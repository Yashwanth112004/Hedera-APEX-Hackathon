import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const consentManagerAddress = "0x931a878562F3c7f3D6B9Ff27f0ce01e1Cb0F4470";
    const abi = ["function audit() view returns (address)"];
    
    const contract = new ethers.Contract(consentManagerAddress, abi, provider);
    try {
        const auditAddress = await contract.audit();
        console.log("Audit address in ConsentManager:", auditAddress);
    } catch (err) {
        console.error("Failed to fetch audit address:", err);
    }
}

main();
