#!/bin/bash
# Flourish AI - Nginx 安装和配置脚本
# 用途：从 Node.js 直接暴露架构迁移到 Nginx 反向代理架构

set -e

echo "========================================="
echo "Flourish AI - Nginx Setup"
echo "========================================="
echo ""

# 1. 安装 Nginx
echo "[Step 1/5] Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    yum install -y nginx
    echo "✓ Nginx installed"
else
    echo "✓ Nginx already installed"
fi

# 2. 创建 Nginx 配置目录（如果不存在）
echo ""
echo "[Step 2/5] Creating Nginx configuration..."
mkdir -p /etc/nginx/conf.d

# 3. 备份旧配置（如果存在）
if [ -f /etc/nginx/conf.d/flourish.conf ]; then
    cp /etc/nginx/conf.d/flourish.conf /etc/nginx/conf.d/flourish.conf.backup.$(date +%Y%m%d_%H%M%S)
    echo "✓ Backed up existing config"
fi

# 4. 创建优化的 Nginx 配置
cat > /etc/nginx/conf.d/flourish.conf << 'EOF'
# Flourish AI Nginx Configuration
# Optimized for security, caching, and performance

# 速率限制配置（防止 API 滥用）
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    listen 80;
    server_name 47.93.29.237;
    
    # 日志配置
    access_log /var/log/nginx/flourish-access.log;
    error_log /var/log/nginx/flourish-error.log;
    
    # 安全 Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # gzip 压缩配置
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;
    gzip_min_length 1000;
    gzip_disable "msie6";
    
    # 前端静态资源
    location / {
        root /root/Flourishing/dist;
        try_files $uri $uri/ /index.html;
        
        # HTML 文件不缓存（确保用户总是获取最新版本）
        location ~* \.html$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
        
        # CSS/JS/字体/图片等静态资源长期缓存
        location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot|webp)$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
            access_log off;
        }
    }
    
    # 后端 API 代理
    location /api {
        # 速率限制（每秒最多 10 个请求，突发允许 20 个）
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # 请求头转发
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓存控制
        proxy_cache_bypass $http_upgrade;
        
        # API 响应不缓存
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # 健康检查端点（不限流）
    location = /api/health {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }
}
EOF

echo "✓ Nginx configuration created"

# 5. 测试 Nginx 配置
echo ""
echo "[Step 3/5] Testing Nginx configuration..."
nginx -t

# 6. 启动并启用 Nginx
echo ""
echo "[Step 4/5] Starting Nginx..."
systemctl enable nginx
systemctl start nginx
systemctl status nginx --no-pager

echo ""
echo "[Step 5/5] Summary"
echo "========================================="
echo "✓ Nginx installed and configured"
echo "✓ Configuration file: /etc/nginx/conf.d/flourish.conf"
echo ""
echo "⚠️  IMPORTANT: Next steps required!"
echo "========================================="
echo ""
echo "1. Update backend to listen on port 3001 instead of 80:"
echo "   Edit /root/Flourishing/server/.env"
echo "   Change: PORT=80"
echo "   To:     PORT=3001"
echo ""
echo "2. Restart backend service:"
echo "   pm2 restart flourish-api"
echo ""
echo "3. Test the service:"
echo "   curl http://localhost/api/health"
echo "   curl http://47.93.29.237/api/health"
echo ""
echo "After these steps, Nginx will serve static files and proxy API requests to Node.js."
echo ""
