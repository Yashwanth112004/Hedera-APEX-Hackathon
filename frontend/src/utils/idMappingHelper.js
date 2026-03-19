import { ethers } from 'ethers';

// Replace with actual deployed address read from last_mapper.txt
export const WALLET_MAPPER_ADDRESS = "0xE37d6EE16b9C6eE7C29eD93a5b2Bde40e225E659";

export const WALLET_MAPPER_ABI = [
  "function registerShortID(string calldata _shortID) external",
  "function getWalletFromShortID(string calldata _shortID) external view returns (address)",
  "function getShortIDFromWallet(address _wallet) external view returns (string memory)",
  "event ShortIdRegistered(address indexed user, string shortId)"
];

/**
 * Normalizes an Ethereum/Hedera EVM address to EIP-55 or lowercase for consistency.
 * @param {string} address The raw address string
 * @returns {string} Normalized address
 */
export const normalizeAddress = (address) => {
  if (!address) return "";
  try {
    return ethers.getAddress(address.toLowerCase().trim());
  } catch (e) {
    return address.toLowerCase().trim();
  }
};

/**
 * Generates a purely local 6-character short ID (3 random digits + last 3 chars of wallet).
 * @param {string} walletAddress The full 0x... address
 * @returns {string} 6-character short ID
 *
 * TODO: Project Checklist
 * - [x] Update `MedicalRecords.sol` with `billAmount` support
 * - [/] Add bill amount input to `PharmacyDashboard.jsx`
 * - [ ] Update `InsuranceDashboard.jsx` to show bill amounts
 * - [ ] Implement insurance claim initiation in `HospitalDashboard.jsx`
 * - [ ] Implement manual claim filing in `PatientDashboard.jsx`
 * - [ ] Verify full claim workflow (Pharmacy -> Patient -> Insurance)
 */
export const generateLocalShortID = (walletAddress) => {
  const normalized = normalizeAddress(walletAddress);
  if (!normalized || normalized.length < 4) return null;

  // Use a more robust random for IDs to avoid collisions
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const tail = normalized.slice(-3).toUpperCase();
  return `${rand}${tail}`;
};

/**
 * Resolves a 6-character short ID or returns the original input if it's already a full address.
 * Use this in forms before interacting with contracts.
 * @param {string} input Current input value
 * @param {ethers.Contract} walletMapperContract Valid initialized contract instance
 * @returns {Promise<string>} Full wallet address
 */
export const resolveWalletAddress = async (input, walletMapperContract) => {
  if (!input) return "";

  // If it's already a valid Ethereum address, return it
  if (ethers.isAddress(input)) {
    return input;
  }

  // If it's 6 chars long, attempt to resolve via the WalletMapper contract
  if (input.length === 6 && walletMapperContract) {
    const tryResolve = async (id) => {
      try {
        // Use provider-connected version as it's safer for view calls
        const provider = walletMapperContract.runner?.provider || walletMapperContract.runner;
        if (!provider) throw new Error("No provider available");

        // DIAGNOSTIC: Check if contract actually exists on this network
        const network = await provider.getNetwork();
        const code = await provider.getCode(WALLET_MAPPER_ADDRESS);
        
        if (code === "0x" || code === "0x0") {
          console.error(`CRITICAL: WalletMapper not found at ${WALLET_MAPPER_ADDRESS} on Chain ID ${network.chainId} (${network.name})`);
          throw new Error(`WalletMapper contract not found on the current network (Chain ID: ${network.chainId}). Please ensure you are on the correct Hedera network.`);
        }

        const readOnlyMapper = new ethers.Contract(WALLET_MAPPER_ADDRESS, WALLET_MAPPER_ABI, provider);
        const resolvedAddress = await readOnlyMapper.getWalletFromShortID(id);
        
        if (resolvedAddress && resolvedAddress !== ethers.ZeroAddress) {
          return resolvedAddress;
        }
      } catch (e) {
        // RPC or Revert
        if (e.message.includes("HTTP client error") || e.message.includes("missing revert data")) {
          console.error(`RPC Failure resolving ${id}:`, e.message);
          throw e;
        }
        return null; // Likely "Short ID not found" (revert)
      }
      return null;
    };

    // 1. Try exact match
    let resolved = await tryResolve(input);
    
    // 2. Try uppercase fallback if not found
    if (!resolved && input !== input.toUpperCase()) {
      resolved = await tryResolve(input.toUpperCase());
    }

    if (resolved) return resolved;

    throw new Error(`Short ID '${input}' not found. Please verify the ID.`);
  }

  // Fallback
  return input;
};
