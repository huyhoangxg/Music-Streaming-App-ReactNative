import { Router } from 'express';
import { getMyNotifications, markAsRead } from '../controllers/notificationController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getMyNotifications);
router.put('/:id/read', authenticateToken, markAsRead);

export default router;