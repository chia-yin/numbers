let _overrideProvider = null;

export function _setProviderForTest(fn) {
  _overrideProvider = fn;
}

async function resolveProvider() {
  // 預設用本機 claude CLI(免 API key,需先 claude login);
  // 設 LLM_PROVIDER=openai 則改用 OpenAI(需 OPENAI_API_KEY)。
  const provider = process.env.LLM_PROVIDER ?? 'cli';
  if (provider === 'openai') {
    const openaiAdapter = await import('./openaiAdapter.js');
    return openaiAdapter.generateComment;
  }
  if (provider === 'cli' || provider === 'claude') {
    const cliAdapter = await import('./claudeCliAdapter.js');
    return cliAdapter.generateComment;
  }
  return null;
}

export async function generateComment(analysisResult, options = {}) {
  const providerFn = _overrideProvider ?? (await resolveProvider());
  if (!providerFn) {
    return null;
  }

  try {
    return await providerFn(analysisResult);
  } catch {
    return null;
  }
}
