import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// 1. TÍNH NĂNG THẢ TIM / BỎ TIM (TOGGLE LIKE)
export const toggleLike = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // THÊM DẤU '?' VÀ ÉP KIỂU ĐỂ TRÁNH LỖI UNDEFINED
    const userId = req.user?.userId as string; 
    const songId = req.params.songId as string;

    if (!userId) {
      res.status(401).json({ message: 'Chưa xác thực!' });
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

    // ÉP KIỂU RÕ RÀNG : number ĐỂ TS KHÔNG BÁO LỖI KHI GÁN TRONG TRANSACTION
    let newLikeCount: number = song.likeCount; 

    await prisma.$transaction(async (tx) => {
      if (existingLike) {
        await tx.like.delete({ where: { userId_songId: { userId, songId } } });
        const updatedSong = await tx.song.update({
          where: { id: songId },
          data: { likeCount: { decrement: 1 } }
        });
        newLikeCount = updatedSong.likeCount; // Giờ TS đã biết chắc đây là number
      } else {
        await tx.like.create({ data: { userId, songId } });
        const updatedSong = await tx.song.update({
          where: { id: songId },
          data: { likeCount: { increment: 1 } }
        });
        newLikeCount = updatedSong.likeCount;

        if (song.userId !== userId) {
          await tx.notification.create({
            data: {
              userId: song.userId,
              actorId: userId,
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
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xử lý Like' });
  }
};

// 2. TÍNH NĂNG VIẾT BÌNH LUẬN
export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;
    const { content } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Chưa xác thực!' });
      return;
    }

    if (!content) {
      res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
      return;
    }

    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát!' });
      return;
    }

    // ÉP KIỂU RÕ RÀNG: : any hoặc dùng Type của Prisma sinh ra
    let newComment: any; 
    let newCommentCount: number = song.commentCount;

    await prisma.$transaction(async (tx) => {
      newComment = await tx.comment.create({
        data: { content, userId, songId },
        include: { user: { select: { fullName: true, avatarUrl: true } } }
      });

      const updatedSong = await tx.song.update({
        where: { id: songId },
        data: { commentCount: { increment: 1 } }
      });
      newCommentCount = updatedSong.commentCount;

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
      message: 'Đã bình luận', 
      comment: newComment,
      commentCount: newCommentCount 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi thêm bình luận' });
  }
};

// 3. LẤY DANH SÁCH BÌNH LUẬN CỦA 1 BÀI HÁT
export const getSongComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId;

    const comments = await prisma.comment.findMany({
      where: { songId },
      include: {
        user: { select: { fullName: true, avatarUrl: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy bình luận' });
  }
};

// 4. TÍNH NĂNG REPOST / UNREPOST (MỚI)
export const toggleRepost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const songId = req.params.songId;

    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát!' });
      return;
    }

    const existingRepost = await prisma.repost.findUnique({
      where: { userId_songId: { userId, songId } }
    });

    let newRepostCount = song.repostCount;

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

        // Bắn thông báo nếu repost bài người khác
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
      message: existingRepost ? 'Đã bỏ Repost bài hát' : 'Đã Repost bài hát lên tường', 
      isReposted: !existingRepost,
      repostCount: newRepostCount // Trả về để cập nhật con số icon 🔄
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xử lý Repost' });
  }
};