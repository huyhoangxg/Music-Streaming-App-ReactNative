import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/errorMiddleware';

const PLAY_COUNT_THRESHOLD_SECONDS = Number(process.env.PLAY_COUNT_THRESHOLD_SECONDS || 15);

export interface RecordPlayHistoryInput {
  userId: string;
  songId: string;
  playedSeconds?: number;
  isCompleted?: boolean;
  sourceContext?: string | null;
}

function normalizePlayedSeconds(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeSourceContext(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 50) : 'player';
}

export const playHistoryService = {
  async recordPlayHistory({
    userId,
    songId,
    playedSeconds,
    isCompleted,
    sourceContext,
  }: RecordPlayHistoryInput) {
    if (!userId) {
      throw new AppError(401, 'Authentication is required to record play history.');
    }

    if (!songId) {
      throw new AppError(400, 'Song ID is required.');
    }

    const normalizedPlayedSeconds = normalizePlayedSeconds(playedSeconds);
    const normalizedIsCompleted = Boolean(isCompleted);
    const normalizedSourceContext = normalizeSourceContext(sourceContext);

    const song = await prisma.song.findUnique({
      where: { id: songId },
      select: { id: true },
    });

    if (!song) {
      throw new AppError(404, 'Song not found.');
    }

    return prisma.$transaction(async (tx) => {
      const history = await tx.playHistory.create({
        data: {
          userId,
          songId,
          durationPlayed: normalizedPlayedSeconds,
          completionRate: normalizedIsCompleted ? 1 : 0,
          source: normalizedSourceContext,
        },
      });

      let playCount: number | null = null;
      const countedPlay = normalizedPlayedSeconds >= PLAY_COUNT_THRESHOLD_SECONDS;

      if (countedPlay) {
        const updatedSong = await tx.song.update({
          where: { id: songId },
          data: { playCount: { increment: 1 } },
          select: { playCount: true },
        });
        playCount = updatedSong.playCount;
      }

      return {
        id: history.id,
        songId: history.songId,
        userId: history.userId,
        playedSeconds: normalizedPlayedSeconds,
        isCompleted: normalizedIsCompleted,
        sourceContext: normalizedSourceContext,
        countedPlay,
        playCount,
        thresholdSeconds: PLAY_COUNT_THRESHOLD_SECONDS,
        createdAt: history.playedAt,
      };
    });
  },
};
