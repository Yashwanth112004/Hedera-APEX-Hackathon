import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const primaryRBAC = "0x0b11e9AA48bf573A8E9d1D5085b71d8c58de9968";
    const legacyRBAC = "0xc285Cba71f206fd6AB83514D82Dd389Fe0584919";
    
    const checkCode = async (address, label) => {
        const code = await provider.getCode(address);
        console.log(`${label} (${address}) code length:`, code.length);
        if (code.length > 2) {
             console.log(`${label} code excerpt:`, code.slice(0, 66));
        }
    };

    await checkCode(primaryRBAC, "Primary RBAC");
    await checkCode(legacyRBAC, "Legacy RBAC");
}

main();
