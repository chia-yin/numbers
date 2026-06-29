import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchCandidates } from '../crawler/index.js';
import { saveSnapshot, loadSnapshot, listSnapshots } from '../crawler/cache.js';

const router = Router();
const sourcesPath = join(dirname(fileURLToPath(import.meta.url)), '../../config/sources.json');

router.get('/sources', async (req, res) => {
  const raw = await readFile(sourcesPath, 'utf8');
  res.status(200).json(JSON.parse(raw));
});

// 列出所有來源的快取(最近一次抓取的時間與筆數)
router.get('/cache', async (req, res) => {
  res.status(200).json({ snapshots: await listSnapshots() });
});

// 取某來源快取的完整號碼清單(免重抓)
router.get('/cache/:id', async (req, res) => {
  const snap = await loadSnapshot(req.params.id);
  if (!snap) return res.status(404).json({ error: '尚無此來源的快取' });
  res.status(200).json(snap);
});

router.post('/', async (req, res) => {
  const source = req.body?.source;
  if (!source) {
    return res.status(400).json({ error: 'source is required' });
  }
  if (!['text', 'url', 'browser', 'static'].includes(source.type)) {
    return res.status(400).json({ error: "source.type must be 'text', 'url', 'browser', or 'static'" });
  }
  if (source.type === 'text' && typeof source.content !== 'string') {
    return res.status(400).json({ error: 'source.content is required for text sources' });
  }
  if (source.type === 'url' || source.type === 'browser') {
    if (typeof source.url !== 'string' || source.url.trim() === '') {
      return res.status(400).json({ error: 'source.url is required for url/browser sources' });
    }
    try {
      new URL(source.url);
    } catch {
      return res.status(400).json({ error: 'source.url must be a valid URL' });
    }
  }

  try {
    const candidates = await fetchCandidates(source);
    // 自動存快取(以 source.id 為鍵),免下次重抓。text 來源不存。
    let savedAt = null;
    if (source.id && source.type !== 'text' && candidates.length > 0) {
      const snap = await saveSnapshot(source.id, candidates).catch(() => null);
      savedAt = snap?.savedAt ?? null;
    }
    return res.status(200).json({
      candidates,
      sourceType: source.type,
      count: candidates.length,
      ...(savedAt ? { savedAt } : {}),
    });
  } catch (error) {
    if (error.message === 'robots.txt disallows crawling this URL') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: `fetch failed: ${error.message}` });
  }
});

export { router };
