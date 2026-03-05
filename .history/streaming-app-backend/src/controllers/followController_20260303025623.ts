import { Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// 1. GỬI YÊU CẦU FOLLOW HOẶC FOLLOW TRỰC TIẾP
export const followUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const followerId = req.user?.userId as string; // Người đi follow (Mình)
    const followedId = req.params.userId as string; // Người được follow

    if (followerId === followedId) {
      res.status(400).json({ message: 'Không thể tự follow chính mình!' });
      return;
    }

    // Kiểm tra xem người kia là Private hay Public
    const targetUser = await prisma.user.findUnique({ 
      where: { id: followedId },
      select: { isPrivate: true } 
    });

    if (!targetUser) {
      res.status(404).json({ message: 'Không tìm thấy người dùng này!' });
      return;
    }

    // Bắt lỗi: Xem đã follow hoặc gửi yêu cầu chưa
    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followedId: { followerId, followedId } }
    });

    if (existingFollow) {
      res.status(400).json({ message: 'Bạn đã follow hoặc đang gửi yêu cầu chờ duyệt rồi!' });
      return;
    }

    const followStatus = targetUser.isPrivate ? 'PENDING' : 'ACCEPTED';

    // Transaction: Làm 3 việc cùng lúc (Tạo record, Tăng đếm nếu Public, Bắn thông báo)
    await prisma.$transaction(async (tx) => {
      await tx.follow.create({
        data: { followerId, followedId, status: followStatus }
      });

      // Chỉ tăng counter nếu account kia là Public (ACCEPTED luôn)
      if (followStatus === 'ACCEPTED') {
        await tx.user.update({ where: { id: followerId }, data: { followingCount: { increment: 1 } } });
        await tx.user.update({ where: { id: followedId }, data: { followerCount: { increment: 1 } } });
      }

      await tx.notification.create({
        data: {
          userId: followedId,
          actorId: followerId,
          type: targetUser.isPrivate ? 'FOLLOW_REQUEST' : 'NEW_FOLLOWER',
        }
      });
    });

    res.status(200).json({ 
      message: targetUser.isPrivate ? 'Đã gửi yêu cầu theo dõi' : 'Đã theo dõi thành công',
      status: followStatus
    });
  } catch (error) {
    console.error("Lỗi followUser:", error);
    res.status(500).json({ message: 'Lỗi server khi xử lý follow.' });
  }
};

// 2. CHẤP NHẬN YÊU CẦU FOLLOW (Chủ acc Private duyệt)
export const acceptFollowRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const myId = req.user?.userId as string;
    const followerId = req.params.followerId as string; 

    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followedId: { followerId, followedId: myId } }
    });

    if (!existingFollow || existingFollow.status !== 'PENDING') {
      res.status(400).json({ message: 'Không có yêu cầu nào cần duyệt!' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Đổi PENDING thành ACCEPTED
      await tx.follow.update({
        where: { followerId_followedId: { followerId, followedId: myId } },
        data: { status: 'ACCEPTED' }
      });

      // 2. Tăng counter cho cả 2 bên
      await tx.user.update({ where: { id: followerId }, data: { followingCount: { increment: 1 } } });
      await tx.user.update({ where: { id: myId }, data: { followerCount: { increment: 1 } } });

      // 3. Bắn thông báo lại cho người xin follow
      await tx.notification.create({
        data: {
          userId: followerId, 
          actorId: myId,
          type: 'FOLLOW_ACCEPTED',
        }
      });
    });

    res.status(200).json({ message: 'Đã chấp nhận yêu cầu theo dõi' });
  } catch (error) {
    console.error("Lỗi acceptFollowRequest:", error);
    res.status(500).json({ message: 'Lỗi server khi chấp nhận follow.' });
  }
};

// 3. TỪ CHỐI YÊU CẦU FOLLOW (Chủ acc Private bấm xóa yêu cầu)
export const rejectFollowRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const myId = req.user?.userId as string;
    const followerId = req.params.followerId as string;

    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followedId: { followerId, followedId: myId } }
    });

    if (!existingFollow || existingFollow.status !== 'PENDING') {
      res.status(400).json({ message: 'Không có yêu cầu nào để xóa!' });
      return;
    }

    // Từ chối thì chỉ cần xóa dòng record PENDING đi, KHÔNG trừ biến đếm (vì đã cộng đâu mà trừ)
    await prisma.follow.delete({
      where: { followerId_followedId: { followerId, followedId: myId } }
    });

    res.status(200).json({ message: 'Đã từ chối yêu cầu theo dõi' });
  } catch (error) {
    console.error("Lỗi rejectFollowRequest:", error);
    res.status(500).json({ message: 'Lỗi server khi từ chối follow.' });
  }
};

// 4. HỦY FOLLOW HOẶC RÚT LẠI YÊU CẦU (Người đi follow tự hủy)
export const unfollowUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const followerId = req.user?.userId as string;
    const followedId = req.params.userId as string;

    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followedId: { followerId, followedId } }
    });

    if (!existingFollow) {
      res.status(400).json({ message: 'Bạn chưa follow người này!' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Xóa record Follow
      await tx.follow.delete({
        where: { followerId_followedId: { followerId, followedId } }
      });

      // 2. Nếu trước đó đã ACCEPTED thì mới đi trừ biến đếm
      if (existingFollow.status === 'ACCEPTED') {
        await tx.user.update({ where: { id: followerId }, data: { followingCount: { decrement: 1 } } });
        await tx.user.update({ where: { id: followedId }, data: { followerCount: { decrement: 1 } } });
      }
    });

    res.status(200).json({ message: 'Đã hủy theo dõi' });
  } catch (error) {
    console.error("Lỗi unfollowUser:", error);
    res.status(500).json({ message: 'Lỗi server khi hủy follow.' });
  }
};