async function main() {
  const ConsentManager = await ethers.getContractFactory("ConsentManager");
  const contract = await ConsentManager.deploy();

  await contract.waitForDeployment();

  console.log("Contract deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});