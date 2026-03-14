import axios from 'axios';
import CryptoJS from 'crypto-js';

// Configuration from provided JWT
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxOGVkZDljMC0yODU3LTRkZTEtOTQ3ZS01ODJkMWU3ZDBlZDkiLCJlbWFpbCI6InB1bGlnaWxsYS55YXNod2FudEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiODBkNzUyODY1ZGRjN2I5YWYzNjEiLCJzY29wZWRLZXlTZWNyZXQiOiIzMTI2OGYyODFkMDZjOTQ5MTFkZDk4NDMxNjVlNWFkMjkyMDQ3YTI3YWNhYWY1N2ZlMDAyZTA4NmRlNGYzMzY0IiwiZXhwIjoxNzk0MTEzODk3fQ.3p91kASUCiF0US8GwgX6ARMTDIaopeqNBnD_XIVP2ag';

// Use a static secret for demo purposes, or prompt user. In prod, this might be derived from signatures.
const DEMO_SECRET_KEY = 'dpdp-healthcare-secret-key-2026';

/**
 * Encrypts a JSON payload symmetrically
 * @param {Object} data - The medical data to encrypt
 * @returns {string} - AES encrypted string
 */
export const encryptData = (data, secretKey = DEMO_SECRET_KEY) => {
    return CryptoJS.AES.encrypt(JSON.stringify(data), secretKey).toString();
};

/**
 * Decrypts a payload back to JSON
 * @param {string} encryptedText 
 * @returns {Object}
 */
export const decryptData = (encryptedText, secretKey = DEMO_SECRET_KEY) => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedText, secretKey);
        const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decryptedString);
    } catch (error) {
        console.error("Decryption failed. Incorrect key or corrupt data.");
        throw new Error("Unable to decrypt medical data");
    }
};

/**
 * Uploads Encrypted String to IPFS via Pinata
 * @param {string} encryptedPayload - the ciphertext
 * @param {string} name - identifier for the pin
 * @returns {Promise<string>} - Returns the IPFS CID Hash
 */
export const uploadToPinata = async (encryptedPayload, name = "Medical Record") => {
    try {
        // Prepare JSON structure for Pinata
        const data = JSON.stringify({
            pinataOptions: { cidVersion: 1 },
            pinataMetadata: { name: name },
            pinataContent: {
                payload: encryptedPayload,
                timestamp: Date.now()
            }
        });

        const res = await axios.post(
            "https://api.pinata.cloud/pinning/pinJSONToIPFS",
            data,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${PINATA_JWT}`
                }
            }
        );
        return res.data.IpfsHash;
    } catch (error) {
        console.error("Error uploading to Pinata:", error);
        throw new Error("Failed to upload to IPFS network");
    }
};

/**
 * Fetches JSON from IPFS via Pinata Gateway
 * @param {string} cid - The IPFS hash
 * @returns {Promise<string>} - The encrypted payload string
 */
export const fetchFromPinata = async (cid) => {
    try {
        // Using Pinata's public gateway for retrieval. Ideally use a dedicated gateway.
        const res = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`);
        return res.data.payload;
    } catch (error) {
        console.error("Error fetching from Pinata:", error);
        throw new Error("Failed to retrieve file from IPFS network");
    }
};
