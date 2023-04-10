// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title CASH Vault Contract
 * @notice The Vault contract stores assets. On a deposit, CASH will be minted
           and sent to the depositor. On a withdrawal, CASH will be burned and
           assets will be sent to the withdrawer. The Vault accepts deposits of
           interest from yield bearing strategies which will modify the supply
           of CASH.
 * @author Stabl Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import { StableMath } from "../utils/StableMath.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IVaultAdmin } from "../interfaces/IVaultAdmin.sol";
import "../exchanges/MiniCurveExchange.sol";
import "./VaultStorage.sol";
import "hardhat/console.sol";

contract VaultCore is VaultStorage, MiniCurveExchange {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using SafeMath for uint256;
    using OvnMath for uint256;

    uint256 constant MAX_UINT = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;


    /**
     * @dev Verifies that the deposits are not paused.
     */
    modifier whenNotCapitalPaused() {
        require(!capitalPaused, "Capital paused");
        _;
    }
    modifier onlyVault() {
        require(msg.sender == address(this), "!VAULT");
        _;
    }
    modifier onlyGovernorOrDripperOrRebaseManager() {
        require(
            isGovernor() || rebaseManagers[msg.sender] || (msg.sender == dripperAddress),
            "Caller is not the Governor or Rebase Manager or Dripper"
        );
        _;
    }

    /**
     * @dev Deposit a supported asset to the Vault and mint CASH. Asset will be swapped to 
            the PS and allocated to Quick Deposit Strategies
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited (decimals based on _asset)
     * @param _minimumCASHAmount Minimum CASH to mint (1e18)
     */
    function mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumCASHAmount
    ) external whenNotCapitalPaused nonReentrant {
        _mint(_asset, _amount, _minimumCASHAmount);
    }

    /**
     * @dev Deposit a supported asset to the Vault and mint CASH.
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited (decimals based on _asset)
     * @param _minimumCASHAmount Minimum CASH to mint (1e18)
     */
    function _mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumCASHAmount
    ) internal {
        require(assets[_asset].isSupported, "NS");
        require(_amount > 0, ">0");
        
        for(uint256 i = 0; i < allAssets.length; i++) {
            validateAssetPeg(allAssets[i], depegMargin); // 1% = 100
        }

        // Prequisites
        IERC20 _assetToken = IERC20(_asset);
        uint256 _assetDecimals = Helpers.getDecimals(_asset);

        uint256 _initNav = nav();
        _assetToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Precalculate mint fee and toUseAsset
        uint256 _toUseAsset = _amount;
        if ((mintFeeBps > 0) && (treasuryAddress != address(0))) {
            uint256 _mintFee = _amount.mul(mintFeeBps).div(10000);
            _toUseAsset = _toUseAsset.sub(_mintFee);
            _assetToken.safeTransfer(treasuryAddress, _mintFee);
            emit TreasuryRemitted(_asset, _mintFee);

        }
        uint256 _toMintCASH = _toUseAsset.scaleBy(18, _assetDecimals);
        IVaultAdmin(address(this)).balance();

        uint256 _change = nav().subOrZero(_initNav);
        require(_change > 0, "NO_DIFF_IN_NAV");
        console.log("PRICE", price());
        console.log("NAV_CHANGE", _change);
        uint256 _toMintBasedOnPrice = _change.scaleBy(18, 8).mul(10**18).div(price());
        console.log("MINT_BASED_ON_PRICE", _toMintBasedOnPrice);

        

        // Choose whichever is lower in value
        uint256 _mintAmount = _toMintBasedOnPrice < _toMintCASH ? _toMintBasedOnPrice : _toMintCASH;
        require(_mintAmount >= _minimumCASHAmount, "Mint amount lower than minimum");
        cash.mint(msg.sender, _mintAmount);

        lastMints[msg.sender] = block.number;
        emit Mint(msg.sender, _mintAmount);
    }


    /**
     * @dev Withdraw a supported asset and burn CASH.
     * @param _amount Amount of CASH to burn
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function redeem(uint256 _amount, uint256 _minimumUnitAmount) external whenNotCapitalPaused nonReentrant {
        _redeem(_amount, _minimumUnitAmount);
    }

    /**
     * @dev Withdraw the PS against CASH and burn CASH.
     * @param _amount Amount of CASH to burn
     * @param _minimumUsd Minimum usd worth of returns.
     */
    function _redeem(uint256 _amount, uint256 _minimumUsd) internal {
        require(_amount > 0, "!AMOUNT");
        require(cash.balanceOf(msg.sender) >= _amount, "INSUF_CASH");
        require(block.number > lastMints[msg.sender], "WAIT_AFTER_MINT");

        uint256 _initNav = nav();

        bool doRebalance = true;
        for(uint256 i = 0; i < allAssets.length; i++) {
            uint256 _price = IOracle(priceProvider).price(allAssets[i]);
            if (_price > (10**8 * (10000-depegMargin))/10000) {
                doRebalance = false;
                break;
            }
        }
        if (doRebalance) {
            IVaultAdmin(address(this)).balance();
        }
        uint256 _deficitDueToRebalance = _initNav.subOrZero(nav()).scaleBy(18, 8).mul(10**18).div(price()); // 18 decimals
        uint256 _worthInUsd = (_amount.sub(_deficitDueToRebalance)).mul(price()).div(10**18).scaleBy(8, 18); // USD is 8 decimals
        if (_worthInUsd.scaleBy(18, 8) > _amount) {
            _worthInUsd = _amount.scaleBy(8, 18);
        }
        require(_worthInUsd > 0, "NOTHING_TO_REDEEM");
        require(_minimumUsd <= _worthInUsd, "MINIMUM_NOT_MET");

        uint256[] memory returnAssetAmounts = new uint256[](allAssets.length); // !NOT USD
        (returnAssetAmounts[0], returnAssetAmounts[1], returnAssetAmounts[2]) = _arrangeUsd(_worthInUsd); // DAI, USDT, USDC amounts
        
        uint256 _checkWorthInUSD = _calculateWorth(returnAssetAmounts); 
        require(_checkWorthInUSD >= _worthInUsd.mul(995).div(1000) || _checkWorthInUSD <= _worthInUsd.mul(1005).div(1000), "WORTH_NOT_MET"); // 0.5% tolerance

        // Loop through all assets and transfer to user and treasury
        for (uint256 i = 0; i < allAssets.length; i++) {
            if (returnAssetAmounts[i] > 0) {
                require(assets[allAssets[i]].isSupported, "NS"); // Make sure all assets are supported.
                if (redeemFeeBps > 0) {
                    uint256 _redeemFee = returnAssetAmounts[i].mul(redeemFeeBps).div(10000);
                    returnAssetAmounts[i] = returnAssetAmounts[i].sub(_redeemFee);
                    IERC20(allAssets[i]).safeTransfer(treasuryAddress, _redeemFee);
                    emit TreasuryRemitted(allAssets[i], _redeemFee);
                }
                IERC20(allAssets[i]).safeTransfer(msg.sender, returnAssetAmounts[i]);
            }
        }

        cash.burn(msg.sender, _amount);
        emit Redeem(msg.sender, _amount);
    }
    /**
     * @dev Calculate the worth in USD using the _amounts [DAI, USDT, USDC] array.
     */
    function _calculateWorth(uint256[] memory _amounts) internal view returns (uint256) {
        uint256 _worth = 0;
        for (uint256 i = 0; i < allAssets.length; i++) {
            if (_amounts[i] > 0) {
                uint256 _dec = Helpers.getDecimals(allAssets[i]);
                uint256 _a = _amounts[i];
                if (_dec > 6) {
                    _a  = _a.scaleBy(6, _dec);
                }
                _worth = _worth.add(IOracle(priceProvider).price(allAssets[i]) * _a);
            }
        }
        return _worth.scaleBy(8, 6); // USD is 8 decimals
    }
    /**
     * @dev Function to arrange USD equivalent of _usdToWithdraw from the strategies.
     */
    function _arrangeUsd(uint256 _usdToWithdraw) internal returns (uint256, uint256, uint256) {
        uint256 _asset0 = 0; // DAI
        uint256 _asset1 = 0; // USDT
        uint256 _asset2 = 0; // USDC

        uint256 _a0 = 0;
        uint256 _a1 = 0;
        uint256 _a2 = 0;

        for(uint8 i = 0; i < strategyWithWeights.length; i++) {
            uint256 _usdToWithdrawFromStrategy = _usdToWithdraw.mul(strategyWithWeights[i].targetWeight).div(TOTAL_WEIGHT);
            if(_usdToWithdrawFromStrategy > 0) {
                (_a0, _a1, _a2) = IStrategy(strategyWithWeights[i].strategy).withdrawUsd(_usdToWithdrawFromStrategy);
                _asset0 = _asset0.add(_a0);
                _asset1 = _asset1.add(_a1);
                _asset2 = _asset2.add(_a2);
            }
        }
        return (_asset0, _asset1, _asset2); // DAI, USDT, USDC [Not in USD!]
    }
    /**
     * @dev Check if the asset is not too below the peg.
     */
    function validateAssetPeg(address _asset, uint256 bps) public view returns (uint256) {
        uint256 _price = IOracle(priceProvider).price(_asset);
        require(_price > (10**8 * (10000-bps))/10000, "ASSET_BELOW_PEG");
        require(_price < (10**8 * (10000+bps))/10000, "ASSET_ABOVE_PEG");
        return _price;
    }

    /**
     * @notice Withdraw PS against all the sender's CASH.
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function redeemAll(uint256 _minimumUnitAmount) external whenNotCapitalPaused nonReentrant {
        _redeem(cash.balanceOf(msg.sender), _minimumUnitAmount);
    }

    /**
     * @notice Calculate the amoount of mix, the user would get.
     * @param _cashAmount The CASH amount to burn.
     */
    function calculateRedeemOutput(uint256 _cashAmount) external view  returns (uint256, uint256, uint256) {
        uint256 _worthInUsd = _cashAmount.mul(price()).div(10**18).scaleBy(8, 18); // USD is 8 decimals
        if (_worthInUsd.scaleBy(18, 8) > _cashAmount) {
            _worthInUsd = _cashAmount.scaleBy(8, 18);
        }
        require(_worthInUsd > 0, "NOTHING_TO_REDEEM");
        return _calculateUSDOutput(_worthInUsd); // DAI, USDT, USDC amounts
    }
    /**
     * @dev Function to arrange USD equivalent of _usdToWithdraw from the strategies.
     */
    function _calculateUSDOutput(uint256 _usdToWithdraw) internal view returns (uint256, uint256, uint256) {
        uint256 _asset0 = 0; // DAI
        uint256 _asset1 = 0; // USDT
        uint256 _asset2 = 0; // USDC

        uint256 _a0 = 0;
        uint256 _a1 = 0;
        uint256 _a2 = 0;

        for(uint8 i = 0; i < strategyWithWeights.length; i++) {
            uint256 _usdToWithdrawFromStrategy = _usdToWithdraw.mul(strategyWithWeights[i].targetWeight).div(TOTAL_WEIGHT);
            if(_usdToWithdrawFromStrategy > 0) {
                (_a0, _a1, _a2) = IStrategy(strategyWithWeights[i].strategy).calculateUsd(_usdToWithdrawFromStrategy);
                _asset0 = _asset0.add(_a0);
                _asset1 = _asset1.add(_a1);
                _asset2 = _asset2.add(_a2);
            }
        }
        return (_asset0, _asset1, _asset2); // DAI, USDT, USDC [Not in USD!]
    }
    /**

    /**
     * @notice Get the USD balance of an asset held in Vault and all strategies.
     * @return _balance Balance of whole vault in USD
     */
    function checkBalance() external view returns (uint256) {
        return _checkBalance();
    }
    /**
     * @dev Calculate the USD worth of available assets in the Vault
     */
    function vaultNav() public view returns (uint256 _balance) {
        for (uint256 i = 0; i < allAssets.length; i++) {
            require(assets[allAssets[i]].isSupported, "NS"); // Make sure all assets are supported.
            _balance = _balance.add(_inUsd(allAssets[i], IERC20(allAssets[i]).balanceOf(address(this))));
        }
    }
    /**
     * @notice Get the USD balance of an asset held in Vault and all strategies.
     * @return _balance Balance of whole vault in USD
     */
    function _checkBalance() virtual internal view returns (uint256 _balance) {
        _balance = vaultNav();
        for (uint256 i = 0; i < strategyWithWeights.length; i++) {
            if (strategies[ strategyWithWeights[i].strategy].isSupported == false) {
                continue;
            }
            require(strategyWithWeights[i].enabled == true, "DIS_WGT");
            try IStrategy(strategyWithWeights[i].strategy).netAssetValue() returns (uint256 _bal) {
                _balance = _balance.add(_bal);

            } catch {
                console.log("NAV_FAILED", strategyWithWeights[i].strategy);
            }
        }
    }
    /**
     * @notice Get the USD balance of an asset held in Vault and all strategies.
     * @return _balance Balance of whole vault in USD
     */
    function nav() public view returns (uint256) {
        return _checkBalance();
    }

    /**
     * @dev Read and return the CASH total supply
     * @return value Total CASH supply (1e18)
     */
    function ncs() public view returns (uint256) {
        return cash.totalSupply();
    }

    function _inUsd(address _asset, uint256 _amount) internal view returns (uint256) {
        return IOracle(priceProvider).price(_asset) * _amount / (10**Helpers.getDecimals(_asset));
    }

    /********************************
                Swapping
    *********************************/
    /**
     * @dev Swapping one asset to another using the Swapper present inside Vault
     * @param tokenFrom address of token to swap from
     * @param tokenTo address of token to swap to
     */
    function _swapAsset(
        address tokenFrom,
        address tokenTo,
        uint256 _amount
    ) internal returns (uint256) {
        require(swappingPool != address(0), "Empty Swapper Address");
        if ((tokenFrom != tokenTo) && (_amount > 0)) {
            return swap(swappingPool, tokenFrom, tokenTo, _amount, priceProvider);
        }
        return IERC20(tokenFrom).balanceOf(address(this));
    }

    function _swapAsset(address tokenFrom, address tokenTo) internal returns (uint256) {
        return _swapAsset(tokenFrom, tokenTo, IERC20(tokenFrom).balanceOf(address(this)));
    }
    function swapAsset(address tokenFrom, address tokenTo, uint256 _amount) external onlyVault returns (uint256) {
        return _swapAsset(tokenFrom, tokenTo, _amount);
    }

    /************************************
     *          Balance Functions        *
     *************************************/

    function _liteBalance(address _asset, uint256 _amount) internal {
        require(IERC20(_asset).balanceOf(address(this)) >= _amount, "RL_BAL_LOW");
        uint256[] memory _stratsAmounts = new uint256[](strategyWithWeights.length);

        for (uint8 i = 0; i < strategyWithWeights.length; i++) {
            IStrategy _thisStrategy = IStrategy(strategyWithWeights[i].strategy);
            // SWeights should be in order as DAI, USDT, USDC to make algo O(n) rather than O(n^2)
            for (uint8 j = 0; j < allAssets.length; j++) {
                if (allAssets[j] == _thisStrategy.token0() && assets[allAssets[j]].isSupported) {
                    uint256 _share = _amount.mul(strategyWithWeights[i].targetWeight).div(100000);
                    _stratsAmounts[i] = (allAssets[j] != _asset) ? _swapAsset(_asset, allAssets[j], _share) : _share;
                    break;
                }
            }
        }
        for (uint8 i = 0; i < strategyWithWeights.length; i++) {
            IStrategy _thisStrategy = IStrategy(strategyWithWeights[i].strategy);
            IERC20(_thisStrategy.token0()).safeTransfer(address(_thisStrategy), _stratsAmounts[i]);
            _thisStrategy.directDeposit();
        }
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Return the price of 1 CASH by dividing net asset vault by CASH total supply.
     */
    function price2() public view returns (uint256) {
        uint256 _totalUsd = 0;
        uint256 _price = 0;
        uint256[] memory _amounts = new uint256[](allAssets.length);

        // Here we are only calculating the dynamic weight allocation of the funds across strats
        for(uint8 i = 0; i < strategyWithWeights.length; i++) {
            (uint256 _a0, uint256 _a1, uint256 _a2) = IStrategy(strategyWithWeights[i].strategy).assetsInUsd();
            _amounts[0] += _a0;
            _amounts[1] += _a1;
            _amounts[2] += _a2;
            _totalUsd  += (_a0 + _a1 + _a2);
        }
        if (_totalUsd == 0) {
            return 10**18;
        }
        // As now we have dynamic weights ( _amounts[i]/_totalUsd ), we can multiply by the asset price
        // to get price2()
        for (uint8 i = 0; i < allAssets.length; i++) {
            _price += (_amounts[i] * IOracle(priceProvider).price(allAssets[i])) / _totalUsd;
        }
        _price = _price.scaleBy(18, 8);
        return _price;
    }

    function price() public view returns (uint256) {
        if (ncs() == 0) {
            return 10**18;
        }
        return nav().scaleBy(18,8) * 10**18 / ncs() ;
    }

    function getAssetIndex(address _asset) public view returns (uint256) {
        for (uint256 i = 0; i < allAssets.length; i++) {
            if (allAssets[i] == _asset) {
                return i;
            }
        }
        revert("Asset not found");
    }
    /**
     * @dev Return the number of assets supported by the Vault.
     */
    function getAssetCount() public view returns (uint256) {
        return allAssets.length;
    }

    /**
     * @dev Return all asset addresses in order
     */
    function getAllAssets() external view returns (address[] memory) {
        return allAssets;
    }

    function getSupportedAssets() external view returns (address[] memory) {
        address[] memory _assets = new address[](allAssets.length);
        uint256 _count = 0;
        for (uint256 i = 0; i < allAssets.length; i++) {
            if (assets[allAssets[i]].isSupported) {
                _assets[_count] = allAssets[i];
                _count++;
            }
        }
        return _assets;
    }

    /**
     * @dev Return the number of strategies active on the Vault.
     */
    function getStrategyCount() external view returns (uint256) {
        return allStrategies.length;
    }

    /**
     * @dev Return the array of all strategies
     */
    function getAllStrategies() external view returns (address[] memory) {
        return allStrategies;
    }

    function isSupportedAsset(address _asset) external view returns (bool) {
        return assets[_asset].isSupported;
    }

    receive() external payable {}

    /**
     * @dev Falldown to the admin implementation
     * @notice This is a catch all for all functions not declared in core
     */
    fallback() external payable {
        bytes32 slot = adminImplPosition;
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), sload(slot), 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
