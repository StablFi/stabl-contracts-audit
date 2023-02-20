// SPDX-License-Identifier: MIT
pragma solidity  ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { StableMath } from "../utils/StableMath.sol";
import  "./../connectors/curve/CurveStuff.sol";
import "../utils/Helpers.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { ICurveCalculator } from "../interfaces/ICurveCalculator.sol";

import "hardhat/console.sol";
abstract contract MiniCurveExchange {
    using OvnMath for uint256;
    using StableMath for uint256;
    using SafeMath for uint256;
    
    function swap(
        address _curvePool,
        address _fromToken,
        address _toToken,
        uint256 _amount,
        address _oracleRouter
    ) internal returns (uint256) {
        _checkPoolBalances(_curvePool);
        IERC20(_fromToken).approve(
            _curvePool,
            _amount
        );
        console.log("Slippage:", _convert(IOracle(_oracleRouter), _fromToken, _toToken, _amount).subBasisPoints(30));
        uint256 _returned =  IStableSwapPool(_curvePool).exchange_underlying(
            _getTokenIndex(_fromToken),
            _getTokenIndex(_toToken),
            _amount,
            _convert(IOracle(_oracleRouter), _fromToken, _toToken, _amount).subBasisPoints(30) // 0.3% slippage
        );
        console.log("Swap Tokens: %s %s" , _fromToken, _toToken);
        console.log("Amounts: %s -> %s " , _amount, _returned);
        return _returned;
    }
    
    function swapTillSatisfied(
        address _curvePool,
        address _fromToken,
        address _toToken,
        uint256 _amount,
        uint256 _min, 
        uint256 _max,
        uint256 _step
    ) internal returns (uint256) {
        _checkPoolBalances(_curvePool);
        IERC20(_fromToken).approve(
            _curvePool,
            _amount
        );
        require(_amount <= _max, "Amount too high");
        uint256 _returned = 0;
        try IStableSwapPool(_curvePool).exchange_underlying(
            _getTokenIndex(_fromToken),
            _getTokenIndex(_toToken),
            _amount,
            _min
        ) returns (uint256 __returned) {
            _returned = __returned;
        } catch  {
            console.log("swapTillSatisfied - Retrying with _amount", _amount.addBasisPoints(_step));
            return swapTillSatisfied(_curvePool, _fromToken, _toToken, _amount.addBasisPoints(_step), _min, _max, _step);
        }
        console.log("Swap Tokens: %s %s" , _fromToken, _toToken);
        console.log("Amounts: %s -> %s " , _amount, _returned);
        return _returned;
    }

    function _checkPoolBalances(address _curvePool) internal view {
        uint256 _dai = IStableSwapPool(_curvePool).balances(0);
        uint256 _usdc = IStableSwapPool(_curvePool).balances(1);
        uint256 _usdt = IStableSwapPool(_curvePool).balances(2);
        if (_dai < 10**(5+18) || _usdc < 10**(5+6) || _usdt < 10**(5+6)) {
            revert("CRV_EM");
        }

    }
    function _getTokenIndex(address _token) internal pure returns (int128) {
        if (_token == address(0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063)) {
            return 0;
        } else if  (_token == address(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)) {
            return 1;
        } else if (_token == address(0xc2132D05D31c914a87C6611C10748AEb04B58e8F)) {
            return 2;
        }
        revert("CRV_NS");
    }
    function _convert(IOracle _router, address _from, address _to, uint256 _amount) internal view returns (uint256) {
        if (_from == _to) {
            return _amount;
        }
        uint256 _fromPrice = _router.price(_from);
        uint256 _toPrice = _router.price(_to);
        uint256 _cAmount = _amount.mul(_fromPrice).div(_toPrice);
        return _cAmount.scaleBy(Helpers.getDecimals(_to), Helpers.getDecimals(_from));
    }
    function onSwap(
        address _curvePool,
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) internal view returns (uint256) {
        _checkPoolBalances(_curvePool);
        
        return IStableSwapPool(_curvePool).get_dy_underlying(
            _getTokenIndex(_fromToken),
            _getTokenIndex(_toToken),
            _amount
        );
    }
    function _howMuchToSwapData(address _curvePool) internal view returns (uint256[3] memory _balances, uint256[3] memory _rates, uint256 _fee, uint256 _a) {
        _balances[0]= (IStableSwapPool(_curvePool).balances(0));
        _balances[1] =(IStableSwapPool(_curvePool).balances(1));
        _balances[2] = (IStableSwapPool(_curvePool).balances(2));

        _rates[0]= (1000000000000000000);
        _rates[1]= (1000000000000000000);
        _rates[2]= (1000000000000000000);


        _fee = IStableSwapPool(_curvePool).fee();
        _a = IStableSwapPool(_curvePool).A();

    }
    function howMuchToSwap(
        address _curvePool,
        address _fromToken,
        address _toToken,
        uint256 _amountToGet
    ) internal view returns (uint256) {
        _checkPoolBalances(_curvePool);
        (uint256[3] memory _balances, uint256[3] memory _rates, uint256 _fee, uint256 _a) = _howMuchToSwapData(_curvePool);
        (int128 _i, int128 _j) = (_getTokenIndex(_fromToken),  _getTokenIndex(_toToken));
        return ICurveCalculator(0x83036f6C6aA9512C4e9f27462069674870B320eA).get_dx_stable(_balances,_a,_fee,_rates,_i,_j,_amountToGet);
    }
}