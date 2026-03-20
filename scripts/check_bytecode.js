const { ethers } = require("ethers");

async function main() {
    const AUDIT_LOG = "0x92d2eCE8bB295b7806A900Fad7CA26Fd55814976";
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    
    console.log(`Checking bytecode at ${AUDIT_LOG}...`);
    const code = await provider.getCode(AUDIT_LOG);
    console.log(`Bytecode length: ${code.length}`);
    if (code === "0x") {
        console.error("No contract found at this address!");
    } else {
        console.log("Contract found.");
        // Check for getLogs function selector: 0x2719597a (approximation)
        // Actually I'll just check if it's long enough to be an AuditLog
        if (code.length < 100) console.warn("Bytecode seems too short for AuditLog.");
    }
}

main().catch(console.error);
