import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import cloudinary from '../config/cloudinary';

export function uploadToCloudinary(
  file: Express.Multer.File,
  options: UploadApiOptions,
): Promise<UploadApiResponse> {
  if (!file?.buffer || file.buffer.length === 0) {
    return Promise.reject(new Error('Upload file buffer is empty.'));
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      if (!result) {
        reject(new Error('Cloudinary upload failed without a result.'));
        return;
      }

      resolve(result);
    });

    stream.end(file.buffer);
  });
}

export async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: 'image' | 'video',
) {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
}

export function extractCloudinaryPublicId(assetUrl?: string | null) {
  if (!assetUrl) {
    return null;
  }

  try {
    const { pathname } = new URL(assetUrl);
    const segments = pathname.split('/').filter(Boolean);
    const uploadIndex = segments.findIndex((segment) => segment === 'upload');

    if (uploadIndex === -1 || uploadIndex === segments.length - 1) {
      return null;
    }

    const publicIdParts = segments.slice(uploadIndex + 1);
    if (/^v\d+$/.test(publicIdParts[0] || '')) {
      publicIdParts.shift();
    }

    if (publicIdParts.length === 0) {
      return null;
    }

    publicIdParts[publicIdParts.length - 1] = publicIdParts[publicIdParts.length - 1].replace(
      /\.[^.]+$/,
      '',
    );

    return publicIdParts.join('/');
  } catch (_error) {
    return null;
  }
}
