import keygen from 'keygen';
import * as crypto from 'crypto';
import { ApiKey } from '../types/internal/ApiKey';
import * as cryptojs from 'crypto-js';
export const apiKeyLength = keygen.medium;
export const apiSecretLength = keygen.large;

function generateApiKey(): string {
  return keygen.url(apiKeyLength);
}

function generateApiSecret(): string {
  return keygen.url(apiSecretLength);
}

export function hash(data: string): string {
  const sha256Hash = crypto.createHash('sha256');
  sha256Hash.update(data);

  return sha256Hash.digest('hex');
}

export function generateHMAC(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function generateApiKeyWithSecret(): ApiKey {
  const secret = generateApiSecret();

  return {
    key: generateApiKey(),
    secret: secret,
    secret_hash: hash(secret),
  };
}

export function verify(data: string, hashedValue: string): boolean {
  const hashedData = hash(data);

  return hashedData === hashedValue;
}

export function verifyHMAC(hmac: string, apiSecretHash: string, userEmail: string): boolean {
  const generatedHMAC = generateHMAC(userEmail, apiSecretHash);

  return hmac === generatedHMAC;
}

export function encodeToBase64(commaSeparatedApiKey: string): string {
  const buffer = Buffer.from(commaSeparatedApiKey, 'utf-8');

  return buffer.toString('base64');
}

export function decodeFromBase64(encodedData: string): string {
  const buffer = Buffer.from(encodedData, 'base64');

  return buffer.toString('utf-8');
}

export function encryptData(data: string): string {
  const encryptedData = cryptojs.AES.encrypt(data, process.env.ENCRYPTION_KEY!).toString();

  return encryptedData;
}

export function decryptData(encryptedData: string): string {
  const decryptedBytes = cryptojs.AES.decrypt(encryptedData, process.env.ENCRYPTION_KEY!);

  return decryptedBytes.toString(cryptojs.enc.Utf8);
}
