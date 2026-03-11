// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract WalletMapper {
    // Maps short ID string to full wallet address
    mapping(string => address) private shortIdToAddress;
    
    // Maps wallet address to short ID string
    mapping(address => string) private addressToShortId;

    event ShortIdRegistered(address indexed user, string shortId);

    /**
     * @dev Register a 6-character short ID for the caller's wallet.
     * Reverts if the ID is already taken or if the caller already has an ID.
     */
    function registerShortID(string calldata _shortID) external {
        require(bytes(_shortID).length == 6, "ID must be exactly 6 characters");
        require(shortIdToAddress[_shortID] == address(0), "Short ID already taken");
        require(bytes(addressToShortId[msg.sender]).length == 0, "Wallet already has a Short ID");

        shortIdToAddress[_shortID] = msg.sender;
        addressToShortId[msg.sender] = _shortID;

        emit ShortIdRegistered(msg.sender, _shortID);
    }

    /**
     * @dev Returns the full wallet address corresponding to a short ID.
     */
    function getWalletFromShortID(string calldata _shortID) external view returns (address) {
        address wallet = shortIdToAddress[_shortID];
        require(wallet != address(0), "Short ID not found");
        return wallet;
    }

    /**
     * @dev Returns the short ID corresponding to a wallet address.
     */
    function getShortIDFromWallet(address _wallet) external view returns (string memory) {
        return addressToShortId[_wallet];
    }
}
