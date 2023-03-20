const { isFork, isMainnet, isStaging } = require("../test/helpers");
const {
    deploymentWithProposal,
    withConfirmation,
    deployWithConfirmation,
} = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");
module.exports = deploymentWithProposal(
    {
        deployName: "203_swapper",
        forceDeploy: true,
        tags: ["test", "test_polygon", "swapper"],
        dependencies: [],
    },
    async ({ ethers, assetAddresses, getTxOpts }) => {
        const { deployerAddr, governorAddr } = await getNamedAccounts();
        const sDeployer = await ethers.provider.getSigner(deployerAddr);

        await deployWithConfirmation("SwapperProxy");
        await deployWithConfirmation("BalancerSwapPlaceProxy");

        const pSwapperProxy = await ethers.getContract("SwapperProxy");
        const pBalancerSwapPlaceProxy = await ethers.getContract("BalancerSwapPlaceProxy");

        await deployWithConfirmation("Swapper");
        await deployWithConfirmation("BalancerSwapPlace");

        const iSwapper = await ethers.getContract("Swapper");
        const iBalancerSwapPlace = await ethers.getContract("BalancerSwapPlace");

        const Swapper = await ethers.getContractAt("Swapper", pSwapperProxy.address);
        const BalancerSwapPlace = await ethers.getContractAt("BalancerSwapPlace", pBalancerSwapPlaceProxy.address);

        console.log("Init the proxy to point at the implementation");
        await withConfirmation(pSwapperProxy.connect(sDeployer)["initialize(address,address,bytes)"](iSwapper.address, deployerAddr, [], await getTxOpts()));
        await withConfirmation(pBalancerSwapPlaceProxy.connect(sDeployer)["initialize(address,address,bytes)"](iBalancerSwapPlace.address, deployerAddr, [], await getTxOpts()));
        await withConfirmation(BalancerSwapPlace.connect(sDeployer)["setBalancerVault(address)"]("0xBA12222222228d8Ba445958a75a0704d566BF2C8", await getTxOpts()));

        let BalancerSwapPlaceType = await BalancerSwapPlace.swapPlaceType();
        console.log("BalancerSwapPlaceType", BalancerSwapPlaceType.toString());

        const oracleRouter = await ethers.getContract("OracleRouter");
        return {
            name: "Register Places to Swapper",
            actions: [
                {
                    contract: Swapper,
                    signature: "setParams(uint256,address,uint256)",
                    args: [0, oracleRouter.address, 30],
                },
                {
                    contract: Swapper,
                    signature: "swapPlaceRegister(string,address)",
                    args: [BalancerSwapPlaceType, BalancerSwapPlace.address],
                },
                {
                    contract: Swapper,
                    signature: "swapPlaceInfoRegister(address,address,address,string)",
                    args: [assetAddresses.TETU,  assetAddresses.USDC, "0xE2f706EF1f7240b803AAe877C9C762644bb808d8", BalancerSwapPlaceType]
                },
           ],
        };
    });
