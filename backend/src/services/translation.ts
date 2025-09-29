import translate from 'google-translate-api-x';
import { pool, createMessageTranslation, getChatParticipants } from '../config/database';
import { MessageTranslation } from '../types';

export class TranslationService {
  /**
   * Translate a message to a target language
   */
  static async translateMessage(
    messageId: string,
    targetLanguage: string,
    originalContent: string,
    originalLanguage: string
  ): Promise<string> {
    try {
      // Check if translation already exists
      const existingTranslation = await this.getExistingTranslation(messageId, targetLanguage);
      if (existingTranslation) {
        return existingTranslation;
      }

      // Translate the message
      const result = await translate(originalContent, {
        from: originalLanguage,
        to: targetLanguage,
      });

      const translatedContent = result.text;

      // Store the translation
      await this.storeTranslation(messageId, targetLanguage, translatedContent);

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