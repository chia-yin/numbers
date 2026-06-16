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
  };
}

router.get('/', (req, res) => {
  const raw = readFileSync(sourcesPath, 'utf8');
  const allSources = JSON.parse(raw);

  const sources = allSources
    .filter((source) => source.type === 'text' || (source.type === 'url' && source.enabled === true))
    .map(toPublicSource);

  res.status(200).json({ sources });
});

export { router };
