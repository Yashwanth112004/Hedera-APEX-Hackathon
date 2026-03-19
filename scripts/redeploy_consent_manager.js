const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const REGISTRY = "0x155Af6ECaFb48861dA7d16Fb8Af2f6ce9d6DD779";
  const AUDIT_LOG = "0x92d2eCE8bB295b7806A900Fad7CA26Fd55814976";

  console.log("Redeploying ConsentManager...");
  const ConsentManager = await hre.ethers.getContractFactory("ConsentManager");
  const consent = await ConsentManager.deploy(REGISTRY, AUDIT_LOG);
  await consent.waitForDeployment();

  const newAddress = await consent.getAddress();
  console.log("ConsentManager redeployed to:", newAddress);

  fs.writeFileSync("new_consent_address.txt", newAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
