import { Router } from 'express';
import { 
  createPlaylist, 
  addSongToPlaylist, 
  removeSongFromPlaylist, 
  getUserPlaylists, 
  getPlaylistById 
} from '../controllers/playlistController';
import { authenticateToken, optionalAuthenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// ==========================================
// NHÓM 1: BẮT BUỘC ĐĂNG NHẬP (CÓ TOKEN)
// ==========================================

// Tạo playlist mới
// Endpoint: POST /api/playlists
router.post('/', authenticateToken, createPlaylist);

// Thêm bài hát vào playlist
// Endpoint: POST /api/playlists/:playlistId/songs
router.post('/:playlistId/songs', authenticateToken, addSongToPlaylist);

// Xóa bài hát khỏi playlist
// Endpoint: DELETE /api/playlists/:playlistId/songs/:songId
router.delete('/:playlistId/songs/:songId', authenticateToken, removeSongFromPlaylist);


// ==========================================
// NHÓM 2: PUBLIC HOẶC PRIVATE (TÙY TRẠNG THÁI)
// ==========================================

// Lấy danh sách Playlist của 1 user cụ thể
// Endpoint: GET /api/playlists/user/:userId
// Dùng optionalAuthenticateToken để nếu là chủ nhân thì xem được cả list Private
router.get('/user/:userId', optionalAuthenticateToken, getUserPlaylists);

// Xem chi tiết 1 Playlist (kèm danh sách bài hát bên trong)
// Endpoint: GET /api/playlists/:playlistId
router.get('/:playlistId', optionalAuthenticateToken, getPlaylistById);

export default router;