import { Router } from 'express';
import { toggleLike, addComment, getSongComments } from '../controllers/interactionController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Lấy danh sách comment thì AI CŨNG XEM ĐƯỢC
router.get('/:songId/comments', getSongComments);

// Like và Comment thì BẮT BUỘC PHẢI ĐĂNG NHẬP (Cần vé VIP)
router.post('/:songId/like', authenticateToken, toggleLike);
router.post('/:songId/comments', authenticateToken, addComment);

export default router;