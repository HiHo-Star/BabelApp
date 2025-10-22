import express from 'express';
import { TextToSpeechService } from '../services/textToSpeech';
import { body, validationResult } from 'express-validator';
import fs from 'fs';

const router = express.Router();

/**
 * POST /api/tts/synthesize
 * Generate audio from text using Google Text-to-Speech
 *
 * Body:
 * - text: The text to convert to speech
 * - languageCode: Language code (e.g., 'en-US', 'he-IL')
 *
 * Returns audio file as MP3
 */
router.post(
  '/synthesize',
  [
    body('text').notEmpty().withMessage('Text is required'),
    body('languageCode').optional().isString().withMessage('Language code must be a string')
  ],
  async (req: any, res: any) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { text, languageCode = 'en-US' } = req.body;

      console.log(`TTS request - Text: "${text.substring(0, 50)}...", Language: ${languageCode}`);

      // Generate audio buffer
      const audioBuffer = await TextToSpeechService.synthesizeSpeechBuffer(text, languageCode);

      // Set response headers
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      });

      // Send audio buffer
      res.send(audioBuffer);
      console.log(`✅ TTS audio sent successfully (${audioBuffer.length} bytes)`);
    } catch (error) {
      console.error('Error in TTS synthesis:', error);
      res.status(500).json({
        error: 'Failed to generate speech',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/tts/synthesize-file
 * Generate audio file from text and return file path
 *
 * Body:
 * - text: The text to convert to speech
 * - languageCode: Language code
 *
 * Returns JSON with file path
 */
router.post(
  '/synthesize-file',
  [
    body('text').notEmpty().withMessage('Text is required'),
    body('languageCode').optional().isString().withMessage('Language code must be a string')
  ],
  async (req: any, res: any) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { text, languageCode = 'en-US' } = req.body;

      console.log(`TTS file request - Text: "${text.substring(0, 50)}...", Language: ${languageCode}`);

      // Generate audio file
      const audioFilePath = await TextToSpeechService.synthesizeSpeech(text, languageCode);

      // Get relative path for client
      const relativePath = audioFilePath.replace(/^.*[\\\/]uploads[\\\/]/, '/uploads/');

      res.json({
        success: true,
        audioUrl: relativePath,
        message: 'Speech synthesized successfully'
      });
      console.log(`✅ TTS file created: ${relativePath}`);
    } catch (error) {
      console.error('Error in TTS file synthesis:', error);
      res.status(500).json({
        error: 'Failed to generate speech file',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/tts/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'text-to-speech',
    timestamp: new Date().toISOString()
  });
});

export default router;
