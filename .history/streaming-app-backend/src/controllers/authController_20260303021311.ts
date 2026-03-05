import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_tam_thoi';

// 1. ĐĂNG KÝ TÀI KHOẢN (REGISTER)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, fullName } = req.body;

    // Validate cơ bản
    if (!username || !email || !password) {
      res.status(400).json({ message: 'Vui lòng điền đủ username, email và password!' });
      return;
    }

    // Kiểm tra xem email hoặc username đã tồn tại chưa
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      res.status(400).json({ message: 'Email hoặc Username đã được sử dụng!' });
      return;
    }

    // Mã hóa mật khẩu (Băm 10 vòng cho an toàn)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Lưu User mới vào Database
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash, // Lưu pass đã mã hóa, tuyệt đối không lưu pass thật
        fullName
      }
    });

    res.status(201).json({
      message: 'Đăng ký tài khoản thành công!',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        createdAt: newUser.createdAt
      } // Trả về thông tin cơ bản, giấu passwordHash đi
    });
  } catch (error) {
    console.error("Lỗi Register:", error);
    res.status(500).json({ message: 'Lỗi server khi đăng ký.' });
  }
};

// 2. ĐĂNG NHẬP (LOGIN)
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu!' });
      return;
    }

    // Tìm user theo email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác!' });
      return;
    }

    // So sánh mật khẩu người dùng nhập với hash trong DB
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    
    if (!isMatch) {
      res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác!' });
      return;
    }

    // Tạo JWT Token (Nhét đúng cái userId vào đây để middleware đọc được)
    const token = jwt.sign(
      { userId: user.id }, 
      JWT_SECRET,
      { expiresIn: '30d' } // App điện thoại thường để token sống lâu 1 chút (30 ngày)
    );

    res.status(200).json({
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        trackCount: user.trackCount
      }
    });
  } catch (error) {
    console.error("Lỗi Login:", error);
    res.status(500).json({ message: 'Lỗi server khi đăng nhập.' });
  }
};