import { readFile } from 'node:fs/promises';

const BASIC_PROMPT = new URL('../../prompts/phone-comment.txt', import.meta.url);
const PERSONAL_PROMPT = new URL('../../prompts/phone-personal.txt', import.meta.url);

export function formatProfile(profile) {
  if (!profile || typeof profile !== 'object') return '(未提供)';
  const lines = [];
  if (profile.name) lines.push(`姓名:${profile.name}`);
  if (profile.gender) lines.push(`性別:${profile.gender}`);
  if (profile.birthDate) lines.push(`國曆生日:${profile.birthDate}`);
  if (profile.birthTime) lines.push(`出生時辰:${profile.birthTime}`);
  return lines.length ? lines.join('\n') : '(未提供)';
}

export function hasProfile(profile) {
  return Boolean(profile && (profile.birthDate || profile.name || profile.gender || profile.birthTime));
}

function fill(template, analysisResult, profile) {
  return template
    .replaceAll('{{profile}}', formatProfile(profile))
    .replaceAll('{{phone}}', analysisResult.input ?? '')
    .replaceAll('{{fiveGrid}}', JSON.stringify(analysisResult.fiveGrid, null, 2))
    .replaceAll('{{score}}', JSON.stringify(analysisResult.score))
    .replaceAll('{{extended}}', JSON.stringify(analysisResult.extended));
}

// 組出完整提示詞(有個人資料用個人化命理版,否則基礎口語版)
export async function buildPrompt(analysisResult, options = {}) {
  const profile = options.profile;
  const path = hasProfile(profile) ? PERSONAL_PROMPT : BASIC_PROMPT;
  const template = await readFile(path, 'utf8');
  return fill(template, analysisResult, profile);
}
