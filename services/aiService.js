const axios = require('axios');
const mlService = require('./mlService');

// Models (kept for other features that may call Gemini)
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';

// Load ML models at startup
try { mlService.loadModels(); } catch (e) { console.warn('⚠️ mlService.loadModels failed at startup:', e && e.message); }

// Helper: Sleep
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// Safe JSON parser
function robustParse(text) {
  try {
    const raw = String(text || '');
    let clean = raw.replace(/```json/g, '').replace(/```/g, '').replace(/`/g, '').trim();

    try {
      return JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('No JSON found');
    }
  } catch {
    return { text: String(text || '') };
  }
}

// Gemini caller (kept available for other features)
async function callGeminiCore(prompt, model = PRIMARY_MODEL, attempt = 1) {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error('API_KEY_MISSING');

  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${API_KEY}`;

  try {
    console.log(`🤖 [${model}] Attempt ${attempt}`);

    const res = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }]
    }, { timeout: 15000 });

    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return robustParse(text);

  } catch (err) {
    const status = err.response?.status;

    if ((status === 503 || err.code === 'ECONNABORTED') && attempt < 3) {
      await sleep(1000 * attempt);
      return callGeminiCore(prompt, model, attempt + 1);
    }

    if (model === PRIMARY_MODEL) {
      return callGeminiCore(prompt, FALLBACK_MODEL, 1);
    }

    throw err;
  }
}

// MAIN: Generate Itinerary - ML FIRST, never return mock/static itineraries
async function generateItinerary({ destination, days = 3, interests = 'culture', budget = 'moderate', travelers = 1 }) {
  console.log(`📍 generateItinerary called for: ${destination}`);

  // Always attempt ML first
  try {
    console.log('🔎 Calling mlService.generateItinerary');
    const mlResult = await Promise.resolve(
      mlService.generateItinerary({ destination, days, interests, budget, travelers })
    );

    if (mlResult && Array.isArray(mlResult.days) && mlResult.days.length > 0) {
      console.log('✅ mlService.generateItinerary succeeded');
      const normalizedDays = mlResult.days.map(d => ({
        day: d.day,
        activities: Array.isArray(d.activities) ? d.activities : [],
        notes: d.notes || ''
      }));

      return {
        tripTitle: mlResult.tripTitle || `${days}-Day ${destination} Itinerary`,
        days: normalizedDays,
        generalTips: Array.isArray(mlResult.generalTips) ? mlResult.generalTips : [],
        source: mlResult.source || 'itinerary_model'
      };
    }

    console.error('❌ mlService.generateItinerary returned empty or invalid result');
    return { error: true, message: 'ML itinerary generation returned invalid result' };

  } catch (err) {
    console.error('❌ mlService.generateItinerary failed:', err && err.message ? err.message : err);
    return { error: true, message: 'ML itinerary generation failed', details: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────
// Hidden Gems
async function getHiddenGems(city, style) {
  try {
    const prompt = `List 5 hidden gems in ${city}`;
    return await callGeminiCore(prompt);
  } catch {
    return [{ name: 'Local Spot', description: 'Quiet and beautiful place.' }];
  }
}

// ─────────────────────────────────────────────────────────────
// Health Check
async function checkHealth() {
  try {
    await callGeminiCore("ok", FALLBACK_MODEL);
    return 'OK';
  } catch {
    return 'FAIL';
  }
}

// ─────────────────────────────────────────────────────────────
// Cost Analysis (ML first)
async function analyzeTripCost(data) {
  try {
    return mlService.analyzeCost(data);
  } catch {
    return "Basic cost analysis unavailable.";
  }
}

// ─────────────────────────────────────────────────────────────
module.exports = {
  generateItinerary,
  getHiddenGems,
  checkHealth,
  analyzeTripCost
};
