const hre = require("hardhat");

async function main() {
    console.log("Testing addPrescription...");
    const MedicalRecords = await hre.ethers.getContractFactory("MedicalRecords");

    const medicalRecords = await MedicalRecords.attach("0x8627E5f5a4b01688f7eA2DB6Ce8E5B24de1ADe51");

    try {
        console.log("Executing transaction...");
        const tx = await medicalRecords.addPrescription(
            "0xF9B6F4B147678c1DD0C4B789dB4D15Ec49d0539D",
            "Satish",
            "QmcVfU2kR7M11j3iKryD8iKxW6R9pA2qJ9zL2tC9i8f3gV",
            { gasLimit: 3000000 }
        );
        console.log("Tx hashing...", tx.hash);
        await tx.wait();
        console.log("Success!");
    } catch (err) {
        console.error("REVERT ERROR CATCHED:", err);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
