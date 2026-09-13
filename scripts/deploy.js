const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("==========================================================");
  console.log(" Deploying OjasRaksha Smart Contracts to Hedera Network");
  console.log(" Deployer Account:", deployer ? deployer.address : "Default");
  console.log("==========================================================\n");

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1. Deploy AuditLog
  console.log("1. Deploying AuditLog...");
  const AuditLog = await hre.ethers.getContractFactory("AuditLog");
  const audit = await AuditLog.deploy();
  await audit.waitForDeployment();
  const auditAddress = await audit.getAddress();
  console.log("   ✓ AuditLog deployed to:", auditAddress);
  await sleep(3500);

  // 2. Deploy DataFiduciaryRegistry
  console.log("2. Deploying DataFiduciaryRegistry...");
  const DataFiduciaryRegistry = await hre.ethers.getContractFactory("DataFiduciaryRegistry");
  const registry = await DataFiduciaryRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   ✓ DataFiduciaryRegistry deployed to:", registryAddress);
  await sleep(3500);

  // 3. Deploy ConsentManager (registry, audit)
  console.log("3. Deploying ConsentManager...");
  const ConsentManager = await hre.ethers.getContractFactory("ConsentManager");
  const consentManager = await ConsentManager.deploy(registryAddress, auditAddress);
  await consentManager.waitForDeployment();
  const consentManagerAddress = await consentManager.getAddress();
  console.log("   ✓ ConsentManager deployed to:", consentManagerAddress);
  await sleep(3500);

  // 4. Deploy DataAccessManager (consentManager, audit)
  console.log("4. Deploying DataAccessManager...");
  const DataAccessManager = await hre.ethers.getContractFactory("DataAccessManager");
  const accessManager = await DataAccessManager.deploy(consentManagerAddress, auditAddress);
  await accessManager.waitForDeployment();
  const accessManagerAddress = await accessManager.getAddress();
  console.log("   ✓ DataAccessManager deployed to:", accessManagerAddress);
  await sleep(3500);

  // 5. Deploy MedicalRecords (registry, audit)
  console.log("5. Deploying MedicalRecords...");
  const MedicalRecords = await hre.ethers.getContractFactory("MedicalRecords");
  const medicalRecords = await MedicalRecords.deploy(registryAddress, auditAddress);
  await medicalRecords.waitForDeployment();
  const medicalRecordsAddress = await medicalRecords.getAddress();
  console.log("   ✓ MedicalRecords deployed to:", medicalRecordsAddress);
  await sleep(3500);

  // 6. Deploy HealthcareRBAC
  console.log("6. Deploying HealthcareRBAC...");
  const HealthcareRBAC = await hre.ethers.getContractFactory("HealthcareRBAC");
  const rbac = await HealthcareRBAC.deploy();
  await rbac.waitForDeployment();
  const rbacAddress = await rbac.getAddress();
  console.log("   ✓ HealthcareRBAC deployed to:", rbacAddress);
  await sleep(3500);

  // 7. Deploy WalletMapper
  console.log("7. Deploying WalletMapper...");
  const WalletMapper = await hre.ethers.getContractFactory("WalletMapper");
  const walletMapper = await WalletMapper.deploy();
  await walletMapper.waitForDeployment();
  const walletMapperAddress = await walletMapper.getAddress();
  console.log("   ✓ WalletMapper deployed to:", walletMapperAddress);
  await sleep(3500);

  // 8. Deploy VolunteerRegistry
  console.log("8. Deploying VolunteerRegistry...");
  const VolunteerRegistry = await hre.ethers.getContractFactory("VolunteerRegistry");
  const volunteerRegistry = await VolunteerRegistry.deploy();
  await volunteerRegistry.waitForDeployment();
  const volunteerRegistryAddress = await volunteerRegistry.getAddress();
  console.log("   ✓ VolunteerRegistry deployed to:", volunteerRegistryAddress);

  const deployedAddresses = {
    network: hre.network.name,
    deployer: deployer ? deployer.address : "",
    deployedAt: new Date().toISOString(),
    contracts: {
      AuditLog: auditAddress,
      DataFiduciaryRegistry: registryAddress,
      ConsentManager: consentManagerAddress,
      DataAccessManager: accessManagerAddress,
      MedicalRecords: medicalRecordsAddress,
      HealthcareRBAC: rbacAddress,
      RoleBasedAccess: rbacAddress,
      WalletMapper: walletMapperAddress,
      VolunteerRegistry: volunteerRegistryAddress
    }
  };

  console.log("\n==========================================================");
  console.log(" All Contracts Deployed Successfully!");
  console.log("==========================================================");
  console.log(JSON.stringify(deployedAddresses.contracts, null, 2));

  // Save to frontend config if directory exists
  try {
    const configPath = path.join(__dirname, "../frontend/src/utils/deployedContracts.json");
    fs.writeFileSync(configPath, JSON.stringify(deployedAddresses, null, 2));
    console.log(`\nSaved contract config to: ${configPath}`);
  } catch (e) {
    console.log("Note: Could not save deployedContracts.json automatically");
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});