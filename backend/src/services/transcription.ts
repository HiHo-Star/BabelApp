import speech, { SpeechClient } from '@google-cloud/speech';
import fs from 'fs';

// Initialize Speech client with credentials from environment variable (for Railway)
// or from default credentials file (for local development)
let client: SpeechClient;

try {
  if (process.env.GOOGLE_CLOUD_CREDENTIALS_JSON) {
    // Railway deployment: credentials from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS_JSON);
    client = new speech.SpeechClient({ credentials });
    console.log('✅ Google Cloud Speech-to-Text initialized from environment variable');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Local development: credentials from file path
    client = new speech.SpeechClient();
    console.log('✅ Google Cloud Speech-to-Text initialized from credentials file');
  } else {
    // No credentials provided - will fail gracefully in upload endpoint
    client = new speech.SpeechClient();
    console.log('⚠️  No Google Cloud credentials configured - transcription will be disabled');
  }
} catch (error) {
  console.error('❌ Error initializing Speech-to-Text client:', error);
  client = new speech.SpeechClient();
}

export class TranscriptionService {
  /**
   * Transcribe audio file to text
   * @param audioFilePath - Path to the audio file
   * @param languageCode - Optional language code (e.g., 'en-US', 'he-IL'). If not provided, auto-detects.
   * @returns Transcribed text
   */
  static async transcribeAudio(audioFilePath: string, languageCode?: string): Promise<string> {
    try {
      console.log(`Transcribing audio file: ${audioFilePath}`);

      // Read the audio file
      const audioBytes = fs.readFileSync(audioFilePath).toString('base64');

      // Configure the request
      const audio = {
        content: audioBytes,
      };

      const config: any = {
        encoding: 'MP3', // M4A files are typically AAC encoded
        sampleRateHertz: 44100,
        audioChannelCount: 1,
        enableAutomaticPunctuation: true,
        model: 'default',
      };

      // If language code is provided, use it. Otherwise, enable auto-detection
      if (languageCode) {
        config.languageCode = languageCode;
      } else {
        // Auto-detect language from a list of common languages
        config.languageCode = 'en-US'; // Primary language
        config.alternativeLanguageCodes = [
          'he-IL', // Hebrew
          'es-ES', // Spanish
          'fr-FR', // French
          'de-DE', // German
          'it-IT', // Italian
          'pt-BR', // Portuguese
          'ru-RU', // Russian
          'ar-SA', // Arabic
          'zh-CN', // Chinese
          'ja-JP', // Japanese
        ];
      }

      const request = {
        audio: audio,
        config: config,
      };

      // Perform the transcription
      const [response] = await client.recognize(request);

      if (!response.results || response.results.length === 0) {
        console.log('No transcription results found');
        return '';
      }

      // Get the transcription from the first result
      const transcription = response.results
        .map((result: any) => result.alternatives?.[0]?.transcript || '')
        .join(' ')
        .trim();

      // Get the detected language
      const detectedLanguage = response.results[0]?.languageCode || 'unknown';
      console.log(`Transcription successful. Detected language: ${detectedLanguage}`);
      console.log(`Transcription: ${transcription}`);

      return transcription;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio with specific language
   */
  static async transcribeWithLanguage(audioFilePath: string, languageCode: string): Promise<string> {
    return this.transcribeAudio(audioFilePath, languageCode);
  }
}
