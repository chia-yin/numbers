import { spawn } from 'node:child_process';
import { buildPrompt } from './promptBuilder.js';

const TIMEOUT_MS = 90000;

// 透過本機已登入的 claude CLI 產生解讀(免 API key)。
// 有個人資料時走「個人化命理」提示詞,否則走基礎口語解讀。
export async function generateComment(analysisResult, options = {}) {
  const content = options.rawPrompt ?? (await buildPrompt(analysisResult, options));

  const args = ['-p'];
  if (process.env.CLAUDE_MODEL) args.push('--model', process.env.CLAUDE_MODEL);
  args.push(content);

  // 補常見 bin 路徑,避免從 Finder/GUI 啟動 server 時 PATH 找不到 claude
  const PATH = `${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin:${process.env.HOME || ''}/.local/bin`;
  return await new Promise((resolve, reject) => {
    const child = spawn('claude', args, { env: { ...process.env, PATH } });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('claude CLI 逾時'));
    }, TIMEOUT_MS);

    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude CLI 失敗 (${code}): ${err.trim()}`));
    });
  });
}
