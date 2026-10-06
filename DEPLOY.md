# Flourishing AI - 部署文档

## 🚀 快速部署（阿里云）

### 服务器信息
- **IP 地址**: 47.93.29.237
- **操作系统**: CentOS / Alibaba Cloud Linux
- **SSH 用户**: root

---

## 📦 部署方式

### 方式 1：SSH 一键部署（推荐）

在本地 PowerShell 执行：

```powershell
ssh root@47.93.29.237 "cd /root/Flourishing && git pull && cd server && npm install && npm run build && cd .. && npm install && npm run build && pm2 restart flourish-api && systemctl reload nginx && echo '部署完成！'"
```

**说明**：
- 拉取最新代码
- 构建后端和前端
- 重启后端服务
- 重载 Nginx 配置

---

### 方式 2：Web 终端手动部署

1. 登录阿里云控制台
2. 进入 ECS 实例，点击"远程连接" → "Web 终端"
3. 执行以下命令：

```bash
cd /root/Flourishing
git pull
cd server && npm install && npm run build
cd .. && npm install && npm run build
pm2 restart flourish-api
systemctl reload nginx
echo "部署完成！"
```

---

## 🔧 首次部署（完整安装）

如果是全新服务器，需要完整安装环境。在服务器上执行：

```bash
#!/bin/bash
set -e

# 1. 安装 Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git

# 2. 安装 PM2
npm install -g pm2

# 3. 克隆项目
cd /root
git clone https://github.com/yanmingzhang2000/Flourishing.git
cd Flourishing

# 4. 构建后端
cd server
npm install --production
npm run build
mkdir -p /root/Flourishing/server/data

# 5. 构建前端
cd ..
npm install --production
npm run build

# 6. 启动后端服务
cd server
PORT=3001 pm2 start dist/index.js --name flourish-api
pm2 save
pm2 startup | tail -1 | bash

# 7. 配置 Nginx
cat > /etc/nginx/conf.d/flourish.conf <<'NGINX_EOF'
server {
    listen 80;
    server_name 47.93.29.237;
    
    # 前端
    location / {
        root /root/Flourishing/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
    
    # 后端 API
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX_EOF

# 测试并重启 Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

echo "=================================="
echo "✅ 首次部署完成！"
echo "=================================="
echo "访问地址: http://47.93.29.237"
echo "后端健康检查: http://47.93.29.237/api/health"
```

---

## 🌐 访问地址

| 服务 | 地址 |
|------|------|
| **主站** | http://47.93.29.237 |
| **健康检查** | http://47.93.29.237/api/health |
| **API 根路径** | http://47.93.29.237/api |

---

## 📊 常用运维命令

### PM2 进程管理

```bash
# 查看进程状态
pm2 status

# 查看日志（实时）
pm2 logs flourish-api

# 查看日志（最近 100 行）
pm2 logs flourish-api --lines 100

# 重启服务
pm2 restart flourish-api

# 停止服务
pm2 stop flourish-api

# 查看资源占用
pm2 monit
```

### Nginx 管理

```bash
# 测试配置
nginx -t

# 重载配置（不中断服务）
systemctl reload nginx

# 重启 Nginx
systemctl restart nginx

# 查看状态
systemctl status nginx

# 查看错误日志
tail -f /var/log/nginx/error.log

# 查看访问日志
tail -f /var/log/nginx/access.log
```

### 数据库管理

```bash
# 查看 SQLite 数据库
cd /root/Flourishing/server/data
ls -lh

# 备份数据库
cp flourish.db flourish.db.backup.$(date +%Y%m%d_%H%M%S)

# 查看数据库大小
du -h flourish.db
```

---

## 🔍 故障排查

### 后端服务无法启动

```bash
# 查看 PM2 日志
pm2 logs flourish-api --err

# 检查端口占用
netstat -tlnp | grep 3001

# 手动启动测试
cd /root/Flourishing/server
node dist/index.js
```

### 前端页面 404

```bash
# 检查构建产物
ls -lh /root/Flourishing/dist/

# 检查 Nginx 配置
cat /etc/nginx/conf.d/flourish.conf
nginx -t

# 查看 Nginx 错误日志
tail -50 /var/log/nginx/error.log
```

### API 请求失败

```bash
# 测试后端健康检查
curl http://127.0.0.1:3001/api/health

# 测试 Nginx 代理
curl http://127.0.0.1/api/health

# 查看后端日志
pm2 logs flourish-api
```

---

## 🔐 环境变量

后端环境变量配置（如需修改）：

```bash
# 编辑 server/.env
cd /root/Flourishing/server
vi .env
```

常见配置：

```bash
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/flourish.db
SILICONFLOW_API_KEY=your_api_key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=Qwen/Qwen2.5-7B-Instruct
```

修改后重启服务：

```bash
pm2 restart flourish-api --update-env
```

---

## 📝 部署检查清单

部署完成后，请验证以下项目：

- [ ] 主站访问正常（http://47.93.29.237）
- [ ] 健康检查返回 200（http://47.93.29.237/api/health）
- [ ] 用户注册/登录功能正常
- [ ] 训练计划生成功能正常
- [ ] PM2 进程状态为 `online`
- [ ] Nginx 状态为 `active (running)`
- [ ] 后端日志无错误

---

## 🆘 紧急回滚

如果新版本出现严重问题，可以快速回滚：

```bash
cd /root/Flourishing
git log --oneline -5  # 查看最近5次提交
git reset --hard <previous-commit-hash>  # 回滚到指定版本
cd server && npm install && npm run build
cd .. && npm install && npm run build
pm2 restart flourish-api
systemctl reload nginx
```

---

## 📞 联系方式

如有问题，请联系技术负责人。
