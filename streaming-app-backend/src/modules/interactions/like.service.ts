import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/errorMiddleware';

interface LikeSongInput {
  userId: string;
  songId: string;
}

export interface LikeSongResult {
  songId: string;
  isLiked: boolean;
  likeCount: number;
  created?: boolean;
  removed?: boolean;
}

async function getSongOrThrow(songId: string) {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: {
      id: true,
      userId: true,
      likeCount: true,
    },
  });

  if (!song) {
    throw new AppError(404, 'Song not found.');
  }

  return song;
}

export const likeService = {
  async likeSong({ userId, songId }: LikeSongInput): Promise<LikeSongResult> {
    if (!userId) {
      throw new AppError(401, 'Authentication is required to like a song.');
    }

    if (!songId) {
      throw new AppError(400, 'Song ID is required.');
    }

    const song = await getSongOrThrow(songId);
    const existingLike = await prisma.like.findUnique({
      where: { userId_songId: { userId, songId } },
    });

    if (existingLike) {
      return {
        songId,
        isLiked: true,
        likeCount: song.likeCount,
        created: false,
      };
    }

    return prisma.$transaction(async (tx) => {
      await tx.like.create({
        data: { userId, songId },
      });

      const updatedSong = await tx.song.update({
        where: { id: songId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });

      if (song.userId !== userId) {
        await tx.notification.create({
          data: {
            userId: song.userId,
            actorId: userId,
            type: 'LIKE_SONG',
            referenceId: songId,
          },
        });
      }

      return {
        songId,
        isLiked: true,
        likeCount: updatedSong.likeCount,
        created: true,
      };
    });
  },

  async unlikeSong({ userId, songId }: LikeSongInput): Promise<LikeSongResult> {
    if (!userId) {
      throw new AppError(401, 'Authentication is required to unlike a song.');
    }

    if (!songId) {
      throw new AppError(400, 'Song ID is required.');
    }

    const song = await getSongOrThrow(songId);
    const existingLike = await prisma.like.findUnique({
      where: { userId_songId: { userId, songId } },
    });

    if (!existingLike) {
      return {
        songId,
        isLiked: false,
        likeCount: song.likeCount,
        removed: false,
      };
    }

    return prisma.$transaction(async (tx) => {
      await tx.like.delete({
        where: { userId_songId: { userId, songId } },
      });

      const updatedSong = await tx.song.update({
        where: { id: songId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });

      return {
        songId,
        isLiked: false,
        likeCount: updatedSong.likeCount,
        removed: true,
      };
    });
  },

  async toggleLike(input: LikeSongInput): Promise<LikeSongResult> {
    const existingLike = await prisma.like.findUnique({
      where: { userId_songId: { userId: input.userId, songId: input.songId } },
    });

    if (existingLike) {
      return this.unlikeSong(input);
    }

    return this.likeSong(input);
  },
};
