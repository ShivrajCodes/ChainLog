import { ethers } from "ethers";
import ABI from "@/abi/LogIntegrity.json";

const CELO_SEPOLIA_CHAIN_ID = 11142220;

export function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("RPC_URL is not set");
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getSigner(): ethers.Wallet {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY is not set");
  return new ethers.Wallet(privateKey, getProvider());
}

export async function assertCorrectNetwork(): Promise<void> {
  const provider = getProvider();
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CELO_SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Wrong network: connected to chainId ${network.chainId} but expected Celo Sepolia (${CELO_SEPOLIA_CHAIN_ID}). ` +
      `Check youur RPC_URL and ensure it's set to a Celo Sepolia endpoint like https://forno.celo-sepolia.celo-testnet.org`
    );
  }
}

export function getSignerContract(): ethers.Contract {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error("CONTRACT_ADDRESS is not set");
  return new ethers.Contract(contractAddress, ABI, getSigner());
}

export function getReaderContract(): ethers.Contract {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error("CONTRACT_ADDRESS is not set");
  return new ethers.Contract(contractAddress, ABI, getProvider());
}

export function isChainConfigured(): boolean {
  return !!(process.env.PRIVATE_KEY && process.env.CONTRACT_ADDRESS && process.env.RPC_URL);
}