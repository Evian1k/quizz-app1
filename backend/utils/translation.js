const { Translate } = require('@google-cloud/translate').v2;
const axios = require('axios');

// Initialize Google Translate client
const translate = new Translate({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE, // Path to service account key
});

// Fallback to Google Translate API (if cloud translate not available)
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

/**
 * Translate text to target language
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code (e.g., 'es', 'fr', 'de')
 * @param {string} sourceLanguage - Source language code (optional, auto-detect if not provided)
 * @returns {Promise<string>} - Translated text
 */
async function translateText(text, targetLanguage, sourceLanguage = null) {
  try {
    // Validate input
    if (!text || !targetLanguage) {
      throw new Error('Text and target language are required');
    }

    // Check if translation is needed (same language)
    if (sourceLanguage && sourceLanguage === targetLanguage) {
      return text;
    }

    // Try Google Cloud Translate first
    if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_KEY_FILE) {
      try {
        const [translation] = await translate.translate(text, {
          to: targetLanguage,
          from: sourceLanguage || undefined
        });
        
        return translation;
      } catch (cloudError) {
        console.warn('Google Cloud Translate failed, falling back to API:', cloudError.message);
      }
    }

    // Fallback to Google Translate API
    if (GOOGLE_TRANSLATE_API_KEY) {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
        {
          q: text,
          target: targetLanguage,
          source: sourceLanguage || undefined,
          format: 'text'
        }
      );

      if (response.data && response.data.data && response.data.data.translations) {
        return response.data.data.translations[0].translatedText;
      }
    }

    // If no translation service available, return original text
    console.warn('No translation service configured, returning original text');
    return text;

  } catch (error) {
    console.error('Translation error:', error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

/**
 * Detect language of text
 * @param {string} text - Text to analyze
 * @returns {Promise<string>} - Detected language code
 */
async function detectLanguage(text) {
  try {
    if (!text) {
      throw new Error('Text is required for language detection');
    }

    // Try Google Cloud Translate first
    if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_KEY_FILE) {
      try {
        const [detection] = await translate.detect(text);
        return detection.language;
      } catch (cloudError) {
        console.warn('Google Cloud language detection failed:', cloudError.message);
      }
    }

    // Fallback to Google Translate API
    if (GOOGLE_TRANSLATE_API_KEY) {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2/detect?key=${GOOGLE_TRANSLATE_API_KEY}`,
        {
          q: text
        }
      );

      if (response.data && response.data.data && response.data.data.detections) {
        return response.data.data.detections[0][0].language;
      }
    }

    // Default to English if detection fails
    return 'en';

  } catch (error) {
    console.error('Language detection error:', error);
    return 'en'; // Default to English
  }
}

/**
 * Get supported languages
 * @returns {Promise<Array>} - Array of supported language objects
 */
async function getSupportedLanguages() {
  try {
    // Try Google Cloud Translate first
    if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_KEY_FILE) {
      try {
        const [languages] = await translate.getLanguages();
        return languages.map(lang => ({
          code: lang.code,
          name: lang.name
        }));
      } catch (cloudError) {
        console.warn('Google Cloud languages failed:', cloudError.message);
      }
    }

    // Fallback to Google Translate API
    if (GOOGLE_TRANSLATE_API_KEY) {
      const response = await axios.get(
        `https://translation.googleapis.com/language/translate/v2/languages?key=${GOOGLE_TRANSLATE_API_KEY}&target=en`
      );

      if (response.data && response.data.data && response.data.data.languages) {
        return response.data.data.languages.map(lang => ({
          code: lang.language,
          name: lang.name
        }));
      }
    }

    // Return common languages as fallback
    return getCommonLanguages();

  } catch (error) {
    console.error('Error fetching supported languages:', error);
    return getCommonLanguages();
  }
}

/**
 * Get common languages (fallback)
 * @returns {Array} - Array of common language objects
 */
function getCommonLanguages() {
  return [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'tr', name: 'Turkish' },
    { code: 'pl', name: 'Polish' },
    { code: 'nl', name: 'Dutch' },
    { code: 'sv', name: 'Swedish' },
    { code: 'da', name: 'Danish' },
    { code: 'no', name: 'Norwegian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'el', name: 'Greek' }
  ];
}

/**
 * Batch translate multiple texts
 * @param {Array<string>} texts - Array of texts to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} sourceLanguage - Source language code (optional)
 * @returns {Promise<Array<string>>} - Array of translated texts
 */
async function batchTranslate(texts, targetLanguage, sourceLanguage = null) {
  try {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    // Try Google Cloud Translate first
    if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_KEY_FILE) {
      try {
        const [translations] = await translate.translate(texts, {
          to: targetLanguage,
          from: sourceLanguage || undefined
        });
        
        return Array.isArray(translations) ? translations : [translations];
      } catch (cloudError) {
        console.warn('Google Cloud batch translate failed:', cloudError.message);
      }
    }

    // Fallback: translate one by one using API
    const translatedTexts = [];
    for (const text of texts) {
      try {
        const translated = await translateText(text, targetLanguage, sourceLanguage);
        translatedTexts.push(translated);
      } catch (error) {
        console.error('Error translating text:', text, error);
        translatedTexts.push(text); // Keep original if translation fails
      }
    }

    return translatedTexts;

  } catch (error) {
    console.error('Batch translation error:', error);
    return texts; // Return original texts if batch translation fails
  }
}

/**
 * Check if translation service is configured
 * @returns {boolean} - True if translation service is available
 */
function isTranslationAvailable() {
  return !!(
    (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_KEY_FILE) ||
    GOOGLE_TRANSLATE_API_KEY
  );
}

module.exports = {
  translateText,
  detectLanguage,
  getSupportedLanguages,
  batchTranslate,
  isTranslationAvailable,
  getCommonLanguages
};