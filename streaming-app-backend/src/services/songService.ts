import prisma from '../prismaClient';

export const songService = {
  // 1. Logic tạo bài hát mới
  async createSong(userId: string, data: any) {
    const { title, fileUrl, imageUrl, duration, privacy } = data;

    // Dùng transaction để đảm bảo tạo nhạc xong thì user cũng được cộng trackCount
    return await prisma.$transaction(async (tx) => {
      const newSong = await tx.song.create({
        data: {
          title,
          fileUrl,
          imageUrl,
          duration,
          privacy: privacy || 'PUBLIC',
          userId,
        }
      });

      await tx.user.update({
        where: { id: userId },
        data: { trackCount: { increment: 1 } }
      });

      return newSong;
    });
  },

  // 2. Logic lấy danh sách nhạc Public
  async getPublicSongs() {
    return await prisma.song.findMany({
      where: { privacy: 'PUBLIC' },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        songGenres: { include: { genre: true } } // Chuẩn bị sẵn để hiển thị Tag/Genre sau này
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  // 3. Logic trackPlay (Ghi nhận lịch sử nghe cho AI)
  async trackPlay(songId: string, userId?: string, data?: any) {
    const { durationPlayed, completionRate, source } = data || {};

    return await prisma.$transaction(async (tx) => {
      // Tăng view
      const updatedSong = await tx.song.update({
        where: { id: songId },
        data: { playCount: { increment: 1 } },
        select: { playCount: true }
      });

      // Nếu có user thì lưu lịch sử nghe
      if (userId) {
        await tx.playHistory.create({
          data: {
            userId,
            songId,
            durationPlayed: durationPlayed || 0,
            completionRate: completionRate || 0,
            source: source || 'unknown',
          }
        });
      }
      return updatedSong.playCount;
    });
  }
};