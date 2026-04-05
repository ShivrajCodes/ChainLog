import { ethers } from 'ethers';

/**
 * Recursively sorts object keys to produce a deterministic structure.
 * This guarantees the same data always serializes identically
 * regardless of key insertion order in the source.
 */
function normalizeJSON(data) {
  if (Array.isArray(data)) {
    return data.map(normalizeJSON);
  } else if (data !== null && typeof data === 'object') {
    return Object.keys(data)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeJSON(data[key]);
        return acc;
      }, {});
  }
  return data;
}

/**
 * Fields added to exports for display purposes only.
 * These must be stripped before hashing because they weren't
 * present in the original telemetry object at storage time.
 */
const METADATA_KEYS = ['user'];

function stripMetadata(data) {
  if (typeof data !== 'object' || data === null) return data;
  const cleaned = {};
  for (const key of Object.keys(data)) {
    if (!METADATA_KEYS.includes(key)) {
      cleaned[key] = data[key];
    }
  }
  return cleaned;
}

/**
 * Generates a deterministic SHA-256 hash from a JSON object.
 * 1. Strips metadata fields (e.g. "user")
 * 2. Normalizes key order recursively
 * 3. Stringifies and hashes with SHA-256
 *
 * @param {Object} data - The telemetry data object
 * @returns {string} 64-char hex hash string
 */
export async function generateHash(data) {
  const stripped = stripMetadata(data);
  const normalized = normalizeJSON(stripped);
  const jsonString = JSON.stringify(normalized);

  const encoder = new TextEncoder();
  const encoded = encoder.encode(jsonString);

  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(buffer));

  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts a SHA-256 hex string into a bytes32 value
 * compatible with the smart contract's storage format.
 * Uses keccak256 to produce a proper 32-byte EVM hash.
 *
 * @param {string} hash - 64-char SHA-256 hex string
 * @returns {string} 0x-prefixed bytes32 hex string
 */
export function toBytes32(hash) {
  return ethers.keccak256(ethers.toUtf8Bytes(hash));
}
