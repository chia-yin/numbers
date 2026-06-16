import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchCandidates } from '../crawler/index.js';

const router = Router();
const sourcesPath = join(dirname(fileURLToPath(import.meta.url)), '../../config/sources.json');

router.get('/sources', async (req, res) => {
  const raw = await readFile(sourcesPath, 'utf8');
  res.status(200).json(JSON.parse(raw));
});

router.post('/', async (req, res) => {
  const source = req.body?.source;
  if (!source) {
    return res.status(400).json({ error: 'source is required' });
  }
  if (source.type !== 'text' && source.type !== 'url') {
    return res.status(400).json({ error: "source.type must be 'text' or 'url'" });
  }
  if (source.type === 'text' && typeof source.content !== 'string') {
    return res.status(400).json({ error: 'source.content is required for text sources' });
  }
  if (source.type === 'url') {
    if (typeof source.url !== 'string' || source.url.trim() === '') {
      return res.status(400).json({ error: 'source.url is required for url sources' });
    }
    try {
      new URL(source.url);
    } catch {
      return res.status(400).json({ error: 'source.url must be a valid URL' });
    }
  }

  try {
    const candidates = await fetchCandidates(source);
    return res.status(200).json({
      candidates,
      sourceType: source.type,
      count: candidates.length,
    });
  } catch (error) {
    if (error.message === 'robots.txt disallows crawling this URL') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: `fetch failed: ${error.message}` });
  }
});

export { router };
