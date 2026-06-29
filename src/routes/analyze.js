import { Router } from 'express';
import { judgeAll, computeSeason } from '../engine/wuxingJudge.js';
import { DEFAULT_GROUP_CONFIG } from '../engine/groupConfig.js';
import { generateComment } from '../llm/adapter.js';
import { buildPrompt, buildMultiPrompt } from '../llm/promptBuilder.js';
import { autoGroup } from './rank.js';
import { currentEmail } from '../auth/session.js';
import { consumeCredit } from '../auth/users.js';

// 付費牆:AI 解讀需登入+扣 1 點。PAYWALL!=1 時不啟用(本機/免費版直接放行)。
// 回傳 {ok, locked} ,locked: 'login'|'credit'|null
async function gateAi(req) {
  if (process.env.PAYWALL !== '1') return { ok: true, locked: null };
  const email = currentEmail(req);
  if (!email) return { ok: false, locked: 'login' };
  const left = await consumeCredit(email);
  if (left < 0) return { ok: false, locked: 'credit' };
  return { ok: true, locked: null, credits: left };
}

const WEIGHTS = {
  總格: 0.50,
  外格: 0.25,
  人格: 0.15,
  地格: 0.10,
  天格: 0.05,
};

const FIVE_GRID_KEYS = ['總格', '天格', '人格', '地格', '外格'];
const EXTENDED_KEYS = ['子息', '健康', '配偶', '朋友'];

function transformResult(result) {
  const fiveGrid = {};
  for (const key of FIVE_GRID_KEYS) {
    const grid = result.fiveGrid[key];
    const numerology = result.numerology[key];
    const entry = {
      value: grid.value,
      digit: grid.digit,
      wuxing: grid.wuxing,
      symbol: numerology.symbol,
      luck: numerology.luck,
      text: numerology.text,
      weight: WEIGHTS[key],
      season: computeSeason(grid.value, grid.wuxing),
    };
    if (key !== '總格') {
      entry.relation = result.wuxingRelations[key].relation;
    }
    fiveGrid[key] = entry;
  }

  const extended = {};
  for (const key of EXTENDED_KEYS) {
    const grid = result.extended[key];
    extended[key] = {
      value: grid.value,
      digit: grid.digit,
      wuxing: grid.wuxing,
      relation: result.wuxingRelations[key].relation,
    };
  }

  return {
    input: result.input,
    groups: result.groups,
    groupSums: result.groupSums,
    fiveGrid,
    extended,
    sancai: result.sancai,
    energyBalance: result.energyBalance,
    score: result.score,
    isPremium: result.isPremium,
    aiComment: null,
  };
}

export function analyzeHandler(phone, groups) {
  if (typeof phone !== 'string' || phone.length === 0 || !/^\d+$/.test(phone)) {
    return {
      status: 400,
      body: { error: 'phone must be a non-empty string of digits' },
    };
  }

  let groupConfig;
  if (groups === undefined || groups === null) {
    groupConfig = DEFAULT_GROUP_CONFIG;
  } else {
    if (!Array.isArray(groups)) {
      return {
        status: 400,
        body: { error: 'groups must be an array of positive integers' },
      };
    }
    for (const n of groups) {
      if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
        return {
          status: 400,
          body: { error: 'groups must be an array of positive integers' },
        };
      }
    }
    const sum = groups.reduce((acc, n) => acc + n, 0);
    if (sum !== phone.length) {
      return {
        status: 400,
        body: {
          error: `groups sum (${sum}) must equal phone length (${phone.length})`,
        },
      };
    }
    groupConfig = groups;
  }

  const result = judgeAll(phone, groupConfig);
  return { status: 200, body: transformResult(result) };
}

const router = Router();
router.post('/', async (req, res) => {
  const { status, body } = analyzeHandler(req.body?.phone, req.body?.groups);

  // 只產生提示詞(不呼叫 LLM):讓使用者複製去自己的 ChatGPT/Claude
  if (status === 200 && req.query.prompt === 'true') {
    body.aiPrompt = await buildPrompt(body, { profile: req.body?.profile });
  }

  if (status === 200 && req.query.aiComment === 'true') {
    const gate = await gateAi(req);
    if (!gate.ok) {
      body.locked = gate.locked;
    } else {
      body.aiComment = await generateComment(body, { profile: req.body?.profile });
      body.credits = gate.credits;
    }
  }

  res.status(status).json(body);
});

// 多號個人比較:{ phones:[], groups?, profile }  ?prompt=true 只回提示詞;?aiComment=true 直接 AI 分析
router.post('/multi', async (req, res) => {
  const phones = req.body?.phones;
  if (!Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: 'phones must be a non-empty array' });
  }
  if (phones.length > 50) {
    return res.status(400).json({ error: 'phones limit is 50' });
  }
  const analyses = [];
  for (const original of phones) {
    try {
      // 與單號/批次一致:自動去開頭 0 → 3-3-3
      const { phone, groups } = autoGroup(original, req.body?.groups);
      const { status, body } = analyzeHandler(phone, groups);
      if (status === 200) {
        body.input = String(original).replace(/[\s-]/g, ''); // 顯示原始號碼
        analyses.push(body);
      }
    } catch {
      // 跳過無法分析的號碼(長度怪異等)
    }
  }
  if (analyses.length === 0) {
    return res.status(400).json({ error: '沒有可分析的有效號碼' });
  }
  const out = { count: analyses.length };
  const prompt = await buildMultiPrompt(analyses, { profile: req.body?.profile });
  if (req.query.prompt === 'true') out.aiPrompt = prompt;
  if (req.query.aiComment === 'true') {
    const gate = await gateAi(req);
    if (!gate.ok) out.locked = gate.locked;
    else { out.aiComment = await generateComment(null, { rawPrompt: prompt, profile: req.body?.profile }); out.credits = gate.credits; }
  }
  res.json(out);
});

export { router };
