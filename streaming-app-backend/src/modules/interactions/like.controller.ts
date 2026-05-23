import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/authMiddleware';
import { AppError } from '../../middlewares/errorMiddleware';
import { likeService } from './like.service';

function getSongIdFromBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    return '';
  }

  const songId = (body as { songId?: unknown }).songId;
  return typeof songId === 'string' ? songId : '';
}

export const likeSong = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication is required to like a song.');
    }

    const result = await likeService.likeSong({
      userId,
      songId: getSongIdFromBody(req.body),
    });

    res.status(result.created ? 201 : 200).json({
      message: result.created ? 'Song liked successfully.' : 'Song already liked.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const unlikeSong = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication is required to unlike a song.');
    }

    const result = await likeService.unlikeSong({
      userId,
      songId: typeof req.params.songId === 'string' ? req.params.songId : '',
    });

    res.status(200).json({
      message: result.removed ? 'Song unliked successfully.' : 'Song was not liked.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
