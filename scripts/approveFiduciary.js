async function main() {

  const registryAddress = "0xb54F86cb9a87f4F8c27915c9820e2a4D48221Db2";
  const hospitalAddress = "0x66d6cfe2e2e93ddb5c0ce954d8830d6d0d701c44";

  const Registry = await ethers.getContractFactory("DataFiduciaryRegistry");
  const registry = Registry.attach(registryAddress);

  const tx = await registry.approveFiduciary(hospitalAddress);
  await tx.wait();

  console.log("Fiduciary approved successfully");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});