import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// 1. TÍNH NĂNG THẢ TIM / BỎ TIM (TOGGLE LIKE)
export const toggleLike = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const songId = req.params.songId as string;

    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát!' });
      return;
    }

    const existingLike = await prisma.like.findUnique({
      where: { userId_songId: { userId, songId } }
    });

    let newLikeCount = song.likeCount;

    // Dùng Transaction để cập nhật đồng thời Like và biến đếm
    await prisma.$transaction(async (tx) => {
      if (existingLike) {
        // Hủy Like
        await tx.like.delete({ where: { userId_songId: { userId, songId } } });
        const updatedSong = await tx.song.update({
          where: { id: songId },
          data: { likeCount: { decrement: 1 } }
        });
        newLikeCount = updatedSong.likeCount;
      } else {
        // Thêm Like
        await tx.like.create({ data: { userId, songId } });
        const updatedSong = await tx.song.update({
          where: { id: songId },
          data: { likeCount: { increment: 1 } }
        });
        newLikeCount = updatedSong.likeCount;

        // Bắn thông báo nếu không phải tự like bài mình
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
      likeCount: newLikeCount // Trả về số lượng Like mới nhất cho Frontend hiển thị
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xử lý Like' });
  }
};

// 2. TÍNH NĂNG VIẾT BÌNH LUẬN
export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const songId = req.params.songId;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
      return;
    }

    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ message: 'Không tìm thấy bài hát!' });
      return;
    }

    let newComment;
    let newCommentCount = song.commentCount;

    await prisma.$transaction(async (tx) => {
      // 1. Tạo comment
      newComment = await tx.comment.create({
        data: { content, userId, songId },
        include: { user: { select: { fullName: true, avatarUrl: true } } }
      });

      // 2. Tăng số đếm Comment
      const updatedSong = await tx.song.update({
        where: { id: songId },
        data: { commentCount: { increment: 1 } }
      });
      newCommentCount = updatedSong.commentCount;

      // 3. Bắn thông báo
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
      commentCount: newCommentCount // Trả về để update số trên UI
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