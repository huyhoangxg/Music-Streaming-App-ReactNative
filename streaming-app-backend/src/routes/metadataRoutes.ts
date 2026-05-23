import { Router } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import {
  enrichSongMetadata,
  getSongMetadata,
} from '../modules/metadata/metadata.controller';

const router = Router();

router.post('/songs/:songId/enrich', authenticateToken, enrichSongMetadata);
router.get('/songs/:songId', getSongMetadata);

export default router;
