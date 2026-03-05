import { Router } from 'express';
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead 
} from '../controllers/notificationController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Tất cả các hành động liên quan đến Thông báo đều bắt buộc phải đăng nhập
router.use(authenticateToken);

// 1. Lấy danh sách thông báo
// Endpoint: GET /api/notifications
router.get('/', getNotifications);

// 2. Đánh dấu tất cả là đã đọc
// Endpoint: PUT /api/notifications/read-all
// LƯU Ý: Đặt route `read-all` lên TRƯỚC route `/:id` để Express không bị nhầm `read-all` là một ID
router.put('/read-all', markAllAsRead);

// 3. Đánh dấu 1 thông báo cụ thể là đã đọc
// Endpoint: PUT /api/notifications/:id/read
router.put('/:id/read', markAsRead);

export default router;