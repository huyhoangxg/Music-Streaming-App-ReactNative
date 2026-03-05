import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes'; 
import songRoutes from './routes/songRoutes';
import interactionRoutes from './routes/interactionRoutes';
import playlistRoutes from './routes/playlistRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes); 
app.use('/api/songs', songRoutes);
app.use('/api/songs', interactionRoutes);

app.use('/api/playlists', playlistRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send(' Backend cho ứng dụng streaming đã sẵn sàng!');
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại: http://localhost:${PORT}`);
});