import { Router } from 'express';
import { register, login } from '../controllers/authController';

const router = Router();

// Định nghĩa 2 cái cổng để App gọi tới
router.post('/register', register);
router.post('/login', login);

export default router;