import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// ==========================================
// 1. TÍNH NĂNG THẢ TIM / BỎ TIM (TOGGLE LIKE)
// ==========================================
export const toggleLike = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;

    if (!userId) {
      res.status(401).json({ message: 'Bạn chưa đăng nhập!' });
      return;
    }

    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát!' });
      return;
    }

    const existingLike = await prisma.like.findUnique({
      where: { userId_songId: { userId, songId } }
    });

    let newLikeCount: number = song.playCount; // Gắn type :number cho TS khỏi báo lỗi

    await prisma.$transaction(async (tx) => {
      if (existingLike) {
        // Đã like -> Bỏ like
        await tx.like.delete({ where: { userId_songId: { userId, songId } } });
        const updatedSong = await tx.song.update({
          where: { id: songId },
          data: { likeCount: { decrement: 1 } }
        });
        newLikeCount = updatedSong.likeCount;
      } else {
        // Chưa like -> Thêm like
        await tx.like.create({ data: { userId, songId } });
        const updatedSong = await tx.song.update({
          where: { id: songId },
          data: { likeCount: { increment: 1 } }
        });
        newLikeCount = updatedSong.likeCount;

        // Bắn thông báo nếu không phải tự like bài của mình
        if (song.userId !== userId) {
          await tx.notification.create({
            data: {
              userId: song.userId, // Người nhận là chủ bài hát
              actorId: userId,     // Người bấm like
              type: 'LIKE_SONG',
              referenceId: songId
            }
          });
        }
      }
    });

    res.status(200).json({ 
      message: existingLike ? 'Đã bỏ thích bài hát' : 'Đã thích bài hát', 
      isLiked: !existingLike,
      likeCount: newLikeCount 
    });
  } catch (error) {
    console.error("Lỗi toggleLike:", error);
    res.status(500).json({ message: 'Lỗi server khi xử lý Like.' });
  }
};

// ==========================================
// 2. TÍNH NĂNG VIẾT BÌNH LUẬN (ADD COMMENT)
// ==========================================
export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;
    const { content } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Bạn chưa đăng nhập!' });
      return;
    }

    if (!content || content.trim() === '') {
      res.status(400).json({ message: 'Nội dung bình luận không được để trống!' });
      return;
    }

    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát!' });
      return;
    }

    // Dùng Type any tạm thời cho comment mới tạo vì Prisma include có thể làm phức tạp Type
    let newComment: any; 
    let newCommentCount: number = song.commentCount;

    await prisma.$transaction(async (tx) => {
      // 1. Tạo Comment
      newComment = await tx.comment.create({
        data: { content, userId, songId },
        include: { user: { select: { fullName: true, username: true, avatarUrl: true } } }
      });

      // 2. Tăng đếm
      const updatedSong = await tx.song.update({
        where: { id: songId },
        data: { commentCount: { increment: 1 } }
      });
      newCommentCount = updatedSong.commentCount;

      // 3. Thông báo
      if (song.userId !== userId) {
        await tx.notification.create({
          data: {
            userId: song.userId,
            actorId: userId,
            type: 'COMMENT_SONG',
            referenceId: songId
          }
        });
      }
    });

    res.status(201).json({ 
      message: 'Đã thêm bình luận', 
      comment: newComment,
      commentCount: newCommentCount 
    });
  } catch (error) {
    console.error("Lỗi addComment:", error);
    res.status(500).json({ message: 'Lỗi server khi thêm bình luận.' });
  }
};

// ==========================================
// 3. LẤY DANH SÁCH BÌNH LUẬN (GET COMMENTS)
// ==========================================
export const getSongComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;

    const comments = await prisma.comment.findMany({
      where: { songId },
      include: {
        user: { select: { fullName: true, username: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' } // Mới nhất lên đầu
    });

    res.status(200).json(comments);
  } catch (error) {
    console.error("Lỗi getSongComments:", error);
    res.status(500).json({ message: 'Lỗi server khi lấy bình luận.' });
  }
};

// ==========================================
// 4. TÍNH NĂNG CHIA SẺ BÀI HÁT (TOGGLE REPOST)
// ==========================================
export const toggleRepost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;

    if (!userId) {
      res.status(401).json({ message: 'Bạn chưa đăng nhập!' });
      return;
    }

    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát!' });
      return;
    }

    const existingRepost = await prisma.repost.findUnique({
      where: { userId_songId: { userId, songId } }
    });

    let newRepostCount: number = song.repostCount;

    await prisma.$transaction(async (tx) => {
      if (existingRepost) {
        // Hủy Repost
        await tx.repost.delete({ where: { userId_songId: { userId, songId } } });
        const updatedSong = await tx.song.update({
          where: { id: songId },
          data: { repostCount: { decrement: 1 } }
        });
        newRepostCount = updatedSong.repostCount;
      } else {
        // Thêm Repost
        await tx.repost.create({ data: { userId, songId } });
        const updatedSong = await tx.song.update({
          where: { id: songId },
          data: { repostCount: { increment: 1 } }
        });
        newRepostCount = updatedSong.repostCount;

        // Bắn thông báo
        if (song.userId !== userId) {
          await tx.notification.create({
            data: {
              userId: song.userId,
              actorId: userId,
              type: 'REPOST_SONG',
              referenceId: songId
            }
          });
        }
      }
    });

    res.status(200).json({ 
      message: existingRepost ? 'Đã gỡ bài hát khỏi tường nhà' : 'Đã đăng bài hát lên tường nhà', 
      isReposted: !existingRepost,
      repostCount: newRepostCount 
    });
  } catch (error) {
    console.error("Lỗi toggleRepost:", error);
    res.status(500).json({ message: 'Lỗi server khi xử lý Repost.' });
  }
};