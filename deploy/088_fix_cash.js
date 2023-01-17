const { isFork, isMainnet, isPolygonStaging, cashUnits } = require("../test/helpers");
const { deploymentWithProposal, withConfirmation, deployWithConfirmation } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "088_fix_cash" , forceDeploy: isMainnet || isPolygonStaging, tags: ["test", "main", "fix_cash"],  dependencies: [] },
  async ({ ethers, assetAddresses }) => {

    const cCASHProxy = await ethers.getContract("CASHProxy");
    const cCASH = await ethers.getContractAt("CASH", cCASHProxy.address);

    const amounts = {
        "0x0b07cfdf4772cc7d6110621e9114ce527f41bb66": "13009",
        "0x1a2ce410a034424b784d4b228f167a061b94cff4": "13433.20259", // NON-REBASING
        "0x953Ad46adE32E1c2E76D725544811E4DD410cb50": "5227.192159", 
        "0x1ab3087e181a5cfd09684f38d3412597d8df4f1f": "2000",
        "0xa8ec46a09a56da39011c82220eed0cf22a257f89": "1971",  // NON-REBASING
        "0x53c8ede52dc28de5f48c10696cbc36c1d0282c61": "994.873379",
        "0xa46df52e5349a87141cf48d5806a97a774be4d74": "210.006566",
        "0x84e8ee329e2f868496de8f73e0cdc77e0d7b9f88": "79.01935499",
        "0x0319000133d3ada02600f0875d2cf03d442c3367": "50.30763196",  // NON-REBASING
        "0x62d51fa08b15411d9429133ae5f224abf3867729": "9.9991747",
        "0x54727a65cc4f71418a29a6f18e5be808efe89856": "7.501781281",
        "0x1a114203392b3237a59950125eb861a7ba32c3e6": "3",
    };

    const args = [
        Object.keys(amounts),
        Object.values(amounts).map((x) => cashUnits(x)),
      ];
      
    // Governance proposal
    return {
      name: "Fix CASH",
      actions: [
        {
          contract: cCASH,
          signature: "resetMint(address[],uint256[])",
          args: [args[0], args[1]],
        }
      ],
    };
  }
);
