import { GEMINI_CHAT_MODEL, GEMINI_FALLBACK_MODEL } from './constants';

export function isQuotaError(status, data) {
  const msg = (data && data.error && data.error.message) || '';
  const statusStr = (data && data.error && data.error.status) || '';
  return status === 429 || /quota/i.test(msg) || /RESOURCE_EXHAUSTED/i.test(statusStr);
}

export async function callGeminiModel(prompt, apiKey, model) {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// Intenta con el modelo principal; si la cuota esta agotada, reintenta
// automaticamente con un modelo alterno para que el error nunca llegue al chat.
export async function generateWithFallback(prompt, apiKey) {
  let result = await callGeminiModel(prompt, apiKey, GEMINI_CHAT_MODEL);

  if (!result.ok && isQuotaError(result.status, result.data)) {
    console.warn('Cuota agotada en ' + GEMINI_CHAT_MODEL + ', reintentando con ' + GEMINI_FALLBACK_MODEL);
    result = await callGeminiModel(prompt, apiKey, GEMINI_FALLBACK_MODEL);
  }

  if (!result.ok) {
    throw new Error((result.data.error && result.data.error.message) || 'Error');
  }

  return result.data;
}

export async function verifyApiKey(apiKey) {
  try {
    const testPrompt = 'Responde unicamente "OK".';
    let result = await callGeminiModel(testPrompt, apiKey, GEMINI_CHAT_MODEL);
    if (!result.ok && isQuotaError(result.status, result.data)) {
      result = await callGeminiModel(testPrompt, apiKey, GEMINI_FALLBACK_MODEL);
    }
    return result.ok;
  } catch (e) {
    return false;
  }
}