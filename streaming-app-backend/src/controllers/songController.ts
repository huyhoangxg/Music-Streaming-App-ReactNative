import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../prismaClient';
import { playHistoryService } from '../modules/interactions/playHistory.service';
import { songService } from '../services/songService';

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

export const getPublicSongs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const songs = await songService.getPublicSongs();
    res.status(200).json(songs);
  } catch (error) {
    console.error('Error in getPublicSongs:', error);
    res.status(500).json({ message: 'Server error while fetching public songs.' });
  }
};

export const getTrendingSongs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(_req.query.limit);
    const songs = await songService.getTrendingSongs(Number.isFinite(limit) ? limit : undefined);
    res.status(200).json(songs);
  } catch (error) {
    console.error('Error in getTrendingSongs:', error);
    res.status(500).json({ message: 'Server error while fetching trending songs.' });
  }
};

export const getListeningHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Authentication is required.' });
      return;
    }

    const limit = Number(req.query.limit);
    const songs = await songService.getListeningHistory(
      userId,
      Number.isFinite(limit) && limit > 0 ? limit : 10,
    );
    res.status(200).json(songs);
  } catch (error) {
    console.error('Error in getListeningHistory:', error);
    res.status(500).json({ message: 'Server error while fetching listening history.' });
  }
};

export const trackPlay = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const userId = req.user?.userId;
    const playedSeconds =
      typeof req.body.playedSeconds === 'number'
        ? req.body.playedSeconds
        : typeof req.body.durationPlayed === 'number'
          ? req.body.durationPlayed
          : 0;
    const isCompleted =
      typeof req.body.isCompleted === 'boolean'
        ? req.body.isCompleted
        : typeof req.body.completionRate === 'number'
          ? req.body.completionRate >= 1
          : false;
    const sourceContext =
      typeof req.body.sourceContext === 'string'
        ? req.body.sourceContext
        : typeof req.body.source === 'string'
          ? req.body.source
          : 'player';

    if (!userId) {
      res.status(401).json({ message: 'Authentication is required.' });
      return;
    }

    const result = await playHistoryService.recordPlayHistory({
      userId,
      songId,
      playedSeconds,
      isCompleted,
      sourceContext,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode).json({ message: error.message });
      return;
    }
    console.error('Error in trackPlay:', error);
    res.status(500).json({ message: 'Server error while tracking play.' });
  }
};

export const getSongById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const requestUserId = req.user?.userId;

    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true },
        },
        songGenres: {
          include: { genre: true },
        },
      },
    });

    if (!song) {
      res.status(404).json({ message: 'Song not found.' });
      return;
    }

    if (song.privacy === 'PRIVATE' && song.userId !== requestUserId) {
      res.status(403).json({ message: 'This song is private.' });
      return;
    }

    res.status(200).json(song);
  } catch (error) {
    console.error('Error in getSongById:', error);
    res.status(500).json({ message: 'Server error while fetching song details.' });
  }
};

export const deleteSong = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Authentication is required.' });
      return;
    }

    const result = await songService.deleteSongById(songId, userId);
    res.status(200).json({
      message: result.deleted ? 'Song deleted successfully.' : 'Song was already deleted.',
      deleted: result.deleted,
    });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode).json({ message: error.message });
      return;
    }
    console.error('Error in deleteSong:', error);
    res.status(500).json({ message: 'Server error while deleting song.' });
  }
};

export const updateSong = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Authentication is required.' });
      return;
    }

    const files = req.files as UploadedFilesMap | undefined;
    const imageFile = getFirstFile(files, ['image']);
    const title = typeof req.body.title === 'string' ? req.body.title : undefined;
    const description =
      typeof req.body.description === 'string' ? req.body.description : undefined;

    const updatedSong = await songService.updateSongById({
      songId,
      userId,
      title,
      description,
      imageFile,
    });

    res.status(200).json(updatedSong);
  } catch (error) {
    console.error('Error in updateSong:', error);
    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Server error while updating song.' });
  }
};

export const getMySongs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string | undefined;

    if (!userId) {
      res.status(401).json({ message: 'Authentication is required.' });
      return;
    }

    const myTracks = await prisma.song.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true },
        },
      },
    });

    res.status(200).json(myTracks);
  } catch (error) {
    console.error('Error in getMySongs:', error);
    res.status(500).json({ message: 'Server error while fetching your songs.' });
  }
};

export const getUserSongs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.userId as string;

    if (!targetUserId) {
      res.status(400).json({ message: 'User ID is required.' });
      return;
    }

    const userTracks = await prisma.song.findMany({
      where: {
        userId: targetUserId,
        privacy: 'PUBLIC',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true },
        },
      },
    });

    res.status(200).json(userTracks);
  } catch (error) {
    console.error('Error in getUserSongs:', error);
    res.status(500).json({ message: 'Server error while fetching user songs.' });
  }
};

export const toggleLike = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;

    const existingLike = await prisma.like.findUnique({
      where: { userId_songId: { userId, songId } },
    });

    if (existingLike) {
      await prisma.$transaction([
        prisma.like.delete({ where: { userId_songId: { userId, songId } } }),
        prisma.song.update({ where: { id: songId }, data: { likeCount: { decrement: 1 } } }),
      ]);
      res.status(200).json({ isLiked: false, message: 'Song unliked successfully.' });
      return;
    }

    await prisma.$transaction([
      prisma.like.create({ data: { userId, songId } }),
      prisma.song.update({ where: { id: songId }, data: { likeCount: { increment: 1 } } }),
    ]);
    res.status(200).json({ isLiked: true, message: 'Song liked successfully.' });
  } catch (error) {
    console.error('Error in toggleLike:', error);
    res.status(500).json({ message: 'Server error while toggling like.' });
  }
};

export const toggleRepost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;

    const existingRepost = await prisma.repost.findUnique({
      where: { userId_songId: { userId, songId } },
    });

    if (existingRepost) {
      await prisma.$transaction([
        prisma.repost.delete({ where: { userId_songId: { userId, songId } } }),
        prisma.song.update({ where: { id: songId }, data: { repostCount: { decrement: 1 } } }),
      ]);
      res.status(200).json({ isReposted: false, message: 'Repost removed successfully.' });
      return;
    }

    await prisma.$transaction([
      prisma.repost.create({ data: { userId, songId } }),
      prisma.song.update({ where: { id: songId }, data: { repostCount: { increment: 1 } } }),
    ]);
    res.status(200).json({ isReposted: true, message: 'Song reposted successfully.' });
  } catch (error) {
    console.error('Error in toggleRepost:', error);
    res.status(500).json({ message: 'Server error while toggling repost.' });
  }
};

export const getMyReposts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;

    const repostsData = await prisma.repost.findMany({
      where: { userId },
      include: {
        song: {
          include: {
            user: {
              select: { id: true, username: true, fullName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const repostedTracks = repostsData.map((repost) => repost.song);
    res.status(200).json(repostedTracks);
  } catch (error) {
    console.error('Error in getMyReposts:', error);
    res.status(500).json({ message: 'Server error while fetching reposted songs.' });
  }
};
