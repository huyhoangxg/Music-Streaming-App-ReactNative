import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { AppError } from '../middlewares/errorMiddleware';
import prisma from '../prismaClient';
import { playlistService } from '../services/playlistService';

// 1. Kéo danh sách Playlist của CHÍNH MÌNH (Kèm theo số lượng bài hát bên trong)
export const getMyPlaylists = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    
    const playlists = await prisma.playlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { playlistSongs: true } } // Đếm xem playlist này có mấy bài rồi
      }
    });
    
    res.status(200).json(playlists);
  } catch (error) {
    console.error('Lỗi getMyPlaylists:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách playlist.' });
  }
};

// 2. Tạo một Playlist mới tinh
export const createPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const newPlaylist = await playlistService.createPlaylist({
      userId,
      title: typeof req.body.title === 'string' ? req.body.title : undefined,
      name: typeof req.body.name === 'string' ? req.body.name : undefined,
      isPublic: typeof req.body.isPublic === 'boolean' ? req.body.isPublic : undefined,
    });

    res.status(201).json({ message: 'Tạo Playlist thành công!', playlist: newPlaylist });
  } catch (error) {
    console.error('Lỗi createPlaylist:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Lỗi server khi tạo playlist mới.' });
  }
};

// 3. Nhét 1 bài hát vào Playlist
export const addSongToPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const playlistId = req.params.playlistId as string;
    const { songId } = req.body;

    const result = await playlistService.addSongToPlaylist({
      userId,
      playlistId,
      songId,
    });

    res.status(result.added ? 201 : 200).json({
      message: result.added
        ? 'Đã thêm bài hát vào Playlist.'
        : 'Bài hát này đã có trong Playlist rồi.',
      ...result,
    });
  } catch (error) {
    console.error('Lỗi addSongToPlaylist:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Lỗi server khi thêm bài hát vào playlist.' });
  }
};

export const removeSongFromPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const playlistId = req.params.playlistId as string;
    const songId = req.params.songId as string;

    const result = await playlistService.removeSongFromPlaylist({
      userId,
      playlistId,
      songId,
    });

    res.status(200).json({
      message: result.removed
        ? 'Đã xóa bài hát khỏi Playlist.'
        : 'Bài hát này không có trong Playlist.',
      ...result,
    });
  } catch (error) {
    console.error('Lỗi removeSongFromPlaylist:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Lỗi server khi xóa bài hát khỏi playlist.' });
  }
};

export const getPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const playlistId = req.params.playlistId as string;
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        playlistSongs: {
          include: {
            song: { include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } } } }
          },
          orderBy: { addedAt: 'desc' }
        }
      }
    });

    if (!playlist) {
      res.status(404).json({ message: 'Không tìm thấy playlist.' });
      return;
    }

    res.status(200).json(playlist);
  } catch (error) {
    console.error('Lỗi getPlaylist:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy chi tiết playlist.' });
  }
};

export const updatePlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const playlistId = req.params.playlistId as string;
    const { title } = req.body;

    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist || playlist.userId !== userId) {
      res.status(403).json({ message: 'Không có quyền sửa playlist.' });
      return;
    }

    const updated = await prisma.playlist.update({
      where: { id: playlistId },
      data: { title }
    });
    res.status(200).json({ message: 'Cập nhật thành công', playlist: updated });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi cập nhật playlist.' });
  }
};

export const deletePlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const playlistId = req.params.playlistId as string;

    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist || playlist.userId !== userId) {
      res.status(403).json({ message: 'Không có quyền xóa playlist.' });
      return;
    }

    await prisma.playlist.delete({ where: { id: playlistId } });
    res.status(200).json({ message: 'Xóa playlist thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi xóa playlist.' });
  }
};
