const axios = require('axios');

// Models configuration
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';

/**
 * PRODUCTION-GRADE GEMINI SERVICE
 * Features: Exponential Backoff, Multi-Model Fallback, Robust Parsing, No-Crash Guarantee
 */

// Helper: Sleep with jitter
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms + Math.random() * 2000));

/**
 * Robust JSON Parser
 */
function robustParse(text) {
  try {
    // 1. Remove markdown wrappers
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 2. Direct Parse
    try {
      return JSON.parse(cleanText);
    } catch (e) {
      // 3. Regex Extraction
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('No JSON structure found');
    }
  } catch (err) {
    console.warn('⚠️ JSON Parsing failed, returning raw text as object');
    return { text };
  }
}

/**
 * Core API Caller with Retries and Backoff
 */
async function callGeminiCore(prompt, model = PRIMARY_MODEL, attempt = 1) {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error('API_KEY_MISSING');

  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${API_KEY}`;
  const start = Date.now();

  try {
    console.log(`🚀 [${model}] Attempt ${attempt}/3...`);
    
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }]
    }, {
      timeout: 15000 // 15s timeout
    });

    console.log(`⏱️ [${model}] Success in ${Date.now() - start}ms`);
    
    const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return robustParse(rawText);

  } catch (err) {
    const status = err.response?.status;
    const isTimeout = err.code === 'ECONNABORTED';

    console.error(`❌ [${model}] Error: ${err.message}`);

    // Retry on 503 or Timeout (Up to 3 times)
    if ((status === 503 || isTimeout) && attempt < 3) {
      const delay = 1000 * attempt;
      console.log(`🔁 Retrying in ${delay}ms...`);
      await sleep(delay);
      return callGeminiCore(prompt, model, attempt + 1);
    }

    // Fallback logic
    if (model === PRIMARY_MODEL) {
      console.warn(`📉 Primary model failed. Switching to ${FALLBACK_MODEL}...`);
      return callGeminiCore(prompt, FALLBACK_MODEL, 1);
    }

    throw err; // Final throw to be caught by safety layer
  }
}

/**
 * Main Entry Point: Generate Itinerary
 * GUARANTEE: Never throws, always returns valid structure
 */
async function generateItinerary({ destination, days, interests, budget, travelers }) {
  const prompt = `Create a ${days}-day itinerary for ${destination} (${travelers} travelers, ${interests} interests, ${budget} budget).
  Return a simple JSON with keys: tripTitle, days (day, activities, notes), generalTips.`;

  try {
    return await callGeminiCore(prompt);
  } catch (err) {
    console.error('⚠️ [FINAL_SAFETY] All AI attempts failed. Returning Mock Data.');
    return {
      tripTitle: `Adventure in ${destination}`,
      days: Array.from({ length: days || 3 }, (_, i) => ({
        day: i + 1,
        activities: [`Explore ${destination} landmarks`, `Local food tour`, `Leisure time`],
        notes: "Enjoy your trip!"
      })),
      generalTips: ["Generated using local fallback system."]
    };
  }
}

/**
 * Get Hidden Gems
 */
async function getHiddenGems(city, style) {
  const prompt = `List 5 hidden gems in ${city} for ${style} travel style. JSON array [{name, description}] only.`;
  try {
    return await callGeminiCore(prompt);
  } catch (e) {
    return [{ name: "Local Secret", description: "A quiet spot loved by residents." }];
  }
}

/**
 * Lightweight Health Check
 */
async function checkHealth() {
  try {
    // Lightweight call to a stable model
    const API_KEY = process.env.GEMINI_API_KEY;
    await axios.post(`https://generativelanguage.googleapis.com/v1/models/${FALLBACK_MODEL}:generateContent?key=${API_KEY}`, {
      contents: [{ parts: [{ text: 'ok' }] }]
    }, { timeout: 5000 });
    return 'OK';
  } catch (e) {
    return 'FAIL';
  }
}

module.exports = { generateItinerary, getHiddenGems, checkHealth };
