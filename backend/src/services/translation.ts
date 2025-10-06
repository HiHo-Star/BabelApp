import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { pool, createMessageTranslation, getChatParticipants } from '../config/database';
import { MessageTranslation } from '../types';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Try different model names - Latest Gemini models (2025)
// Ordered from newest/fastest to older models
let model: GenerativeModel;
const modelNamesToTry = [
  'gemini-2.5-flash',           // Latest Feb 2025 - fastest and best
  'gemini-2.5-flash-latest',    // Alternative name
  'gemini-2.0-flash',           // Dec 2024 - very fast
  'gemini-2.0-flash-exp',       // Experimental 2.0
  'gemini-1.5-flash',           // Stable 1.5
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',             // Pro version
  'gemini-1.0-pro-002',         // Older stable
  'gemini-1.0-pro'              // Fallback
];

// Use the first model name (we'll handle errors gracefully in the translate function)
model = genAI.getGenerativeModel({
  model: modelNamesToTry[0]
});

export class TranslationService {
  /**
   * List available models (for debugging)
   */
  static async listAvailableModels(): Promise<void> {
    try {
      console.log('=== Attempting to list available Gemini models ===');
      // This is just for logging - the SDK doesn't expose a listModels method easily
      console.log('Using model:', model.model);
    } catch (error) {
      console.error('Error listing models:', error);
    }
  }

  /**
   * Translate a message to a target language using Gemini AI
   */
  static async translateMessage(
    messageId: string,
    targetLanguage: string,
    originalContent: string,
    originalLanguage: string
  ): Promise<string> {
    // Convert language codes to full names for better translation
    const langMap: { [key: string]: string } = {
      'en': 'English',
      'he': 'Hebrew',
      'iw': 'Hebrew',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ar': 'Arabic',
      'ru': 'Russian',
      'zh': 'Chinese',
    };

    const targetLangName = langMap[targetLanguage] || targetLanguage;
    const originalLangName = langMap[originalLanguage] || originalLanguage;

    // Create translation prompt for Gemini
    const prompt = `Translate the following message from ${originalLangName} to ${targetLangName}.
Only return the translated text, nothing else. Keep the same tone and style.
If there are names, keep them as is.

Message: "${originalContent}"

Translation:`;

    console.log(`Translating "${originalContent}" from ${originalLangName} to ${targetLangName} using Gemini...`);

    // Try each model until one works
    for (let i = 0; i < modelNamesToTry.length; i++) {
      try {
        const currentModel = genAI.getGenerativeModel({ model: modelNamesToTry[i] });
        console.log(`Attempting translation with model: ${modelNamesToTry[i]}`);

        const result = await currentModel.generateContent(prompt);
        const response = await result.response;
        const translatedContent = response.text().trim();

        console.log(`✅ Translation successful with model ${modelNamesToTry[i]}: "${translatedContent}"`);

        // Update the global model to the working one
        model = currentModel;

        return translatedContent;
      } catch (error: any) {
        console.error(`❌ Model ${modelNamesToTry[i]} failed:`, error.message);

        // If this is the last model, return original
        if (i === modelNamesToTry.length - 1) {
          console.error('All models failed, returning original content');
          return originalContent;
        }

        // Otherwise, try next model
        console.log(`Trying next model...`);
      }
    }

    // Fallback (shouldn't reach here)
    return originalContent;
  }

  /**
   * Get existing translation from database
   */
  private static async getExistingTranslation(
    messageId: string,
    targetLanguage: string
  ): Promise<string | null> {
    const query = `
      SELECT translated_content 
      FROM message_translations 
      WHERE message_id = $1 AND target_language = $2
    `;
    const result = await pool.query(query, [messageId, targetLanguage]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].translated_content;
  }

  /**
   * Store translation in database
   */
  private static async storeTranslation(
    messageId: string,
    targetLanguage: string,
    translatedContent: string
  ): Promise<void> {
    try {
      await createMessageTranslation({
        message_id: messageId,
        target_language: targetLanguage,
        translated_content: translatedContent,
      });
    } catch (error) {
      console.error('Error storing translation:', error);
    }
  }

  /**
   * Translate message for all participants in a chat
   */
  static async translateMessageForChat(
    messageId: string,
    originalContent: string,
    originalLanguage: string,
    chatId: string
  ): Promise<void> {
    try {
      // Get all participants in the chat
      const participants = await getChatParticipants(chatId);

      if (!participants || participants.length === 0) {
        console.error('No participants found for chat:', chatId);
        return;
      }

      // Translate for each participant's language
      const translationPromises = participants.map(async (participant: any) => {
        const userLanguage = participant.language;
        
        // Skip if user's language is the same as original
        if (userLanguage === originalLanguage) {
          return;
        }

        return this.translateMessage(
          messageId,
          userLanguage,
          originalContent,
          originalLanguage
        );
      });

      await Promise.all(translationPromises);
    } catch (error) {
      console.error('Error translating message for chat:', error);
    }
  }

  /**
   * Get translated message for a specific user
   */
  static async getTranslatedMessage(
    messageId: string,
    userLanguage: string,
    originalContent: string,
    originalLanguage: string
  ): Promise<string> {
    // If user's language is the same as original, return original
    if (userLanguage === originalLanguage) {
      return originalContent;
    }

    // Get or create translation
    return this.translateMessage(messageId, userLanguage, originalContent, originalLanguage);
  }
} 