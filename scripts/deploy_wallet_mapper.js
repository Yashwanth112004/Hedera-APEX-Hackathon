const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy WalletMapper
  const WalletMapper = await hre.ethers.getContractFactory("WalletMapper");
  const walletMapper = await WalletMapper.deploy();
  await walletMapper.waitForDeployment();
  const mapperAddress = await walletMapper.getAddress();
  
  console.log("WalletMapper deployed to:", mapperAddress);
  const fs = require("fs");
  fs.writeFileSync("last_mapper.txt", mapperAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
