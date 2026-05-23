import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/authMiddleware';
import { AppError } from '../../middlewares/errorMiddleware';
import { playHistoryService } from './playHistory.service';

function normalizePlayedSeconds(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export const recordPlayHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication is required to record play history.');
    }

    const result = await playHistoryService.recordPlayHistory({
      userId,
      songId: typeof req.body.songId === 'string' ? req.body.songId : '',
      playedSeconds: normalizePlayedSeconds(req.body.playedSeconds),
      isCompleted: Boolean(req.body.isCompleted),
      sourceContext:
        typeof req.body.sourceContext === 'string' ? req.body.sourceContext : undefined,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};
