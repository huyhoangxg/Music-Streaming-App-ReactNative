import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { userService } from '../services/userService';
import prisma from '../prismaClient';
import { uploadToCloudinary } from '../utils/uploadToCloudinary';

function sanitizeUserSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}


export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    
    // Gọi thẳng Prisma để móc đủ các cột đếm số lượng (Counters)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, 
        username: true, 
        fullName: true, 
        avatarUrl: true, 
        bio: true,
        followerCount: true,   
        followingCount: true,  
        trackCount: true,  
      }
    });
    
    if (!user) {
      res.status(404).json({ message: 'Không tìm thấy người dùng!' });
      return;
    }

    res.status(200).json(user);
  } catch (error: any) {
    console.error("Lỗi getMyProfile:", error);
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin.' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    
    // 1. Hứng các trường text (fullName, username, bio...)
    const updateData = { ...req.body };

    // 2. Nếu có avatar mới, upload thẳng buffer lên Cloudinary theo cùng flow upload hiện tại.
    if (req.file) {
      const avatarUpload = await uploadToCloudinary(req.file, {
        folder: 'soundwave/avatars',
        resource_type: 'image',
        public_id: `soundwave/avatar/${sanitizeUserSegment(userId)}/${Date.now()}`,
        overwrite: false,
      });

      updateData.avatarUrl = avatarUpload.secure_url;
    }

    // 3. Đưa cục updateData (đã gộp cả chữ lẫn link ảnh) xuống Service
    const updatedUser = await userService.updateProfile(userId, updateData);

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
    const currentUserId = req.user?.userId; // Thằng đang cầm điện thoại xem (có thể undefined nếu chưa đăng nhập)

    // Lấy data thằng chủ tường
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true, username: true, fullName: true, avatarUrl: true, bio: true,
        followerCount: true, followingCount: true, trackCount: true,
      }
    });

    if (!user) {
      res.status(404).json({ message: 'Không tìm thấy người dùng này!' });
      return;
    }

    let isFollowedByMe = false;

    // BƯỚC QUAN TRỌNG NHẤT: Nếu mình đang đăng nhập, check xem mình follow nó chưa
    if (currentUserId) {
      const checkFollow = await prisma.follow.findUnique({
        where: {
          followerId_followedId: {
            followerId: currentUserId,
            followedId: targetUserId
          }
        }
      });
      if (checkFollow) isFollowedByMe = true;
    }

    // Trả về data gộp luôn cả cái cờ trạng thái này cho App
    res.status(200).json({
      ...user,
      isFollowedByMe // Trả về true/false để App biết đường tô màu nút Cam hay Đen
    });

  } catch (error: any) {
    console.error("Lỗi getUserProfile:", error);
    res.status(500).json({ message: 'Lỗi server khi xem profile.' });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, fullName: true, avatarUrl: true }
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách user" });
  }
};

export const toggleFollowUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user?.userId as string; 
    const targetUserId = req.params.userId as string; 

    if (currentUserId === targetUserId) {
      res.status(400).json({ message: 'Không thể tự follow chính mình!' });
      return;
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followedId: {
          followerId: currentUserId,
          followedId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      // 1. NẾU ĐÃ FOLLOW -> XÓA FOLLOW + TRỪ ĐI 1 Ở 2 BẢNG USER (Dùng Transaction cho an toàn)
      await prisma.$transaction([
        prisma.follow.delete({
          where: { followerId_followedId: { followerId: currentUserId, followedId: targetUserId } }
        }),
        prisma.user.update({
          where: { id: targetUserId },
          data: { followerCount: { decrement: 1 } } // Trừ follower của nó
        }),
        prisma.user.update({
          where: { id: currentUserId },
          data: { followingCount: { decrement: 1 } } // Trừ following của mình
        })
      ]);
      res.status(200).json({ isFollowing: false, message: 'Đã bỏ theo dõi' });
    } else {
      // 2. NẾU CHƯA FOLLOW -> TẠO FOLLOW + CỘNG THÊM 1 VÀO 2 BẢNG USER
      await prisma.$transaction([
        prisma.follow.create({
          data: { followerId: currentUserId, followedId: targetUserId }
        }),
        prisma.user.update({
          where: { id: targetUserId },
          data: { followerCount: { increment: 1 } } // Cộng follower cho nó
        }),
        prisma.user.update({
          where: { id: currentUserId },
          data: { followingCount: { increment: 1 } } // Cộng following cho mình
        })
      ]);
      res.status(200).json({ isFollowing: true, message: 'Đã theo dõi' });
    }
  } catch (error) {
    console.error('Lỗi toggleFollowUser:', error);
    res.status(500).json({ message: 'Lỗi server khi follow user.' });
  }
};

export const getFollowers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.userId as string;

    const followersData = await prisma.follow.findMany({
      where: { followedId: targetUserId },
      include: {
        follower: { select: { id: true, username: true, fullName: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Bóc tách data cho đẹp: Chỉ lấy thông tin user, vứt mấy cái râu ria của bảng Follow đi
    const followers = followersData.map(f => f.follower);
    
    res.status(200).json(followers);
  } catch (error) {
    console.error('Lỗi getFollowers:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy followers.' });
  }
};

export const getFollowing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.userId as string;

    const followingData = await prisma.follow.findMany({
      where: { followerId: targetUserId },
      include: {
        followed: { select: { id: true, username: true, fullName: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Tương tự, bóc lấy ruột thằng followed thôi
    const following = followingData.map(f => f.followed);

    res.status(200).json(following);
  } catch (error) {
    console.error('Lỗi getFollowing:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy following.' });
  }
};
