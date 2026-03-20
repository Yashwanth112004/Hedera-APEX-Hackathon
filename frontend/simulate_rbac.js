import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const adminAddress = "0x04Fee3FD1B338d12FFD6dBD8d66dE1e8e0BB99cB";
    const primaryRBAC = "0x0b11e9AA48bf573A8E9d1D5085b71d8c58de9968";
    const abi = ["function registerRole(address user, uint8 role)"];
    
    const contract = new ethers.Contract(primaryRBAC, abi, provider);
    
    const userToRegister = "0x990E741672E66D67507d10AEE96FFa076A968b54"; // Example user
    const roleId = 1;
    
    try {
        const data = contract.interface.encodeFunctionData("registerRole", [userToRegister, roleId]);
        
        await provider.call({
            to: primaryRBAC,
            from: adminAddress,
            data: data
        });
        console.log("Simulation Successful!");
    } catch (err) {
        console.error("Simulation failed object:", JSON.stringify(err, null, 2));
        if (err.data) {
             const reason = ethers.toUtf8String("0x" + err.data.slice(138));
             console.log("Revert Reason:", reason);
        }
    }
}

main();
