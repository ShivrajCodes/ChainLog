import { ethers } from 'ethers';
import ABI from '@/abi/LogIntegrity.json';

export function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('RPC_URL is not set in environment variables');
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getSigner(): ethers.Wallet {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY is not set in environment variables');
  return new ethers.Wallet(privateKey, getProvider());
}

export function getSignerContract(): ethers.Contract {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error('CONTRACT_ADDRESS is not set in environment variables');
  return new ethers.Contract(contractAddress, ABI, getSigner());
}

export function getReaderContract(): ethers.Contract {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error('CONTRACT_ADDRESS is not set in environment variables');
  return new ethers.Contract(contractAddress, ABI, getProvider());
}