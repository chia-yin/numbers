import { readFile } from 'node:fs/promises';

const PROMPT_PATH = new URL('../../prompts/phone-comment.txt', import.meta.url);

function buildPrompt(template, analysisResult) {
  return template
    .replaceAll('{{phone}}', analysisResult.input ?? '')
    .replaceAll('{{fiveGrid}}', JSON.stringify(analysisResult.fiveGrid, null, 2))
    .replaceAll('{{score}}', JSON.stringify(analysisResult.score))
    .replaceAll('{{extended}}', JSON.stringify(analysisResult.extended));
}

export async function generateComment(analysisResult) {
  const template = await readFile(PROMPT_PATH, 'utf8');
  const content = buildPrompt(template, analysisResult);

  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
