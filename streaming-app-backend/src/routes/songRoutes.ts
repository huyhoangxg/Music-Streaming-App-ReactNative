import { Router } from 'express';
import {
  getPublicSongs,
  getSongById,
  trackPlay,
  getMySongs,
  getUserSongs,
  getTrendingSongs,
  deleteSong,
  getListeningHistory,
  updateSong,
} from '../controllers/songController';
import { authenticateToken, optionalAuthenticateToken } from '../middlewares/authMiddleware';
import { songEditFields } from '../middlewares/uploadMiddleware';
import songUploadRoutes from '../modules/songs/song.routes';

const router = Router();

router.get('/public', getPublicSongs);
router.get('/trending', getTrendingSongs);
router.get('/my-songs', authenticateToken, getMySongs);
router.get('/listening-history', authenticateToken, getListeningHistory);
router.get('/user/:userId', authenticateToken, getUserSongs);
router.post('/:songId/play', trackPlay);

router.use('/', songUploadRoutes);

router.get('/:songId', optionalAuthenticateToken, getSongById);
router.put('/:songId', authenticateToken, songEditFields, updateSong);
router.delete('/:songId', authenticateToken, deleteSong);

export default router;
