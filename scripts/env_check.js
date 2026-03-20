require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
    const key = process.env.PRIVATE_KEY;
    if (!key) {
        console.log("ERROR: PRIVATE_KEY is not defined in .env");
        return;
    }
    console.log("PRIVATE_KEY is defined. Length:", key.length);
    
    // Check balance
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(key, provider);
    console.log("Wallet address:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "HBAR");
}

main().catch(console.error);
