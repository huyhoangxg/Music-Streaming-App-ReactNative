import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_tam_thoi';

// ĐỊNH NGHĨA LẠI CHO CHUẨN: Báo cho TS biết JWT payload có chứa userId
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    [key: string]: any; // Phòng hờ m nhét thêm role hay email vào token
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Bạn chưa đăng nhập (Không tìm thấy Token)!' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
      return;
    }
    
    // Ép kiểu (cast) decoded sang đúng cấu trúc đã định nghĩa
    req.user = decoded as { userId: string };
    next(); 
  });
};