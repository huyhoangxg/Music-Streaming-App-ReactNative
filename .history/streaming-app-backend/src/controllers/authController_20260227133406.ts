import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_tam_thoi';

// --- HÀM ĐĂNG KÝ (REGISTER) ---
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, fullName } = req.body;

    // 1. Kiểm tra xem email hoặc username đã tồn tại chưa
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existingUser) {
      res.status(400).json({ message: 'Email hoặc Username đã được sử dụng!' });
      return;
    }

    // 2. Mã hóa mật khẩu (Băm 10 vòng)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Lưu user mới vào Database
    const newUser = await prisma.user.create({
      data: { username, email, passwordHash, fullName },
    });

    res.status(201).json({ message: 'Đăng ký thành công!', userId: newUser.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server khi đăng ký' });
  }
};

// --- HÀM ĐĂNG NHẬP (LOGIN) ---
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 1. Tìm user theo email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ message: 'Không tìm thấy tài khoản!' });
      return;
    }

    // 2. Kiểm tra mật khẩu có khớp với cục Hash trong DB không
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Sai mật khẩu!' });
      return;
    }

    // 3. Tạo thẻ bài JWT (Token) có hạn 7 ngày
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // 4. Trả về token và thông tin user (nhớ giấu password đi)
    const { passwordHash, ...userInfo } = user;
    res.status(200).json({ message: 'Đăng nhập thành công!', token, user: userInfo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server khi đăng nhập' });
  }
};