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
    /// @notice Block timestamp at construction. Informational only.
    uint256 public immutable startTime;

    address[] private _members;
    mapping(address => bool) public isMember;
    mapping(uint256 => mapping(address => bool)) public contributed;
    mapping(uint256 => uint256) public cycleContributions;
    uint256 public currentCycle;

    /// @notice 0 = current cycle is in OPEN phase (collecting contributions).
    ///         >0 = ACTIVE phase began at this timestamp; payout unlocks at
    ///         `currentCycleActiveAt + cycleLength`.
    uint256 public currentCycleActiveAt;

    event Contributed(address indexed member, uint256 indexed cycle, uint256 amount);
    event CycleActivated(uint256 indexed cycle, uint256 timestamp);
    event PayoutExecuted(address indexed payee, uint256 indexed cycle, uint256 amount);
    event CycleAdvanced(uint256 indexed newCycle);
    event ChamaCompleted();

    error NotMember(address who);
    error AlreadyContributed();
    error CycleNotActive();
    error ActivePhaseNotElapsed();
    error ChamaAlreadyCompleted();
    error InvalidConfig();
    error DuplicateMember(address who);

    constructor(
        address token_,
        address agent_,
        address[] memory members_,
        uint256 contribution_,
        uint256 cycleLength_
    ) {
        if (members_.length < 2 || contribution_ == 0 || cycleLength_ == 0) revert InvalidConfig();
        token = IERC20(token_);
        agent = agent_;
        contribution = contribution_;
        cycleLength = cycleLength_;
        startTime = block.timestamp;
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
        if (currentCycle >= _members.length) revert ChamaAlreadyCompleted();
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

    /// @notice Permissionless: deliver the active cycle's pot to its payee.
    ///         Reverts unless the cycle has entered the ACTIVE phase AND the
    ///         `cycleLength` timer has elapsed. The contract enforces the
    ///         payout order, amount, and timing — gating the caller adds
    ///         nothing.
    function executePayout() external {
        uint256 cycle = currentCycle;
        if (cycle >= _members.length) revert ChamaAlreadyCompleted();
        uint256 activeAt = currentCycleActiveAt;
        if (activeAt == 0) revert CycleNotActive();
        if (block.timestamp < activeAt + cycleLength) revert ActivePhaseNotElapsed();

        address payee = _members[cycle];
        uint256 pot = cycleContributions[cycle];

        currentCycle = cycle + 1;
        currentCycleActiveAt = 0; // next cycle re-enters OPEN
        emit PayoutExecuted(payee, cycle, pot);
        emit CycleAdvanced(currentCycle);
        if (currentCycle == _members.length) emit ChamaCompleted();

        require(token.transfer(payee, pot), "transfer failed");
    }

    function members() external view returns (address[] memory) {
        return _members;
    }

    function memberCount() external view returns (uint256) {
        return _members.length;
    }

    function currentPayee() external view returns (address) {
        if (currentCycle >= _members.length) return address(0);
        return _members[currentCycle];
    }

    /// @notice Returns 0 if the current cycle is in OPEN phase (no countdown
    ///         yet). Otherwise returns the absolute timestamp at which the
    ///         active phase elapses and payout becomes callable.
    function cycleDeadline() external view returns (uint256) {
        if (currentCycleActiveAt == 0) return 0;
        return currentCycleActiveAt + cycleLength;
    }

    /// @notice True when the current cycle's collection is complete and the
    ///         countdown is ticking toward payout.
    function isCycleActive() external view returns (bool) {
        return currentCycle < _members.length && currentCycleActiveAt > 0;
    }
}
