import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// 1. ĐĂNG BÀI HÁT MỚI
export const uploadSong = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const { title, fileUrl, imageUrl, duration, privacy, genreId } = req.body;

    if (!title || !fileUrl) {
      res.status(400).json({ message: 'Tên bài hát và file nhạc là bắt buộc!' });
      return;
    }

    let newSong;
    await prisma.$transaction(async (tx) => {
      newSong = await tx.song.create({
        data: {
          title, fileUrl, imageUrl, duration, 
          privacy: privacy || 'Public', 
          userId, genreId
        },
        include: { user: { select: { fullName: true, username: true, avatarUrl: true } } }
      });
      await tx.user.update({
        where: { id: userId },
        data: { trackCount: { increment: 1 } }
      });
    });

    res.status(201).json({ message: 'Đăng bài hát thành công!', song: newSong });
  } catch (error) {
    console.error("Lỗi uploadSong:", error);
    res.status(500).json({ message: 'Lỗi server khi đăng bài hát.' });
  }
};

// 2. LẤY DANH SÁCH BÀI HÁT PUBLIC
export const getPublicSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const songs = await prisma.song.findMany({
      where: { privacy: 'Public' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        genre: { select: { id: true, name: true } }
      },
      take: 50
    });
    res.status(200).json(songs);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách bài hát.' });
  }
};

// 3. XEM CHI TIẾT 1 BÀI HÁT
export const getSongById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const requestUserId = req.user?.userId;

    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } }, genre: true }
    });

    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát!' });
      return;
    }

    if (song.privacy === 'Private' && song.userId !== requestUserId) {
      if (!requestUserId) {
        res.status(403).json({ message: 'Bài hát riêng tư. Cần đăng nhập!' });
        return;
      }
      const isFollowing = await prisma.follow.findUnique({
        where: { followerId_followedId: { followerId: requestUserId, followedId: song.userId } }
      });
      if (!isFollowing || isFollowing.status !== 'ACCEPTED') {
        res.status(403).json({ message: 'Bài hát riêng tư. Bạn phải follow người này!' });
        return;
      }
    }
    res.status(200).json(song);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy chi tiết bài hát.' });
  }
};

// 4. TĂNG LƯỢT NGHE
export const incrementPlayCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const updatedSong = await prisma.song.update({
      where: { id: songId },
      data: { playCount: { increment: 1 } },
      select: { playCount: true }
    });
    res.status(200).json({ message: 'Đã tăng lượt nghe', playCount: updatedSong.playCount });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi cập nhật lượt nghe.' });
  }
};