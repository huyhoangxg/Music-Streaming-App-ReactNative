import { Router } from 'express';
import { authenticateToken } from '../../middlewares/authMiddleware';
import { songUploadFields } from '../../middlewares/uploadMiddleware';
import { uploadSong } from './song.controller';

const router = Router();

router.post('/upload', authenticateToken, songUploadFields, uploadSong);

export default router;
