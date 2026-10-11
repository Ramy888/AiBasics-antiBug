import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AppError } from "./errors";

/** The drill's answer. Only the server can read it; the browser carries it as an opaque token. */
export type Answer = {
  bugLines: number[];
  original: string;
  mutated: string;
  category: string;
  lesson: string;
  file: string;
  iat: number; // issued-at, epoch seconds
};

const TTL_SECONDS = 60 * 60;

// One random key per server process when no secret is configured. Kept on globalThis so
// Next's dev hot reload doesn't invalidate tokens that are already in a browser.
const g = globalThis as { __antibugKey?: Buffer };

function key(): Buffer {
  const secret = process.env.ANTIBUG_SECRET;
  if (secret) return createHash("sha256").update(secret).digest();
  g.__antibugKey ??= randomBytes(32);
  return g.__antibugKey;
}

export function seal(answer: Omit<Answer, "iat">, now = Date.now()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = JSON.stringify({ ...answer, iat: Math.floor(now / 1000) });
  const ct = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

export function open(token: string, now = Date.now()): Answer {
  const invalid = new AppError("token_invalid", "This drill has expired. Start a new one.");
  let answer: Answer;
  try {
    const buf = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const body = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
    answer = JSON.parse(body.toString("utf8"));
  } catch {
    throw invalid;
  }
  if (Math.floor(now / 1000) - answer.iat > TTL_SECONDS) throw invalid;
  return answer;
}
