const hre = require("hardhat");

async function main() {
    const RBAC_ADDRESS = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919";
    const roleABI = [
        "function getRole(address user) view returns (uint8)"
    ];
    const contract = await hre.ethers.getContractAt(roleABI, RBAC_ADDRESS);

    // Provide the wallet the user tested with, or check the admin wallet temporarily
    const targetWallet = "0x3eB3DE09126807dcc2291ec142cc5B3d137f0E57";

    try {
        const checksummed = hre.ethers.getAddress(targetWallet);
        const roleId = await contract.getRole(checksummed);
        console.log(`Wallet: ${checksummed}, Role ID: ${roleId}`);
    } catch (e) {
        console.log("Error checking role:", e.message);
    }
}

main().catch(console.error);
