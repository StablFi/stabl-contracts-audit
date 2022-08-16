// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IVault } from "../interfaces/IVault.sol";

import { CASH } from "../token/CASH.sol";

contract MockNonRebasing {
    CASH cash;

    function setCASH(address _cashAddress) public {
        cash = CASH(_cashAddress);
    }

    function rebaseOptIn() public {
        cash.rebaseOptIn();
    }

    function rebaseOptOut() public {
        cash.rebaseOptOut();
    }

    function transfer(address _to, uint256 _value) public {
        cash.transfer(_to, _value);
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public {
        cash.transferFrom(_from, _to, _value);
    }

    function increaseAllowance(address _spender, uint256 _addedValue) public {
        cash.increaseAllowance(_spender, _addedValue);
    }

    function mintCASH(
        address _vaultContract,
        address _asset,
        uint256 _amount
    ) public {
        IVault(_vaultContract).justMint(_asset, _amount, 0);
    }

    function redeemCASH(address _vaultContract, uint256 _amount) public {
        IVault(_vaultContract).redeem(_amount, 0);
    }

    function approveFor(
        address _contract,
        address _spender,
        uint256 _addedValue
    ) public {
        IERC20(_contract).approve(_spender, _addedValue);
    }
}
