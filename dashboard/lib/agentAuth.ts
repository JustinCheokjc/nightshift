import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Keys for the desktop agent, signed with a server-side secret so no
// database key ever ships to a contributor's computer.
//   setup key:    nse_<payload>.<sig>   (one hour, ties a new device to a user)
//   device token: nsd_<device id>.<sig> (permanent; deleting the device revokes it)

const SETUP_KEY_TTL_MS = 60 * 60 * 1000;

function secret() {
  const explicit = process.env.AGENT_SIGNING_SECRET;
  if (explicit) return explicit;
  // Fall back to a value derived from the service-role key, so the agent
  // works without extra configuration. Set AGENT_SIGNING_SECRET to rotate.
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update("nightshift-agent-v1")
    .digest("hex");
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function verify(value: string, sig: string) {
  const expected = Buffer.from(sign(value));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function createSetupKey(userId: string, server: string) {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, s: server, exp: Date.now() + SETUP_KEY_TTL_MS })
  ).toString("base64url");
  return `nse_${payload}.${sign(`setup:${payload}`)}`;
}

export function readSetupKey(key: string): { userId: string } | null {
  const m = /^nse_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(key.trim());
  if (!m || !verify(`setup:${m[1]}`, m[2])) return null;
  const { u, exp } = JSON.parse(Buffer.from(m[1], "base64url").toString());
  if (typeof u !== "string" || typeof exp !== "number" || exp < Date.now()) return null;
  return { userId: u };
}

export function createDeviceToken(deviceId: string) {
  return `nsd_${deviceId}.${sign(`device:${deviceId}`)}`;
}

export function readDeviceToken(header: string | null): string | null {
  const m = /^Bearer nsd_([0-9a-f-]{36})\.([A-Za-z0-9_-]+)$/.exec(header ?? "");
  return m && verify(`device:${m[1]}`, m[2]) ? m[1] : null;
}
