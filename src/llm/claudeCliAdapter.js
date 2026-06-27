import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const BASIC_PROMPT = new URL('../../prompts/phone-comment.txt', import.meta.url);
const PERSONAL_PROMPT = new URL('../../prompts/phone-personal.txt', import.meta.url);
const TIMEOUT_MS = 90000;

function formatProfile(profile) {
  if (!profile || typeof profile !== 'object') return '(未提供)';
  const lines = [];
  if (profile.name) lines.push(`姓名:${profile.name}`);
  if (profile.gender) lines.push(`性別:${profile.gender}`);
  if (profile.birthDate) lines.push(`國曆生日:${profile.birthDate}`);
  if (profile.birthTime) lines.push(`出生時辰:${profile.birthTime}`);
  return lines.length ? lines.join('\n') : '(未提供)';
}

function hasProfile(profile) {
  return Boolean(profile && (profile.birthDate || profile.name || profile.gender || profile.birthTime));
}

function buildPrompt(template, analysisResult, profile) {
  return template
    .replaceAll('{{profile}}', formatProfile(profile))
    .replaceAll('{{phone}}', analysisResult.input ?? '')
    .replaceAll('{{fiveGrid}}', JSON.stringify(analysisResult.fiveGrid, null, 2))
    .replaceAll('{{score}}', JSON.stringify(analysisResult.score))
    .replaceAll('{{extended}}', JSON.stringify(analysisResult.extended));
}

// 透過本機已登入的 claude CLI 產生解讀(免 API key)。
// 有個人資料時走「個人化命理」提示詞,否則走基礎口語解讀。
export async function generateComment(analysisResult, options = {}) {
  const profile = options.profile;
  const templatePath = hasProfile(profile) ? PERSONAL_PROMPT : BASIC_PROMPT;
  const template = await readFile(templatePath, 'utf8');
  const content = buildPrompt(template, analysisResult, profile);

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
