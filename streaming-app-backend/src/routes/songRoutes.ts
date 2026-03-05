import { Router } from 'express';
import { 
  uploadSong, 
  getPublicSongs, 
  getSongById, 
  incrementPlayCount 
} from '../controllers/songController';
import { authenticateToken, optionalAuthenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// ==========================================
// NHÓM 1: PUBLIC / KHÔNG BẮT BUỘC ĐĂNG NHẬP
// ==========================================

// Lấy danh sách nhạc Public (Trang chủ/Khám phá)
// GET /api/songs/public
router.get('/public', getPublicSongs);

// Xem chi tiết & Play nhạc (Có check Public/Private)
// GET /api/songs/:songId
router.get('/:songId', optionalAuthenticateToken, getSongById);

// Tăng lượt nghe (Play Count)
// POST /api/songs/:songId/play
router.post('/:songId/play', incrementPlayCount);


// ==========================================
// NHÓM 2: BẮT BUỘC ĐĂNG NHẬP (CÓ TOKEN)
// ==========================================

// Đăng bài hát mới
// POST /api/songs
router.post('/', authenticateToken, uploadSong);

export default router;