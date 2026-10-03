#!/bin/bash
# Flourish AI Nginx 配置优化脚本
# 用途：生成优化后的 Nginx 配置文件

set -e

CONFIG_FILE="/etc/nginx/conf.d/flourish.conf"
BACKUP_FILE="/etc/nginx/conf.d/flourish.conf.backup.$(date +%Y%m%d_%H%M%S)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Nginx configuration optimization..."

# 备份当前配置
if [ -f "$CONFIG_FILE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backing up current config to: $BACKUP_FILE"
    cp "$CONFIG_FILE" "$BACKUP_FILE"
fi

# 生成优化后的配置
cat > "$CONFIG_FILE" << 'EOF'
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
        
        proxy_pass http://127.0.0.1:80;
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
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }
}
EOF

echo "[$(date '+%Y-%m-%d %H:%M:%S')] New configuration written to: $CONFIG_FILE"

# 测试 Nginx 配置
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Configuration test passed."
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Reloading Nginx..."
    systemctl reload nginx
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Nginx reloaded successfully."
    echo ""
    echo "Optimization applied:"
    echo "  ✓ Security headers (X-Frame-Options, X-Content-Type-Options, etc.)"
    echo "  ✓ gzip compression for text/json/css/js"
    echo "  ✓ Static assets caching (1 year for CSS/JS/images)"
    echo "  ✓ API rate limiting (10 req/s + burst 20)"
    echo "  ✓ Access logs for debugging"
    echo ""
    echo "If you need to rollback, run:"
    echo "  cp $BACKUP_FILE $CONFIG_FILE"
    echo "  nginx -t && systemctl reload nginx"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ Configuration test failed. Restoring backup..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi
