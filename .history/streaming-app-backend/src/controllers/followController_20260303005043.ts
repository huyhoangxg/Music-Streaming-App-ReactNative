import { Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware'; // Giữ nguyên import của m

// 1. GỬI YÊU CẦU FOLLOW HOẶC FOLLOW TRỰC TIẾP
export const followUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const followerId = req.user.userId; // Mình
    const followedId = req.params.userId; // Người mình muốn follow

    if (followerId === followedId) {
      res.status(400).json({ message: 'Không thể tự follow chính mình!' });
      return;
    }

    // Kiểm tra xem người kia là Private hay Public
    const targetUser = await prisma.user.findUnique({ where: { id: followedId } });
    if (!targetUser) {
      res.status(404).json({ message: 'Không tìm thấy người dùng này!' });
      return;
    }

    // Bắt lỗi: Tránh việc bấm follow 2 lần gây crash server
    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followedId: { followerId, followedId } }
    });

    if (existingFollow) {
      res.status(400).json({ message: 'Bạn đã follow hoặc đang gửi yêu cầu rồi!' });
      return;
    }

    const followStatus = targetUser.isPrivate ? 'PENDING' : 'ACCEPTED';

    // Dùng Transaction để đảm bảo Tạo Follow + Tăng biến đếm + Bắn thông báo thành công cùng lúc
    await prisma.$transaction(async (tx) => {
      await tx.follow.create({
        data: { followerId, followedId, status: followStatus }
      });

      // Nếu là Public (ACCEPTED), tăng số người theo dõi ngay lập tức
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
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi follow' });
  }
};

// 2. CHẤP NHẬN YÊU CẦU FOLLOW (Chỉ dùng khi tài khoản là Private)
export const acceptFollowRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const myId = req.user.userId;
    const followerId = req.params.followerId; 

    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followedId: { followerId, followedId: myId } }
    });

    if (!existingFollow || existingFollow.status !== 'PENDING') {
      res.status(400).json({ message: 'Không có yêu cầu nào cần duyệt!' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái
      await tx.follow.update({
        where: { followerId_followedId: { followerId, followedId: myId } },
        data: { status: 'ACCEPTED' }
      });

      // 2. Bắt đầu tính số follow cho cả 2 bên
      await tx.user.update({ where: { id: followerId }, data: { followingCount: { increment: 1 } } });
      await tx.user.update({ where: { id: myId }, data: { followerCount: { increment: 1 } } });

      // 3. Bắn thông báo
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
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi chấp nhận follow' });
  }
};

// 3. HỦY FOLLOW HOẶC RÚT LẠI YÊU CẦU FOLLOW
export const unfollowUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const followerId = req.user.userId;
    const followedId = req.params.userId;

    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followedId: { followerId, followedId } }
    });

    if (!existingFollow) {
      res.status(400).json({ message: 'Bạn chưa follow người này!' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.follow.delete({
        where: { followerId_followedId: { followerId, followedId } }
      });

      // Nếu trước đó đã ACCEPTED thì mới trừ biến đếm
      if (existingFollow.status === 'ACCEPTED') {
        await tx.user.update({ where: { id: followerId }, data: { followingCount: { decrement: 1 } } });
        await tx.user.update({ where: { id: followedId }, data: { followerCount: { decrement: 1 } } });
      }
    });

    res.status(200).json({ message: 'Đã hủy theo dõi' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi hủy follow' });
  }
};

// 4. TỪ CHỐI YÊU CẦU FOLLOW (Chủ acc Private bấm xóa)
export const rejectFollowRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const myId = req.user.userId;
    const followerId = req.params.followerId;

    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followedId: { followerId, followedId: myId } }
    });

    if (!existingFollow || existingFollow.status !== 'PENDING') {
      res.status(400).json({ message: 'Không có yêu cầu nào để xóa!' });
      return;
    }

    // Từ chối thì chỉ cần xóa dòng record PENDING đi, không ảnh hưởng số đếm
    await prisma.follow.delete({
      where: { followerId_followedId: { followerId, followedId: myId } }
    });

    res.status(200).json({ message: 'Đã từ chối yêu cầu theo dõi' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi từ chối follow' });
  }
};