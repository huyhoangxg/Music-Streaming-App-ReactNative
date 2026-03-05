import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';


// 1. TÍNH NĂNG THẢ TIM / BỎ TIM (TOGGLE LIKE)
export const toggleLike = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const songId = req.params.songId as String; // Lấy ID bài hát từ URL

    // 1. Kiểm tra xem bài hát có tồn tại không
    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát!' });
      return;
    }

    // 2. Tìm xem user này đã like bài này chưa (Tìm trong Bảng trung gian)
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_songId: { userId, songId } // Tìm theo khóa chính kép
      }
    });

    if (existingLike) {
      // Đã like rồi -> Bấm phát nữa là XÓA LIKE (Unlike)
      await prisma.like.delete({
        where: { userId_songId: { userId, songId } }
      });
      res.status(200).json({ message: 'Đã bỏ thích bài hát', isLiked: false });
    } else {
      // Chưa like -> TẠO LIKE MỚI
      await prisma.like.create({
        data: { userId, songId }
      });
      res.status(201).json({ message: 'Đã thích bài hát', isLiked: true });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xử lý Like' });
  }
};


// 2. TÍNH NĂNG VIẾT BÌNH LUẬN
export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const { songId } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
      return;
    }

    const newComment = await prisma.comment.create({
      data: {
        content,
        userId,
        songId
      },
      include: {
        user: { select: { fullName: true, avatarUrl: true } } // Trả về luôn tên người comment để App hiển thị
      }
    });

    res.status(201).json({ message: 'Đã bình luận', comment: newComment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi thêm bình luận' });
  }
};

// 3. LẤY DANH SÁCH BÌNH LUẬN CỦA 1 BÀI HÁT
export const getSongComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;

    const comments = await prisma.comment.findMany({
      where: { songId },
      include: {
        user: { select: { fullName: true, avatarUrl: true, username: true } }
      },
      orderBy: { createdAt: 'desc' } // Comment mới nhất lên đầu
    });

    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy bình luận' });
  }
};