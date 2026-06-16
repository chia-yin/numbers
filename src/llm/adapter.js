let _overrideProvider = null;

export function _setProviderForTest(fn) {
  _overrideProvider = fn;
}

async function resolveProvider() {
  const provider = process.env.LLM_PROVIDER;
  if (provider === 'openai') {
    const openaiAdapter = await import('./openaiAdapter.js');
    return openaiAdapter.generateComment;
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
