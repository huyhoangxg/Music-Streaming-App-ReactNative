import { Router } from 'express';
import {
  register,
  login,
  googleLogin,
  verifyEmail,
  resendVerificationCode,
  changePassword,
} from '../controllers/authController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);

router.post('/login', login);

router.post('/google', googleLogin);

router.post('/verify-email', verifyEmail);

router.post('/resend-verification', resendVerificationCode);

router.post('/change-password', authenticateToken, changePassword);

export default router;
