import { GoogleGenerativeAI } from '@google/generative-ai';
import { pool, createMessageTranslation, getChatParticipants } from '../config/database';
import { MessageTranslation } from '../types';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export class TranslationService {
  /**
   * Translate a message to a target language using Gemini AI
   */
  static async translateMessage(
    messageId: string,
    targetLanguage: string,
    originalContent: string,
    originalLanguage: string
  ): Promise<string> {
    try {
      // Skip database caching for now (database not connected on Railway)
      // TODO: Re-enable when PostgreSQL is configured
      // const existingTranslation = await this.getExistingTranslation(messageId, targetLanguage);
      // if (existingTranslation) {
      //   console.log(`Using cached translation for message ${messageId} to ${targetLanguage}`);
      //   return existingTranslation;
      // }

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

      // Call Gemini API
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const translatedContent = response.text().trim();

      console.log(`Translation result: "${translatedContent}"`);

      // Skip database storage for now (database not connected on Railway)
      // TODO: Re-enable when PostgreSQL is configured
      // await this.storeTranslation(messageId, targetLanguage, translatedContent);

      return translatedContent;
    } catch (error) {
      console.error('Translation error:', error);
      // Return original content if translation fails
      return originalContent;
    }
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