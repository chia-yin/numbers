import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const DATA_DIR = process.env.DATA_DIR
  ? join(process.env.DATA_DIR, 'users')
  : join(dirname(fileURLToPath(import.meta.url)), '../../data/users');

function emailKey(email) {
  return String(email).trim().toLowerCase().replace(/[^a-z0-9._@+-]/g, '_');
}
function filePath(email) {
  return join(DATA_DIR, `${emailKey(email)}.json`);
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${salt}:${buf.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const buf = await scryptAsync(password, salt, 64);
  const a = Buffer.from(hash, 'hex');
  return a.length === buf.length && timingSafeEqual(a, buf);
}

export async function getUser(email) {
  try {
    return JSON.parse(await readFile(filePath(email), 'utf8'));
  } catch {
    return null;
  }
}

async function saveUser(user) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(filePath(user.email), JSON.stringify(user, null, 2), 'utf8');
}

export async function createUser(email, password) {
  if (!isValidEmail(email)) throw new Error('invalid_email');
  if (typeof password !== 'string' || password.length < 6) throw new Error('weak_password');
  if (await getUser(email)) throw new Error('email_taken');
  const user = {
    email: String(email).trim().toLowerCase(),
    pw: await hashPassword(password),
    credits: 0,
    createdAt: new Date().toISOString(),
  };
  await saveUser(user);
  return publicUser(user);
}

export async function authUser(email, password) {
  const user = await getUser(email);
  if (!user) return null;
  if (!(await verifyPassword(password, user.pw))) return null;
  return publicUser(user);
}

export async function addCredits(email, n) {
  const user = await getUser(email);
  if (!user) throw new Error('no_user');
  user.credits = (user.credits || 0) + n;
  await saveUser(user);
  return user.credits;
}

// 扣 1 點(原子性:先讀後寫;單機檔案足夠)。回傳剩餘點數,不足回 -1
export async function consumeCredit(email) {
  const user = await getUser(email);
  if (!user || (user.credits || 0) <= 0) return -1;
  user.credits -= 1;
  await saveUser(user);
  return user.credits;
}

export function publicUser(user) {
  return { email: user.email, credits: user.credits || 0 };
}

export async function listUsers() {
  try {
    const files = await readdir(DATA_DIR);
    return files.filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}
