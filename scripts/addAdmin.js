const { ethers } = require("hardhat")

async function main() {

  const contractAddress = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919"

  const contract = await ethers.getContractAt(
    "HealthcareRBAC",
    contractAddress
  )

  const tx = await contract.addAdmin(
    "0x04Fee3FD1B338d12FFD6dBD8d66dE1e8e0BB99cB"
  )

  await tx.wait()

  console.log("New admin added!")

}

main().catch(console.error)