const axios = require('axios');

/**
 * Get current weather for a destination using Open-Meteo (FREE, NO KEY)
 * @param {string} city 
 */
async function getWeather(city) {
  try {
    // 1. Get coordinates for the city (Geocoding)
    const geoResponse = await axios.get(`https://geocoding-api.open-meteo.com/v1/search`, {
      params: { name: city, count: 1, language: 'en', format: 'json' }
    });

    if (!geoResponse.data.results || geoResponse.data.results.length === 0) {
      return null;
    }

    const { latitude, longitude, name } = geoResponse.data.results[0];

    // 2. Get weather for those coordinates
    const weatherResponse = await axios.get(`https://api.open-meteo.com/v1/forecast`, {
      params: {
        latitude,
        longitude,
        current_weather: true,
        timezone: 'auto'
      }
    });

    const current = weatherResponse.data.current_weather;
    
    // Map to a format similar to what the app expects
    return {
      main: { temp: current.temperature },
      weather: [{ 
        description: getWeatherDescription(current.weathercode),
        icon: '01d' // Open-Meteo doesn't provide icons directly, using a default
      }],
      name: name
    };
  } catch (err) {
    console.error('Open-Meteo Error:', err.message);
    return null;
  }
}

/**
 * Helper to map WMO Weather interpretation codes
 */
function getWeatherDescription(code) {
  const mapping = {
    0: 'Clear sky',
    1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    95: 'Thunderstorm'
  };
  return mapping[code] || 'Unknown';
}

module.exports = {
  getWeather
};
