#!/bin/bash
# 清理服务器上的 /opt/flourish-ai 残留目录
# 用途：移除之前 deploy.sh 创建的多余部署

set -e

LEGACY_DIR="/opt/flourish-ai"
BACKUP_DIR="/root/backups/legacy-flourish-ai.$(date +%Y%m%d_%H%M%S)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up legacy deployment directory..."

# 检查目录是否存在
if [ ! -d "$LEGACY_DIR" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Directory $LEGACY_DIR does not exist. Nothing to clean."
    exit 0
fi

# 备份目录（以防万一）
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating backup: $BACKUP_DIR"
mkdir -p "$(dirname "$BACKUP_DIR")"
cp -r "$LEGACY_DIR" "$BACKUP_DIR"

# 检查是否有数据库文件（避免误删重要数据）
if [ -f "$LEGACY_DIR/server/data/flourish.db" ]; then
    DB_SIZE=$(du -h "$LEGACY_DIR/server/data/flourish.db" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Found database file in legacy directory (${DB_SIZE})"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database backed up to: $BACKUP_DIR/server/data/flourish.db"
fi

# 删除目录
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Removing legacy directory: $LEGACY_DIR"
rm -rf "$LEGACY_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Cleanup completed successfully."
echo ""
echo "Legacy directory removed: $LEGACY_DIR"
echo "Backup saved to: $BACKUP_DIR"
echo ""
echo "If you need to restore, run:"
echo "  cp -r $BACKUP_DIR $LEGACY_DIR"
