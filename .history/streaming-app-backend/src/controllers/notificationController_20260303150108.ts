import { Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// ==========================================
// 1. LẤY DANH SÁCH THÔNG BÁO CỦA MÌNH
// ==========================================
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;

    const notifications = await prisma.notification.findMany({
      where: { userId }, // Lấy những thông báo gửi đến mình
      orderBy: { createdAt: 'desc' }, // Mới nhất lên đầu
      include: {
        actor: { 
          // Lấy thông tin người gây ra thông báo (người Like, người Follow...)
          select: { id: true, username: true, fullName: true, avatarUrl: true } 
        }
      }
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Lỗi getNotifications:", error);
    res.status(500).json({ message: 'Lỗi server khi lấy thông báo.' });
  }
};

// ==========================================
// 2. ĐÁNH DẤU 1 THÔNG BÁO LÀ "ĐÃ ĐỌC"
// ==========================================
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const notificationId = parseInt(req.params.id); // ID thông báo là Int theo schema Prisma

    if (isNaN(notificationId)) {
      res.status(400).json({ message: 'ID thông báo không hợp lệ!' });
      return;
    }

    // Kiểm tra xem thông báo có tồn tại và đúng là của mình không
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      res.status(404).json({ message: 'Không tìm thấy thông báo!' });
      return;
    }

    if (notification.userId !== userId) {
      res.status(403).json({ message: 'Bạn không có quyền sửa thông báo này!' });
      return;
    }

    // Cập nhật trạng thái
    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    res.status(200).json({ 
      message: 'Đã đánh dấu đọc.', 
      notification: updatedNotification 
    });
  } catch (error) {
    console.error("Lỗi markAsRead:", error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật thông báo.' });
  }
};

// ==========================================
// 3. ĐÁNH DẤU TẤT CẢ LÀ "ĐÃ ĐỌC"
// ==========================================
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;

    await prisma.notification.updateMany({
      where: { 
        userId,
        isRead: false // Chỉ update những cái chưa đọc cho tối ưu
      },
      data: { isRead: true }
    });

    res.status(200).json({ message: 'Đã đánh dấu đọc tất cả thông báo.' });
  } catch (error) {
    console.error("Lỗi markAllAsRead:", error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật tất cả thông báo.' });
  }
};