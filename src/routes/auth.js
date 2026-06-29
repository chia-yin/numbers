import { Router } from 'express';
import { createUser, authUser, getUser, publicUser } from '../auth/users.js';
import { sessionCookie, clearCookie, currentEmail } from '../auth/session.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { email, password } = req.body ?? {};
  try {
    const user = await createUser(email, password);
    res.setHeader('Set-Cookie', sessionCookie(user.email));
    res.json({ user });
  } catch (e) {
    const map = { invalid_email: '電子郵件格式不正確', weak_password: '密碼至少 6 碼', email_taken: '此信箱已註冊' };
    res.status(400).json({ error: map[e.message] || '註冊失敗' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await authUser(email, password);
  if (!user) return res.status(401).json({ error: '帳號或密碼錯誤' });
  res.setHeader('Set-Cookie', sessionCookie(user.email));
  res.json({ user });
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearCookie());
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const email = currentEmail(req);
  if (!email) return res.json({ user: null });
  const user = await getUser(email);
  res.json({ user: user ? publicUser(user) : null });
});

export { router };
