// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Chama} from "./Chama.sol";

/// @title ChamaFactory — single deployer for many concurrent chamas
/// @notice Permissionless: any wallet can create a chama. Token and agent
///         are fixed per factory deployment so members and operators have
///         a predictable target to authorize.
contract ChamaFactory {
    address public immutable token;
    address public immutable agent;

    address[] private _chamas;
    mapping(address => address[]) private _createdBy;
    mapping(address => uint256) public createdAt;

    event ChamaCreated(
        address indexed creator,
        address indexed chama,
        address[] members,
        uint256 contribution,
        uint256 cycleLength,
        uint256 openTimeout,
        uint256 index
    );

    error InvalidConfig();

    constructor(address token_, address agent_) {
        if (token_ == address(0) || agent_ == address(0)) revert InvalidConfig();
        token = token_;
        agent = agent_;
    }

    function createChama(
        address[] memory members,
        uint256 contribution,
        uint256 cycleLength,
        uint256 openTimeout
    ) external returns (address) {
        Chama chama = new Chama(token, agent, members, contribution, cycleLength, openTimeout);
        address addr = address(chama);
        uint256 idx = _chamas.length;
        _chamas.push(addr);
        _createdBy[msg.sender].push(addr);
        createdAt[addr] = block.timestamp;
        emit ChamaCreated(msg.sender, addr, members, contribution, cycleLength, openTimeout, idx);
        return addr;
    }

    function chamasCount() external view returns (uint256) {
        return _chamas.length;
    }

    function chamaAt(uint256 index) external view returns (address) {
        return _chamas[index];
    }

    /// @notice Reverse-chronological page; useful for "latest N chamas" UI.
    function latestChamas(uint256 limit) external view returns (address[] memory out) {
        uint256 n = _chamas.length;
        uint256 take = limit > n ? n : limit;
        out = new address[](take);
        for (uint256 i = 0; i < take; i++) {
            out[i] = _chamas[n - 1 - i];
        }
    }

    function chamasOf(address creator) external view returns (address[] memory) {
        return _createdBy[creator];
    }
}
