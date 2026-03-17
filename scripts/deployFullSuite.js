const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("-----------------------------------------");
    console.log("🚀 STARTING FULL SUITE DEPLOYMENT...");
    console.log("-----------------------------------------");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // 1️⃣ Deploy HealthcareRBAC
    console.log("Deploying HealthcareRBAC...");
    const RBAC = await hre.ethers.getContractFactory("HealthcareRBAC");
    const rbac = await RBAC.deploy();
    await rbac.waitForDeployment();
    const rbacAddress = await rbac.getAddress();
    console.log("HealthcareRBAC deployed to:", rbacAddress);

    // 2️⃣ Deploy WalletMapper
    console.log("Deploying WalletMapper...");
    const WalletMapper = await hre.ethers.getContractFactory("WalletMapper");
    const walletMapper = await WalletMapper.deploy();
    await walletMapper.waitForDeployment();
    const mapperAddress = await walletMapper.getAddress();
    console.log("WalletMapper deployed to:", mapperAddress);

    // 3️⃣ Deploy DataFiduciaryRegistry
    console.log("Deploying DataFiduciaryRegistry...");
    const Registry = await hre.ethers.getContractFactory("DataFiduciaryRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log("Registry deployed to:", registryAddress);

    // 4️⃣ Deploy AuditLog
    console.log("Deploying AuditLog...");
    const Audit = await hre.ethers.getContractFactory("AuditLog");
    const audit = await Audit.deploy();
    await audit.waitForDeployment();
    const auditAddress = await audit.getAddress();
    console.log("AuditLog deployed to:", auditAddress);

    // 5️⃣ Deploy ConsentManager
    console.log("Deploying ConsentManager...");
    const Consent = await hre.ethers.getContractFactory("ConsentManager");
    const consent = await Consent.deploy(registryAddress, auditAddress);
    await consent.waitForDeployment();
    const consentAddress = await consent.getAddress();
    console.log("ConsentManager deployed to:", consentAddress);

    // 6️⃣ Deploy DataAccessManager
    console.log("Deploying DataAccessManager...");
    const Access = await hre.ethers.getContractFactory("DataAccessManager");
    const access = await Access.deploy(consentAddress, auditAddress);
    await access.waitForDeployment();
    const accessAddress = await access.getAddress();
    console.log("DataAccessManager deployed to:", accessAddress);

    // 7️⃣ Deploy MedicalRecords
    console.log("Deploying MedicalRecords...");
    const Medical = await hre.ethers.getContractFactory("MedicalRecords");
    const medical = await Medical.deploy(registryAddress, auditAddress);
    await medical.waitForDeployment();
    const medicalAddress = await medical.getAddress();
    console.log("MedicalRecords deployed to:", medicalAddress);

    console.log("-----------------------------------------");
    console.log("✅ DEPLOYMENT COMPLETE");
    console.log("-----------------------------------------");
    
    const addresses = {
        AUDIT_LOG: auditAddress,
        REGISTRY: registryAddress,
        CONSENT_MANAGER: consentAddress,
        ACCESS_MANAGER: accessAddress,
        MEDICAL_RECORDS: medicalAddress,
        RBAC_CONTRACT_ADDRESS: rbacAddress,
        WALLET_MAPPER_ADDRESS: mapperAddress
    };

    console.log("Final Address Summary:");
    console.table(addresses);

    // Write to a JSON file for easy frontend copy-pasting
    fs.writeFileSync("deployed_addresses.json", JSON.stringify(addresses, null, 2));
    console.log("Addresses saved to deployed_addresses.json");
    
    // Also update specific txt files used by existing scripts if any
    fs.writeFileSync("rbac_address.txt", rbacAddress);
    fs.writeFileSync("last_mapper.txt", mapperAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
