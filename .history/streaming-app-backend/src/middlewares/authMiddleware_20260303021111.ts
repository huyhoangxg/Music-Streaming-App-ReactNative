import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_tam_thoi';

// ĐỊNH NGHĨA CHUẨN: Interface này sẽ được import vào tất cả các Controller
export interface AuthRequest extends Request {
  user?: {
    userId: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Lấy header authorization (cách viết gọn hơn)
  const authHeader = req.headers.authorization;
  
  // Dùng optional chaining (?.) để lấy token an toàn, không sợ crash nếu authHeader bị undefined
  const token = authHeader?.split(' ')[1]; 

  if (!token) {
    res.status(401).json({ message: 'Bạn chưa đăng nhập (Không tìm thấy Token)!' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
      return;
    }
    
    // Ép kiểu an toàn (cast) decoded sang đúng cấu trúc đã định nghĩa
    req.user = decoded as { userId: string };
    
    // Chạy tiếp sang Controller
    next(); 
  });
};