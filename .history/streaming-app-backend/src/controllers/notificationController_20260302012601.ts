import { Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// 1. LẤY DANH SÁCH THÔNG BÁO CỦA TÔI
export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const notifications = await prisma.notification.findMany({
      where: { userId }, // Chỉ lấy thông báo gửi cho mình
      include: {
        actor: { select: { fullName: true, avatarUrl: true } } // Lấy thông tin đứa đã Like/Comment mình
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông báo' });
  }
};

// 2. ĐÁNH DẤU LÀ ĐÃ ĐỌC
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notiId = parseInt(req.params.id as string); // Ép kiểu Int vì ID thông báo là số

    await prisma.notification.update({
      where: { id: notiId },
      data: { isRead: true }
    });
    res.status(200).json({ message: 'Đã đánh dấu đọc' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật thông báo' });
  }
};