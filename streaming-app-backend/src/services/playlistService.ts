import prisma from '../config/prisma';
import { AppError } from '../middlewares/errorMiddleware';

interface CreatePlaylistInput {
  userId: string;
  title?: string;
  name?: string;
  isPublic?: boolean;
}

interface PlaylistSongInput {
  userId: string;
  playlistId: string;
  songId: string;
}

function normalizePlaylistTitle(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 120) : '';
}

async function getOwnedPlaylistOrThrow(playlistId: string, userId: string) {
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
  });

  if (!playlist) {
    throw new AppError(404, 'Playlist not found.');
  }

  if (playlist.userId !== userId) {
    throw new AppError(403, 'You do not have permission to modify this playlist.');
  }

  return playlist;
}

async function ensureSongExists(songId: string) {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { id: true },
  });

  if (!song) {
    throw new AppError(404, 'Song not found.');
  }
}

export const playlistService = {
  async createPlaylist({ userId, title, name, isPublic }: CreatePlaylistInput) {
    if (!userId) {
      throw new AppError(401, 'Authentication is required to create a playlist.');
    }

    const normalizedTitle = normalizePlaylistTitle(title ?? name);
    if (!normalizedTitle) {
      throw new AppError(400, 'Playlist name is required.');
    }

    return prisma.playlist.create({
      data: {
        title: normalizedTitle,
        userId,
        privacy: isPublic === false ? 'PRIVATE' : 'PUBLIC',
      },
    });
  },

  async addSongToPlaylist({ userId, playlistId, songId }: PlaylistSongInput) {
    if (!songId) {
      throw new AppError(400, 'Song ID is required.');
    }

    await getOwnedPlaylistOrThrow(playlistId, userId);
    await ensureSongExists(songId);

    const existingEntry = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: { playlistId, songId },
      },
    });

    if (existingEntry) {
      return {
        playlistId,
        songId,
        added: false,
      };
    }

    await prisma.playlistSong.create({
      data: {
        playlistId,
        songId,
      },
    });

    return {
      playlistId,
      songId,
      added: true,
    };
  },

  async removeSongFromPlaylist({ userId, playlistId, songId }: PlaylistSongInput) {
    await getOwnedPlaylistOrThrow(playlistId, userId);

    const existingEntry = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: { playlistId, songId },
      },
    });

    if (!existingEntry) {
      return {
        playlistId,
        songId,
        removed: false,
      };
    }

    await prisma.playlistSong.delete({
      where: {
        playlistId_songId: { playlistId, songId },
      },
    });

    return {
      playlistId,
      songId,
      removed: true,
    };
  },
};
