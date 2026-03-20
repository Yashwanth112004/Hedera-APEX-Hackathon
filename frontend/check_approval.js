import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const registryAddress = "0x155Af6ECaFb48861dA7d16Fb8Af2f6ce9d6DD779";
    const abi = ["function isApproved(address) view returns (bool)"];
    
    const contract = new ethers.Contract(registryAddress, abi, provider);
    
    // The fiduciary address from the simulation (which I used as insuranceWallet)
    const insuranceWallet = "0x4621C543A63D3a6A0207F6BF66140EB366F9DCB5";
    
    try {
        const approved = await contract.isApproved(insuranceWallet);
        console.log(`Is address ${insuranceWallet} approved?`, approved);
    } catch (err) {
        console.error("Failed to check approval:", err);
    }
}

main();
