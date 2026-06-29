import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const router = Router();
const sourcesPath = join(dirname(fileURLToPath(import.meta.url)), '../../config/sources.json');

function toPublicSource(source) {
  if (source.type === 'text') {
    return {
      id: source.id,
      name: source.name,
      type: source.type,
    };
  }

  return {
    id: source.id,
    name: source.name,
    type: source.type,
    url: source.url,
    selector: source.selector,
    delayMs: source.delayMs,
    steps: source.steps,
    iterateSelect: source.iterateSelect,
    cht: source.cht,
    fet: source.fet,
  };
}

router.get('/', (req, res) => {
  const raw = readFileSync(sourcesPath, 'utf8');
  const allSources = JSON.parse(raw);

  // 無瀏覽器的主機(如 Render free)用 NO_PLAYWRIGHT=1 隱藏需 Playwright 的來源(如 FET);
  // CHT 走純 fetch 不受影響。
  const noPlaywright = process.env.NO_PLAYWRIGHT === '1';
  const sources = allSources
    .filter(
      (source) =>
        source.type === 'text' ||
        ((source.type === 'url' || source.type === 'browser') && source.enabled === true),
    )
    .filter((source) => !(noPlaywright && source.type === 'browser' && !source.cht))
    .map(toPublicSource);

  res.status(200).json({ sources });
});

export { router };
