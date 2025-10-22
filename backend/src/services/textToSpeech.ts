import textToSpeech, { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';

// Initialize Text-to-Speech client with credentials from environment variable (for Railway)
// or from default credentials file (for local development)
let client: TextToSpeechClient;

try {
  if (process.env.GOOGLE_CLOUD_CREDENTIALS_JSON) {
    // Railway deployment: credentials from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS_JSON);
    client = new textToSpeech.TextToSpeechClient({ credentials });
    console.log('✅ Google Cloud Text-to-Speech initialized from environment variable');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Local development: credentials from file path
    client = new textToSpeech.TextToSpeechClient();
    console.log('✅ Google Cloud Text-to-Speech initialized from credentials file');
  } else {
    // No credentials provided - will fail gracefully in endpoint
    client = new textToSpeech.TextToSpeechClient();
    console.log('⚠️  No Google Cloud credentials configured - text-to-speech will be disabled');
  }
} catch (error) {
  console.error('❌ Error initializing Text-to-Speech client:', error);
  client = new textToSpeech.TextToSpeechClient();
}

// Language code to Google TTS voice name mapping
const LANGUAGE_VOICE_MAP: { [key: string]: { name: string; gender: string } } = {
  'en': { name: 'en-US-Standard-D', gender: 'MALE' },      // English
  'en-US': { name: 'en-US-Standard-D', gender: 'MALE' },
  'en-GB': { name: 'en-GB-Standard-B', gender: 'MALE' },
  'he': { name: 'he-IL-Standard-A', gender: 'FEMALE' },    // Hebrew
  'he-IL': { name: 'he-IL-Standard-A', gender: 'FEMALE' },
  'es': { name: 'es-ES-Standard-A', gender: 'FEMALE' },    // Spanish
  'es-ES': { name: 'es-ES-Standard-A', gender: 'FEMALE' },
  'fr': { name: 'fr-FR-Standard-A', gender: 'FEMALE' },    // French
  'fr-FR': { name: 'fr-FR-Standard-A', gender: 'FEMALE' },
  'de': { name: 'de-DE-Standard-A', gender: 'FEMALE' },    // German
  'de-DE': { name: 'de-DE-Standard-A', gender: 'FEMALE' },
  'it': { name: 'it-IT-Standard-A', gender: 'FEMALE' },    // Italian
  'it-IT': { name: 'it-IT-Standard-A', gender: 'FEMALE' },
  'pt': { name: 'pt-BR-Standard-A', gender: 'FEMALE' },    // Portuguese
  'pt-BR': { name: 'pt-BR-Standard-A', gender: 'FEMALE' },
  'ru': { name: 'ru-RU-Standard-A', gender: 'FEMALE' },    // Russian
  'ru-RU': { name: 'ru-RU-Standard-A', gender: 'FEMALE' },
  'ar': { name: 'ar-XA-Standard-A', gender: 'FEMALE' },    // Arabic
  'ar-SA': { name: 'ar-XA-Standard-A', gender: 'FEMALE' },
  'zh': { name: 'cmn-CN-Standard-A', gender: 'FEMALE' },   // Chinese
  'zh-CN': { name: 'cmn-CN-Standard-A', gender: 'FEMALE' },
  'ja': { name: 'ja-JP-Standard-A', gender: 'FEMALE' },    // Japanese
  'ja-JP': { name: 'ja-JP-Standard-A', gender: 'FEMALE' },
};

export class TextToSpeechService {
  /**
   * Convert text to speech audio file
   * @param text - The text to convert to speech
   * @param languageCode - Language code (e.g., 'en-US', 'he-IL')
   * @param outputFilePath - Optional path to save the audio file. If not provided, generates a temp file.
   * @returns Path to the generated audio file
   */
  static async synthesizeSpeech(
    text: string,
    languageCode: string = 'en-US',
    outputFilePath?: string
  ): Promise<string> {
    try {
      console.log(`Synthesizing speech for text: "${text.substring(0, 50)}..." in language: ${languageCode}`);

      // Normalize language code
      const normalizedLang = languageCode.toLowerCase();
      let voiceConfig = LANGUAGE_VOICE_MAP[normalizedLang];

      // Fallback to base language if specific locale not found
      if (!voiceConfig && normalizedLang.includes('-')) {
        const baseLang = normalizedLang.split('-')[0];
        voiceConfig = LANGUAGE_VOICE_MAP[baseLang];
      }

      // Final fallback to English
      if (!voiceConfig) {
        console.log(`Voice not found for ${languageCode}, falling back to English`);
        voiceConfig = LANGUAGE_VOICE_MAP['en'];
      }

      // Construct the request
      const request = {
        input: { text },
        voice: {
          languageCode: languageCode,
          name: voiceConfig.name,
          ssmlGender: voiceConfig.gender as any,
        },
        audioConfig: {
          audioEncoding: 'MP3' as any,
          speakingRate: 1.0,
          pitch: 0.0,
        },
      };

      // Perform the text-to-speech request
      const [response] = await client.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content returned from TTS service');
      }

      // Generate output file path if not provided
      const audioFilePath = outputFilePath || path.join(
        process.cwd(),
        'uploads',
        `tts_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
      );

      // Ensure uploads directory exists
      const uploadsDir = path.dirname(audioFilePath);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Write the audio content to file
      fs.writeFileSync(audioFilePath, response.audioContent, 'binary');
      console.log(`✅ Audio content written to file: ${audioFilePath}`);

      return audioFilePath;
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  /**
   * Get audio buffer directly without saving to file
   * @param text - The text to convert to speech
   * @param languageCode - Language code
   * @returns Audio buffer
   */
  static async synthesizeSpeechBuffer(
    text: string,
    languageCode: string = 'en-US'
  ): Promise<Buffer> {
    try {
      console.log(`Synthesizing speech buffer for: "${text.substring(0, 50)}..." in ${languageCode}`);

      // Normalize language code
      const normalizedLang = languageCode.toLowerCase();
      let voiceConfig = LANGUAGE_VOICE_MAP[normalizedLang];

      // Fallback to base language if specific locale not found
      if (!voiceConfig && normalizedLang.includes('-')) {
        const baseLang = normalizedLang.split('-')[0];
        voiceConfig = LANGUAGE_VOICE_MAP[baseLang];
      }

      // Final fallback to English
      if (!voiceConfig) {
        voiceConfig = LANGUAGE_VOICE_MAP['en'];
      }

      const request = {
        input: { text },
        voice: {
          languageCode: languageCode,
          name: voiceConfig.name,
          ssmlGender: voiceConfig.gender as any,
        },
        audioConfig: {
          audioEncoding: 'MP3' as any,
          speakingRate: 1.0,
          pitch: 0.0,
        },
      };

      const [response] = await client.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content returned from TTS service');
      }

      return Buffer.from(response.audioContent);
    } catch (error) {
      console.error('Error synthesizing speech buffer:', error);
      throw error;
    }
  }
}
