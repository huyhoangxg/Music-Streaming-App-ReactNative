import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { recommendationService } from '../services/recommendationService';

function parseLimit(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const getForYouRecommendations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const limit = parseLimit(req.query.limit, 12);
    const recommendations = await recommendationService.getForYouRecommendations(userId, limit);
    res.status(200).json(recommendations);
  } catch (error) {
    console.error('Failed to get home recommendations:', error);
    res.status(500).json({ message: 'Failed to get recommendations.' });
  }
};

export const getAutoplayRecommendations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const songId = req.params.songId as string;
    const limit = parseLimit(req.query.limit, 10);
    const recommendations = await recommendationService.getAutoplayRecommendations(userId, songId, limit);
    res.status(200).json(recommendations);
  } catch (error) {
    console.error('Failed to get autoplay recommendations:', error);
    res.status(500).json({ message: 'Failed to get autoplay recommendations.' });
  }
};

export const getSimilarRecommendations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId ?? null;
    const songId = req.params.songId as string;
    const limit = parseLimit(req.query.limit, 10);
    const recommendations = await recommendationService.getSimilarRecommendations(userId, songId, limit);
    res.status(200).json(recommendations);
  } catch (error) {
    console.error('Failed to get similar recommendations:', error);
    res.status(500).json({ message: 'Failed to get similar recommendations.' });
  }
};

export const rebuildTasteProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId as string;
    const profile = await recommendationService.rebuildUserGenrePreferences(userId);
    res.status(200).json({
      message: 'User taste profile rebuilt.',
      profile,
    });
  } catch (error) {
    console.error('Failed to rebuild taste profile:', error);
    res.status(500).json({ message: 'Failed to rebuild taste profile.' });
  }
};
