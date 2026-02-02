import crypto from 'crypto';
import QRCode from 'qrcode';
import { config } from '../../config/index.js';

// Base32 alphabet for TOTP
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export interface MFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAVerifyResult {
  valid: boolean;
  usedBackupCode?: boolean;
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(encoded: string): Buffer {
  const cleanEncoded = encoded.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleanEncoded.length; i++) {
    const char = cleanEncoded[i];
    const index = BASE32_CHARS.indexOf(char);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function generateTOTP(secret: string, counter: number): string {
  const secretBuffer = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);

  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0xf;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return String(code % 1000000).padStart(6, '0');
}

export function generateSecret(): string {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

export async function setupMFA(email: string): Promise<MFASetupResult> {
  const secret = generateSecret();
  const backupCodes = generateBackupCodes(10);

  // Generate otpauth URL
  const issuer = encodeURIComponent(config.mfa.issuer);
  const account = encodeURIComponent(email);
  const otpauthUrl = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  // Generate QR code as data URL
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return {
    secret,
    qrCodeUrl,
    backupCodes,
  };
}

export function verifyTOTP(secret: string, token: string): boolean {
  const time = Math.floor(Date.now() / 1000 / 30);
  const window = config.mfa.tokenWindow;

  // Check current time step and window before/after
  for (let i = -window; i <= window; i++) {
    const expectedToken = generateTOTP(secret, time + i);
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
      return true;
    }
  }

  return false;
}

export function verifyBackupCode(
  inputCode: string,
  hashedBackupCodes: string[]
): { valid: boolean; usedIndex: number } {
  const normalizedInput = inputCode.replace(/-/g, '').toUpperCase();
  const inputHash = hashBackupCode(normalizedInput);

  for (let i = 0; i < hashedBackupCodes.length; i++) {
    if (hashedBackupCodes[i] && crypto.timingSafeEqual(
      Buffer.from(inputHash),
      Buffer.from(hashedBackupCodes[i])
    )) {
      return { valid: true, usedIndex: i };
    }
  }

  return { valid: false, usedIndex: -1 };
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function hashBackupCodes(codes: string[]): string[] {
  return codes.map((code) => hashBackupCode(code.replace(/-/g, '').toUpperCase()));
}
