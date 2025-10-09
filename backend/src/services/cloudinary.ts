import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryService {
  /**
   * Upload an image to Cloudinary
   * @param filePath - Local file path to upload
   * @param folder - Cloudinary folder to organize uploads (default: 'babelapp/images')
   * @returns Cloudinary upload result with secure URL
   */
  static async uploadImage(filePath: string, folder: string = 'babelapp/images') {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: folder,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' }, // Max dimensions
          { quality: 'auto', fetch_format: 'auto' }     // Auto optimization
        ],
      });

      console.log('Image uploaded to Cloudinary:', result.secure_url);
      return result;
    } catch (error) {
      console.error('Error uploading image to Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Upload a video to Cloudinary
   * @param filePath - Local file path to upload
   * @param folder - Cloudinary folder to organize uploads (default: 'babelapp/videos')
   * @returns Cloudinary upload result with secure URL
   */
  static async uploadVideo(filePath: string, folder: string = 'babelapp/videos') {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: folder,
        resource_type: 'video',
        transformation: [
          { width: 1280, height: 720, crop: 'limit' },  // Max dimensions
          { quality: 'auto', fetch_format: 'auto' }      // Auto optimization
        ],
      });

      console.log('Video uploaded to Cloudinary:', result.secure_url);
      return result;
    } catch (error) {
      console.error('Error uploading video to Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Upload an audio file to Cloudinary
   * @param filePath - Local file path to upload
   * @param folder - Cloudinary folder to organize uploads (default: 'babelapp/audio')
   * @returns Cloudinary upload result with secure URL
   */
  static async uploadAudio(filePath: string, folder: string = 'babelapp/audio') {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: folder,
        resource_type: 'video', // Cloudinary uses 'video' resource type for audio
      });

      console.log('Audio uploaded to Cloudinary:', result.secure_url);
      return result;
    } catch (error) {
      console.error('Error uploading audio to Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Cloudinary
   * @param publicId - The public ID of the file to delete
   * @param resourceType - Type of resource ('image', 'video', 'raw')
   */
  static async deleteFile(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image') {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });

      console.log('File deleted from Cloudinary:', publicId);
      return result;
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Check if Cloudinary is properly configured
   */
  static isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }
}

export default CloudinaryService;
