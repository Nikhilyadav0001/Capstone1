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

/**
 * Analyze Trip Cost with AI
 */
async function analyzeTripCost(costData) {
  try {
    const { totalCost, budgetType, destination, travelers } = costData;
    const costPerPerson = (totalCost / Math.max(1, travelers)).toFixed(2);
    
    const budgetDescriptions = {
      economy: 'budget-friendly/backpacker style',
      moderate: 'mid-range/balanced comfort style',
      luxury: 'premium/luxury experience style'
    };
    
    const prompt = `You are a travel budget advisor. Analyze this trip budget for ${destination}:
    
Trip Details:
- Destination: ${destination}
- Total Budget: $${totalCost.toFixed(2)}
- Cost per person: $${costPerPerson}
- Number of travelers: ${travelers}
- Travel Style: ${budgetDescriptions[budgetType] || budgetType}

Based on this total budget of $${totalCost.toFixed(2)} for ${travelers} traveler(s) traveling to ${destination} in a ${budgetType} style:

1. Budget Adequacy: Is this budget sufficient for a ${budgetType} trip to ${destination}?
2. Budget Distribution: Suggest how to allocate this budget across flights, accommodation, food, activities, and local transport
3. Daily Budget: Calculate the daily per-person budget and assess if it's realistic
4. Top 5 Money-Saving Tips: Specific recommendations for ${destination} travel
5. What you can expect: Quality/experience level for this budget in ${destination}

Be practical and specific to ${destination}. Format as clear bullet points.`;

    const result = await callGeminiCore(prompt);
    
    if (result && result.text) {
      return result.text;
    } else if (typeof result === 'string') {
      return result;
    } else {
      return "✓ Budget Analysis for " + destination + "\n\n" +
             "Total Budget: $" + totalCost.toFixed(2) + "\n" +
             "Per Person: $" + costPerPerson + "\n" +
             "Travel Style: " + (budgetType || 'moderate') + "\n\n" +
             "Budget Breakdown Suggestion:\n" +
             "• Flights: 35-45% ($" + (totalCost * 0.40).toFixed(2) + ")\n" +
             "• Accommodation: 30-35% ($" + (totalCost * 0.33).toFixed(2) + ")\n" +
             "• Food & Activities: 15-20% ($" + (totalCost * 0.18).toFixed(2) + ")\n" +
             "• Local Transport & Misc: 5-10% ($" + (totalCost * 0.06).toFixed(2) + ")\n\n" +
             "Daily Per-Person Budget: $" + (costPerPerson / 7).toFixed(2) + " (assuming 7-day trip)\n\n" +
             "Top Tips:\n" +
             "• Book flights in advance and use price trackers\n" +
             "• Choose accommodations by comfort level and location\n" +
             "• Mix local eateries with occasional dining splurges\n" +
             "• Use public transport and look for city passes\n" +
             "• Travel during shoulder season for significant savings";
    }
  } catch (err) {
    console.error('Cost analysis error:', err);
    const totalCost = costData.totalCost || 0;
    const costPerPerson = ((totalCost) / Math.max(1, costData.travelers)).toFixed(2);
    return "Budget Analysis for " + (costData.destination || '') + 
           "\n\nTotal Trip Cost: $" + totalCost.toFixed(2) +
           "\nCost per Person: $" + costPerPerson +
           "\nTravel Style: " + (costData.budgetType || 'moderate') +
           "\n\nRecommended Allocation:\n" +
           "• Flights: 35-45%\n" +
           "• Accommodation: 30-35%\n" +
           "• Meals & Activities: 20%\n" +
           "• Local Transport & Misc: 5-10%\n\n" +
           "Money-Saving Tips:\n" +
           "• Book flights 6-8 weeks in advance\n" +
           "• Use budget airlines and off-peak flights\n" +
           "• Consider mid-range hotels or guesthouses\n" +
           "• Eat at local markets and bakeries\n" +
           "• Use public transportation and city cards";
  }
}

module.exports = { generateItinerary, getHiddenGems, checkHealth, analyzeTripCost };
