// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockMeshSwapUniPoolLP is MintableERC20 {
    constructor() ERC20("MockMeshSwapUniPoolLP", "MockMeshSwapUniPoolLP") {}
    function depositToken(uint256 _amount) external {
        
    }
    function withdrawToken(uint256 _amount) external {
        
    }
}
