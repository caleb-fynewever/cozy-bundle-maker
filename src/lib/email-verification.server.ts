import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .regex(/\.edu$/i, "Use your .edu email address.");
const codeSchema = z.string().regex(/^\d{6}$/);
const encoder = new TextEncoder();

function serverEnv() {
  return (
    (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env ?? {}
  );
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  if (!/^(?:[\da-f]{2})+$/i.test(value)) throw new Error("Invalid verification token");
  return Uint8Array.from(value.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function seal(payload: { email: string; code: string; expiresAt: number }) {
  const secret = serverEnv()["EMAIL_VERIFICATION_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error(
      "Email verification is not configured. Set EMAIL_VERIFICATION_SECRET on the server.",
    );
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(secret),
    encoder.encode(JSON.stringify(payload)),
  );
  return `${bytesToHex(iv)}.${bytesToHex(new Uint8Array(ciphertext))}`;
}

async function unseal(token: string) {
  const secret = serverEnv()["EMAIL_VERIFICATION_SECRET"];
  if (!secret || secret.length < 32) throw new Error("Email verification is not configured.");
  const [ivHex, ciphertextHex, extra] = token.split(".");
  if (!ivHex || !ciphertextHex || extra) throw new Error("Invalid verification token");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(ivHex) },
    await encryptionKey(secret),
    hexToBytes(ciphertextHex),
  );
  return z
    .object({
      email: z.string().email(),
      code: codeSchema,
      expiresAt: z.number(),
    })
    .parse(JSON.parse(new TextDecoder().decode(plaintext)));
}

const requestSchema = z.object({ email: emailSchema });

export const requestEmailVerification = createServerFn({ method: "POST" })
  .validator(requestSchema)
  .handler(async ({ data }) => {
    const env = serverEnv();
    const missing = ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_VERIFICATION_SECRET"].filter(
      (key) => !env[key],
    );
    if (missing.length) {
      throw new Error(
        `Email verification is not configured. Add ${missing.join(", ")} to the server environment and restart the app.`,
      );
    }

    const email = data.email.toLowerCase();
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(
      6,
      "0",
    );
    const token = await seal({ email, code, expiresAt: Date.now() + 10 * 60 * 1000 });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env["RESEND_API_KEY"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env["EMAIL_FROM"],
        to: [email],
        subject: "Your wego verification code",
        text: `Your wego code is ${code}. It expires in 10 minutes. If you didn't request it, you can ignore this email.`,
        html: `<p>Your wego verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`,
      }),
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 1000);
      console.error("Resend email delivery failed", response.status, details);
      throw new Error("Could not send your code. Check the email sender setup and try again.");
    }

    return { token };
  });

const verifySchema = z.object({
  email: emailSchema,
  code: codeSchema,
  token: z.string().min(1).max(1000),
});

export const verifyEmailCode = createServerFn({ method: "POST" })
  .validator(verifySchema)
  .handler(async ({ data }) => {
    try {
      const payload = await unseal(data.token);
      return {
        valid:
          payload.email === data.email.trim().toLowerCase() &&
          payload.code === data.code &&
          payload.expiresAt >= Date.now(),
      };
    } catch {
      return { valid: false };
    }
  });
