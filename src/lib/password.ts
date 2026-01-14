import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
};

export const verifyPassword = (password: string, storedHash: string) => {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  const keyBuffer = Buffer.from(key, "hex");
  return (
    keyBuffer.length === derivedKey.length &&
    timingSafeEqual(keyBuffer, derivedKey)
  );
};
