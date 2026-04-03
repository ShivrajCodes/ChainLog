import { ethers } from "ethers";
import ABI from "@/abi/LogIntegrity.json";

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(process.env.RPC_URL!);
}

export function getSignerContract(): ethers.Contract {
  const provider = getProvider();
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  return new ethers.Contract(process.env.CONTRACT_ADDRESS!, ABI, wallet);
}

export function getReadContract(): ethers.Contract {
  const provider = getProvider();
  return new ethers.Contract(process.env.CONTRACT_ADDRESS!, ABI, provider);
}

export function hashLogContent(content: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(content));
}

export function generateRecordId(machineId: string, timestamp: number): string {
  return ethers.keccak256(
    ethers.solidityPacked(["string", "uint256"], [machineId, timestamp])
  );
}