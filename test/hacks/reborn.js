const { expect } = require("chai");

const { rebornFixture } = require("../_fixture");
const { loadFixture, isFork, daiUnits, cashUnits } = require("../helpers");

describe("Reborn Attack Protection", function () {
  if (isFork) {
    this.timeout(0);
  }

  describe("Vault", function () {
    it("Should correctly do accounting when reborn calls mint as different types of addresses @mock @hack", async function () {
      const fixture = await loadFixture(rebornFixture);
      const { dai, cash, matt, reborner, rebornAttack } = fixture;
      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await reborner.bye();
      await rebornAttack(true);
      await expect(reborner).to.have.a.balanceOf("2", cash);
      expect(await cash.nonRebasingSupply()).to.equal(cashUnits("2"));
    });

    it("Should correctly do accounting when reborn calls burn as different types of addresses @mock @hack", async function () {
      const fixture = await loadFixture(rebornFixture);
      const { dai, cash, matt, reborner, rebornAttack } = fixture;
      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      console.log("Minting");
      await reborner.mint();
      console.log("Bying");
      await reborner.bye();
      console.log("Attack");
      await rebornAttack(true, 1);
      console.log("Balance");
      await expect(reborner).to.have.a.balanceOf("0", cash);
      expect(await cash.nonRebasingSupply()).to.equal(cashUnits("0"));
    });

    it("Should correctly do accounting when reborn calls transfer as different types of addresses @mock @hack", async function () {
      const fixture = await loadFixture(rebornFixture);
      const { dai, cash, matt, reborner, rebornAttack } = fixture;
      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await reborner.bye();
      expect(await cash.nonRebasingSupply()).to.equal(cashUnits("1"));
      await rebornAttack(true, 2);
      await expect(reborner).to.have.a.balanceOf("0", cash);
      expect(await cash.nonRebasingSupply()).to.equal(cashUnits("0"));
    });

    it("Should have correct balance even after recreating @mock @hack", async function () {
      const { dai, matt, reborner, rebornAttack, cash } = await loadFixture(
        rebornFixture
      );

      // Mint one cash and self-destruct
      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await expect(reborner).to.have.a.balanceOf("1", cash);
      await reborner.bye();

      // Recreate the contract at the same address but expect
      // to not have any change in balance (outside constructor)
      await rebornAttack(false);
      await expect(reborner).to.have.a.balanceOf("1", cash);
      await reborner.mint();
      await expect(reborner).to.have.a.balanceOf("2", cash);
    });
  });
});