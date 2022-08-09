// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { Helpers } from "../utils/Helpers.sol";
import "hardhat/console.sol";


abstract contract OracleRouterBase is IOracle {
    uint256 constant MIN_DRIFT = uint256(70000000);
    uint256 constant MAX_DRIFT = uint256(130000000);

    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     * @return address address of the price feed for the asset
     */
    function feed(address asset) internal view virtual returns (address);

    /**
     * @notice Returns the total price in 8 digit USD for a given asset.
     * @param asset address of the asset
     * @return uint256 USD price of 1 of the asset, in 8 decimal fixed
     */
    function price(address asset) external view override returns (uint256) {
        console.log("OracleRouterBase: Getting the address of", asset);
        address _feed = feed(asset);
        //require(_feed != address(0), "Asset not available: Price");
        (, int256 _iprice, , , ) = AggregatorV3Interface(_feed)
            .latestRoundData();
        uint256 _price = uint256(_iprice);
        if (isStablecoin(asset)) {
            require(_price <= MAX_DRIFT, "Oracle: Price exceeds max");
            require(_price >= MIN_DRIFT, "Oracle: Price under min");
        }
        return uint256(_price);
    }

    function isStablecoin(address _asset) internal view returns (bool) {
        string memory symbol = Helpers.getSymbol(_asset);
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        return
            symbolHash == keccak256(abi.encodePacked("DAI")) ||
            symbolHash == keccak256(abi.encodePacked("USDC")) ||
            symbolHash == keccak256(abi.encodePacked("USDT"));
    }
}

contract OracleRouter is OracleRouterBase {
    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal pure override returns (address) {
        if (asset == address(0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063)) {
            // Chainlink: DAI/USD
            return address(0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D);
        } else if (
            asset == address(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)
        ) {
            // Chainlink: USDC/USD
            return address(0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7);
        } else if (
            asset == address(0xc2132D05D31c914a87C6611C10748AEb04B58e8F)
        ) {
            // Chainlink: USDT/USD
            return address(0x0A6513e40db6EB1b165753AD52E80663aeA50545);


        // COMP not available in Polygon
        } else if (
            asset == address(0xc00e94Cb662C3520282E6f5717214004A7f26888)
        ) {
            // Chainlink: COMP/USD
            return address(0x2A8758b7257102461BC958279054e372C2b1bDE6);
        } else if (
            asset == address(0xD6DF932A45C0f255f85145f286eA0b292B21C90B)
        ) {
            // Chainlink: AAVE/USD
            return address(0x72484B12719E23115761D5DA1646945632979bB6);
        } else if (
            asset == address(0x172370d5Cd63279eFa6d502DAB29171933a610AF)
        ) {
            // Chainlink: CRV/USD
            return address(0x336584C8E6Dc19637A5b36206B1c79923111b405);
        } else if (
            asset == address(0x4257EA7637c355F81616050CbB6a9b709fd72683)
        ) {
            // Chainlink: CVX/USD
            return address(0x5ec151834040B4D453A1eA46aA634C1773b36084);
        } else if (
            asset == address(0x2e1AD108fF1D8C782fcBbB89AAd783aC49586756)
        ) {
            // Chainlink: TUSD/USD
            return address(0x7C5D415B64312D38c56B54358449d0a4058339d2);
        } else {
            revert("Asset not available");
        }
    }
    
}

contract OracleRouterDev is OracleRouterBase {
    mapping(address => address) public assetToFeed;

    function setFeed(address _asset, address _feed) external {
        assetToFeed[_asset] = _feed;
    }

    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal view override returns (address) {
        return assetToFeed[asset];
    }
}
