import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored?: string | null) {
  if (!stored || !stored.includes(":")) {
    return false;
  }
  const [salt, hash] = stored.split(":");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(hash, "hex");
  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }
  return timingSafeEqual(derivedKey, storedBuffer);
}
