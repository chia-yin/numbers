import { readFile } from 'node:fs/promises';

const BASIC_PROMPT = new URL('../../prompts/phone-comment.txt', import.meta.url);
const PERSONAL_PROMPT = new URL('../../prompts/phone-personal.txt', import.meta.url);
const MULTI_PROMPT = new URL('../../prompts/phone-multi.txt', import.meta.url);

const GRID = ['總格', '天格', '人格', '地格', '外格'];

// 把多支號碼的分析整理成精簡文字(給多號比較提示詞用)
function formatNumbers(analyses) {
  return analyses
    .map((a, i) => {
      const grids = GRID.map((k) => {
        const g = a.fiveGrid[k];
        return `${k} ${g.value}(${g.wuxing}・${g.symbol}${g.luck})`;
      }).join('、');
      const good = GRID.filter((k) => a.fiveGrid[k].symbol === '○').length;
      return `${i + 1}. ${a.input}　五格:${grids}　吉${good}/5`;
    })
    .join('\n');
}

// 組多號比較提示詞
export async function buildMultiPrompt(analyses, options = {}) {
  const template = await readFile(MULTI_PROMPT, 'utf8');
  return template
    .replaceAll('{{profile}}', formatProfile(options.profile))
    .replaceAll('{{numbers}}', formatNumbers(analyses));
}

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
