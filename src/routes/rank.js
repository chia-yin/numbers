import { Router } from 'express';
import { analyzeHandler } from './analyze.js';

const DEFAULT_MIN_SCORE = 70;

export function rankHandler(body) {
  const candidates = body?.candidates;
  const groups = body?.groups;
  const rawMinScore = body?.minScore;
  const minScore = rawMinScore === undefined ? DEFAULT_MIN_SCORE : rawMinScore;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      status: 400,
      body: { error: 'candidates must be a non-empty array' },
    };
  }

  if (candidates.length > 200) {
    return {
      status: 400,
      body: { error: 'candidates limit is 200' },
    };
  }

  if (typeof minScore !== 'number' || !Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
    return {
      status: 400,
      body: { error: 'minScore must be a number between 0 and 100' },
    };
  }

  const passed = [];
  let successCount = 0;

  for (const phone of candidates) {
    const { status, body: result } = analyzeHandler(phone, groups);
    if (status !== 200) {
      continue;
    }
    successCount++;
    if (result.score.weighted >= minScore) {
      const { aiComment, ...rest } = result;
      passed.push(rest);
    }
  }

  passed.sort((a, b) => b.score.weighted - a.score.weighted);

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
