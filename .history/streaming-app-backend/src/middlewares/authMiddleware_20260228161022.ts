import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_tam_thoi';

// Định nghĩa thêm kiểu cho Request để chứa thông tin user
export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Lấy token từ header của request gửi lên
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Định dạng: "Bearer <token>"

  if (!token) {
    res.status(401).json({ message: 'Bạn chưa đăng nhập (Không tìm thấy Token)!' });
    return;
  }

  // Kiểm tra token có hợp lệ không
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
      return;
    }
    
    // Nếu hợp lệ, nhét thông tin user vào Request để các hàm sau xài
    req.user = user;
    next(); // Cho phép đi tiếp vào Controller
  });
};