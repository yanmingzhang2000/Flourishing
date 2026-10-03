#!/bin/bash
# Flourish AI Database Restore Script
# 用途：从备份恢复数据库

set -e

BACKUP_DIR="/root/backups/flourish-db"
DB_PATH="/root/Flourishing/server/data/flourish.db"

# 检查参数
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null || echo "No backups found in $BACKUP_DIR"
    exit 1
fi

BACKUP_FILE="$1"

# 检查备份文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    echo "[ERROR] Backup file not found: $BACKUP_FILE"
    exit 1
fi

# 备份当前数据库
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating safety backup of current database..."
cp "$DB_PATH" "${DB_PATH}.before_restore.$(date +%Y%m%d_%H%M%S)"

# 停止服务
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping flourish-api service..."
pm2 stop flourish-api

# 恢复数据库
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring from backup: $BACKUP_FILE"
gunzip -c "$BACKUP_FILE" > "$DB_PATH"

# 重启服务
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting flourish-api service..."
pm2 start flourish-api

# 健康检查
sleep 2
if curl -s http://localhost:80/api/health | grep -q "ok"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Database restored successfully. Service is healthy."
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ WARNING: Service health check failed. Please check pm2 logs."
fi
