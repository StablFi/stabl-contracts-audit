const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");
const { loadFixture } = require("../helpers");

describe("VaultAdmin Upgrades @fast @mock", async function () {
  let cash, vault, vaultStorage, governor;

  beforeEach(async function () {
    const fixture = await loadFixture(defaultFixture);
    vault = fixture.vault;
    cash = fixture.cash;
    governor = fixture.governor;
    vaultStorage = await hre.ethers.getContractAt(
      "VaultStorage",
      vault.address
    );
  });

  it("should upgrade to a new admin implementation @fast @mock", async function () {
    const newVaultImpl = cash.address; // ;)
    await vaultStorage.connect(governor).setAdminImpl(newVaultImpl);
  });

  it("should not upgrade to a non-contract admin implementation @fast @mock", async function () {
    const blankImpl = "0x4000000000000000000000000000000000000004";
    await expect(
      vaultStorage.connect(governor).setAdminImpl(blankImpl)
    ).to.be.revertedWith("new implementation is not a contract");
  });
});
