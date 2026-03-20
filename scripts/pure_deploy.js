require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 STARTING PURE ETHERS DEPLOYMENT...");
    
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Deploying with address:", wallet.address);

    // Hardcoded addresses from App.jsx
    const registryAddress = "0x155Af6ECaFb48861dA7d16Fb8Af2f6ce9d6DD779";
    const auditAddress = "0x92d2eCE8bB295b7806A900Fad7CA26Fd55814976";

    // Load Artifact (Wait, I need the artifact JSON)
    const artifactPath = path.join(__dirname, "../artifacts/contracts/MedicalRecords.sol/MedicalRecords.json");
    if (!fs.existsSync(artifactPath)) {
        console.error("ERROR: Artifact not found at", artifactPath);
        return;
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    console.log("Sending deployment transaction...");
    const contract = await factory.deploy(registryAddress, auditAddress, { gasLimit: 5000000 });
    
    console.log("Waiting for deployment confirmation...");
    await contract.waitForDeployment();
    
    const address = await contract.getAddress();
    console.log("\n✅ SUCCESS!");
    console.log("New MedicalRecords address:", address);
    
    fs.writeFileSync("new_medical_address.txt", address);
    console.log("Address saved to new_medical_address.txt");
}

main().catch(console.error);
