import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database';

const router = Router();

function signToken(userId: number) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
}

// 注册
router.post('/register', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码必填' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: '邮箱已注册' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
  const userId = result.lastInsertRowid as number;

  return res.json({ token: signToken(userId), userId });
});

// 登录
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码必填' });

  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ? AND is_guest = 0').get(email) as any;
  if (!user) return res.status(401).json({ error: '邮箱或密码错误' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: '邮箱或密码错误' });

  return res.json({ token: signToken(user.id), userId: user.id });
});

// 游客模式
router.post('/guest', (_req: Request, res: Response) => {
  const result = db.prepare('INSERT INTO users (is_guest) VALUES (1)').run();
  const userId = result.lastInsertRowid as number;
  return res.json({ token: signToken(userId), userId, isGuest: true });
});

export default router;
