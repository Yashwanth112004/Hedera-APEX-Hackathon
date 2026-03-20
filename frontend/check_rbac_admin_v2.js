import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const adminAddress = "0x04Fee3FD1B338d12FFD6dBD8d66dE1e8e0BB99cB";
    const primaryRBAC = "0x0b11e9AA48bf573A8E9d1D5085b71d8c58de9968";
    const abi = [
        "function isAdmin(address) view returns (bool)",
        "function admins(address) view returns (bool)"
    ];
    
    const checkAdmin = async (contractAddress, label) => {
        const contract = new ethers.Contract(contractAddress, abi, provider);
        try {
            const isAdmin = await contract.isAdmin(adminAddress);
            const adminsMap = await contract.admins(adminAddress);
            console.log(`${label} - isAdmin():`, isAdmin, "admins map:", adminsMap);
        } catch (err) {
            console.error(`Failed on ${label}:`, err.message);
        }
    };

    await checkAdmin(primaryRBAC, "Primary RBAC");
}

main();
