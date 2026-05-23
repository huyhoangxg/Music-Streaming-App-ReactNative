import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import prisma from '../prismaClient';
import { AppError } from '../middlewares/errorMiddleware';
import {
  destroyCloudinaryAsset,
  extractCloudinaryPublicId,
  uploadToCloudinary,
} from '../utils/uploadToCloudinary';

const SONG_LIST_INCLUDE = {
  user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
  songGenres: { include: { genre: true } },
} as const;

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function buildImagePublicId(userId: string, title: string) {
  const safeUserId = sanitizeSegment(userId);
  const safeTitle = sanitizeSegment(title || 'untitled-track');
  return `soundwave/images/${safeUserId}/${Date.now()}-${safeTitle}`;
}

function normalizeOptionalText(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

async function cleanupUploadedImage(upload?: UploadApiResponse | null) {
  if (!upload?.public_id) {
    return;
  }

  try {
    await destroyCloudinaryAsset(upload.public_id, 'image');
  } catch (cleanupError) {
    console.error(`Failed to clean up uploaded image ${upload.public_id}:`, cleanupError);
  }
}

export const songService = {
  async getPublicSongs(limit?: number) {
    return prisma.song.findMany({
      where: { privacy: 'PUBLIC', audioUrl: { not: '' } },
      include: SONG_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: limit } : {}),
    });
  },

  async getTrendingSongs(limit = 10) {
    return prisma.song.findMany({
      where: { privacy: 'PUBLIC', audioUrl: { not: '' } },
      include: SONG_LIST_INCLUDE,
      orderBy: [{ playCount: 'desc' }, { likeCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  },

  async getListeningHistory(userId: string, limit = 10) {
    const playHistory = await prisma.playHistory.findMany({
      where: { userId },
      orderBy: { playedAt: 'desc' },
      take: Math.max(limit * 4, 20),
      include: {
        song: {
          include: SONG_LIST_INCLUDE,
        },
      },
    });

    const seenSongIds = new Set<string>();
    const uniqueSongs = [];

    for (const history of playHistory) {
      const song = history.song;
      if (!song?.audioUrl || seenSongIds.has(song.id)) {
        continue;
      }

      seenSongIds.add(song.id);
      uniqueSongs.push({
        ...song,
        sourceContext: 'history',
        lastPlayedAt: history.playedAt,
      });

      if (uniqueSongs.length >= limit) {
        break;
      }
    }

    return uniqueSongs;
  },

  async updateSongById({
    songId,
    userId,
    title,
    description,
    imageFile,
  }: {
    songId: string;
    userId: string;
    title?: string;
    description?: string | null;
    imageFile?: Express.Multer.File;
  }) {
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: SONG_LIST_INCLUDE,
    });

    if (!song) {
      throw new AppError(404, 'Song not found.');
    }

    if (song.userId !== userId) {
      throw new AppError(403, 'You do not have permission to edit this song.');
    }

    const normalizedTitle = title === undefined ? undefined : title.trim();
    if (title !== undefined && !normalizedTitle) {
      throw new AppError(400, 'Title cannot be empty.');
    }

    const normalizedDescription = normalizeOptionalText(description);
    const hasTextChange = title !== undefined || description !== undefined;

    if (!imageFile && !hasTextChange) {
      throw new AppError(400, 'No track changes were provided.');
    }

    let imageUpload: UploadApiResponse | null = null;

    if (imageFile) {
      const imageOptions: UploadApiOptions = {
        folder: 'soundwave/images',
        resource_type: 'image',
        public_id: buildImagePublicId(userId, normalizedTitle ?? song.title),
        overwrite: false,
      };

      try {
        imageUpload = await uploadToCloudinary(imageFile, imageOptions);
      } catch (error) {
        throw new AppError(502, 'Failed to upload the new track image.', error);
      }
    }

    try {
      const updatedSong = await prisma.song.update({
        where: { id: songId },
        data: {
          ...(normalizedTitle !== undefined ? { title: normalizedTitle } : {}),
          ...(normalizedDescription !== undefined ? { description: normalizedDescription } : {}),
          ...(imageUpload ? { imageUrl: imageUpload.secure_url } : {}),
        },
        include: SONG_LIST_INCLUDE,
      });

      if (imageUpload && song.imageUrl) {
        const oldImagePublicId = extractCloudinaryPublicId(song.imageUrl);
        if (oldImagePublicId) {
          await destroyCloudinaryAsset(oldImagePublicId, 'image').catch((cleanupError) => {
            console.error(`Failed to clean up previous image ${oldImagePublicId}:`, cleanupError);
          });
        }
      }

      return updatedSong;
    } catch (error) {
      await cleanupUploadedImage(imageUpload);
      throw error;
    }
  },

  async deleteSongById(songId: string, userId: string) {
    const song = await prisma.song.findUnique({
      where: { id: songId },
      select: { id: true, userId: true, audioUrl: true, imageUrl: true },
    });

    if (!song) {
      return { deleted: false };
    }

    if (song.userId !== userId) {
      throw new AppError(403, 'You do not have permission to delete this song.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.song.delete({ where: { id: songId } });
      await tx.user.updateMany({
        where: { id: userId, trackCount: { gt: 0 } },
        data: { trackCount: { decrement: 1 } },
      });
    });

    const audioPublicId = extractCloudinaryPublicId(song.audioUrl);
    const imagePublicId = extractCloudinaryPublicId(song.imageUrl);

    if (audioPublicId) {
      await destroyCloudinaryAsset(audioPublicId, 'video').catch((cleanupError) => {
        console.error(`Failed to clean up audio asset ${audioPublicId}:`, cleanupError);
      });
    }

    if (imagePublicId) {
      await destroyCloudinaryAsset(imagePublicId, 'image').catch((cleanupError) => {
        console.error(`Failed to clean up image asset ${imagePublicId}:`, cleanupError);
      });
    }

    return { deleted: true };
  },
};
