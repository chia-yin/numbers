import { Router } from 'express';
import { addCredits } from '../auth/users.js';
import { currentEmail } from '../auth/session.js';

const router = Router();

// 方案:點數包
export const PACKAGES = {
  single: { credits: 1, amount: 99, name: '單次深解' },
  pick: { credits: 5, amount: 399, name: '選號方案' },
};

router.get('/packages', (req, res) => {
  res.json({
    packages: PACKAGES,
    enabled: Boolean(process.env.TAPPAY_PARTNER_KEY && process.env.TAPPAY_MERCHANT_ID),
  });
});

// TapPay Pay by Prime:前端 SDK 取得 prime → 後端用 partner_key/merchant_id 請款
router.post('/charge', async (req, res) => {
  const email = currentEmail(req);
  if (!email) return res.status(401).json({ error: '請先登入' });

  const { prime, pkg } = req.body ?? {};
  const plan = PACKAGES[pkg];
  if (!plan) return res.status(400).json({ error: '方案不存在' });

  const PARTNER_KEY = process.env.TAPPAY_PARTNER_KEY;
  const MERCHANT_ID = process.env.TAPPAY_MERCHANT_ID;
  if (!PARTNER_KEY || !MERCHANT_ID) {
    return res.status(503).json({ error: '金流設定中,暫時無法購買(尚未設定 TapPay 金鑰)' });
  }
  if (!prime) return res.status(400).json({ error: '缺少付款 prime' });

  const apiBase = process.env.TAPPAY_API_BASE
    || (process.env.TAPPAY_ENV === 'production'
      ? 'https://prod.tappaysdk.com'
      : 'https://sandbox.tappaysdk.com');

  try {
    const resp = await fetch(`${apiBase}/tpc/payment/pay-by-prime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PARTNER_KEY },
      body: JSON.stringify({
        prime,
        partner_key: PARTNER_KEY,
        merchant_id: MERCHANT_ID,
        amount: plan.amount,
        currency: 'TWD',
        details: plan.name,
        cardholder: { phone_number: '', name: email, email },
        remember: false,
      }),
    });
    const data = await resp.json();
    if (data.status !== 0) {
      return res.status(402).json({ error: `付款失敗:${data.msg || '未知錯誤'}` });
    }
    const credits = await addCredits(email, plan.credits);
    res.json({ ok: true, credits, added: plan.credits });
  } catch {
    res.status(502).json({ error: '付款服務連線失敗' });
  }
});

export { router };
