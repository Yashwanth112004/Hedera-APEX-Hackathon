import { ethers } from 'ethers';

// Replace with actual deployed address read from last_mapper.txt
export const WALLET_MAPPER_ADDRESS = "0x03650175507C7555dc6896486DcdE213C7fe8Eb1";

export const WALLET_MAPPER_ABI = [
  "function registerShortID(string calldata _shortID) external",
  "function getWalletFromShortID(string calldata _shortID) external view returns (address)",
  "function getShortIDFromWallet(address _wallet) external view returns (string memory)",
  "event ShortIdRegistered(address indexed user, string shortId)"
];

/**
 * Generates a purely local 6-character short ID (3 random digits + last 3 chars of wallet).
 * @param {string} walletAddress The full 0x... address
 * @returns {string} 6-character short ID
 */
export const generateLocalShortID = (walletAddress) => {
  if (!walletAddress || walletAddress.length < 4) return null;
  
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const tail = walletAddress.slice(-3).toUpperCase();
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
    try {
      const resolvedAddress = await walletMapperContract.getWalletFromShortID(input);
      if (resolvedAddress && resolvedAddress !== ethers.ZeroAddress) {
        return resolvedAddress;
      }
    } catch (e) {
      console.warn("Could not resolve Short ID", input, e);
      throw new Error(`Short ID '${input}' not found on-chain.`);
    }
  }

  // Fallback (might throw an invalid address error later in the calling function)
  return input;
};
