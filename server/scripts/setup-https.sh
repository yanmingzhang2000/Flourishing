#!/bin/bash
# Flourish AI HTTPS 配置脚本
# 用途：使用 Let's Encrypt 自动配置 HTTPS

set -e

# 检查是否提供了域名参数
if [ -z "$1" ]; then
    echo "Usage: $0 <your-domain.com>"
    echo ""
    echo "Example:"
    echo "  bash setup-https.sh flourish.example.com"
    echo ""
    echo "Prerequisites:"
    echo "  1. 你需要拥有一个域名"
    echo "  2. 域名的 DNS A 记录已指向服务器 IP: 47.93.29.237"
    echo "  3. 80 端口已开放（用于 Let's Encrypt 验证）"
    echo ""
    exit 1
fi

DOMAIN="$1"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Setting up HTTPS for domain: $DOMAIN"

# 1. 安装 Certbot
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    yum install -y epel-release
    yum install -y certbot python3-certbot-nginx
else
    echo "Certbot already installed"
fi

# 2. 更新 Nginx 配置，将 server_name 改为域名
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Updating Nginx server_name to: $DOMAIN"
NGINX_CONF="/etc/nginx/conf.d/flourish.conf"
BACKUP_CONF="/etc/nginx/conf.d/flourish.conf.backup.before_https.$(date +%Y%m%d_%H%M%S)"

# 备份当前配置
cp "$NGINX_CONF" "$BACKUP_CONF"

# 替换 server_name
sed -i "s/server_name .*/server_name $DOMAIN;/" "$NGINX_CONF"

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx

# 3. 获取 SSL 证书
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Obtaining SSL certificate from Let's Encrypt..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN"

# 4. 测试自动续期
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Testing certificate auto-renewal..."
certbot renew --dry-run

echo ""
echo "========================================="
echo "✓ HTTPS setup completed successfully!"
echo "========================================="
echo ""
echo "Your site is now available at:"
echo "  https://$DOMAIN"
echo ""
echo "Certificate details:"
certbot certificates
echo ""
echo "Auto-renewal is configured. Certificates will be renewed automatically."
echo ""
echo "To update CORS configuration, edit server/.env on the server:"
echo "  ALLOWED_ORIGINS=https://$DOMAIN"
echo ""
echo "Then restart the backend:"
echo "  pm2 restart flourish-api"
