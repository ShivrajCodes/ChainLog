import crypto from "crypto";

function canonicalize(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((result: any, key) => {
        result[key] = canonicalize(obj[key]);
        return result;
      }, {});
  }
  return obj;
}

export function generateSHA256Hash(data: unknown): string {
  const canonical = canonicalize(data);
  const json = JSON.stringify(canonical);
  return crypto.createHash("sha256").update(json).digest("hex");
}

export function hexToBytes32(hex: string): string {
  return "0x" + hex.padStart(64, "0");
}