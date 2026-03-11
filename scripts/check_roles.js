const hre = require("hardhat");

async function main() {
    const RBAC_ADDRESS = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919";
    const roleABI = [
        "event RoleAssigned(address indexed user, uint8 role)",
        "event RoleUpdated(address indexed user, uint8 role)",
        "function getRole(address user) view returns (uint8)"
    ];
    const contract = await hre.ethers.getContractAt(roleABI, RBAC_ADDRESS);

    const filterAssigned = contract.filters.RoleAssigned();
    const assignedEvents = await contract.queryFilter(filterAssigned, -5000);

    console.log("Assigned Events:");
    assignedEvents.forEach(e => {
        console.log(`Wallet: ${e.args.user}, Role ID: ${e.args.role}`);
    });
}

main().catch(console.error);
