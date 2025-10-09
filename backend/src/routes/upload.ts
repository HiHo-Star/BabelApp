import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { TranscriptionService } from '../services/transcription';
import { CloudinaryService } from '../services/cloudinary';

const router = express.Router();

// Ensure uploads directories exist
const audioUploadsDir = path.join(__dirname, '../../uploads/audio');
const mediaUploadsDir = path.join(__dirname, '../../uploads/media');
if (!fs.existsSync(audioUploadsDir)) {
  fs.mkdirSync(audioUploadsDir, { recursive: true });
}
if (!fs.existsSync(mediaUploadsDir)) {
  fs.mkdirSync(mediaUploadsDir, { recursive: true });
}

// Configure multer for audio file storage
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.m4a';
    cb(null, 'audio-' + uniqueSuffix + ext);
  }
});

// Configure multer for media (image/video) file storage
const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, mediaUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const prefix = file.mimetype.startsWith('video/') ? 'video' : 'image';
    cb(null, prefix + '-' + uniqueSuffix + ext);
  }
});

// File filter to accept only audio files
const audioFileFilter = (req: any, file: any, cb: any) => {
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

// File filter to accept images and videos
const mediaFileFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/3gpp'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

const mediaUpload = multer({
  storage: mediaStorage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size for images/videos
  }
});

// Upload audio file endpoint
router.post('/audio', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Audio file uploaded:', req.file.filename);
    const filePath = req.file.path;

    // Upload to Cloudinary if configured, otherwise use local storage
    let fileUrl = `/uploads/audio/${req.file.filename}`;

    if (CloudinaryService.isConfigured()) {
      try {
        console.log('Uploading audio to Cloudinary...');
        const cloudinaryResult = await CloudinaryService.uploadAudio(filePath);
        fileUrl = cloudinaryResult.secure_url;
        console.log('Audio uploaded to Cloudinary:', fileUrl);

        // Delete local file after successful upload to Cloudinary
        fs.unlinkSync(filePath);
      } catch (cloudinaryError) {
        console.error('Cloudinary upload failed, using local storage:', cloudinaryError);
        // Fall back to local storage
      }
    } else {
      console.log('Cloudinary not configured, using local storage');
    }

    // Transcribe the audio file (optional - non-blocking)
    let transcription = '';
    try {
      console.log('Starting transcription for file:', filePath);
      // Add a timeout to prevent hanging
      const transcriptionPromise = TranscriptionService.transcribeAudio(filePath);
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Transcription timeout')), 10000)
      );

      transcription = await Promise.race([transcriptionPromise, timeoutPromise]);
      console.log('Transcription result:', transcription);
    } catch (transcriptionError: any) {
      console.error('Error transcribing audio (non-blocking):', transcriptionError?.message || transcriptionError);
      // Continue even if transcription fails - transcription will be empty
      // This allows voice messages to work without Google Cloud credentials
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

// Upload media file (image/video) endpoint
router.post('/media', mediaUpload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No media file provided' });
    }

    console.log('Media file uploaded:', req.file.filename);
    const filePath = req.file.path;
    const contentType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    // Get optional caption from request body
    const caption = req.body.caption || '';

    // Upload to Cloudinary if configured, otherwise use local storage
    let fileUrl = `/uploads/media/${req.file.filename}`;

    if (CloudinaryService.isConfigured()) {
      try {
        console.log(`Uploading ${contentType} to Cloudinary...`);

        const cloudinaryResult = contentType === 'video'
          ? await CloudinaryService.uploadVideo(filePath)
          : await CloudinaryService.uploadImage(filePath);

        fileUrl = cloudinaryResult.secure_url;
        console.log(`${contentType} uploaded to Cloudinary:`, fileUrl);

        // Delete local file after successful upload to Cloudinary
        fs.unlinkSync(filePath);
      } catch (cloudinaryError) {
        console.error('Cloudinary upload failed, using local storage:', cloudinaryError);
        // Fall back to local storage
      }
    } else {
      console.log('Cloudinary not configured, using local storage');
    }

    return res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
      contentType: contentType,
      caption: caption
    });
  } catch (error) {
    console.error('Error uploading media file:', error);
    return res.status(500).json({ error: 'Failed to upload media file' });
  }
});

export default router;
