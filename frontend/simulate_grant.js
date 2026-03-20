import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const consentManagerAddress = "0x931a878562F3c7f3D6B9Ff27f0ce01e1Cb0F4470";
    const abi = ["function grantConsent(address,string,string,string,uint256)"];
    
    const contract = new ethers.Contract(consentManagerAddress, abi, provider);
    
    const insuranceWallet = "0x990E741672E66D67507d10AEE96FFa076A968b54";
    const purpose = "Insurance Claim Filing for CID QmTestHash";
    const dataHash = "QmTestHash";
    const dataScope = "Clinical Record";
    const duration = 2592000;
    
    try {
        const data = contract.interface.encodeFunctionData("grantConsent", [
            insuranceWallet,
            purpose,
            dataHash,
            dataScope,
            duration
        ]);
        
        const res = await provider.call({
            to: consentManagerAddress,
            from: insuranceWallet, // Simulate as the user
            data: data
        });
        console.log("Simulation Result:", res);
    } catch (err) {
        console.error("Simulation failed object:", JSON.stringify(err, null, 2));
        if (err.data) {
            try {
                const reason = ethers.toUtf8String("0x" + err.data.slice(138));
                console.log("Revert Reason:", reason);
            } catch (e) {
                console.error("Failed to decode reason:", e);
            }
        }
    }
}

main();
