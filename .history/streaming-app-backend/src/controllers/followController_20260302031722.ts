import { Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// 1. GỬI YÊU CẦU FOLLOW HOẶC FOLLOW TRỰC TIẾP
export const followUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const followerId = req.user.userId; // Mình
    const followedId = req.params.userId as string; // Người mình muốn follow

    if (followerId === followedId) {
      res.status(400).json({ message: 'Không thể tự follow chính mình!' });
      return;
    }

    // Kiểm tra xem người kia là Private hay Public
    const targetUser = await prisma.user.findUnique({ where: { id: followedId } });
    if (!targetUser) return;

    // Nếu họ là Private -> Trạng thái chờ duyệt (PENDING)
    // Nếu họ là Public -> Trạng thái duyệt luôn (ACCEPTED)
    const followStatus = targetUser.isPrivate ? 'PENDING' : 'ACCEPTED';

    await prisma.follow.create({
      data: { followerId, followedId, status: followStatus }
    });

    // BẮN THÔNG BÁO CHO NGƯỜI KIA
    await prisma.notification.create({
      data: {
        userId: followedId,
        actorId: followerId,
        type: targetUser.isPrivate ? 'FOLLOW_REQUEST' : 'NEW_FOLLOWER',
      }
    });

    res.status(200).json({ 
      message: targetUser.isPrivate ? 'Đã gửi yêu cầu theo dõi' : 'Đã theo dõi thành công',
      status: followStatus
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi follow' });
  }
};

// 2. CHẤP NHẬN YÊU CẦU FOLLOW (Chỉ dùng khi tài khoản là Private)
export const acceptFollowRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const myId = req.user.userId;
    const followerId = req.params.followerId as string; // Người đã xin follow mình

    // Cập nhật trạng thái từ PENDING sang ACCEPTED
    await prisma.follow.update({
      where: {
        followerId_followedId: { followerId: followerId, followedId: myId }
      },
      data: { status: 'ACCEPTED' }
    });

    // BẮN THÔNG BÁO BÁO CHO NGƯỜI KIA BIẾT LÀ "TÔI ĐÃ ĐỒNG Ý"
    await prisma.notification.create({
      data: {
        userId: followerId, // Người nhận thông báo là người xin follow
        actorId: myId,
        type: 'FOLLOW_ACCEPTED',
      }
    });

    res.status(200).json({ message: 'Đã chấp nhận yêu cầu theo dõi' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi chấp nhận follow' });
  }
};