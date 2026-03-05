import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// 1. LẤY THÔNG TIN CÁ NHÂN (Profile của mình)
export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      // Tuyệt đối không Select cái passwordHash ra để tránh lộ mật khẩu
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        dateOfBirth: true,
        country: true,
        avatarUrl: true,
        bio: true,
        isPrivate: true,
        followerCount: true,
        followingCount: true,
        trackCount: true,
        createdAt: true,
      }
    });

    if (!user) {
      res.status(404).json({ message: 'Không tìm thấy người dùng!' });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Lỗi getMyProfile:", error);
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin.' });
  }
};

// 2. CẬP NHẬT THÔNG TIN CÁ NHÂN (Edit Profile)
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    
    // Lấy các trường m muốn cho user sửa từ body gửi lên
    const { fullName, bio, avatarUrl, country, dateOfBirth, isPrivate } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        bio,
        avatarUrl, // Cái này sau sẽ là link do Cloudinary trả về
        country,
        // Ép kiểu dateOfBirth về chuẩn Date của Prisma nếu frontend có truyền lên
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        isPrivate
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        avatarUrl: true,
        country: true,
        dateOfBirth: true,
        isPrivate: true
      }
    });

    res.status(200).json({
      message: 'Cập nhật thông tin thành công!',
      user: updatedUser
    });
  } catch (error) {
    console.error("Lỗi updateProfile:", error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật thông tin.' });
  }
};

// 3. LẤY THÔNG TIN NGƯỜI KHÁC (Xem trang cá nhân public)
export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.userId as string;

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        avatarUrl: true,
        country: true,
        isPrivate: true,
        followerCount: true,
        followingCount: true,
        trackCount: true,
      }
    });

    if (!user) {
      res.status(404).json({ message: 'Không tìm thấy người dùng này!' });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Lỗi getUserProfile:", error);
    res.status(500).json({ message: 'Lỗi server khi xem profile.' });
  }
};