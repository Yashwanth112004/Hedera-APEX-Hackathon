const hre = require("hardhat");

async function main() {
    const registryAddress = "0x155Af6ECaFb48861dA7d16Fb8Af2f6ce9d6DD779";
    const auditAddress = "0x92d2eCE8bB295b7806A900Fad7CA26Fd55814976";

    console.log("Deploying MedicalRecords...");
    const Medical = await hre.ethers.getContractFactory("MedicalRecords");
    const medical = await Medical.deploy(registryAddress, auditAddress);
    await medical.waitForDeployment();
    
    const address = await medical.getAddress();
    console.log("SUCCESS: Deployed to", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
