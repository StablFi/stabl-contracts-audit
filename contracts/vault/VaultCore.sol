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

 * @dev The following are the meaning of abbreviations used in the contracts
        PS: Primary Stable
        PSD: Primary Stable Decimals
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import { StableMath } from "../utils/StableMath.sol";
import { OvnMath } from "../utils/OvnMath.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IVaultAdmin } from "../interfaces/IVaultAdmin.sol";
import { IRebaseHandler } from "../interfaces/IRebaseHandler.sol";
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
     * @dev Verifies that the rebasing is not paused.
     */
    modifier whenNotRebasePaused() {
        require(!rebasePaused, "Rebasing paused");
        _;
    }

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
        require(assetDefaultStrategies[_asset] != address(0), "!QD");
        require(_amount > 0, ">0");

        // Rebase must happen before any transfers occur.
        if (!rebasePaused) {
            _rebase();
        }

        // Prequisites
        IERC20 _assetToken = IERC20(_asset);
        uint256 _assetDecimals = Helpers.getDecimals(_asset);
        uint256 _psDecimals = Helpers.getDecimals(primaryStableAddress);

        // Precalculate mint fee and toUseAsset
        uint256 _mintFee = 0;
        uint256 _toUseAsset = _amount;
        if ((mintFeeBps > 0) && (treasuryAddress != address(0))) {
            _mintFee = _amount.mul(mintFeeBps).div(10000);
            _toUseAsset = _toUseAsset.sub(_mintFee);
        }
        uint256 _toMintCASH = _toUseAsset.scaleBy(18, _assetDecimals);

        console.log("MINT FEE:", _mintFee);
        console.log("TO_USE_ASSET:", _toUseAsset);

        uint256 _liquidationValueBefore = _totalValue();
        _assetToken.safeTransferFrom(msg.sender, address(this), _amount);
        console.log("VAULT BALANCE:", _assetToken.balanceOf(address(this)));

        _liteBalance(_asset, _toUseAsset);
        uint256 _change = _totalValue().subOrZero(_liquidationValueBefore);
        require(_change > 0, "NO_DIFF_IN_LIQ");

        // Send mint fee to treasury if extra
        if (_change > _toUseAsset) {
            console.log("SEND_TO_TREASURY:", _asset, _change - _toUseAsset);
            _assetToken.safeTransfer(treasuryAddress, _change - _toUseAsset);
            emit TreasuryRemitted(_change - _toUseAsset);
        }

        if (_assetToken.balanceOf(address(this)) > 0) {
            console.log("SENDING STRAY TO QD:", _assetToken.balanceOf(address(this)), assetDefaultStrategies[_asset]);
            IERC20 _t0OfQD = IERC20(IStrategy(assetDefaultStrategies[_asset]).token0());
            if (address(_t0OfQD) != _asset) {
                _swapAsset(_asset, address(_t0OfQD), _assetToken.balanceOf(address(this)));
            }
            _t0OfQD.safeTransfer(assetDefaultStrategies[_asset], _t0OfQD.balanceOf(address(this)));
            IStrategy(assetDefaultStrategies[_asset]).directDeposit();
        }

        require(_change.scaleBy(18, _psDecimals) >= _minimumCASHAmount, "Mint amount lower than minimum");
        console.log("TO_MINT_CASH:", _toMintCASH);
        console.log("LV_CHANGE:", _change);

        // Choose whichever is lower in value
        uint256 _mintAmount = _change.scaleBy(18, _psDecimals) < _toMintCASH ? _change.scaleBy(18, _psDecimals) : _toMintCASH;
        console.log("MINT", _mintAmount);

        emit Mint(msg.sender, _mintAmount);
        cash.mint(msg.sender, _mintAmount);
        lastMints[msg.sender] = block.number;
    }

    // In memoriam

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
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function _redeem(uint256 _amount, uint256 _minimumUnitAmount) internal {
        require(_amount > 0, "Amount must be greater than 0");
        require(cash.balanceOf(msg.sender) >= _amount, "Insufficient Amount!");
        require(block.number > lastMints[msg.sender], "Wait after mint");
        (uint256 output, uint256 backingValue, uint256 redeemFee) = _calculateRedeemOutput(_amount);
        require(output > 0, "Nothing to redeem");

        console.log("REDEEM OUTPUT:", output);
        console.log("BACKING VALUE:", backingValue);
        console.log("REDEEM FEE:", redeemFee);

        IERC20 _ps = IERC20(primaryStableAddress);
        uint256 _psDecimals = Helpers.getDecimals(primaryStableAddress);

        // Check that CASH is backed by enough assets
        uint256 _totalSupply = cash.totalSupply();
        if (maxSupplyDiff > 0) {
            // Allow a max difference of maxSupplyDiff% between
            // backing assets value and CASH total supply
            uint256 diff = _totalSupply.divPrecisely(backingValue);
            require((diff > 1e18 ? diff.sub(1e18) : 0) <= maxSupplyDiff, "Backing supply liquidity error");
        }
        if (_minimumUnitAmount > 0) {
            require(output.scaleBy(18, _psDecimals) >= _minimumUnitAmount, "Redeem amount lower than minimum");
        }
        emit Redeem(msg.sender, _amount);

        uint256 _amountToPull = (output + redeemFee).subOrZero(_ps.balanceOf(address(this)));

        // If the Vault itself cannot satisfy the redeem()
        if (_amountToPull > 0) {
            for (uint8 i = 0; i < strategyWithWeights.length; i++) {
                uint256 _pullAmount = _amountToPull.mul(strategyWithWeights[i].targetWeight).div(100000);
                if (IStrategy(strategyWithWeights[i].strategy).checkBalance() < _amountToPull) {
                    // @dev: Check Balance can show somewhat larger value than actual balance at the time of withdraw
                    //       We will compensate it from the redeem fee.
                    _pullAmount = IStrategy(strategyWithWeights[i].strategy).checkBalance().subBasisPoints(1);
                }
                IStrategy(strategyWithWeights[i].strategy).withdraw(address(this), primaryStableAddress, _pullAmount);
            }
        }
        require(_ps.balanceOf(address(this)) >= (output), "Not enough funds anywhere to redeem.");

        if (_amountToPull == 0) {
            _ps.safeTransfer(treasuryAddress, redeemFee);
            emit TreasuryRemitted(redeemFee);
        } else {
            _ps.safeTransfer(treasuryAddress, _ps.balanceOf(address(this)) - output);
            emit TreasuryRemitted(_ps.balanceOf(address(this)) - output);
        }
        require(output <= _amount.scaleBy(_psDecimals, 18), ">_amount");
        _ps.safeTransfer(msg.sender, output);
        cash.burn(msg.sender, _amount);
        amountDueForRebase = amountDueForRebase.add(_amount);

        if (amountDueForRebase > rebaseThreshold && !rebasePaused) {
            _rebase();
        }
    }

    /**
     * @notice Withdraw PS against all the sender's CASH.
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function redeemAll(uint256 _minimumUnitAmount) external whenNotCapitalPaused nonReentrant {
        _redeem(cash.balanceOf(msg.sender), _minimumUnitAmount);
    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of CASH.
     */
    function rebase() external virtual nonReentrant onlyGovernorOrDripperOrRebaseManager {
        _rebase();
    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of CASH, optionally sending a
     *      portion of the yield to the trustee.
     */
    function _rebase() internal whenNotRebasePaused {
        uint256 cashSupply = cash.totalSupply();
        if (cashSupply == 0) {
            return;
        }
        uint256 primaryStableDecimals = Helpers.getDecimals(primaryStableAddress);
        uint256 vaultValue = _checkBalance(true).scaleBy(18, primaryStableDecimals);

        // Only rachet CASH supply upwards
        cashSupply = cash.totalSupply(); // Final check should use latest value
        if (vaultValue > cashSupply) {
            cash.changeSupply(vaultValue);
            if (rebaseHandler != address(0)) {
                IRebaseHandler(rebaseHandler).process();
            }
        }
        amountDueForRebase = 0;
    }

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @return uint256 Balance of asset in decimals of asset
     */
    function checkBalance() external view returns (uint256) {
        return _checkBalance(false);
    }

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @return balance Balance of asset in decimals of asset
     */
    function _checkBalance(bool _nav) internal view virtual returns (uint256 balance) {
        IERC20 asset = IERC20(primaryStableAddress);
        balance = asset.balanceOf(address(this));

        for (uint256 i = 0; i < allStrategies.length; i++) {
            if (strategies[allStrategies[i]].isSupported == false) {
                continue;
            }
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (_nav) {
                try strategy.netAssetValue() returns (uint256 _bal) {
                    balance = balance.add(_bal);
                } catch {
                    console.log("NAV_FAILED", allStrategies[i]);
                }
            } else {
                balance = balance.add(strategy.checkBalance());
            }
        }
    }

    /**
     * @dev Determine the total value of assets held by the vault and its
     *         strategies.
     * @return value Total value in PS
     */
    function totalValue() external view virtual returns (uint256 value) {
        value = _totalValue();
    }

    /**
     * @dev Internal Calculate the total value of the assets held by the
     *         vault and its strategies.
     * @return value Total value in PS
     */
    function _totalValue() internal view virtual returns (uint256 value) {
        return _checkBalance(false);
    }

    /**
     * @dev Calculate the net asset value of the assets held by the
     *         vault and its strategies.
     * @return value Total value in PS
     */
    function nav() public view returns (uint256) {
        return _checkBalance(true);
    }

    /**
     * @dev Read and return the CASH total supply
     * @return value Total CASH supply (1e18)
     */
    function ncs() public view returns (uint256) {
        return cash.totalSupply();
    }

    function available() public view returns (uint256) {
        return IERC20(primaryStableAddress).balanceOf(address(this));
    }

    /**
     * @notice Calculate the output for a redeem function
     */
    function calculateRedeemOutput(uint256 _amount) external view returns (uint256) {
        (uint256 output, , ) = _calculateRedeemOutput(_amount);
        return output;
    }

    /**
     * @notice Calculate the output for a redeem function
     */
    function redeemOutputs(uint256 _amount)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return _calculateRedeemOutput(_amount);
    }

    /**
     * @notice Calculate the output for a redeem function
     * @param _amount Amount to redeem (1e18)
     * @return output  amount respective to the primary stable (in PSDecimals)
     * @return totalBalance Total balance of Vault (1e18)
     * @return redeemFee redeem fee on _amount (in PSDecimals)
     */
    function _calculateRedeemOutput(uint256 _amount)
        internal
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 _psBalance = _checkBalance(false);
        uint256 _psDecimals = Helpers.getDecimals(primaryStableAddress);
        uint256 _psBalanceIn18Decs = _psBalance.scaleBy(18, _psDecimals);
        uint256 _cashTS = cash.totalSupply();
        uint256 _give = (_amount.mul(_psBalanceIn18Decs)).div(_cashTS);
        uint256 redeemFee = 0;
        if (redeemFeeBps > 0) {
            redeemFee = _give.mul(redeemFeeBps).div(10000);
            _give = _give.sub(redeemFee);
        }
        return (_give.scaleBy(_psDecimals, 18), _psBalanceIn18Decs, redeemFee.scaleBy(_psDecimals, 18));
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
