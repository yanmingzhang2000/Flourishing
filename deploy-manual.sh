#!/bin/bash
# Flourish AI 服务器部署脚本
# 复制下面全部内容，粘贴到阿里云 Web 终端执行

set -e
echo "=================================="
echo "Flourish AI 部署开始"
echo "=================================="

# 1. 安装 Node.js 20 (适用于 CentOS/Alibaba Cloud Linux)
echo "步骤 1: 安装 Node.js..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git

# 验证
echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

# 2. 安装 PM2
echo "步骤 2: 安装 PM2..."
npm install -g pm2

# 3. 克隆项目
echo "步骤 3: 克隆项目..."
cd /root
if [ -d "Flourishing" ]; then
    echo "项目已存在，更新代码..."
    cd Flourishing
    git pull
else
    git clone https://github.com/yanmingzhang2000/Flourishing.git
    cd Flourishing
fi

# 4. 后端构建
echo "步骤 4: 构建后端..."
cd /root/Flourishing/server
npm install --production
npm run build

# 创建数据库目录
mkdir -p /root/Flourishing/server/data

# 5. 前端构建
echo "步骤 5: 构建前端..."
cd /root/Flourishing
npm install --production
npm run build

# 6. 停止旧进程并启动新进程
echo "步骤 6: 启动后端服务..."
pm2 stop flourish-api 2>/dev/null || true
pm2 delete flourish-api 2>/dev/null || true
cd /root/Flourishing/server
PORT=3001 pm2 start dist/index.js --name flourish-api
pm2 save
pm2 startup | tail -1 | bash

# 7. 配置 Nginx
echo "步骤 7: 配置 Nginx..."
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

# 测试 Nginx 配置
nginx -t

# 重启 Nginx
systemctl restart nginx
systemctl enable nginx

echo "=================================="
echo "✅ 部署完成！"
echo "=================================="
echo "访问地址: http://47.93.29.237"
echo "后端健康检查: http://47.93.29.237/api/health"
echo ""
echo "常用命令:"
echo "  查看后端日志: pm2 logs flourish-api"
echo "  重启后端: pm2 restart flourish-api"
echo "  查看进程状态: pm2 status"
echo "=================================="
