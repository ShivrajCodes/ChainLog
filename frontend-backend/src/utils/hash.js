/**
 * Generates a SHA-256 hash string from a valid JSON object.
 * Utilizes the built-in Web Crypto API.
 */
export async function generateSHA256Hash(data) {
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);
  
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}
