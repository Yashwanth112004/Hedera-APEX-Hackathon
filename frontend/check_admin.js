import { ethers } from "ethers";
import fs from "fs";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const registryAddress = "0x155Af6ECaFb48861dA7d16Fb8Af2f6ce9d6DD779";
    const abi = [
        "function admins(address) view returns (bool)",
        "function superAdmin() view returns (address)"
    ];
    
    const contract = new ethers.Contract(registryAddress, abi, provider);
    const adminAddress = "0x04Fee3FD1B338d12FFD6dBD8d66dE1e8e0BB99cB";
    
    try {
        const isAdmin = await contract.admins(adminAddress);
        const sa = await contract.superAdmin();
        const result = {
            adminAddress,
            isAdmin,
            superAdmin: sa
        };
        console.log(JSON.stringify(result, null, 2));
        fs.writeFileSync('check_admin_result.json', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Failed to check admin status:", err);
    }
}

main();
