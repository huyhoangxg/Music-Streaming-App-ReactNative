import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// ==========================================
// 1. TẠO PLAYLIST MỚI
// ==========================================
export const createPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const { title, privacy } = req.body;

    if (!title) {
      res.status(400).json({ message: 'Tên playlist không được để trống!' });
      return;
    }

    const newPlaylist = await prisma.playlist.create({
      data: {
        title,
        privacy: privacy || 'PUBLIC',
        userId
      }
    });

    res.status(201).json({ 
      message: 'Đã tạo playlist thành công', 
      playlist: newPlaylist 
    });
  } catch (error) {
    console.error("Lỗi createPlaylist:", error);
    res.status(500).json({ message: 'Lỗi server khi tạo playlist.' });
  }
};

// ==========================================
// 2. THÊM BÀI HÁT VÀO PLAYLIST
// ==========================================
export const addSongToPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const playlistId = req.params.playlistId as string;
    const { songId } = req.body;

    if (!songId) {
      res.status(400).json({ message: 'Thiếu ID bài hát!' });
      return;
    }

    // Kiểm tra Playlist có tồn tại và thuộc về user này không
    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) {
      res.status(404).json({ message: 'Không tìm thấy playlist!' });
      return;
    }
    if (playlist.userId !== userId) {
      res.status(403).json({ message: 'Bạn không có quyền sửa playlist này!' });
      return;
    }

    // Kiểm tra xem bài hát đã có trong playlist chưa
    const existingEntry = await prisma.playlistSong.findFirst({
      where: { playlistId, songId }
    });

    if (existingEntry) {
      res.status(400).json({ message: 'Bài hát đã có trong playlist này rồi!' });
      return;
    }

    await prisma.playlistSong.create({
      data: { playlistId, songId }
    });

    res.status(200).json({ message: 'Đã thêm bài hát vào playlist.' });
  } catch (error) {
    console.error("Lỗi addSongToPlaylist:", error);
    res.status(500).json({ message: 'Lỗi server khi thêm bài hát.' });
  }
};

// ==========================================
// 3. XÓA BÀI HÁT KHỎI PLAYLIST
// ==========================================
export const removeSongFromPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const playlistId = req.params.playlistId as string;
    const songId = req.params.songId as string;

    // Kiểm tra quyền sở hữu Playlist
    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) {
      res.status(404).json({ message: 'Không tìm thấy playlist!' });
      return;
    }
    if (playlist.userId !== userId) {
      res.status(403).json({ message: 'Bạn không có quyền sửa playlist này!' });
      return;
    }

    // Xóa record trong bảng trung gian
    const deletedRecord = await prisma.playlistSong.deleteMany({
      where: { playlistId, songId }
    });

    if (deletedRecord.count === 0) {
      res.status(404).json({ message: 'Bài hát không nằm trong playlist này!' });
      return;
    }

    res.status(200).json({ message: 'Đã xóa bài hát khỏi playlist.' });
  } catch (error) {
    console.error("Lỗi removeSongFromPlaylist:", error);
    res.status(500).json({ message: 'Lỗi server khi xóa bài hát.' });
  }
};

// ==========================================
// 4. LẤY DANH SÁCH PLAYLIST CỦA 1 USER
// ==========================================
export const getUserPlaylists = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.userId as string;
    const myId = req.user?.userId; // Có thể undefined nếu chưa đăng nhập

    // Nếu mình đang xem trang của chính mình -> Lấy cả Public lẫn Private
    // Nếu xem trang người khác -> Chỉ lấy Public
    const isOwner = myId === targetUserId;

    const playlists = await prisma.playlist.findMany({
      where: {
        userId: targetUserId,
        ...(isOwner ? {} : { privacy: 'PUBLIC' }) // Tricky query của Prisma
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { playlistSongs: true } } // Đếm luôn số bài hát có trong list
      }
    });

    res.status(200).json(playlists);
  } catch (error) {
    console.error("Lỗi getUserPlaylists:", error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách playlist.' });
  }
};

// ==========================================
// 5. XEM CHI TIẾT PLAYLIST & DANH SÁCH BÀI HÁT
// ==========================================
export const getPlaylistById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const playlistId = req.params.playlistId as string;
    const myId = req.user?.userId;

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        user: { select: { username: true, fullName: true, avatarUrl: true } },
        playlistSongs: {
          orderBy: { addedAt: 'desc' },
          include: {
            song: { 
              include: { user: { select: { fullName: true, username: true } } }
            }
          }
        }
      }
    });

    if (!playlist) {
      res.status(404).json({ message: 'Không tìm thấy playlist!' });
      return;
    }

    // Logic chặn quyền riêng tư: Playlist Private thì chỉ chủ nhân mới được xem
    if (playlist.privacy === 'PRIVATE' && playlist.userId !== myId) {
      res.status(403).json({ message: 'Playlist này đang ở chế độ riêng tư!' });
      return;
    }

    res.status(200).json(playlist);
  } catch (error) {
    console.error("Lỗi getPlaylistById:", error);
    res.status(500).json({ message: 'Lỗi server khi lấy chi tiết playlist.' });
  }
};