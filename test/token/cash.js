const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");
const { utils } = require("ethers");

const {
  usdcUnits,
  cashUnits,
  isFork,
  loadFixture,
} = require("../helpers");

describe("Token", function () {
  

  it("Should return the token name and symbol @mock", async () => {
    const { cash } = await loadFixture(defaultFixture);
    expect(await cash.name()).to.equal("CASH");
    expect(await cash.symbol()).to.equal("CASH");
  });

  it("Should have 18 decimals @mock", async () => {
    const { cash } = await loadFixture(defaultFixture);
    expect(await cash.decimals()).to.equal(18);
  });

  it("Should return 0 balance for the zero address @mock", async () => {
    const { cash } = await loadFixture(defaultFixture);
    expect(
      await cash.balanceOf("0x0000000000000000000000000000000000000000")
    ).to.equal(0);
  });

  it("Should not allow anyone to mint CASH directly @mock", async () => {
    const { cash, matt } = await loadFixture(defaultFixture);
    await expect(
      cash.connect(matt).mint(matt.getAddress(), cashUnits("100"))
    ).to.be.revertedWith("Caller is not the Vault");
    await expect(matt).has.a.balanceOf("100.00", cash);
  });

  it("Should allow a simple transfer of 1 CASH @mock", async () => {
    const { cash, anna, matt } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0", cash);
    await expect(matt).has.a.balanceOf("100", cash);
    await cash.connect(matt).transfer(anna.getAddress(), cashUnits("1"));
    await expect(anna).has.a.balanceOf("1", cash);
    await expect(matt).has.a.balanceOf("99", cash);
  });

  it("Should allow a transferFrom with an allowance @mock", async () => {
    const { cash, anna, matt } = await loadFixture(defaultFixture);
    // Approve CASH for transferFrom
    await cash.connect(matt).approve(anna.getAddress(), cashUnits("1000"));
    expect(
      await cash.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(cashUnits("1000"));

    // Do a transferFrom of CASH
    await cash
      .connect(anna)
      .transferFrom(
        await matt.getAddress(),
        await anna.getAddress(),
        cashUnits("1")
      );

    // Anna should have the dollar
    await expect(anna).has.a.balanceOf("1", cash);

    // Check if it has reflected in allowance
    expect(
      await cash.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(cashUnits("999"));
  });

  it("Should transfer the correct amount from a rebasing account to a non-rebasing account and set creditsPerToken @mock", async () => {
    let { cash, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );

    // Give contract 100 CASH from Josh
    await cash
      .connect(josh)
      .transfer(mockNonRebasing.address, cashUnits("100"));

    await expect(matt).has.an.approxBalanceOf("100.00", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", cash);

    const contractCreditsPerToken = await cash.creditsBalanceOf(
      mockNonRebasing.address
    );

    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();

    // Credits per token should be the same for the contract
    contractCreditsPerToken ===
      (await cash.creditsBalanceOf(mockNonRebasing.address));

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should transfer the correct amount from a rebasing account to a non-rebasing account with previously set creditsPerToken @mock", async () => {
    let { cash, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    await cash
      .connect(josh)
      .transfer(mockNonRebasing.address, cashUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", cash);
    await expect(josh).has.an.approxBalanceOf("0", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", cash);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Matt received all the yield
    await expect(matt).has.an.approxBalanceOf("300.00", cash);
    // Give contract 100 CASH from Matt
    await cash.connect(matt).transfer(mockNonRebasing.address, cashUnits("50"));
    await expect(matt).has.an.approxBalanceOf("250", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("150.00", cash);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should transfer the correct amount from a non-rebasing account without previously set creditssPerToken to a rebasing account @mock", async () => {
    let { cash, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 CASH from Josh
    await cash
      .connect(josh)
      .transfer(mockNonRebasing.address, cashUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", cash);
    await expect(josh).has.an.approxBalanceOf("0", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", cash);
    await mockNonRebasing.transfer(await matt.getAddress(), cashUnits("100"));
    await expect(matt).has.an.approxBalanceOf("200.00", cash);
    await expect(josh).has.an.approxBalanceOf("0", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", cash);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should transfer the correct amount from a non-rebasing account with previously set creditsPerToken to a rebasing account @mock", async () => {
    let { cash, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 CASH from Josh
    await cash
      .connect(josh)
      .transfer(mockNonRebasing.address, cashUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", cash);
    await expect(josh).has.an.approxBalanceOf("0", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", cash);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Matt received all the yield
    await expect(matt).has.an.approxBalanceOf("300.00", cash);
    // Give contract 100 CASH from Matt
    await cash.connect(matt).transfer(mockNonRebasing.address, cashUnits("50"));
    await expect(matt).has.an.approxBalanceOf("250", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("150.00", cash);
    // Transfer contract balance to Josh
    await mockNonRebasing.transfer(await josh.getAddress(), cashUnits("150"));
    await expect(matt).has.an.approxBalanceOf("250", cash);
    await expect(josh).has.an.approxBalanceOf("150", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", cash);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should transfer the correct amount from a non-rebasing account to a non-rebasing account with different previously set creditsPerToken @mock", async () => {
    let { cash, vault, matt, usdc, josh, mockNonRebasing, mockNonRebasingTwo } =
      await loadFixture(defaultFixture);
    // Give contract 100 CASH from Josh
    await cash.connect(josh).transfer(mockNonRebasing.address, cashUnits("50"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("50.00", cash);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    await cash
      .connect(josh)
      .transfer(mockNonRebasingTwo.address, cashUnits("50"));
    await usdc.connect(matt).transfer(vault.address, usdcUnits("100"));
    await vault.rebase();
    await mockNonRebasing.transfer(mockNonRebasingTwo.address, cashUnits("10"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("40", cash);
    await expect(mockNonRebasingTwo).has.an.approxBalanceOf("60", cash);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const creditBalanceMockNonRebasing = await cash.creditsBalanceOf(
      mockNonRebasing.address
    );
    const balanceMockNonRebasing = creditBalanceMockNonRebasing[0]
      .mul(utils.parseUnits("1", 18))
      .div(creditBalanceMockNonRebasing[1]);
    const creditBalanceMockNonRebasingTwo = await cash.creditsBalanceOf(
      mockNonRebasingTwo.address
    );
    const balanceMockNonRebasingTwo = creditBalanceMockNonRebasingTwo[0]
      .mul(utils.parseUnits("1", 18))
      .div(creditBalanceMockNonRebasingTwo[1]);

    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(balanceMockNonRebasing)
      .add(balanceMockNonRebasingTwo);

    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a rebasing account to a non-rebasing account and set creditsPerToken @mock", async () => {
    let { cash, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give Josh an allowance to move Matt's CASH
    await cash
      .connect(matt)
      .increaseAllowance(await josh.getAddress(), cashUnits("100"));
    // Give contract 100 CASH from Matt via Josh
    await cash
      .connect(josh)
      .transferFrom(
        await matt.getAddress(),
        mockNonRebasing.address,
        cashUnits("100")
      );
    await expect(matt).has.an.approxBalanceOf("0", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", cash);
    const contractCreditsPerToken = await cash.creditsBalanceOf(
      mockNonRebasing.address
    );
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Credits per token should be the same for the contract
    contractCreditsPerToken ===
      (await cash.creditsBalanceOf(mockNonRebasing.address));

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a rebasing account to a non-rebasing account with previously set creditsPerToken @mock", async () => {
    let { cash, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give Josh an allowance to move Matt's CASH
    await cash
      .connect(matt)
      .increaseAllowance(await josh.getAddress(), cashUnits("150"));
    // Give contract 100 CASH from Matt via Josh
    await cash
      .connect(josh)
      .transferFrom(
        await matt.getAddress(),
        mockNonRebasing.address,
        cashUnits("50")
      );
    await expect(matt).has.an.approxBalanceOf("50", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("50", cash);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Give contract 50 more CASH from Matt via Josh
    await cash
      .connect(josh)
      .transferFrom(
        await matt.getAddress(),
        mockNonRebasing.address,
        cashUnits("50")
      );
    await expect(mockNonRebasing).has.an.approxBalanceOf("100", cash);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a non-rebasing account without previously set creditsPerToken to a rebasing account @mock", async () => {
    let { cash, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 CASH from Josh
    await cash
      .connect(josh)
      .transfer(mockNonRebasing.address, cashUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", cash);
    await expect(josh).has.an.approxBalanceOf("0", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", cash);
    await mockNonRebasing.increaseAllowance(
      await matt.getAddress(),
      cashUnits("100")
    );

    await cash
      .connect(matt)
      .transferFrom(
        mockNonRebasing.address,
        await matt.getAddress(),
        cashUnits("100")
      );
    await expect(matt).has.an.approxBalanceOf("200.00", cash);
    await expect(josh).has.an.approxBalanceOf("0", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", cash);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a non-rebasing account with previously set creditsPerToken to a rebasing account @mock", async () => {
    let { cash, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 CASH from Josh
    await cash
      .connect(josh)
      .transfer(mockNonRebasing.address, cashUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", cash);
    await expect(josh).has.an.approxBalanceOf("0", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", cash);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Matt received all the yield
    await expect(matt).has.an.approxBalanceOf("300.00", cash);
    // Give contract 100 CASH from Matt
    await cash.connect(matt).transfer(mockNonRebasing.address, cashUnits("50"));
    await expect(matt).has.an.approxBalanceOf("250", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("150.00", cash);
    // Transfer contract balance to Josh
    await mockNonRebasing.increaseAllowance(
      await matt.getAddress(),
      cashUnits("150")
    );

    await cash
      .connect(matt)
      .transferFrom(
        mockNonRebasing.address,
        await matt.getAddress(),
        cashUnits("150")
      );

    await expect(matt).has.an.approxBalanceOf("400", cash);
    await expect(josh).has.an.approxBalanceOf("0", cash);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", cash);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should maintain the correct balances when rebaseOptIn is called from non-rebasing contract @mock", async () => {
    let { cash, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 99.50 CASH from Josh
    // This will set a nonrebasingCreditsPerTokenHighres for this account
    await cash
      .connect(josh)
      .transfer(mockNonRebasing.address, cashUnits("99.50"));

    const initialRebasingCredits = await cash.rebasingCreditsHighres();
    const initialTotalSupply = await cash.totalSupply();

    await expect(mockNonRebasing).has.an.approxBalanceOf("99.50", cash);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();

    const totalSupplyBefore = await cash.totalSupply();
    await expect(mockNonRebasing).has.an.approxBalanceOf("99.50", cash);
    await mockNonRebasing.rebaseOptIn();
    await expect(mockNonRebasing).has.an.approxBalanceOf("99.50", cash);
    expect(await cash.totalSupply()).to.equal(totalSupplyBefore);

    const rebasingCredits = await cash.rebasingCreditsHighres();
    const rebasingCreditsPerTokenHighres =
      await cash.rebasingCreditsPerTokenHighres();

    const creditsAdded = cashUnits("99.50")
      .mul(rebasingCreditsPerTokenHighres)
      .div(utils.parseUnits("1", 18));

    await expect(rebasingCredits).to.equal(
      initialRebasingCredits.add(creditsAdded)
    );

    expect(await cash.totalSupply()).to.approxEqual(
      initialTotalSupply.add(utils.parseUnits("200", 18))
    );

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should maintain the correct balance when rebaseOptOut is called from rebasing EOA @mock", async () => {
    let { cash, vault, matt, usdc } = await loadFixture(defaultFixture);
    await expect(matt).has.an.approxBalanceOf("100.00", cash);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    const totalSupplyBefore = await cash.totalSupply();

    const initialRebasingCredits = await cash.rebasingCreditsHighres();
    const initialrebasingCreditsPerTokenHighres =
      await cash.rebasingCreditsPerTokenHighres();

    await cash.connect(matt).rebaseOptOut();
    // Received 100 from the rebase, the 200 simulated yield was split between
    // Matt and Josh
    await expect(matt).has.an.approxBalanceOf("200.00", cash);

    const rebasingCredits = await cash.rebasingCreditsHighres();

    const creditsDeducted = cashUnits("200")
      .mul(initialrebasingCreditsPerTokenHighres)
      .div(utils.parseUnits("1", 18));

    await expect(rebasingCredits).to.equal(
      initialRebasingCredits.sub(creditsDeducted)
    );

    expect(await cash.totalSupply()).to.equal(totalSupplyBefore);
  });

  it("Should not allow EOA to call rebaseOptIn when already opted in to rebasing @mock", async () => {
    let { cash, matt } = await loadFixture(defaultFixture);
    await expect(cash.connect(matt).rebaseOptIn()).to.be.revertedWith(
      "Account has not opted out"
    );
  });

  it("Should not allow EOA to call rebaseOptOut when already opted out of rebasing @mock", async () => {
    let { cash, matt } = await loadFixture(defaultFixture);
    await cash.connect(matt).rebaseOptOut();
    await expect(cash.connect(matt).rebaseOptOut()).to.be.revertedWith(
      "Account has not opted in"
    );
  });

  it("Should not allow contract to call rebaseOptIn when already opted in to rebasing @mock", async () => {
    let { mockNonRebasing } = await loadFixture(defaultFixture);
    await mockNonRebasing.rebaseOptIn();
    await expect(mockNonRebasing.rebaseOptIn()).to.be.revertedWith(
      "Account has not opted out"
    );
  });

  it("Should not allow contract to call rebaseOptOut when already opted out of rebasing @mock", async () => {
    let { mockNonRebasing } = await loadFixture(defaultFixture);
    await expect(mockNonRebasing.rebaseOptOut()).to.be.revertedWith(
      "Account has not opted in"
    );
  });

  it("Should maintain the correct balance on a partial transfer for a non-rebasing account without previously set creditsPerToken @mock", async () => {
    let { cash, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Opt in to rebase so contract doesn't set a fixed creditsPerToken for the contract
    await mockNonRebasing.rebaseOptIn();
    // Give contract 100 CASH from Josh
    await cash
      .connect(josh)
      .transfer(mockNonRebasing.address, cashUnits("100"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("100", cash);
    await cash.connect(matt).rebaseOptOut();
    // Transfer will cause a fixed creditsPerToken to be set for mockNonRebasing
    await mockNonRebasing.transfer(await matt.getAddress(), cashUnits("50"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("50", cash);
    await expect(matt).has.an.approxBalanceOf("150", cash);
    await mockNonRebasing.transfer(await matt.getAddress(), cashUnits("25"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("25", cash);
    await expect(matt).has.an.approxBalanceOf("175", cash);
  });

  it("Should maintain the same totalSupply on many transfers between different account types @mock", async () => {
    let { cash, matt, josh, mockNonRebasing, mockNonRebasingTwo } =
      await loadFixture(defaultFixture);

    // Only Matt and Josh have CASH, give some to contracts
    await cash.connect(josh).transfer(mockNonRebasing.address, cashUnits("50"));
    await cash
      .connect(matt)
      .transfer(mockNonRebasingTwo.address, cashUnits("50"));

    // Set up accounts
    await cash.connect(josh).rebaseOptOut();
    const nonRebasingEOA = josh;
    const rebasingEOA = matt;
    const nonRebasingContract = mockNonRebasing;
    await mockNonRebasingTwo.rebaseOptIn();
    const rebasingContract = mockNonRebasingTwo;

    const allAccounts = [
      nonRebasingEOA,
      rebasingEOA,
      nonRebasingContract,
      rebasingContract,
    ];

    const initialTotalSupply = await cash.totalSupply();
    for (let i = 0; i < 10; i++) {
      for (const fromAccount of allAccounts) {
        const toAccount =
          allAccounts[Math.floor(Math.random() * allAccounts.length)];

        if (typeof fromAccount.transfer === "function") {
          // From account is a contract
          await fromAccount.transfer(
            toAccount.address,
            (await cash.balanceOf(fromAccount.address)).div(2)
          );
        } else {
          // From account is a EOA
          await cash
            .connect(fromAccount)
            .transfer(
              toAccount.address,
              (await cash.balanceOf(fromAccount.address)).div(2)
            );
        }

        await expect(await cash.totalSupply()).to.equal(initialTotalSupply);
      }
    }
  });

  it("Should revert a transferFrom if an allowance is insufficient @mock", async () => {
    const { cash, anna, matt } = await loadFixture(defaultFixture);
    // Approve CASH for transferFrom
    await cash.connect(matt).approve(anna.getAddress(), cashUnits("10"));
    expect(
      await cash.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(cashUnits("10"));

    // Do a transferFrom of CASH
    await expect(
      cash
        .connect(anna)
        .transferFrom(
          await matt.getAddress(),
          await anna.getAddress(),
          cashUnits("100")
        )
    ).to.be.revertedWith(
      "Arithmetic operation underflowed or overflowed outside of an unchecked block"
    );
  });

  it("Should allow to increase/decrease allowance @mock", async () => {
    const { cash, anna, matt } = await loadFixture(defaultFixture);
    // Approve CASH
    await cash.connect(matt).approve(anna.getAddress(), cashUnits("1000"));
    expect(
      await cash.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(cashUnits("1000"));

    // Decrease allowance
    await cash
      .connect(matt)
      .decreaseAllowance(await anna.getAddress(), cashUnits("100"));
    expect(
      await cash.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(cashUnits("900"));

    // Increase allowance
    await cash
      .connect(matt)
      .increaseAllowance(await anna.getAddress(), cashUnits("20"));
    expect(
      await cash.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(cashUnits("920"));

    // Decrease allowance more than what's there
    await cash
      .connect(matt)
      .decreaseAllowance(await anna.getAddress(), cashUnits("950"));
    expect(
      await cash.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(cashUnits("0"));
  });

  it("Should increase users balance on supply increase @mock", async () => {
    const { cash, usdc, vault, anna, matt } = await loadFixture(defaultFixture);
    // Transfer 1 to Anna, so we can check different amounts
    await cash.connect(matt).transfer(anna.getAddress(), cashUnits("1"));
    await expect(matt).has.a.balanceOf("99", cash);
    await expect(anna).has.a.balanceOf("1", cash);

    // Increase total supply thus increasing all user's balances
    await usdc.connect(matt).mint(usdcUnits("2"));
    await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Matt should have (99/200) * 202 CASH
    await expect(matt).has.a.balanceOf("99.99", cash);
    // Anna should have (1/200) * 202 CASH
    await expect(anna).has.a.balanceOf("1.01", cash);
  });

  it("Should mint correct amounts on non-rebasing account without previously set creditsPerToken @mock", async () => {
    let { cash, usdc, vault, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 USDC from Josh
    await usdc.connect(josh).transfer(mockNonRebasing.address, usdcUnits("100"));
    await expect(mockNonRebasing).has.a.balanceOf("0", cash);
    const totalSupplyBefore = await cash.totalSupply();
    await mockNonRebasing.approveFor(
      usdc.address,
      vault.address,
      usdcUnits("100")
    );
    await mockNonRebasing.mintCASH(vault.address, usdc.address, usdcUnits("50"));
    await expect(await cash.totalSupply()).to.equal(
      totalSupplyBefore.add(cashUnits("50"))
    );

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    await expect(await cash.nonRebasingSupply()).to.approxEqual(
      cashUnits("50")
    );
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should mint correct amounts on non-rebasing account with previously set creditsPerToken @mock", async () => {
    let { cash, usdc, vault, matt, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);
    // Give contract 100 USDC from Josh
    await usdc.connect(josh).transfer(mockNonRebasing.address, usdcUnits("100"));
    await expect(mockNonRebasing).has.a.balanceOf("0", cash);
    const totalSupplyBefore = await cash.totalSupply();
    await mockNonRebasing.approveFor(
      usdc.address,
      vault.address,
      usdcUnits("100")
    );
    await mockNonRebasing.mintCASH(vault.address, usdc.address, usdcUnits("50"));
    await expect(await cash.totalSupply()).to.equal(
      totalSupplyBefore.add(cashUnits("50"))
    );
    const contractCreditsBalanceOf = await cash.creditsBalanceOf(
      mockNonRebasing.address
    );
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // After the initial transfer and the rebase the contract address has a
    // separate and different creditsPerToken to the global one
    expect(
      (await cash.creditsBalanceOf(await josh.getAddress()))[1]
    ).to.not.equal(contractCreditsBalanceOf[1]);
    // Mint again
    await mockNonRebasing.mintCASH(vault.address, usdc.address, usdcUnits("50"));
    await expect(await cash.totalSupply()).to.equal(
      // Note 200 additional from simulated yield
      totalSupplyBefore.add(cashUnits("100")).add(cashUnits("200"))
    );
    await expect(mockNonRebasing).has.a.balanceOf("100", cash);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    await expect(await cash.nonRebasingSupply()).to.approxEqual(
      cashUnits("100")
    );
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should burn the correct amount for non-rebasing account @mock", async () => {
    let { cash, usdc, vault, matt, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);
    // Give contract 100 USDC from Josh
    await usdc.connect(josh).transfer(mockNonRebasing.address, usdcUnits("100"));
    await expect(mockNonRebasing).has.a.balanceOf("0", cash);
    const totalSupplyBefore = await cash.totalSupply();
    await mockNonRebasing.approveFor(
      usdc.address,
      vault.address,
      usdcUnits("100")
    );
    await mockNonRebasing.mintCASH(vault.address, usdc.address, usdcUnits("50"));
    await expect(await cash.totalSupply()).to.equal(
      totalSupplyBefore.add(cashUnits("50"))
    );
    const contractCreditsBalanceOf = await cash.creditsBalanceOf(
      mockNonRebasing.address
    );
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // After the initial transfer and the rebase the contract address has a
    // separate and different creditsPerToken to the global one
    expect(
      (await cash.creditsBalanceOf(await josh.getAddress()))[1]
    ).to.not.equal(contractCreditsBalanceOf[1]);
    // Burn CASH
    await mockNonRebasing.redeemCASH(vault.address, cashUnits("25"));
    await expect(await cash.totalSupply()).to.equal(
      // Note 200 from simulated yield
      totalSupplyBefore.add(cashUnits("225"))
    );
    await expect(mockNonRebasing).has.a.balanceOf("25", cash);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    await expect(await cash.nonRebasingSupply()).to.approxEqual(
      cashUnits("25")
    );
    const calculatedTotalSupply = (await cash.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await cash.rebasingCreditsPerTokenHighres())
      .add(await cash.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await cash.totalSupply()
    );
  });

  it("Should exact transfer to new contract accounts @mock", async () => {
    let { cash, vault, matt, usdc, mockNonRebasing } = await loadFixture(
      defaultFixture
    );

    // Add yield to so we need higher resolution
    await usdc.connect(matt).mint(usdcUnits("9671.2345"));
    await usdc.connect(matt).transfer(vault.address, usdcUnits("9671.2345"));
    await vault.rebase();

    // Helper to verify balance-exact transfers in
    const checkTransferIn = async (amount) => {
      const beforeReceiver = await cash.balanceOf(mockNonRebasing.address);
      await cash.connect(matt).transfer(mockNonRebasing.address, amount);
      const afterReceiver = await cash.balanceOf(mockNonRebasing.address);
      expect(beforeReceiver.add(amount)).to.equal(afterReceiver);
    };

    // Helper to verify balance-exact transfers out
    const checkTransferOut = async (amount) => {
      const beforeReceiver = await cash.balanceOf(mockNonRebasing.address);
      await mockNonRebasing.transfer(matt.address, amount);
      const afterReceiver = await cash.balanceOf(mockNonRebasing.address);
      expect(beforeReceiver.sub(amount)).to.equal(afterReceiver);
    };

    // In
    await checkTransferIn(1);
    await checkTransferIn(2);
    await checkTransferIn(5);
    await checkTransferIn(9);
    await checkTransferIn(100);
    await checkTransferIn(2);
    await checkTransferIn(5);
    await checkTransferIn(9);

    // Out
    await checkTransferOut(1);
    await checkTransferOut(2);
    await checkTransferOut(5);
    await checkTransferOut(9);
    await checkTransferOut(100);
    await checkTransferOut(2);
    await checkTransferOut(5);
    await checkTransferOut(9);
  });
});
