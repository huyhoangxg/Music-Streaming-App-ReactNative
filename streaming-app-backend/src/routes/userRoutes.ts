import { Router } from 'express';
import { getMyProfile, updateProfile, getUserProfile } from '../controllers/userController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// 1. Lấy thông tin cá nhân của mình (Yêu cầu đăng nhập)
// Endpoint: GET /api/users/me
router.get('/me', authenticateToken, getMyProfile);

// 2. Cập nhật thông tin cá nhân (Yêu cầu đăng nhập)
// Endpoint: PUT /api/users/me
router.put('/me', authenticateToken, updateProfile);

// 3. Lấy thông tin profile của một user bất kỳ (Yêu cầu đăng nhập)
// Endpoint: GET /api/users/:userId
// T gắn luôn authenticateToken vào đây, để lỡ sau này m muốn làm logic kiểu: "Acc private thì tao check xem mày đã follow chưa tao mới trả data về" thì trong Controller nó đã có sẵn req.user.userId để check.
router.get('/:userId', authenticateToken, getUserProfile);

export default router;