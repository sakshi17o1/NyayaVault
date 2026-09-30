import { z } from "zod";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const globalForEnv = globalThis as unknown as { __DEV_SESSION_SECRET: string };
const DEV_RANDOM_SECRET = globalForEnv.__DEV_SESSION_SECRET ?? Math.random().toString(36).substring(2) + Date.now().toString(36);
if (process.env.NODE_ENV !== "production") {
  globalForEnv.__DEV_SESSION_SECRET = DEV_RANDOM_SECRET;
}

const sessionSecret = process.env.SESSION_SECRET ?? DEV_RANDOM_SECRET;
const encryptionKey = process.env.ENCRYPTION_KEY ?? "";
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 || process.env.SESSION_SECRET.startsWith("replace-with")) {
    throw new Error("SESSION_SECRET missing, short, or default in production");
  }
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef") {
    throw new Error("ENCRYPTION_KEY missing or default in production");
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  sessionSecret,
  encryptionKey,
  demoOtp: process.env.DEMO_OTP ?? "000000",
  demoRoleSwitch: !isProd && (process.env.DEMO_ROLE_SWITCH ?? "false") === "true",
  rateLimitRpm: Number(process.env.RATE_LIMIT_RPM ?? "120"),
  storageAdapter: process.env.STORAGE_ADAPTER ?? "filesystem",
  storageRoot: process.env.STORAGE_ROOT ?? "./storage/objects",
  searchAdapter: process.env.SEARCH_ADAPTER ?? "sqlite_fts",
  ledgerAdapter: process.env.LEDGER_ADAPTER ?? "hash_chain",
  espSecret: process.env.ESP_SECRET ?? "super-secure-national-esign-secret-key-2026",
  awsKmsKeyId: process.env.AWS_KMS_KEY_ID,
};

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  otp: z.string().optional(),
});

export { requireEnv };
