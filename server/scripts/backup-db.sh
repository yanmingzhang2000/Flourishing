#!/bin/bash
# Flourish AI Database Backup Script
# 用途：自动备份 SQLite 数据库，保留最近 30 天的备份

set -e

# 配置
BACKUP_DIR="/root/backups/flourish-db"
DB_PATH="/root/Flourishing/server/data/flourish.db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/flourish_$DATE.db"
RETENTION_DAYS=30

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
    echo "[ERROR] Database file not found: $DB_PATH"
    exit 1
fi

# 执行备份
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup..."
cp "$DB_PATH" "$BACKUP_FILE"

# 压缩备份文件
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# 检查备份文件大小
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed: $BACKUP_FILE (${BACKUP_SIZE})"

# 清理旧备份（保留最近 N 天）
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "flourish_*.db.gz" -mtime +$RETENTION_DAYS)
if [ -n "$OLD_BACKUPS" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Removing old backups (older than $RETENTION_DAYS days):"
    echo "$OLD_BACKUPS"
    find "$BACKUP_DIR" -name "flourish_*.db.gz" -mtime +$RETENTION_DAYS -delete
fi

# 显示当前备份列表
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current backups:"
ls -lh "$BACKUP_DIR" | tail -5

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup process finished successfully."
