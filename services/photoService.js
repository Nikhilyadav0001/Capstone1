const axios = require('axios');

/**
 * Fetch a destination photo using Lorem Flickr (TRULY FREE, NO KEY REQUIRED)
 */
async function getPhoto(city) {
  try {
    // We use a high-quality redirect service that finds relevant images by keyword
    const imageUrl = `https://loremflickr.com/1200/600/${encodeURIComponent(city)},landscape/all`;
    
    // Increased timeout to 10s to handle slower connections
    await axios.head(imageUrl, { timeout: 10000 });
    
    return imageUrl;
  } catch (err) {
    console.error('⚠️ Photo Service Timeout/Error, using fallback:', err.message);
    // Reliable high-quality travel fallback
    return 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';
  }
}

async function checkHealth() {
  return 'OK'; // Always OK because it's keyless
}

module.exports = { getPhoto, checkHealth };
