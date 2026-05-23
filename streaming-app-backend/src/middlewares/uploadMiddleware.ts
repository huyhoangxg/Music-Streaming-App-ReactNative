import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { AppError } from './errorMiddleware';

const AUDIO_FIELDS = new Set(['audio']);
const IMAGE_FIELDS = new Set(['image', 'avatar']);
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (AUDIO_FIELDS.has(file.fieldname)) {
    if (!file.mimetype.startsWith('audio/')) {
      cb(new AppError(400, 'Audio file must have an audio MIME type.'));
      return;
    }
  } else if (IMAGE_FIELDS.has(file.fieldname)) {
    if (!file.mimetype.startsWith('image/')) {
      cb(new AppError(400, 'Image file must have an image MIME type.'));
      return;
    }
  } else {
    cb(new AppError(400, `Unsupported upload field: ${file.fieldname}`));
    return;
  }

  cb(null, true);
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter,
});

export const songUploadFields = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

export const songEditFields = upload.fields([{ name: 'image', maxCount: 1 }]);

export const avatarUpload = upload.single('avatar');
