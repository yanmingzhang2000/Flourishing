#!/bin/bash
set -e

APP_DIR="/opt/flourish-ai"
NODE_VERSION="22"

echo "=== Flourish AI 部署脚本 ==="

# 1. 安装 Node.js (如未安装)
if ! command -v node &> /dev/null; then
    echo "安装 Node.js $NODE_VERSION..."
    curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
    yum install -y nodejs || dnf install -y nodejs || apt-get install -y nodejs
fi

echo "Node: $(node -v), npm: $(npm -v)"

# 2. 创建应用目录
mkdir -p $APP_DIR

# 3. 安装前端依赖并构建（项目根目录）
echo "构建前端..."
cd $APP_DIR
npm install
npm run build

# 4. 安装后端依赖并编译
echo "编译后端..."
cd $APP_DIR/server
npm install
npx tsc

# 5. 用 pm2 启动/重启服务
if ! command -v pm2 &> /dev/null; then
    echo "安装 pm2..."
    npm install -g pm2
fi

# 停止旧进程（如有）
pm2 stop flourish-ai 2>/dev/null || true
pm2 delete flourish-ai 2>/dev/null || true

# 启动新进程
echo "启动服务..."
cd $APP_DIR/server
pm2 start dist/index.js --name flourish-ai
pm2 save

# 设置开机自启
pm2 startup 2>/dev/null || true

echo ""
echo "=== 部署完成 ==="
echo "服务运行在: http://47.93.29.237"
echo "健康检查: http://47.93.29.237/api/health"
echo ""
echo "查看日志: pm2 logs flourish-ai"
echo "重启服务: pm2 restart flourish-ai"
