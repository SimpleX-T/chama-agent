// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Chama — trustless rotating savings (ROSCA) on Celo
/// @notice One contract instance = one chama. N members each contribute a fixed
///         amount of `token` per cycle; the cycle's full pot is paid out to one
///         member in a fixed rotation, one member per cycle, until all have been paid.
/// @dev Every cycle has two phases:
///        1. OPEN — the contract is collecting contributions; no countdown is
///           ticking. The cycle waits indefinitely for all members to pay in.
///        2. ACTIVE — triggered automatically when the last member contributes.
///           A `cycleLength`-long timer starts. Once it elapses, `executePayout`
///           can be called by anyone to push the pot to that cycle's payee and
///           advance.
///      Both `contributeFor` and `executePayout` are permissionless. The agent
///      address is stored as event metadata only.
contract Chama {
    IERC20 public immutable token;
    address public immutable agent;
    uint256 public immutable contribution;
    uint256 public immutable cycleLength;
    /// @notice How long a cycle can stay in OPEN phase before anyone may
    ///         force-advance with whatever was collected. 0 = no force
    ///         advance (chama waits indefinitely for all contributions).
    uint256 public immutable openTimeout;
    /// @notice How many times the pot rotates through every member. The
    ///         chama's total number of cycles is `members.length * rounds`.
    ///         At round boundaries, the payee rotation loops back to
    ///         member[0] — members who want to leave just stop contributing.
    uint256 public immutable rounds;
    /// @notice Block timestamp at construction. Informational only.
    uint256 public immutable startTime;

    address[] private _members;
    mapping(address => bool) public isMember;
    mapping(uint256 => mapping(address => bool)) public contributed;
    mapping(uint256 => uint256) public cycleContributions;
    uint256 public currentCycle;

    /// @notice The current cycle's own clock. Set in constructor, reset on
    ///         each advance. Force-advance unlocks at
    ///         `currentCycleOpenAt + openTimeout` (when openTimeout > 0).
    uint256 public currentCycleOpenAt;
    /// @notice 0 = current cycle is in OPEN phase (collecting contributions).
    ///         >0 = ACTIVE phase began at this timestamp; payout unlocks at
    ///         `currentCycleActiveAt + cycleLength`.
    uint256 public currentCycleActiveAt;

    event Contributed(address indexed member, uint256 indexed cycle, uint256 amount);
    event CycleActivated(uint256 indexed cycle, uint256 timestamp);
    event Defaulted(address indexed member, uint256 indexed cycle);
    event PayoutExecuted(address indexed payee, uint256 indexed cycle, uint256 amount);
    event CycleAdvanced(uint256 indexed newCycle);
    event ChamaCompleted();

    error NotMember(address who);
    error AlreadyContributed();
    error ActivePhaseNotElapsed();
    error OpenTimeoutNotElapsed();
    error OpenTimeoutDisabled();
    error ChamaAlreadyCompleted();
    error InvalidConfig();
    error DuplicateMember(address who);

    constructor(
        address token_,
        address agent_,
        address[] memory members_,
        uint256 contribution_,
        uint256 cycleLength_,
        uint256 openTimeout_,
        uint256 rounds_
    ) {
        if (
            members_.length < 2 ||
            contribution_ == 0 ||
            cycleLength_ == 0 ||
            rounds_ == 0
        ) revert InvalidConfig();
        token = IERC20(token_);
        agent = agent_;
        contribution = contribution_;
        cycleLength = cycleLength_;
        openTimeout = openTimeout_; // 0 = no force-advance possible
        rounds = rounds_;
        startTime = block.timestamp;
        currentCycleOpenAt = block.timestamp;
        for (uint256 i = 0; i < members_.length; i++) {
            address m = members_[i];
            if (isMember[m]) revert DuplicateMember(m);
            isMember[m] = true;
            _members.push(m);
        }
    }

    /// @notice Permissionless: pull one cycle's contribution from `member`.
    ///         Anyone can call; the contract only debits if `member` has
    ///         pre-approved this contract for at least `contribution` cUSD.
    ///         The contribution that completes the cycle's member set
    ///         transitions the cycle from OPEN to ACTIVE and starts the
    ///         `cycleLength` timer.
    function contributeFor(address member) external {
        if (!isMember[member]) revert NotMember(member);
        if (currentCycle >= _members.length * rounds) revert ChamaAlreadyCompleted();
        if (contributed[currentCycle][member]) revert AlreadyContributed();

        contributed[currentCycle][member] = true;
        cycleContributions[currentCycle] += contribution;
        emit Contributed(member, currentCycle, contribution);

        require(token.transferFrom(member, address(this), contribution), "transferFrom failed");

        // Last contribution flips the cycle to ACTIVE — but the payout doesn't
        // fire until the `cycleLength` timer elapses.
        if (cycleContributions[currentCycle] == contribution * _members.length) {
            currentCycleActiveAt = block.timestamp;
            emit CycleActivated(currentCycle, block.timestamp);
        }
    }

    /// @notice Permissionless: deliver the cycle's pot to its payee.
    ///         Reverts unless either:
    ///           a) ACTIVE path — last contribution flipped the cycle to
    ///              ACTIVE and the `cycleLength` timer has elapsed, OR
    ///           b) FORCE-ADVANCE path — `openTimeout` was configured > 0 at
    ///              construction and the cycle has stayed in OPEN phase
    ///              longer than that. The partial pot (only whatever was
    ///              contributed) goes to the slot's payee; non-contributors
    ///              are surfaced via Defaulted events.
    ///         If the payee themselves defaulted, they still receive the
    ///         partial pot — the contract just enforces the rotation. Social
    ///         layer handles fairness beyond that.
    function executePayout() external {
        uint256 cycle = currentCycle;
        uint256 total = _members.length * rounds;
        if (cycle >= total) revert ChamaAlreadyCompleted();
        uint256 activeAt = currentCycleActiveAt;

        if (activeAt > 0) {
            // ACTIVE path
            if (block.timestamp < activeAt + cycleLength) revert ActivePhaseNotElapsed();
        } else {
            // FORCE-ADVANCE path
            if (openTimeout == 0) revert OpenTimeoutDisabled();
            if (block.timestamp < currentCycleOpenAt + openTimeout) revert OpenTimeoutNotElapsed();
            for (uint256 i = 0; i < _members.length; i++) {
                if (!contributed[cycle][_members[i]]) emit Defaulted(_members[i], cycle);
            }
        }

        // Payee rotates through every member, wrapping around on each new round.
        address payee = _members[cycle % _members.length];
        uint256 pot = cycleContributions[cycle];

        currentCycle = cycle + 1;
        currentCycleActiveAt = 0;
        currentCycleOpenAt = block.timestamp;
        emit PayoutExecuted(payee, cycle, pot);
        emit CycleAdvanced(currentCycle);
        if (currentCycle == total) emit ChamaCompleted();

        if (pot > 0) require(token.transfer(payee, pot), "transfer failed");
    }

    function members() external view returns (address[] memory) {
        return _members;
    }

    function memberCount() external view returns (uint256) {
        return _members.length;
    }

    function currentPayee() external view returns (address) {
        if (currentCycle >= _members.length * rounds) return address(0);
        return _members[currentCycle % _members.length];
    }

    /// @notice Total cycles this chama will run before completion.
    function totalCycles() external view returns (uint256) {
        return _members.length * rounds;
    }

    /// @notice The current round index (0-based). Round 0 is the first
    ///         rotation through all members; round `rounds-1` is the last.
    function currentRound() external view returns (uint256) {
        return currentCycle / _members.length;
    }

    /// @notice Returns the next timestamp at which `executePayout()` will
    ///         succeed:
    ///         - During ACTIVE phase: `currentCycleActiveAt + cycleLength`
    ///         - During OPEN phase with openTimeout > 0:
    ///           `currentCycleOpenAt + openTimeout` (force-advance)
    ///         - During OPEN phase with openTimeout = 0: returns 0
    ///           (chama waits indefinitely for all contributions)
    ///         - When completed: returns 0
    function cycleDeadline() external view returns (uint256) {
        if (currentCycle >= _members.length * rounds) return 0;
        if (currentCycleActiveAt > 0) return currentCycleActiveAt + cycleLength;
        if (openTimeout == 0) return 0;
        return currentCycleOpenAt + openTimeout;
    }

    /// @notice True when the current cycle's collection is complete and the
    ///         countdown is ticking toward payout.
    function isCycleActive() external view returns (bool) {
        return currentCycle < _members.length * rounds && currentCycleActiveAt > 0;
    }
}
