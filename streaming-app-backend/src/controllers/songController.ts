import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { songService } from '../services/songService'; 
import prisma from '../prismaClient';

export const uploadSong = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const { title, fileUrl } = req.body;

    // Validation cơ bản ở Controller
    if (!title || !fileUrl) {
      res.status(400).json({ message: 'Vui lòng cung cấp đủ tiêu đề và file nhạc.' });
      return;
    }

    // Đẩy hết data xuống Service xử lý
    const newSong = await songService.createSong(userId, req.body);
    
    res.status(201).json({ message: 'Đăng bài hát thành công!', song: newSong });
  } catch (error) {
    console.error('Lỗi uploadSong:', error);
    res.status(500).json({ message: 'Lỗi server khi đăng nhạc.' });
  }
};

export const getPublicSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    // Gọi Service lấy data
    const songs = await songService.getPublicSongs();
    res.status(200).json(songs);
  } catch (error) {
    console.error('Lỗi getPublicSongs:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách nhạc.' });
  }
};

export const trackPlay = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const userId = req.user?.userId;

    // Gọi Service ghi log và lấy playCount mới
    const playCount = await songService.trackPlay(songId, userId, req.body);
    
    res.status(200).json({ message: 'Đã ghi nhận lượt nghe', playCount });
  } catch (error) {
    console.error('Lỗi trackPlay:', error);
    res.status(500).json({ message: 'Lỗi server khi ghi nhận lượt nghe.' });
  }
};

export const getSongById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const requestUserId = req.user?.userId; // Lấy từ token (có thể undefined nếu chưa đăng nhập)

    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        songGenres: { include: { genre: true } } // Update theo Schema mới
      }
    });

    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát.' });
      return;
    }

    // Check quyền riêng tư (Viết hoa PRIVATE)
    if (song.privacy === 'PRIVATE' && song.userId !== requestUserId) {
      res.status(403).json({ message: 'Bài hát này đang ở chế độ riêng tư.' });
      return;
    }

    res.status(200).json(song);
  } catch (error) {
    console.error('Lỗi getSongById:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy chi tiết bài hát.' });
  }
};

export const deleteSong = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const userId = req.user?.userId;

    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát' });
      return;
    }

    if (song.userId !== userId) {
      res.status(403).json({ message: 'Không có quyền xóa bài hát này' });
      return;
    }

    await prisma.song.delete({ where: { id: songId } });
    res.status(200).json({ message: 'Đã xóa bài hát thành công' });
  } catch (error) {
    console.error('Lỗi deleteSong:', error);
    res.status(500).json({ message: 'Lỗi server khi xóa bài hát' });
  }
};