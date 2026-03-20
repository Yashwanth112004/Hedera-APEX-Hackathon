const { ethers } = require("ethers");

async function main() {
    const AUDIT_LOG = "0x92d2eCE8bB295b7806A900Fad7CA26Fd55814976";
    const auditABI = [
        "function getLogs() view returns (tuple(address dataPrincipal, address dataFiduciary, string action, string purpose, uint256 timestamp)[])"
    ];
    
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const contract = new ethers.Contract(AUDIT_LOG, auditABI, provider);
    
    try {
        console.log("Calling getLogs()...");
        const logs = await contract.getLogs();
        console.log("Success! Fetched", logs.length, "logs.");
    } catch (err) {
        console.error("getLogs() failed!");
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        if (err.data) console.error("Error Data:", err.data);
    }
}

main().catch(console.error);
