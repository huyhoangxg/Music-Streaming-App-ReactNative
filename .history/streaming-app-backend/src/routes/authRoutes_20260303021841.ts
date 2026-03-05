import { Router } from 'express';
import { register, login } from '../controllers/authController';

const router = Router();

// Route Đăng ký (Method: POST)
// Endpoint thực tế sẽ là: POST /api/auth/register
router.post('/register', register);

// Route Đăng nhập (Method: POST)
// Endpoint thực tế sẽ là: POST /api/auth/login
router.post('/login', login);

export default router;