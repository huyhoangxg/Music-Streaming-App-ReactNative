import { Router } from 'express';
import {
  register,
  login,
  googleLogin,
  startGoogleDeviceLogin,
  pollGoogleDeviceLogin,
  verifyEmail,
  resendVerificationCode,
  changePassword,
  requestPasswordReset,
  resetPassword,
} from '../controllers/authController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);

router.post('/login', login);

router.post('/google', googleLogin);

router.post('/google/device/start', startGoogleDeviceLogin);

router.post('/google/device/poll', pollGoogleDeviceLogin);

router.post('/verify-email', verifyEmail);

router.post('/resend-verification', resendVerificationCode);

router.post('/change-password', authenticateToken, changePassword);

router.post('/forgot-password', requestPasswordReset);

router.post('/reset-password', resetPassword);

export default router;
