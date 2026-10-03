# Flourish AI 运维脚本

## 数据库备份脚本

### backup-db.sh

自动备份 SQLite 数据库的脚本。

**功能：**
- 复制数据库文件到备份目录
- 使用 gzip 压缩备份文件
- 自动清理超过 30 天的旧备份
- 记录备份日志

**使用方法：**

```bash
# 手动执行备份
bash /root/Flourishing/server/scripts/backup-db.sh

# 设置自动备份（每天凌晨 2 点）
crontab -e

# 添加以下行：
0 2 * * * /root/Flourishing/server/scripts/backup-db.sh >> /var/log/flourish-backup.log 2>&1
```

**备份文件位置：**
- 备份目录：`/root/backups/flourish-db/`
- 文件命名：`flourish_YYYYMMDD_HHMMSS.db.gz`
- 保留时长：30 天

### restore-db.sh

从备份恢复数据库的脚本。

**功能：**
- 在恢复前自动备份当前数据库
- 停止服务 → 恢复数据库 → 重启服务
- 执行健康检查验证恢复结果

**使用方法：**

```bash
# 查看可用备份
bash /root/Flourishing/server/scripts/restore-db.sh

# 从指定备份恢复
bash /root/Flourishing/server/scripts/restore-db.sh /root/backups/flourish-db/flourish_20261003_020000.db.gz
```

## 首次配置步骤

在服务器上执行以下命令设置自动备份：

```bash
# 1. 确保脚本有执行权限
chmod +x /root/Flourishing/server/scripts/*.sh

# 2. 测试手动备份
bash /root/Flourishing/server/scripts/backup-db.sh

# 3. 查看备份结果
ls -lh /root/backups/flourish-db/

# 4. 配置定时任务
crontab -e

# 添加这一行（每天凌晨 2 点备份）：
0 2 * * * /root/Flourishing/server/scripts/backup-db.sh >> /var/log/flourish-backup.log 2>&1

# 5. 验证 crontab 配置
crontab -l
```

## 日志查看

```bash
# 查看备份日志
tail -50 /var/log/flourish-backup.log

# 查看最近的备份文件
ls -lht /root/backups/flourish-db/ | head -10
```
