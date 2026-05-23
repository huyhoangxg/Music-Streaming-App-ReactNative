import { Router } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import {
  getAutoplayRecommendations,
  getForYouRecommendations,
  getSimilarRecommendations,
  rebuildTasteProfile,
} from '../controllers/recommendationController';
import { optionalAuthenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.get('/for-you', authenticateToken, getForYouRecommendations);
router.get('/autoplay/:songId', authenticateToken, getAutoplayRecommendations);
router.get('/similar/:songId', optionalAuthenticateToken, getSimilarRecommendations);
router.post('/profile/rebuild', authenticateToken, rebuildTasteProfile);

export default router;
