import { Router } from 'express';
import authRoutes from './authRoutes';
import songRoutes from './songRoutes';
import playlistRoutes from './playlistRoutes';
import notificationRoutes from './notificationRoutes';
import userRoutes from './userRoutes';
import followRoutes from './followRoutes';
import interactionRoutes from './interactionRoutes';
import recommendationRoutes from './recommendationRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/songs', songRoutes);
router.use('/playlists', playlistRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/follows', followRoutes);
router.use('/interaction', interactionRoutes);
router.use('/interactions', interactionRoutes);
router.use('/recommendations', recommendationRoutes);

export default router;
