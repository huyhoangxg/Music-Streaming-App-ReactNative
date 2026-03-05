import { Router } from 'express';
import { getAllSongs, createSong } from '../controllers/songController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Lấy danh sách nhạc thì AI CŨNG XEM ĐƯỢC (Không cần chặn)
router.get('/', getAllSongs);

// Upload nhạc thì PHẢI ĐĂNG NHẬP (Nhét bác bảo vệ authenticateToken vào giữa)
router.post('/', authenticateToken, createSong);

export default router;