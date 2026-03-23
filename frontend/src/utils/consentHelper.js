import { ethers } from "ethers";

/**
 * Legacy ABI for the Consent struct (8 fields)
 * Used as a fallback when the Hedera network returns data that doesn't match the new 9-field ABI.
 */
export const consentABIOld = [
  "function getPatientConsents(address) view returns (tuple(address dataPrincipal,address dataFiduciary,string purpose,string dataHash,uint256 grantedAt,uint256 expiry,bool isActive,bool erased)[])",
  "function getPendingRequests(address) view returns (tuple(uint256 id,address provider,string purpose,uint256 timestamp,bool isPending)[])",
  "function approveRequest(uint256,string,uint256)"
];

/**
 * Robustly fetches and decodes patient consents, falling back to legacy ABI if necessary.
 * @param {ethers.Contract} consentContract - The active consent contract instance.
 * @param {string} patientAddress - The wallet address of the patient.
 * @param {string} contractAddress - The address of the ConsentManager contract.
 * @param {ethers.Provider} provider - The ethers provider.
 * @returns {Promise<Array>} - Array of normalized consent objects.
 */
export const getSafePatientConsents = async (consentContract, patientAddress, contractAddress, provider) => {
    try {
        // Attempt normal fetch with current ABI
        const res = await consentContract.getFunction("getPatientConsents")(patientAddress);
        // Normalize ethers.js Result tuples to plain JS objects
        // (Result proxy objects can lose property accessors when passed as React props)
        return res.map(c => ({
            dataPrincipal: c.dataPrincipal,
            dataFiduciary: c.dataFiduciary,
            purpose: c.purpose,
            dataHash: c.dataHash,
            dataScope: c.dataScope || "All",
            grantedAt: c.grantedAt,
            expiry: c.expiry,
            isActive: Boolean(c.isActive),
            erased: Boolean(c.erased)
        }));
    } catch (decodeErr) {
        // Detect "BAD_DATA" or decoding errors typical of ABI mismatch on Hedera
        if (decodeErr.code === "BAD_DATA" || (decodeErr.message && decodeErr.message.includes("could not decode"))) {
            console.warn(`[ConsentHelper] Decoding failed for ${patientAddress}, trying legacy fallback...`);
            
            try {
                const legacyContract = new ethers.Contract(contractAddress, consentABIOld, provider);
                const legacyRes = await legacyContract.getFunction("getPatientConsents")(patientAddress);
                
                // Map legacy Results (8 fields) to New Format (9 fields)
                // New field added: dataScope (defaulting to "All")
                return legacyRes.map(c => ({
                    dataPrincipal: c.dataPrincipal,
                    dataFiduciary: c.dataFiduciary,
                    purpose: c.purpose,
                    dataHash: c.dataHash,
                    dataScope: "All", // Default for legacy records
                    grantedAt: c.grantedAt,
                    expiry: c.expiry,
                    isActive: c.isActive,
                    erased: c.erased
                }));
            } catch (fallbackErr) {
                console.error("[ConsentHelper] Legacy fallback also failed:", fallbackErr);
                throw fallbackErr;
            }
        } else {
            // Rethrow if it's not a decoding error
            throw decodeErr;
        }
    }
};

/**
 * Robustly fetches pending requests, with error logging.
 */
export const getSafePendingRequests = async (consentContract, patientAddress, contractAddress, provider) => {
    try {
        return await consentContract.getFunction("getPendingRequests")(patientAddress);
    } catch (err) {
        if (err.code === "BAD_DATA" || (err.message && err.message.includes("could not decode"))) {
            console.warn(`[ConsentHelper] Request decoding failed for ${patientAddress}, trying legacy fallback...`);
            try {
                const legacyContract = new ethers.Contract(contractAddress, consentABIOld, provider);
                return await legacyContract.getFunction("getPendingRequests")(patientAddress);
            } catch (fallbackErr) {
                console.error("[ConsentHelper] Legacy request fallback failed:", fallbackErr);
                return [];
            }
        }
        console.error(`[ConsentHelper] Failed to fetch requests for ${patientAddress}:`, err);
        return [];
    }
};

/**
 * Robustly approves a request, trying both NEW and OLD ABI signatures.
 */
export const safeApproveRequest = async (consentContract, requestId, dataHash, scope, duration, contractAddress, signer) => {
    try {
        // Try NEW ABI first: (uint256, string, string, uint256)
        console.log("[ConsentHelper] Attempting NEW ABI approval...");
        return await consentContract.approveRequest(requestId, dataHash, scope, duration, { gasLimit: 2000000 });
    } catch (err) {
        console.warn("[ConsentHelper] NEW ABI approval failed, trying legacy...", err.message);
        try {
            const legacyContract = new ethers.Contract(contractAddress, consentABIOld, signer);
            // Legacy ABI: (uint256, string, uint256) -> scope is omitted
            return await legacyContract.approveRequest(requestId, dataHash, duration, { gasLimit: 2000000 });
        } catch (fallbackErr) {
            console.error("[ConsentHelper] Both approval attempts failed:", fallbackErr);
            throw fallbackErr;
        }
    }
};
