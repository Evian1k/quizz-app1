const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local file path
 * @param {Object} options - Upload options
 * @returns {Promise<string>} - Cloudinary URL
 */
async function uploadToCloudinary(filePath, options = {}) {
  try {
    if (!filePath) {
      throw new Error('File path is required');
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary configuration missing');
    }

    // Default options
    const uploadOptions = {
      folder: 'chatzone/media',
      resource_type: 'auto', // Automatically detect file type
      quality: 'auto:good', // Optimize quality
      fetch_format: 'auto', // Optimize format
      ...options
    };

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    return result.secure_url;

  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Media upload failed: ${error.message}`);
  }
}

/**
 * Upload image with transformations
 * @param {string} filePath - Local file path
 * @param {Object} transformations - Image transformations
 * @returns {Promise<string>} - Cloudinary URL
 */
async function uploadImage(filePath, transformations = {}) {
  try {
    const defaultTransformations = {
      width: 800,
      height: 600,
      crop: 'limit',
      quality: 'auto:good',
      fetch_format: 'auto'
    };

    const options = {
      folder: 'chatzone/images',
      resource_type: 'image',
      transformation: { ...defaultTransformations, ...transformations }
    };

    return await uploadToCloudinary(filePath, options);

  } catch (error) {
    console.error('Image upload error:', error);
    throw new Error(`Image upload failed: ${error.message}`);
  }
}

/**
 * Upload video with optimizations
 * @param {string} filePath - Local file path
 * @param {Object} options - Video options
 * @returns {Promise<string>} - Cloudinary URL
 */
async function uploadVideo(filePath, options = {}) {
  try {
    const defaultOptions = {
      quality: 'auto:good',
      video_codec: 'h264',
      audio_codec: 'aac',
      width: 1280,
      height: 720,
      crop: 'limit'
    };

    const uploadOptions = {
      folder: 'chatzone/videos',
      resource_type: 'video',
      transformation: { ...defaultOptions, ...options }
    };

    return await uploadToCloudinary(filePath, uploadOptions);

  } catch (error) {
    console.error('Video upload error:', error);
    throw new Error(`Video upload failed: ${error.message}`);
  }
}

/**
 * Upload audio file
 * @param {string} filePath - Local file path
 * @returns {Promise<string>} - Cloudinary URL
 */
async function uploadAudio(filePath) {
  try {
    const options = {
      folder: 'chatzone/audio',
      resource_type: 'video', // Audio files are handled as video in Cloudinary
    };

    return await uploadToCloudinary(filePath, options);

  } catch (error) {
    console.error('Audio upload error:', error);
    throw new Error(`Audio upload failed: ${error.message}`);
  }
}

/**
 * Upload user avatar with specific transformations
 * @param {string} filePath - Local file path
 * @returns {Promise<string>} - Cloudinary URL
 */
async function uploadAvatar(filePath) {
  try {
    const options = {
      folder: 'chatzone/avatars',
      resource_type: 'image',
      transformation: [
        {
          width: 200,
          height: 200,
          crop: 'fill',
          gravity: 'face:center',
          quality: 'auto:good',
          fetch_format: 'auto'
        },
        {
          radius: 'max' // Make it circular
        }
      ]
    };

    return await uploadToCloudinary(filePath, options);

  } catch (error) {
    console.error('Avatar upload error:', error);
    throw new Error(`Avatar upload failed: ${error.message}`);
  }
}

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type (image, video, raw)
 * @returns {Promise<Object>} - Deletion result
 */
async function deleteFromCloudinary(publicId, resourceType = 'image') {
  try {
    if (!publicId) {
      throw new Error('Public ID is required');
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });

    return result;

  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    throw new Error(`Media deletion failed: ${error.message}`);
  }
}

/**
 * Get optimized URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} transformations - Transformations to apply
 * @returns {string} - Optimized URL
 */
function getOptimizedUrl(publicId, transformations = {}) {
  try {
    if (!publicId) {
      throw new Error('Public ID is required');
    }

    const defaultTransformations = {
      quality: 'auto:good',
      fetch_format: 'auto'
    };

    return cloudinary.url(publicId, {
      ...defaultTransformations,
      ...transformations
    });

  } catch (error) {
    console.error('URL generation error:', error);
    return publicId; // Return original if transformation fails
  }
}

/**
 * Generate thumbnail for video
 * @param {string} videoPublicId - Video public ID
 * @param {Object} options - Thumbnail options
 * @returns {string} - Thumbnail URL
 */
function generateVideoThumbnail(videoPublicId, options = {}) {
  try {
    const defaultOptions = {
      resource_type: 'video',
      format: 'jpg',
      width: 300,
      height: 200,
      crop: 'fill',
      quality: 'auto:good'
    };

    return cloudinary.url(videoPublicId, {
      ...defaultOptions,
      ...options
    });

  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return null;
  }
}

/**
 * Get media info from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type
 * @returns {Promise<Object>} - Media information
 */
async function getMediaInfo(publicId, resourceType = 'image') {
  try {
    if (!publicId) {
      throw new Error('Public ID is required');
    }

    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType
    });

    return {
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      url: result.secure_url,
      createdAt: result.created_at
    };

  } catch (error) {
    console.error('Media info error:', error);
    throw new Error(`Failed to get media info: ${error.message}`);
  }
}

/**
 * Batch upload files
 * @param {Array<string>} filePaths - Array of file paths
 * @param {Object} options - Upload options
 * @returns {Promise<Array<string>>} - Array of Cloudinary URLs
 */
async function batchUpload(filePaths, options = {}) {
  try {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return [];
    }

    const uploadPromises = filePaths.map(filePath => 
      uploadToCloudinary(filePath, options)
        .catch(error => {
          console.error(`Failed to upload ${filePath}:`, error);
          return null; // Return null for failed uploads
        })
    );

    const results = await Promise.all(uploadPromises);
    
    // Filter out failed uploads
    return results.filter(url => url !== null);

  } catch (error) {
    console.error('Batch upload error:', error);
    throw new Error(`Batch upload failed: ${error.message}`);
  }
}

/**
 * Check if Cloudinary is configured
 * @returns {boolean} - True if Cloudinary is configured
 */
function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Extract public ID from Cloudinary URL
 * @param {string} cloudinaryUrl - Cloudinary URL
 * @returns {string} - Public ID
 */
function extractPublicId(cloudinaryUrl) {
  try {
    if (!cloudinaryUrl || !cloudinaryUrl.includes('cloudinary.com')) {
      return null;
    }

    // Extract public ID from URL
    const parts = cloudinaryUrl.split('/');
    const filename = parts[parts.length - 1];
    const publicId = filename.split('.')[0];
    
    // Include folder path if present
    const folderIndex = parts.indexOf('upload') + 1;
    if (folderIndex < parts.length - 1) {
      const folderPath = parts.slice(folderIndex, -1).join('/');
      return `${folderPath}/${publicId}`;
    }
    
    return publicId;

  } catch (error) {
    console.error('Public ID extraction error:', error);
    return null;
  }
}

module.exports = {
  uploadToCloudinary,
  uploadImage,
  uploadVideo,
  uploadAudio,
  uploadAvatar,
  deleteFromCloudinary,
  getOptimizedUrl,
  generateVideoThumbnail,
  getMediaInfo,
  batchUpload,
  isCloudinaryConfigured,
  extractPublicId
};