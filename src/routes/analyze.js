import { Router } from 'express';
import { judgeAll } from '../engine/wuxingJudge.js';
import { DEFAULT_GROUP_CONFIG } from '../engine/groupConfig.js';
import { generateComment } from '../llm/adapter.js';
import { buildPrompt } from '../llm/promptBuilder.js';

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
    body.aiComment = await generateComment(body, { profile: req.body?.profile });
  }

  res.status(status).json(body);
});

export { router };
