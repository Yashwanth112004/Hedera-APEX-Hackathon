require("@nomicfoundation/hardhat-toolbox");

require("dotenv").config();

module.exports = {
  solidity: "0.8.28",
  networks: {
    testnet: {
      url: "https://testnet.hashio.io/api",
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};