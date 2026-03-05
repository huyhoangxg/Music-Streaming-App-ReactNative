import { Router } from 'express';
import { createPlaylist, getMyPlaylists, addSongToPlaylist } from '../controllers/playlistController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Tất cả thao tác Playlist đều cần Đăng nhập
router.post('/', authenticateToken, createPlaylist);
router.get('/', authenticateToken, getMyPlaylists);
router.post('/:playlistId/songs', authenticateToken, addSongToPlaylist);

export default router;