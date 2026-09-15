import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDB } from './config/database';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import projectsRouter from './routes/projects';
import plansRouter from './routes/plans';
import recordsRouter from './routes/records';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'] }));
app.use(express.json());

// 初始化数据库
initDB();

// 路由
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/plans', plansRouter);
app.use('/api/records', recordsRouter);

// 健康检查
app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: 'v2' }));

app.listen(PORT, () => {
  console.log(`Flourish AI Server running on http://localhost:${PORT}`);
});

export default app;
