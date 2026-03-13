import prisma from '../prismaClient'; 

export const userService = {
  // 1. Lấy thông tin cá nhân (Profile của mình)
  async getMyProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        isPrivate: true,
        followerCount: true,
        followingCount: true,
        trackCount: true,
        createdAt: true,
      }
    });

    if (!user) throw new Error('USER_NOT_FOUND');
    return user;
  },

  // 2. Cập nhật thông tin cá nhân
  async updateProfile(userId: string, data: any) {
    const { fullName, bio, avatarUrl, isPrivate } = data;

    return await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        bio,
        avatarUrl,
        isPrivate
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        avatarUrl: true,
        isPrivate: true
      }
    });
  },

  // 3. Lấy thông tin người khác 
  async getUserProfile(targetUserId: string) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        avatarUrl: true,
        isPrivate: true,
        followerCount: true,
        followingCount: true,
        trackCount: true,
      }
    });

    if (!user) throw new Error('USER_NOT_FOUND');
    return user;
  }
};