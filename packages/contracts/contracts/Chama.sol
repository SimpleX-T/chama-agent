// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Chama — trustless rotating savings (ROSCA) on Celo
/// @notice One contract instance = one chama. N members each contribute a fixed
///         amount of `token` per cycle; the cycle's full pot is paid out to one
///         member in a fixed rotation, one member per cycle, until all have been paid.
/// @dev Both contributeFor() and executePayout() are permissionless — the contract
///      itself enforces every invariant (one contribution per member per cycle,
///      fixed payout order, no payout before the cycle is ready). The `agent`
///      address is stored as metadata (handy for ERC-8004 attestations and event
///      indexing) but has no special on-chain privilege. If the courtesy agent
///      service is offline, any member — or anyone at all — can call these
///      functions to keep the chama moving.
contract Chama {
    IERC20 public immutable token;
    address public immutable agent;
    uint256 public immutable contribution;
    uint256 public immutable cycleLength;
    uint256 public immutable startTime;

    address[] private _members;
    mapping(address => bool) public isMember;
    mapping(uint256 => mapping(address => bool)) public contributed;
    mapping(uint256 => uint256) public cycleContributions;
    uint256 public currentCycle;

    event Contributed(address indexed member, uint256 indexed cycle, uint256 amount);
    event PayoutExecuted(address indexed payee, uint256 indexed cycle, uint256 amount);
    event CycleAdvanced(uint256 indexed newCycle);
    event Defaulted(address indexed member, uint256 indexed cycle);
    event ChamaCompleted();

    error NotMember(address who);
    error AlreadyContributed();
    error CycleNotReady();
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

    /// @notice Permissionless trigger: pulls one cycle's contribution from `member`.
    /// @dev Anyone can call this; the contract only debits if `member` has
    ///      pre-approved this contract for at least `contribution` cUSD.
    function contributeFor(address member) external {
        if (!isMember[member]) revert NotMember(member);
        if (currentCycle >= _members.length) revert ChamaAlreadyCompleted();
        if (contributed[currentCycle][member]) revert AlreadyContributed();

        contributed[currentCycle][member] = true;
        cycleContributions[currentCycle] += contribution;
        emit Contributed(member, currentCycle, contribution);

        // Effects-before-interactions
        require(token.transferFrom(member, address(this), contribution), "transferFrom failed");
    }

    /// @notice Permissionless: push the cycle's pot to the next-in-line member and advance.
    /// @dev Callable once per cycle by anyone. Requires either all members
    ///      contributed OR the cycle deadline elapsed (in which case the pot
    ///      may be partial — defaulters are surfaced as Defaulted events).
    ///      Removing access control here is safe because the contract enforces
    ///      *who* gets paid (fixed rotation order), *how much* (only what's
    ///      been contributed this cycle), and *when* (only after the cycle is
    ///      ready). The agent address is preserved as event metadata only.
    function executePayout() external {
        uint256 cycle = currentCycle;
        if (cycle >= _members.length) revert ChamaAlreadyCompleted();

        bool allContributed = cycleContributions[cycle] == contribution * _members.length;
        bool deadlinePassed = block.timestamp >= startTime + (cycle + 1) * cycleLength;
        if (!allContributed && !deadlinePassed) revert CycleNotReady();

        if (!allContributed) {
            for (uint256 i = 0; i < _members.length; i++) {
                if (!contributed[cycle][_members[i]]) emit Defaulted(_members[i], cycle);
            }
        }

        address payee = _members[cycle];
        uint256 pot = cycleContributions[cycle];

        currentCycle = cycle + 1;
        emit PayoutExecuted(payee, cycle, pot);
        emit CycleAdvanced(currentCycle);
        if (currentCycle == _members.length) emit ChamaCompleted();

        if (pot > 0) require(token.transfer(payee, pot), "transfer failed");
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

    function cycleDeadline() external view returns (uint256) {
        return startTime + (currentCycle + 1) * cycleLength;
    }
}
