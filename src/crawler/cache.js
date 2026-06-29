// 抓取結果快取:把每個來源最近一次抓到的號碼存檔,免每次重抓。
// 存於 DATA_DIR/crawl/<sourceId>.json,內容 { sourceId, savedAt, count, candidates }。
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CACHE_DIR = process.env.DATA_DIR
  ? join(process.env.DATA_DIR, 'crawl')
  : join(dirname(fileURLToPath(import.meta.url)), '../../data/crawl');

// 只允許安全字元當檔名,擋路徑穿越
function safeId(sourceId) {
  return String(sourceId).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function saveSnapshot(sourceId, candidates) {
  if (!sourceId) return null;
  await mkdir(CACHE_DIR, { recursive: true });
  const snapshot = {
    sourceId,
    savedAt: new Date().toISOString(),
    count: candidates.length,
    candidates,
  };
  await writeFile(join(CACHE_DIR, `${safeId(sourceId)}.json`), JSON.stringify(snapshot), 'utf8');
  return snapshot;
}

export async function loadSnapshot(sourceId) {
  try {
    const raw = await readFile(join(CACHE_DIR, `${safeId(sourceId)}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// 列出所有快取(不含號碼本身,只回 meta)
export async function listSnapshots() {
  try {
    const files = await readdir(CACHE_DIR);
    const metas = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const snap = JSON.parse(await readFile(join(CACHE_DIR, f), 'utf8'));
        metas.push({ sourceId: snap.sourceId, savedAt: snap.savedAt, count: snap.count });
      } catch {
        // 壞檔略過
      }
    }
    return metas;
  } catch {
    return [];
  }
}
