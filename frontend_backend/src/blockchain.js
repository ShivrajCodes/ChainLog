import { ethers } from 'ethers';
import abi from './abi/contractABI.json';
import { toBytes32 } from './utils/hash';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// Celo Sepolia Testnet chain config (chain ID 11142220)
const CELO_SEPOLIA = {
  chainId: '0xAA044C',
  chainName: 'Celo Sepolia Testnet',
  nativeCurrency: {
    name: 'CELO',
    symbol: 'CELO',
    decimals: 18
  },
  rpcUrls: ['https://forno.celo-sepolia.celo-testnet.org'],
  blockExplorerUrls: ['https://celo-sepolia.blockscout.com']
};

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed!');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CELO_SEPOLIA.chainId }],
    });
  } catch (error) {
    if (error.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [CELO_SEPOLIA],
      });
    } else {
      throw error;
    }
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}

/**
 * Stores a log on-chain.
 * Converts the SHA-256 hex hash to bytes32 via keccak256 before sending.
 *
 * @param {string} hashHex - SHA-256 hex string from generateHash()
 * @param {number} timestamp - Unix epoch in seconds
 * @param {string} fileName - Name of the telemetry file
 * @param {string} machineId - Identifier for the machine/sensor
 * @param {ethers.Signer} signer - Connected wallet signer
 * @returns {string} Transaction hash
 */
export async function storeLogOnChain(hashHex, timestamp, fileName, machineId, signer) {
  if (!signer) throw new Error("Wallet not connected");

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

  const fileHashBytes = toBytes32(hashHex);
  const ts = BigInt(timestamp);

  const tx = await contract.storeLog(fileHashBytes, ts, fileName, machineId);
  console.log("Transaction sent:", tx.hash);

  await tx.wait();

  return tx.hash;
}

/**
 * Retrieves a specific record by its recordId from on-chain storage.
 */
export async function getRecordFromChain(recordIdHex, provider) {
  if (!provider) throw new Error("Provider not available");

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
  const record = await contract.getRecord(recordIdHex);

  return {
    fileHash: record.fileHash,
    timestamp: Number(record.timestamp),
    fileName: record.fileName,
    machineId: record.machineId,
    owner: record.owner,
  };
}

/**
 * Retrieves all record IDs belonging to the connected wallet.
 */
export async function getMyRecordsFromChain(signer) {
  if (!signer) throw new Error("Wallet not connected");

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
  const recordIds = await contract.getMyRecords();
  return recordIds;
}

/**
 * Verifies file integrity by:
 * 1. Converting the SHA-256 hash to bytes32 (same as storage)
 * 2. Getting all the caller's record IDs
 * 3. Fetching each record and comparing fileHash
 *
 * @param {string} hashHex - SHA-256 hex string from generateHash()
 * @param {ethers.Signer} signer - Connected wallet signer
 * @returns {Object} { isAuthentic: bool, matchedRecord: LogRecord | null }
 */
export async function verifyFileIntegrity(hashHex, signer) {
  if (!signer) throw new Error("Wallet not connected");

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
  const fileHashBytes = toBytes32(hashHex);

  // Fetch the caller's record IDs
  const recordIds = await contract.getMyRecords();

  for (const recordId of recordIds) {
    const record = await contract.getRecord(recordId);

    if (record.fileHash === fileHashBytes) {
      return {
        isAuthentic: true,
        matchedRecord: {
          fileHash: record.fileHash,
          timestamp: Number(record.timestamp),
          fileName: record.fileName,
          machineId: record.machineId,
          owner: record.owner,
        },
      };
    }
  }

  return { isAuthentic: false, matchedRecord: null };
}