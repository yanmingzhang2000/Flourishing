import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDB, initCopilotData } from './config/database';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import projectsRouter from './routes/projects';
import plansRouter from './routes/plans';
import recordsRouter from './routes/records';
import projectInstancesRouter from './routes/projectInstances';
import exercisesRouter from './routes/exercises';
import copilotRouter from './copilot/router';

const app = express();
const PORT = process.env.PORT || 80;

// CORS 配置：支持环境变量覆盖
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://47.93.29.237',
      'http://47.93.29.237:80',
    ];

// 开发环境额外添加 localhost
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000'
  );
}

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// 初始化数据库
initDB();

// 初始化 Copilot 数据（模板等）
initCopilotData().catch(err => {
  console.error('Failed to initialize Copilot data:', err);
});

// API 路由
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/plans', plansRouter);
app.use('/api/records', recordsRouter);
app.use('/api/project-instances', projectInstancesRouter);
app.use('/api/exercises', exercisesRouter);
app.use('/api/copilot', copilotRouter);

// 健康检查
app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: 'v2' }));

// 静态文件服务（前端 dist）
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// SPA fallback — 所有非 /api 路由返回 index.html
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`Flourish AI Server running on http://localhost:${PORT}`);
});

export default app;
