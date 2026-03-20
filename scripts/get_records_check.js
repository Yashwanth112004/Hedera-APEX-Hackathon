const { ethers } = require("ethers");

async function main() {
    const MEDICAL_RECORDS = "0xd9BB8653aE2Ba8860e4B436D9FdA4c829F04ce85";
    const medicalABI = [
        "function getPatientRecords(address) view returns (tuple(uint256 id,address patient,address provider,string cid,string recordType,uint256 timestamp,uint256 billAmount)[])"
    ];
    
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const contract = new ethers.Contract(MEDICAL_RECORDS, medicalABI, provider);
    
    // Sample patient address from the logs
    const patientAddress = "0x14b991DA635B552cbec7402F0c00e31C197fAc0F";
    
    try {
        console.log(`Calling getPatientRecords for ${patientAddress}...`);
        const records = await contract.getPatientRecords(patientAddress);
        console.log("Success! Fetched", records.length, "records.");
        if (records.length > 0) {
            console.log("Sample Record:", {
                id: records[0].id.toString(),
                cid: records[0].cid,
                bill: records[0].billAmount.toString()
            });
        }
    } catch (err) {
        console.error("getPatientRecords() failed!");
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        if (err.data) console.error("Error Data:", err.data);
    }
}

main().catch(console.error);
