import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/authMiddleware';
import { AppError } from '../../middlewares/errorMiddleware';
import { songUploadService } from './song.service';

type UploadedFilesMap = Record<string, Express.Multer.File[]>;

function getFirstFile(files: UploadedFilesMap | undefined, fieldNames: string[]) {
  for (const fieldName of fieldNames) {
    const file = files?.[fieldName]?.[0];
    if (file) {
      return file;
    }
  }

  return undefined;
}

function formatUploadError(error: unknown) {
  if (error instanceof AppError) {
    const details =
      error.details instanceof Error ? ` Details: ${error.details.message}` : '';
    return `${error.statusCode} ${error.message}${details}`;
  }

  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

export const uploadSong = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication is required to upload a song.');
    }

    const files = req.files as UploadedFilesMap | undefined;
    const audioFile = getFirstFile(files, ['audio']);
    const imageFile = getFirstFile(files, ['image']);
    const title = typeof req.body.title === 'string' ? req.body.title : '';
    const description =
      typeof req.body.description === 'string' ? req.body.description : undefined;
    const uploaderGenre = typeof req.body.uploaderGenre === 'string' ? req.body.uploaderGenre : undefined;

    const result = await songUploadService.uploadSong({
      title,
      description,
      userId,
      uploaderGenre,
      audioFile,
      imageFile,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(`Upload song failed: ${formatUploadError(error)}`);
    next(error);
  }
};
