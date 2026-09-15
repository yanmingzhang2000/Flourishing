import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDB } from './config/database';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import projectsRouter from './routes/projects';
import plansRouter from './routes/plans';
import recordsRouter from './routes/records';

const app = express();
const PORT = process.env.PORT || 80;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    'http://47.93.29.237',
    'http://47.93.29.237:80',
    'http://flourish.tbit.xin',
    'https://flourish.tbit.xin',
  ]
}));
app.use(express.json());

// 初始化数据库
initDB();

// API 路由
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/plans', plansRouter);
app.use('/api/records', recordsRouter);

// 健康检查
app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: 'v2' }));

// 静态文件服务（前端 dist）
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// SPA fallback — 所有非 /api 路由返回 index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Flourish AI Server running on http://localhost:${PORT}`);
});

export default app;
