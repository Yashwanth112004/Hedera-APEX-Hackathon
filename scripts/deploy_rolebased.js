const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("-----------------------------------------");
    console.log("DEPLOYMENT STARTING...");
    console.log("-----------------------------------------");

    const RoleBased = await hre.ethers.getContractFactory("HealthcareRBAC");
    const roleBased = await RoleBased.deploy();

    await roleBased.waitForDeployment();
    const address = await roleBased.getAddress();

    console.log(`HealthcareRBAC successfully deployed to: ${address}`);

    // Write to file for absolute reliability
    fs.writeFileSync("rbac_address.txt", address);
    console.log("Address written to rbac_address.txt");

    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployed by: ${deployer.address}`);

    const isAdmin = await roleBased.isAdmin(deployer.address);
    console.log(`Deployer is admin: ${isAdmin}`);
    console.log("-----------------------------------------");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
