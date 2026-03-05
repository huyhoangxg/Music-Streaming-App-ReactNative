import { Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middlewares/authMiddleware';

// 1. TẠO PLAYLIST MỚI
export const createPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const { title, privacy } = req.body;

    const newPlaylist = await prisma.playlist.create({
      data: { title, privacy: privacy || 'Public', userId }
    });
    res.status(201).json({ message: 'Tạo Playlist thành công', playlist: newPlaylist });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo Playlist' });
  }
};

// 2. LẤY DANH SÁCH PLAYLIST CỦA TÔI
export const getMyPlaylists = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const playlists = await prisma.playlist.findMany({
      where: { userId },
      include: {
        _count: { select: { playlistSongs: true } } // Đếm xem có bao nhiêu bài trong list này
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(playlists);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy Playlist' });
  }
};

// 3. THÊM BÀI HÁT VÀO PLAYLIST (Lưu vào bảng trung gian PlaylistSong)
export const addSongToPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const playlistId = req.params.playlistId as string;
    const { songId } = req.body;

    // Kiểm tra xem bài hát đã có trong playlist chưa để tránh thêm trùng
    const exist = await prisma.playlistSong.findFirst({
      where: { playlistId, songId }
    });

    if (exist) {
      res.status(400).json({ message: 'Bài hát đã có trong Playlist này rồi!' });
      return;
    }

    await prisma.playlistSong.create({
      data: { playlistId, songId }
    });
    res.status(201).json({ message: 'Đã thêm bài hát vào Playlist' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thêm bài hát vào Playlist' });
  }
};
// 4. XÓA BÀI HÁT KHỎI PLAYLIST
export const removeSongFromPlaylist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const playlistId = req.params.playlistId as string;
    const { songId } = req.body;

    await prisma.playlistSong.deleteMany({
      where: { playlistId, songId }
    });
    
    res.status(200).json({ message: 'Đã xóa bài hát khỏi Playlist' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa bài hát' });
  }
};

// 5. CẬP NHẬT VỊ TRÍ (ORDER) TRONG PLAYLIST
export const updateSongOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const playlistId = req.params.playlistId as string;
    const { songId, newOrderIndex } = req.body; 
    // newOrderIndex là vị trí mới (ví dụ: 1, 2, 3) do React Native gửi lên khi user kéo thả

    // Cập nhật vị trí vào bảng trung gian
    await prisma.playlistSong.updateMany({
      where: { playlistId, songId },
      data: { orderIndex: newOrderIndex }
    });

    res.status(200).json({ message: 'Đã cập nhật thứ tự bài hát' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật vị trí' });
  }
};