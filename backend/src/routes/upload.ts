import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { TranscriptionService } from '../services/transcription';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/audio');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for audio file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.m4a';
    cb(null, 'audio-' + uniqueSuffix + ext);
  }
});

// File filter to accept only audio files
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    'audio/mpeg',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/3gpp',
    'audio/aac'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// Upload audio file endpoint
router.post('/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Audio file uploaded:', req.file.filename);

    // Return the URL/path where the file can be accessed
    const fileUrl = `/uploads/audio/${req.file.filename}`;
    const filePath = req.file.path;

    // Transcribe the audio file
    let transcription = '';
    try {
      console.log('Starting transcription for file:', filePath);
      transcription = await TranscriptionService.transcribeAudio(filePath);
      console.log('Transcription result:', transcription);
    } catch (transcriptionError) {
      console.error('Error transcribing audio (non-blocking):', transcriptionError);
      // Continue even if transcription fails - transcription will be empty
    }

    return res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
      transcription: transcription
    });
  } catch (error) {
    console.error('Error uploading audio file:', error);
    return res.status(500).json({ error: 'Failed to upload audio file' });
  }
});

export default router;
