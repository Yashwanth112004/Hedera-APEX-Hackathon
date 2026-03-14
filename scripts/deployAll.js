async function main() {

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1️⃣ Deploy DataFiduciaryRegistry
  const Registry = await ethers.getContractFactory("DataFiduciaryRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("Registry deployed to:", registryAddress);

  // 2️⃣ Deploy AuditLog
  const Audit = await ethers.getContractFactory("AuditLog");
  const audit = await Audit.deploy();
  await audit.waitForDeployment();
  const auditAddress = await audit.getAddress();
  console.log("AuditLog deployed to:", auditAddress);

  // 3️⃣ Deploy ConsentManager
  const Consent = await ethers.getContractFactory("ConsentManager");
  const consent = await Consent.deploy(registryAddress, auditAddress);
  await consent.waitForDeployment();
  const consentAddress = await consent.getAddress();
  console.log("ConsentManager deployed to:", consentAddress);

  // 4️⃣ Deploy DataAccessManager
  const Access = await ethers.getContractFactory("DataAccessManager");
  const access = await Access.deploy(consentAddress, auditAddress);
  await access.waitForDeployment();
  const accessAddress = await access.getAddress();
  console.log("DataAccessManager deployed to:", accessAddress);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});