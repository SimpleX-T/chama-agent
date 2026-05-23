// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Testnet stand-in for cUSD. Public mint so test wallets can self-fund.
///      On mainnet, swap for the real cUSD at 0x765DE816845861e75A25fCA122bb6898B8B1282a.
contract MockCUSD is ERC20 {
    constructor() ERC20("Mock Celo Dollar", "mcUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
