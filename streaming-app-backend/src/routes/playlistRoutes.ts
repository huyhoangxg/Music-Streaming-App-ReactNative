import { Router } from 'express';
import { 
  getMyPlaylists,
  createPlaylist, 
  addSongToPlaylist,
  removeSongFromPlaylist,
  getPlaylist,
  updatePlaylist,
  deletePlaylist
} from '../controllers/playlistController';
import { authenticateToken, optionalAuthenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.get('/my-playlists', authenticateToken, getMyPlaylists);

router.post('/', authenticateToken, createPlaylist);

router.post('/:playlistId/songs', authenticateToken, addSongToPlaylist);
router.delete('/:playlistId/songs/:songId', authenticateToken, removeSongFromPlaylist);

router.get('/:playlistId', optionalAuthenticateToken, getPlaylist);
router.put('/:playlistId', authenticateToken, updatePlaylist);
router.delete('/:playlistId', authenticateToken, deletePlaylist);

export default router;
