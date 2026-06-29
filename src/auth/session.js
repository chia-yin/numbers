import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';
const MAX_AGE_DAYS = 30;
const COOKIE = 'sid';

function sign(data) {
  return createHmac('sha256', SECRET).update(data).digest('base64url');
}

// 簽出 session token:base64url(payload).hmac
export function signSession(email) {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + MAX_AGE_DAYS * 86400_000 }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, mac] = token.split('.');
  const expected = sign(payload);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
    return null;
  }
  try {
    const { email, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!email || !exp || Date.now() > exp) return null;
    return { email };
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(email) {
  const token = signSession(email);
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_DAYS * 86400}`;
}
export function clearCookie() {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

// Express middleware:從 cookie 取 session → req.userEmail
export function currentEmail(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  const s = verifySession(token);
  return s ? s.email : null;
}
