import express, { Request, Response } from 'express';
import cors from 'cors';
// 1. Import cái routes vừa tạo
import authRoutes from './routes/authRoutes'; 

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 2. Gắn authRoutes vào đường dẫn gốc /api/auth
app.use('/api/auth', authRoutes); 

app.get('/', (req: Request, res: Response) => {
  res.send('Chào mừng đến với Backend của App Nhạc Mạng Xã Hội! 🚀');
});

app.listen(PORT, () => {
  console.log(`✅ Server đang chạy mượt mà tại: http://localhost:${PORT}`);
});