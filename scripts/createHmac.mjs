import crypto from 'crypto';
import prompt_sync from 'prompt-sync';

function hash(data) {
  const sha256Hash = crypto.createHash('sha256');
  sha256Hash.update(data);
  return sha256Hash.digest('hex');
}

function generateHMAC(email, secret) {
  return crypto.createHmac('sha256', secret).update(email).digest('hex');
}

function encodeToBase64(commaSeparatedApiKey){
  console.log('key',commaSeparatedApiKey);
  const buffer = Buffer.from(commaSeparatedApiKey, 'utf-8');
  return buffer.toString('base64');
}

function decodeFromBase64(encodedData) {
  const buffer = Buffer.from(encodedData, 'base64');
  return buffer.toString('utf-8');
}

const prompt = prompt_sync({ sigint: true });

const email = prompt('Email: ');
const orgKey = prompt('ORG Key: ');

const apiKey = (decodeFromBase64(orgKey)).split(',');
const apiKeySecretHash=hash(apiKey[1]);
const hmac=generateHMAC(email, apiKeySecretHash);
console.log(encodeToBase64(`${email},${apiKey[0]},${hmac}`));
