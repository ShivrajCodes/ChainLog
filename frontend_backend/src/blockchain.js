import { ethers } from 'ethers';
import abi from './abi/contractABI.json';
import { toBytes32 } from './utils/hash';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

const CELO_SEPOLIA_CHAIN_ID_HEX = '0xaa044c';
const CELO_SEPOLIA_CHAIN_ID_DEC = 11142220n;

const CELO_SEPOLIA = {
  chainId: CELO_SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Celo Sepolia Testnet',
  nativeCurrency: {
    name: 'CELO',
    symbol: 'CELO',
    decimals: 18,
  },
  rpcUrls: ['https://forno.celo-sepolia.celo-testnet.org'],
  blockExplorerUrls: ['https://celo-sepolia.blockscout.com'],
};

const WALLET_CONNECTED_KEY = 'chainlog_wallet_connected';

async function ensureCeloSepolia() {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed.');
  }

  const currentChainId = await window.ethereum.request({
    method: 'eth_chainId',
  });

  if (currentChainId?.toLowerCase() === CELO_SEPOLIA_CHAIN_ID_HEX) {
    return;
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CELO_SEPOLIA_CHAIN_ID_HEX }],
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
}

export async function connectWallet(options = {}) {
  const { silent = false, forceAccountSelection = false } = options;

  if (!window.ethereum) {
    throw new Error('MetaMask is not installed.');
  }

  let accounts = [];

  if (silent) {
    accounts = await window.ethereum.request({
      method: 'eth_accounts',
    });

    if (!accounts || accounts.length === 0) {
      localStorage.removeItem(WALLET_CONNECTED_KEY);
      throw new Error('No authorized wallet account found.');
    }
  } else if (forceAccountSelection) {
    await window.ethereum.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });

    accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });
  } else {
    accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });
  }

  if (!accounts || accounts.length === 0) {
    localStorage.removeItem(WALLET_CONNECTED_KEY);
    throw new Error('No wallet account selected.');
  }

  await ensureCeloSepolia();

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  localStorage.setItem(WALLET_CONNECTED_KEY, 'true');

  return { provider, signer, address };
}

export async function disconnectWallet() {
  localStorage.removeItem(WALLET_CONNECTED_KEY);
  return true;
}

export function wasWalletPreviouslyConnected() {
  return localStorage.getItem(WALLET_CONNECTED_KEY) === 'true';
}

export async function storeLogOnChain(hashHex, timestamp, fileName, machineId, signer) {
  if (!signer) throw new Error('Wallet not connected');

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

  const fileHashBytes = toBytes32(hashHex);
  const ts = BigInt(timestamp);

  const tx = await contract.storeLog(fileHashBytes, ts, fileName, machineId);
  await tx.wait();

  return tx.hash;
}

export async function getRecordFromChain(recordIdHex, provider) {
  if (!provider) throw new Error('Provider not available');

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

export async function getMyRecordsFromChain(signer) {
  if (!signer) throw new Error('Wallet not connected');

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
  return await contract.getMyRecords();
}

export async function verifyFileIntegrity(hashHex, fileName, signer) {
  if (!signer) throw new Error('Wallet not connected');

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
  const fileHashBytes = toBytes32(hashHex);

  const recordIds = await contract.getMyRecords();

  const allRecords = [];
  for (const recordId of recordIds) {
    const record = await contract.getRecord(recordId);
    allRecords.push({
      fileHash: record.fileHash,
      timestamp: Number(record.timestamp),
      fileName: record.fileName,
      machineId: record.machineId,
      owner: record.owner,
    });
  }

  const matchedByFileName = allRecords.find((record) => record.fileName === fileName);

  if (matchedByFileName) {
    return {
      isAuthentic: matchedByFileName.fileHash === fileHashBytes,
      matchedRecord: matchedByFileName,
    };
  }

  const matchedByHash = allRecords.find((record) => record.fileHash === fileHashBytes);

  if (matchedByHash) {
    return {
      isAuthentic: true,
      matchedRecord: matchedByHash,
    };
  }

  return { isAuthentic: false, matchedRecord: null };
}

export { CELO_SEPOLIA_CHAIN_ID_DEC };