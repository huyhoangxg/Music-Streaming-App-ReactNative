import { Router } from 'express';
import {
  addComment,
  getMyLikedSongs,
  getMyReposts,
  getSongComments,
  getSongInteractionStatus,
  toggleLike,
  toggleRepost,
} from '../controllers/interactionController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { likeSong, unlikeSong } from '../modules/interactions/like.controller';
import { recordPlayHistory } from '../modules/interactions/playHistory.controller';

const router = Router();

router.post('/play-history', authenticateToken, recordPlayHistory);
router.post('/like', authenticateToken, likeSong);
router.delete('/like/:songId', authenticateToken, unlikeSong);
router.get('/my-reposts', authenticateToken, getMyReposts);
router.get('/my-likes', authenticateToken, getMyLikedSongs);
router.post('/:songId/like', authenticateToken, toggleLike);
router.post('/:songId/repost', authenticateToken, toggleRepost);
router.post('/:songId/comment', authenticateToken, addComment);
router.get('/:songId/comment', getSongComments);
router.get('/:songId/my-status', authenticateToken, getSongInteractionStatus);

export default router;
