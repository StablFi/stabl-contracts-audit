// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockMeshToken is MintableERC20 {
    constructor() ERC20("MeshToken", "MeshToken") {}
}
