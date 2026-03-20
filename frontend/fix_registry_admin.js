import { ethers } from "ethers";

async function main() {
    const pk = "0xa4ae27ce1030b81e1ee9ea47ad61154de36631471f58599d0d58c432d43151bd";
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(pk, provider);
    
    const registryAddress = "0x155Af6ECaFb48861dA7d16Fb8Af2f6ce9d6DD779";
    const abi = [
        "function addAdmin(address) external",
        "function admins(address) view returns (bool)"
    ];
    
    const contract = new ethers.Contract(registryAddress, abi, wallet);
    const targetAdmin = "0x04Fee3FD1B338d12FFD6dBD8d66dE1e8e0BB99cB";
    
    try {
        console.log(`Adding ${targetAdmin} as admin in Registry...`);
        const tx = await contract.addAdmin(targetAdmin, { gasLimit: 1000000 });
        await tx.wait();
        console.log("Admin added successfully!");
    } catch (err) {
        console.error("Failed to add admin:", err);
    }
}

main();
