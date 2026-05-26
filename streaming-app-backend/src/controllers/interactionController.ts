import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';
import { AppError } from '../middlewares/errorMiddleware';
import { likeService } from '../modules/interactions/like.service';

// ==========================================
// 1. TÍNH NĂNG THẢ TIM / BỎ TIM (TOGGLE LIKE)
// ==========================================
export const toggleLike = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;

    const result = await likeService.toggleLike({ userId, songId });
    res.status(200).json({
      message: result.isLiked ? 'Đã thích bài hát' : 'Đã bỏ thích bài hát',
      ...result,
    });
  } catch (error) {
    console.error("Lỗi toggleLike:", error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
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
// 3b. OWNER-ONLY TRACK INSIGHT LISTS
// ==========================================
async function getOwnedSongOrRespond(songId: string, userId: string, res: Response) {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { id: true, userId: true },
  });

  if (!song) {
    res.status(404).json({ message: 'Song not found.' });
    return null;
  }

  if (song.userId !== userId) {
    res.status(403).json({ message: 'Only the track owner can view this list.' });
    return null;
  }

  return song;
}

export const getSongLikeUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const song = await getOwnedSongOrRespond(songId, userId, res);
    if (!song) {
      return;
    }

    const likes = await prisma.like.findMany({
      where: { songId },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(
      likes.map((like) => ({
        createdAt: like.createdAt,
        user: like.user,
      })),
    );
  } catch (error) {
    console.error('Error getSongLikeUsers:', error);
    res.status(500).json({ message: 'Server error while loading likes.' });
  }
};

export const getSongRepostUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const song = await getOwnedSongOrRespond(songId, userId, res);
    if (!song) {
      return;
    }

    const reposts = await prisma.repost.findMany({
      where: { songId },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(
      reposts.map((repost) => ({
        createdAt: repost.createdAt,
        user: repost.user,
      })),
    );
  } catch (error) {
    console.error('Error getSongRepostUsers:', error);
    res.status(500).json({ message: 'Server error while loading reposts.' });
  }
};

// ==========================================
// 3c. KIỂM TRA TRẠNG THÁI TƯƠNG TÁC CỦA USER
// ==========================================
export const getSongInteractionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;

    const [like, repost] = await Promise.all([
      prisma.like.findUnique({ where: { userId_songId: { userId, songId } } }),
      prisma.repost.findUnique({ where: { userId_songId: { userId, songId } } }),
    ]);

    res.status(200).json({
      isLiked: !!like,
      isReposted: !!repost,
    });
  } catch (error) {
    console.error('Lỗi getSongInteractionStatus:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy trạng thái tương tác.' });
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

export const getMyReposts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;

    if (!userId) {
      res.status(401).json({ message: 'Bạn chưa đăng nhập!' });
      return;
    }

    // Tìm trong bảng Repost của user này
    const reposts = await prisma.repost.findMany({
      where: { userId },
      include: {
        song: {
          include: {
            // Lấy thông tin tác giả của bài hát
            user: { select: { fullName: true, username: true, avatarUrl: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Repost là 1 bảng trung gian, mình chỉ cần móc cái ruột 'song' ra để trả về cho Frontend
    const repostedSongs = reposts.map(r => r.song);

    res.status(200).json(repostedSongs);
  } catch (error) {
    console.error("Lỗi getMyReposts:", error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách nhạc repost.' });
  }
};

export const getMyLikedSongs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const likesData = await prisma.like.findMany({
      where: { userId },
      include: {
        song: {
          include: {
            user: { select: { id: true, username: true, fullName: true, avatarUrl: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const likedTracks = likesData.map(l => l.song);
    res.status(200).json(likedTracks);
  } catch (error) {
    console.error("Lỗi getMyLikedSongs:", error);
    res.status(500).json({ message: 'Lỗi server khi lấy nhạc đã thích.' });
  }
};
