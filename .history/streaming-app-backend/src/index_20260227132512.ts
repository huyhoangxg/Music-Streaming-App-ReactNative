import express, { Request, Response } from 'express';
import cors from 'cors';
import prisma from './prismaClient';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware giúp Server đọc được dữ liệu JSON và cho phép App gọi API
app.use(cors());
app.use(express.json());

// API Test: Kiểm tra xem Server đã chạy chưa
app.get('/', (req: Request, res: Response) => {
  res.send('Backend của Music Streaming App đang hoạt động!');
});

// API Test: Thử lấy danh sách User từ Database xem Prisma hoạt động không
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' });
  }
});

// Khởi động Server
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy mượt mà tại: http://localhost:${PORT}`);
});