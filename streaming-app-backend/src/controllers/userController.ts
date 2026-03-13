import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { userService } from '../services/userService'; // Import Service vào

export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const user = await userService.getMyProfile(userId);
    
    res.status(200).json(user);
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ message: 'Không tìm thấy người dùng!' });
      return;
    }
    console.error("Lỗi getMyProfile:", error);
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin.' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const updatedUser = await userService.updateProfile(userId, req.body);

    res.status(200).json({
      message: 'Cập nhật thông tin thành công!',
      user: updatedUser
    });
  } catch (error) {
    console.error("Lỗi updateProfile:", error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật thông tin.' });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.userId as string;
    const user = await userService.getUserProfile(targetUserId);

    res.status(200).json(user);
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ message: 'Không tìm thấy người dùng này!' });
      return;
    }
    console.error("Lỗi getUserProfile:", error);
    res.status(500).json({ message: 'Lỗi server khi xem profile.' });
  }
};