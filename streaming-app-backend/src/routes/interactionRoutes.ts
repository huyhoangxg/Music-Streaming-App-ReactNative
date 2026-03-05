import { Router } from 'express';
import { 
  toggleLike, 
  addComment, 
  getSongComments, 
  toggleRepost 
} from '../controllers/interactionController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// ==========================================
// NHÓM 1: BẮT BUỘC ĐĂNG NHẬP (CÓ TOKEN)
// ==========================================

// Thả tim / Hủy thả tim bài hát
// Endpoint: POST /api/interactions/like/:songId
router.post('/like/:songId', authenticateToken, toggleLike);

// Viết bình luận mới vào bài hát
// Endpoint: POST /api/interactions/comment/:songId
router.post('/comment/:songId', authenticateToken, addComment);

// Chia sẻ / Gỡ chia sẻ bài hát (Repost)
// Endpoint: POST /api/interactions/repost/:songId
router.post('/repost/:songId', authenticateToken, toggleRepost);


// ==========================================
// NHÓM 2: PUBLIC (KHÔNG CẦN ĐĂNG NHẬP)
// ==========================================

// Lấy danh sách bình luận của 1 bài hát
// Endpoint: GET /api/interactions/comment/:songId
router.get('/comment/:songId', getSongComments);

export default router;