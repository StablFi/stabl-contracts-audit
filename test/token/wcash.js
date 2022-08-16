const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");
const {
  sleep
} = require("../../utils/deploy");

const { cashUnits, daiUnits, isFork, loadFixture, daiUnitsFormat, wcashUnitsFormat, cashUnitsFormat } = require("../helpers");

describe("WCASH", function () {
  

  let cash, wcash, vault, dai, matt, josh, governor;

  beforeEach(async () => {
    const fixture = await loadFixture(defaultFixture);
    cash = fixture.cash;
    wcash = fixture.wcash;
    vault = fixture.vault;
    dai = fixture.dai;
    matt = fixture.matt;
    josh = fixture.josh;
    anna = fixture.anna;
    governor = fixture.governor;

    // Josh wraps 50
    await cash.connect(josh).approve(wcash.address, cashUnits("1000"));
    await wcash.connect(josh).deposit(cashUnits("50"), josh.address);
    // Matt gives money to wCASH, which counts as yield and changes the effective price of WCASH
    // 1 WCASH will be worth 2 CASH
    await cash.connect(matt).transfer(wcash.address, cashUnits("50"));
  });

  describe("Funds in, Funds out @fast @mock", async () => {
    it("should deposit at the correct ratio @fast @mock", async () => {
      await wcash.connect(josh).deposit(cashUnits("50"), josh.address);
      await expect(josh).to.have.a.balanceOf("75", wcash);
      await expect(josh).to.have.a.balanceOf("0", cash);
    });
    it("should withdraw at the correct ratio @fast @mock", async () => {
      await wcash
        .connect(josh)
        .withdraw(cashUnits("50"), josh.address, josh.address);
      await expect(josh).to.have.a.balanceOf("25", wcash);
      await expect(josh).to.have.a.balanceOf("100", cash);
    });
    it("should mint at the correct ratio @fast @mock", async () => {
      await wcash.connect(josh).mint(cashUnits("25"), josh.address);
      await expect(josh).to.have.a.balanceOf("75", wcash);
      await expect(josh).to.have.a.balanceOf("0", cash);
    });
    it("should redeem at the correct ratio @fast @mock", async () => {
      await expect(josh).to.have.a.balanceOf("50", wcash);
      await wcash
        .connect(josh)
        .redeem(cashUnits("50"), josh.address, josh.address);
      await expect(josh).to.have.a.balanceOf("0", wcash);
      await expect(josh).to.have.a.balanceOf("150", cash);
    });
  });

  describe("Collects Rebase @mock", async () => {
    it("should increase with an CASH rebase @slow" , async () => {
      console.log("matt CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
      console.log("WCASH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(wcash.address)).toString()))
      console.log("Vault DAI Balance: ", daiUnitsFormat((await dai.balanceOf(vault.address)).toString()))

      console.log("Waiting");
      await sleep(120000);
      await expect(wcash).to.have.approxBalanceOf("100", cash);
      console.log("Waiting");
      await sleep(30000);
      console.log("Transferring Stray 100 DAI to the Vault")
      await dai.connect(josh).transfer(vault.address, daiUnits("100"));

      console.log("matt CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
      console.log("WCASH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(wcash.address)).toString()))
      console.log("Vault DAI Balance: ", daiUnitsFormat((await dai.balanceOf(vault.address)).toString()))

      console.log("Waiting");
      await sleep(30000);
      console.log("Rebasing...")
      console.log("matt CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
      console.log("WCASH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(wcash.address)).toString()))
      console.log("Vault DAI Balance: ", daiUnitsFormat((await dai.balanceOf(vault.address)).toString()))

      await vault.rebase();
      console.log("matt CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
      console.log("WCASH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(wcash.address)).toString()))
      console.log("Vault DAI Balance: ", daiUnitsFormat((await dai.balanceOf(vault.address)).toString()))

      console.log("Waiting");
      await sleep(30);
      expect((await cash.balanceOf(wcash.address))).to.be.above("140");
      console.log("Waiting");
      await sleep(30);
      console.log("matt CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
      console.log("WCASH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(wcash.address)).toString()))
      console.log("Vault DAI Balance: ", daiUnitsFormat((await dai.balanceOf(vault.address)).toString()))
      console.log("Transferring 50 CASH to WCASH")
      await cash.connect(matt).transfer(wcash.address, cashUnits("50")); // Failing of this line.
      console.log("matt CASH Balance: ", cashUnitsFormat((await cash.balanceOf(matt.address)).toString()))
      console.log("WCASH CASH Balance: ", cashUnitsFormat((await cash.balanceOf(wcash.address)).toString()))
      console.log("Vault DAI Balance: ", daiUnitsFormat((await dai.balanceOf(vault.address)).toString()))

    });
  });

  describe("Check proxy @fast @mock", async () => {
    it("should have correct ERC20 properties @fast @mock", async () => {
      expect(await wcash.decimals()).to.eq(18);
      expect(await wcash.name()).to.eq("Wrapped CASH");
      expect(await wcash.symbol()).to.eq("wCASH");
    });
  });

  describe("Token recovery @fast @mock", async () => {
    it("should allow a governor to recover tokens @fast @mock", async () => {
      await dai.connect(matt).transfer(wcash.address, daiUnits("2"));
      await expect(wcash).to.have.a.balanceOf("2", dai);
      await expect(governor).to.have.a.balanceOf("1000", dai);

      await wcash.connect(governor).transferToken(dai.address, daiUnits("2"));
      await expect(wcash).to.have.a.balanceOf("0", dai);
      await expect(governor).to.have.a.balanceOf("1002", dai);
    });
    it("should not allow a governor to collect CASH @fast @mock", async () => {
      await expect(
        wcash.connect(governor).transferToken(cash.address, cashUnits("2"))
      ).to.be.revertedWith("Cannot collect CASH");
    });
    it("should not allow a non governor to recover tokens @fast @mock", async () => {
      await expect(
        wcash.connect(josh).transferToken(cash.address, cashUnits("2"))
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("wCASH upgrade @mock", async () => {
    it("should be upgradable @fast @mock", async () => {
      // Do upgrade
      const cWrappedCASHProxy = await ethers.getContract("WrappedCASHProxy");
      const factory = await ethers.getContractFactory("MockLimitedWrappedCASH");
      const dNewImpl = await factory.deploy(
        cash.address,
        "wCASH",
        "Wrapped CASH"
      );
      await cWrappedCASHProxy.connect(governor).upgradeTo(dNewImpl.address);

      // Test basics
      expect(await wcash.decimals()).to.eq(18);
      expect(await wcash.name()).to.eq("Wrapped CASH");
      expect(await wcash.symbol()).to.eq("wCASH");

      // Test previous balance
      await expect(wcash).to.have.a.balanceOf("100", cash);
      await expect(josh).to.have.a.balanceOf("50", wcash);
      await expect(matt).to.have.a.balanceOf("0", wcash);

      // Upgraded contract will only allow deposits of up to 1 CASH
      await wcash.connect(josh).deposit(cashUnits("1"), josh.address);
      await expect(
        wcash.connect(josh).deposit(cashUnits("25"), josh.address)
      ).to.be.revertedWith("ERC4626: deposit more then max");
    });
  });
});
