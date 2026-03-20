import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const adminAddress = "0x04Fee3FD1B338d12FFD6dBD8d66dE1e8e0BB99cB";
    const primaryRBAC = "0x0b11e9AA48bf573A8E9d1D5085b71d8c58de9968";
    const legacyRBAC = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919";
    const abi = ["function isAdmin(address) view returns (bool)"];
    
    const checkAdmin = async (contractAddress, label) => {
        const contract = new ethers.Contract(contractAddress, abi, provider);
        try {
            const result = await contract.isAdmin(adminAddress);
            console.log(`${label} (${contractAddress}) - Is ${adminAddress} Admin?`, result);
        } catch (err) {
            console.error(`Failed to check admin on ${label}:`, err.message);
        }
    };

    await checkAdmin(primaryRBAC, "Primary RBAC");
    await checkAdmin(legacyRBAC, "Legacy RBAC");
}

main();
