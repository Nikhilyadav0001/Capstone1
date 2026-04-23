/**
 * TRAIN COST MODEL
 * Run: node scripts/trainCostModel.js
 * Output: models/cost_model.json
 */

console.log('🚀 Starting Cost Model Training...');

const fs = require('fs');
const path = require('path');

// ── Read CSV synchronously ────────────────────────────────────────────────────
function readCSVSync(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const lines = fs.readFileSync(filePath, 'utf-8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = [];
        let current = '';
        let inQuotes = false;
        for (const ch of lines[i]) {
            if (ch === '"') { inQuotes = !inQuotes; }
            else if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
            else { current += ch; }
        }
        cols.push(current.trim());

        if (cols.length >= headers.length) {
            const row = {};
            headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
            rows.push(row);
        }
    }
    return rows;
}

function parsePrice(str) {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(/[",\s₹]/g, ''));
    return isNaN(n) ? 0 : n;
}

function normalizeCity(name) {
    return String(name || '').toLowerCase().trim()
        .replace('bengaluru', 'bangalore')
        .replace('bombay', 'mumbai');
}

// ── City tier ─────────────────────────────────────────────────────────────────
const CITY_TIERS = {
    mumbai: 1, delhi: 1, bangalore: 1, chennai: 1, kolkata: 1, hyderabad: 1,
    pune: 2, ahmedabad: 2, jaipur: 2, lucknow: 2, kochi: 2, goa: 2,
    manali: 3, shimla: 3, udaipur: 3, varanasi: 3, agra: 3
};
const BUDGET_ENC = { economy: 1, moderate: 2, luxury: 3 };

function getCityTier(city) { return CITY_TIERS[normalizeCity(city)] || 2; }

// ── Load hotel data ───────────────────────────────────────────────────────────
console.log('📂 Reading hotel CSVs...');
const hotelDir = path.join(__dirname, '../data/hotel');
const hotelFiles = fs.existsSync(hotelDir) ? fs.readdirSync(hotelDir).filter(f => f.endsWith('.csv')) : [];
console.log(`   Found ${hotelFiles.length} hotel files: ${hotelFiles.join(', ')}`);

const hotelData = {};
for (const file of hotelFiles) {
    const city = normalizeCity(path.basename(file, '.csv'));
    const rows = readCSVSync(path.join(hotelDir, file));
    hotelData[city] = rows
        .map(r => ({ price: parsePrice(r['Price']), starRating: parseFloat(r['Star Rating']) || 3 }))
        .filter(h => h.price > 0);
    console.log(`   ${city}: ${hotelData[city].length} hotels`);
}

// ── Load flight data ──────────────────────────────────────────────────────────
console.log('📂 Reading flight CSVs...');
const flightDir = path.join(__dirname, '../data/flight');
const flightFiles = fs.existsSync(flightDir) ? fs.readdirSync(flightDir).filter(f => f.endsWith('.csv')) : [];
let allFlightPrices = [];
for (const file of flightFiles) {
    const rows = readCSVSync(path.join(flightDir, file));
    const prices = rows.map(r => parsePrice(r['Price'])).filter(p => p > 0);
    allFlightPrices = allFlightPrices.concat(prices);
}
const avgFlightPrice = allFlightPrices.length
    ? Math.round(allFlightPrices.reduce((a, b) => a + b, 0) / allFlightPrices.length)
    : 3500;
console.log(`   ${allFlightPrices.length} flight records, avg price: ₹${avgFlightPrice}`);

// ── Build training samples ───────────────────────────────────────────────────
console.log('🔨 Building training samples...');

const X = [];
const y = [];

const FOOD_COST = {
    1: { 1: 400, 2: 800, 3: 2000 },
    2: { 1: 300, 2: 600, 3: 1500 },
    3: { 1: 250, 2: 500, 3: 1200 },
};
const ACTIVITY_COST = {
    1: { 1: 200, 2: 500, 3: 1500 },
    2: { 1: 150, 2: 400, 3: 1200 },
    3: { 1: 100, 2: 300, 3: 1000 },
};

for (const [city, hotels] of Object.entries(hotelData)) {
    const tier = getCityTier(city);
    for (const hotel of hotels) {
        let budgetType = 'moderate';
        if (hotel.starRating >= 5) budgetType = 'luxury';
        else if (hotel.starRating <= 3) budgetType = 'economy';
        const bEnc = BUDGET_ENC[budgetType];

        for (let days = 2; days <= 7; days++) {
            for (let travelers = 1; travelers <= 4; travelers++) {
                const hotelTotal = hotel.price * days * travelers;
                const foodTotal = FOOD_COST[tier][bEnc] * days * travelers;
                const activitiesTotal = ACTIVITY_COST[tier][bEnc] * days;
                const transport = (tier === 1 ? 300 : 200) * days * travelers;
                const total = hotelTotal + foodTotal + activitiesTotal + transport;

                X.push([tier, bEnc, days, travelers, hotel.price]);
                y.push(Math.round(total));
            }
        }
    }
}

console.log(`   Built ${X.length} training samples`);

// ── Limit samples ─────────────────────────────────────────────────────────────
const sampleLimit = 2000;
const indices = Array.from({ length: X.length }, (_, i) => i)
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleLimit);
const X_train = indices.map(i => X[i]);
const y_train = indices.map(i => y[i]);
console.log(`   Using ${X_train.length} samples for training`);

// ── Train Linear Regression (no external library) ─────────────────────────────
console.log('📈 Training Linear Regression model...');

function trainLinearModel(X, y) {
    const n = X.length;
    const numFeatures = X[0].length;

    const means_x = new Array(numFeatures).fill(0);
    let mean_y = 0;

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < numFeatures; j++) means_x[j] += X[i][j];
        mean_y += y[i];
    }
    for (let j = 0; j < numFeatures; j++) means_x[j] /= n;
    mean_y /= n;

    const num = new Array(numFeatures).fill(0);
    const den = new Array(numFeatures).fill(0);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < numFeatures; j++) {
            num[j] += (X[i][j] - means_x[j]) * (y[i] - mean_y);
            den[j] += (X[i][j] - means_x[j]) ** 2;
        }
    }

    const weights = new Array(numFeatures).fill(0);
    for (let j = 0; j < numFeatures; j++) {
        weights[j] = den[j] !== 0 ? num[j] / den[j] : 0;
    }

    let bias = mean_y;
    for (let j = 0; j < numFeatures; j++) bias -= weights[j] * means_x[j];

    return { weights, bias, means_x, mean_y };
}

function predict(model, x) {
    return model.bias + model.weights.reduce((sum, w, j) => sum + w * x[j], 0);
}

const trainedModel = trainLinearModel(X_train, y_train);
console.log('✅ Model trained successfully');

// ── Validate ──────────────────────────────────────────────────────────────────
let totalErr = 0;
const testSize = Math.min(20, X_train.length);
for (let i = 0; i < testSize; i++) {
    const pred = predict(trainedModel, X_train[i]);
    totalErr += Math.abs(pred - y_train[i]) / y_train[i] * 100;
}
console.log(`📉 Avg prediction error: ${(totalErr / testSize).toFixed(1)}%`);

// ── Save ──────────────────────────────────────────────────────────────────────
const modelsDir = path.join(__dirname, '../models');
if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

const modelPath = path.join(modelsDir, 'cost_model.json');
const payload = JSON.stringify({
    version: '1.0',
    type: 'linear_regression',
    trainedAt: new Date().toISOString(),
    samples: X_train.length,
    avgFlightPrice,
    cityTiers: CITY_TIERS,
    features: ['cityTier', 'budgetEnc', 'days', 'travelers', 'hotelPricePerNight'],
    model: trainedModel,
});

fs.writeFileSync(modelPath, payload);
console.log(`\n💾 Saved → models/cost_model.json (${(Buffer.byteLength(payload) / 1024).toFixed(1)} KB)`);
console.log('✅ Cost model training complete!');