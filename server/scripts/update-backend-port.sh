#!/bin/bash
# 更新后端监听端口从 80 改为 3001

set -e

ENV_FILE="/root/Flourishing/server/.env"

echo "Updating backend port configuration..."

# 备份 .env
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✓ Backed up .env file"

# 更新 PORT 配置
if grep -q "^PORT=" "$ENV_FILE"; then
    sed -i 's/^PORT=.*/PORT=3001/' "$ENV_FILE"
    echo "✓ Updated PORT=3001"
else
    echo "PORT=3001" >> "$ENV_FILE"
    echo "✓ Added PORT=3001"
fi

echo ""
echo "Current .env configuration:"
cat "$ENV_FILE"

echo ""
echo "✓ Backend port updated to 3001"
echo ""
echo "Next: Restart the backend service"
echo "  pm2 restart flourish-api"
