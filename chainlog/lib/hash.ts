import { createHash } from 'crypto';

export function generateSHA256Hash(data: unknown): string {
  const jsonString = JSON.stringify(data);
  return createHash('sha256').update(jsonString, 'utf8').digest('hex');
}

export function hexToBytes32(hex: string): string {
  return '0x' + hex.padStart(64, '0');
}