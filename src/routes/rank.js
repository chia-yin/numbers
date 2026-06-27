import { Router } from 'express';
import { analyzeHandler } from './analyze.js';

// 與單號頁一致的自動分組:10 碼台灣手機自動去掉開頭 0 → 9 碼 → 3-3-3。
// 若呼叫端有給「長度吻合的」分組,則尊重該設定。
export function autoGroup(rawPhone, requestedGroups) {
  const phone = String(rawPhone).replace(/[\s-]/g, '');
  const sum = Array.isArray(requestedGroups)
    ? requestedGroups.reduce((a, b) => a + (Number(b) || 0), 0)
    : 0;
  if (Array.isArray(requestedGroups) && requestedGroups.length > 0 && sum === phone.length) {
    return { phone, groups: requestedGroups };
  }
  if (phone.length === 10 && phone.startsWith('0')) return { phone: phone.slice(1), groups: [3, 3, 3] };
  if (phone.length === 9) return { phone, groups: [3, 3, 3] };
  return { phone, groups: requestedGroups };
}

const FIVE_GRID_KEYS = ['總格', '天格', '人格', '地格', '外格'];

// 數一個號碼的五格裡有幾個「吉(○)」
function countGood(fiveGrid) {
  return FIVE_GRID_KEYS.filter((k) => fiveGrid[k]?.symbol === '○').length;
}

export function rankHandler(body) {
  const candidates = body?.candidates;
  const groups = body?.groups;
  // 改以「至少幾個吉(○)」為門檻(預設 0 = 全部列出);minScore 仍可選用
  const minGood = body?.minGood === undefined ? 0 : body.minGood;
  const minScore = body?.minScore === undefined ? 0 : body.minScore;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      status: 400,
      body: { error: 'candidates must be a non-empty array' },
    };
  }

  if (candidates.length > 20000) {
    return {
      status: 400,
      body: { error: 'candidates limit is 20000' },
    };
  }

  if (typeof minGood !== 'number' || !Number.isFinite(minGood) || minGood < 0 || minGood > 5) {
    return {
      status: 400,
      body: { error: 'minGood must be a number between 0 and 5' },
    };
  }

  const passed = [];
  let successCount = 0;

  for (const original of candidates) {
    const { phone, groups: g } = autoGroup(original, groups);
    const { status, body: result } = analyzeHandler(phone, g);
    if (status !== 200) {
      continue;
    }
    successCount++;
    const goodCount = countGood(result.fiveGrid);
    if (goodCount >= minGood && result.score.weighted >= minScore) {
      const { aiComment, ...rest } = result;
      // 顯示使用者實際看到的原始號碼(清掉分隔符的完整 10 碼)
      passed.push({ ...rest, phone: String(original).replace(/[\s-]/g, ''), goodCount });
    }
  }

  // 依「吉(○)數」由多到少排序,同分再以加權分(內部用,不顯示)分高低
  passed.sort((a, b) => b.goodCount - a.goodCount || b.score.weighted - a.score.weighted);

  const ranked = passed.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  return {
    status: 200,
    body: {
      ranked,
      total: ranked.length,
      filtered: successCount - ranked.length,
    },
  };
}

const router = Router();
router.post('/', (req, res) => {
  const { status, body } = rankHandler(req.body);
  res.status(status).json(body);
});

export { router };
