// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SelfVerificationRoot} from "@selfxyz/contracts/contracts/abstract/SelfVerificationRoot.sol";
import {ISelfVerificationRoot} from "@selfxyz/contracts/contracts/interfaces/ISelfVerificationRoot.sol";
import {SelfStructs} from "@selfxyz/contracts/contracts/libraries/SelfStructs.sol";
import {SelfUtils} from "@selfxyz/contracts/contracts/libraries/SelfUtils.sol";
import {IIdentityVerificationHubV2} from "@selfxyz/contracts/contracts/interfaces/IIdentityVerificationHubV2.sol";

/// @title ChamaVerifier — Self Protocol verification consumer for ChamaAgent
/// @notice Registers a verification config with the Self Identity Verification Hub
///         and records the set of addresses that have produced a valid proof of
///         humanity. The Chama escrow contract (next step) can read `verified`
///         to gate membership trustlessly.
///
/// @dev Frontend integration:
///       - `endpoint` should be set to this contract's deployed address
///       - `scope` (in SelfAppBuilder) should be the same `scopeSeed` passed
///         to this constructor; the SDK + this contract independently compute
///         the Poseidon hash of (address, scopeSeed) so they line up.
///       - `disclosures` must match the on-chain config exactly.
contract ChamaVerifier is SelfVerificationRoot {
    SelfStructs.VerificationConfigV2 public verificationConfig;
    bytes32 public verificationConfigId;

    mapping(address => bool) public verified;
    mapping(address => uint256) public verifiedAt;

    uint256 public verifiedCount;

    event Verified(address indexed user, uint256 timestamp);

    constructor(
        address hubV2,
        string memory scopeSeed,
        SelfUtils.UnformattedVerificationConfigV2 memory config
    ) SelfVerificationRoot(hubV2, scopeSeed) {
        verificationConfig = SelfUtils.formatVerificationConfigV2(config);
        verificationConfigId = IIdentityVerificationHubV2(hubV2).setVerificationConfigV2(verificationConfig);
    }

    function customVerificationHook(
        ISelfVerificationRoot.GenericDiscloseOutputV2 memory output,
        bytes memory /* userData */
    ) internal override {
        address user = address(uint160(output.userIdentifier));
        if (!verified[user]) {
            verified[user] = true;
            verifiedAt[user] = block.timestamp;
            unchecked {
                verifiedCount++;
            }
            emit Verified(user, block.timestamp);
        }
    }

    function getConfigId(
        bytes32, /* destinationChainId */
        bytes32, /* userIdentifier */
        bytes memory /* userDefinedData */
    ) public view override returns (bytes32) {
        return verificationConfigId;
    }
}
