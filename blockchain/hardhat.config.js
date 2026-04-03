import "dotenv/config";
import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

export default defineConfig({
  solidity: "0.8.20",
  plugins: [hardhatEthers, hardhatVerify],
  networks: {
    celoSepolia: {
      type: "http",
      url: process.env.CELO_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  verify: {
    blockscout: {
      enabled: true,
    },
  },
});