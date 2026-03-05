import { Router } from 'express';
import { 
  followUser, 
  unfollowUser, 
  acceptFollowRequest, 
  rejectFollowRequest,
  getFollowers,
  getFollowing
} from '../controllers/followController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// ==========================================
// NHÓM 1: LẤY DANH SÁCH (Không bắt buộc phải truyền Token nếu xem Public)
// ==========================================
// GET /api/follows/:userId/followers
router.get('/:userId/followers', getFollowers);

// GET /api/follows/:userId/following
router.get('/:userId/following', getFollowing);


// ==========================================
// NHÓM 2: HÀNH ĐỘNG CỦA USER (BẮT BUỘC CÓ TOKEN)
// ==========================================

// Gửi yêu cầu follow / Follow trực tiếp
// POST /api/follows/:userId
router.post('/:userId', authenticateToken, followUser);

// Hủy follow / Hủy yêu cầu follow
// DELETE /api/follows/:userId
router.delete('/:userId', authenticateToken, unfollowUser);

// Chủ acc Private duyệt yêu cầu follow của người khác
// PUT /api/follows/requests/:followerId/accept
router.put('/requests/:followerId/accept', authenticateToken, acceptFollowRequest);

// Chủ acc Private từ chối yêu cầu follow của người khác
// DELETE /api/follows/requests/:followerId/reject
router.delete('/requests/:followerId/reject', authenticateToken, rejectFollowRequest);

export default router;