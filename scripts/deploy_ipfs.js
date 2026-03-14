const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("-----------------------------------------");
    console.log("DEPLOYING IPFS MAPPING & NEW CONSENT SYSTEM...");
    console.log("-----------------------------------------");

    // We need the addresses of AuditLog and DataFiduciaryRegistry to deploy ConsentManager and MedicalRecords
    // We can fetch from existing config or just redeploy everything for a clean slate. 
    // Given the complexity of interconnected state, let's redeploy the necessary parts. 
    // We will keep HealthcareRBAC if possible, or just mock it.
    // Let's assume we read from the frontend constants if we need them, but the easiest way is a fresh deploy of the core trio:
    // Registry -> AuditLog -> ConsentManager & MedicalRecords.

    const AuditLog = await hre.ethers.getContractFactory("AuditLog");
    const auditLog = await AuditLog.deploy();
    await auditLog.waitForDeployment();
    const auditAddr = await auditLog.getAddress();
    console.log(`AuditLog deployed to: ${auditAddr}`);

    const Registry = await hre.ethers.getContractFactory("DataFiduciaryRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    const registryAddr = await registry.getAddress();
    console.log(`DataFiduciaryRegistry deployed to: ${registryAddr}`);

    const ConsentManager = await hre.ethers.getContractFactory("ConsentManager");
    const consentManager = await ConsentManager.deploy(registryAddr, auditAddr);
    await consentManager.waitForDeployment();
    const consentAddr = await consentManager.getAddress();
    console.log(`ConsentManager deployed to: ${consentAddr}`);

    const MedicalRecords = await hre.ethers.getContractFactory("MedicalRecords");
    const medicalRecords = await MedicalRecords.deploy(registryAddr, auditAddr);
    await medicalRecords.waitForDeployment();
    const recordsAddr = await medicalRecords.getAddress();
    console.log(`MedicalRecords deployed to: ${recordsAddr}`);


    const AccessManager = await hre.ethers.getContractFactory("DataAccessManager");
    const accessManager = await AccessManager.deploy(consentAddr, auditAddr);
    await accessManager.waitForDeployment();
    const accessAddr = await accessManager.getAddress();
    console.log(`DataAccessManager deployed to: ${accessAddr}`);

    console.log("-----------------------------------------");
    console.log("Please update your frontend constants.js with these new addresses:");
    console.log("-----------------------------------------");

    const outputObj = {
        AUDIT_LOG_ADDRESS: auditAddr,
        REGISTRY_ADDRESS: registryAddr,
        CONSENT_MANAGER_ADDRESS: consentAddr,
        DATA_ACCESS_ADDRESS: accessAddr,
        MEDICAL_RECORDS_ADDRESS: recordsAddr
    };
    fs.writeFileSync("deployed.json", JSON.stringify(outputObj, null, 2));
    console.log("Wrote addresses to deployed.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
