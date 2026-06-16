import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const PROMPT_PATH = new URL('../../prompts/phone-comment.txt', import.meta.url);
const TIMEOUT_MS = 60000;

function buildPrompt(template, analysisResult) {
  return template
    .replaceAll('{{phone}}', analysisResult.input ?? '')
    .replaceAll('{{fiveGrid}}', JSON.stringify(analysisResult.fiveGrid, null, 2))
    .replaceAll('{{score}}', JSON.stringify(analysisResult.score))
    .replaceAll('{{extended}}', JSON.stringify(analysisResult.extended));
}

// 透過本機已登入的 claude CLI 產生口語化解讀(免 API key)。
export async function generateComment(analysisResult) {
  const template = await readFile(PROMPT_PATH, 'utf8');
  const content = buildPrompt(template, analysisResult);

  const args = ['-p'];
  if (process.env.CLAUDE_MODEL) args.push('--model', process.env.CLAUDE_MODEL);
  args.push(content);

  return await new Promise((resolve, reject) => {
    const child = spawn('claude', args);
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
