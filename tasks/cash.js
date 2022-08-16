// Displays an account CASH balance and credits.
async function balance(taskArguments) {
  const cashProxy = await ethers.getContract("CASHProxy");
  const cash = await ethers.getContractAt("CASH", cashProxy.address);

  const balance = await cash.balanceOf(taskArguments.account);
  const credits = await cash.creditsBalanceOf(taskArguments.account);
  console.log(
    "CASH balance=",
    ethers.utils.formatUnits(balance.toString(), 18)
  );
  console.log(
    "CASH credits=",
    ethers.utils.formatUnits(credits[0].toString(), 18)
  );
  console.log(
    "CASH creditsPerToken=",
    ethers.utils.formatUnits(credits[1].toString(), 18)
  );
}

module.exports = {
  balance,
};
