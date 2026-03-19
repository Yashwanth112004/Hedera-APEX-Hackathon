const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("-----------------------------------------");
    console.log("🚀 RE-DEPLOYING MEDICAL RECORDS ONLY...");
    console.log("-----------------------------------------");

    const registryAddress = "0x155Af6ECaFb48861dA7d16Fb8Af2f6ce9d6DD779";
    const auditAddress = "0x92d2eCE8bB295b7806A900Fad7CA26Fd55814976";

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const Medical = await hre.ethers.getContractFactory("MedicalRecords");
    console.log("Compiling and deploying...");
    const medical = await Medical.deploy(registryAddress, auditAddress);
    await medical.waitForDeployment();
    
    const newAddress = await medical.getAddress();
    console.log("\n✅ SUCCESS!");
    console.log("New MedicalRecords address:", newAddress);
    
    fs.writeFileSync("new_medical_address.txt", newAddress);
    console.log("Address saved to new_medical_address.txt");
    console.log("-----------------------------------------");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
