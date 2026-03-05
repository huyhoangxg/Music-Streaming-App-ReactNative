import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// --- LẤY DANH SÁCH TẤT CẢ BÀI HÁT ---
export const getAllSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const songs = await prisma.song.findMany({
      where: { privacy: 'Public' }, // Chỉ lấy nhạc công khai
      include: {
        user: { select: { username: true, fullName: true } }, // Lấy kèm tên ca sĩ
        genre: { select: { name: true } } // Lấy kèm tên thể loại
      },
      orderBy: { createdAt: 'desc' } // Mới nhất lên đầu
    });
    res.status(200).json(songs);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách bài hát' });
  }
};

// --- ĐĂNG TẢI (TẠO) BÀI HÁT MỚI ---
// Lưu ý: Hàm này dùng AuthRequest vì nó cần lấy ID của người đang login
export const createSong = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, fileUrl, imageUrl, genreId, duration } = req.body;
    
    // Lấy ID của user từ "Bác bảo vệ" truyền sang
    const userId = req.user.userId;

    const newSong = await prisma.song.create({
      data: {
        title,
        fileUrl,
        imageUrl,
        duration,
        genreId: genreId ? parseInt(genreId) : null,
        userId: userId // Gắn bài hát này cho user đang đăng nhập
      }
    });

    res.status(201).json({ message: 'Đăng bài hát thành công!', song: newSong });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tạo bài hát' });
  }
};