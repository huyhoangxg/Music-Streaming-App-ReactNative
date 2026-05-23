import { Response } from 'express';
import { AuthRequest } from '../../middlewares/authMiddleware';
import { metadataService } from './metadata.service';

export const enrichSongMetadata = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const uploaderSelectedGenre = req.body?.uploaderSelectedGenre as string | undefined;
    const result = await metadataService.enrichSongMetadata({ songId, uploaderSelectedGenre });

    res.status(200).json({
      message: 'Song metadata enriched.',
      result,
    });
  } catch (error) {
    console.error('Failed to enrich song metadata:', error);
    res.status(500).json({ message: 'Failed to enrich song metadata.' });
  }
};

export const getSongMetadata = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const songId = req.params.songId as string;
    const metadata = await metadataService.getSongMetadata(songId);
    res.status(200).json(metadata);
  } catch (error) {
    console.error('Failed to load song metadata:', error);
    res.status(500).json({ message: 'Failed to load song metadata.' });
  }
};
