# Nginx 配置优化

## 优化内容

已创建 `optimize-nginx.sh` 脚本，包含以下优化：

### 1. 安全 Headers
- `X-Frame-Options: SAMEORIGIN` - 防止点击劫持
- `X-Content-Type-Options: nosniff` - 防止 MIME 类型嗅探
- `X-XSS-Protection: 1; mode=block` - XSS 保护
- `Referrer-Policy: no-referrer-when-downgrade` - 控制 Referer 信息

### 2. gzip 压缩
- 压缩级别：6（平衡性能和压缩率）
- 压缩类型：HTML、CSS、JS、JSON、XML、字体、SVG
- 最小压缩文件大小：1000 字节
- 预期效果：文本资源减少 60-80% 传输大小

### 3. 缓存策略优化
**HTML 文件：**
- `Cache-Control: no-cache, no-store, must-revalidate`
- 确保用户总是获取最新版本

**静态资源（CSS/JS/图片/字体）：**
- `Cache-Control: public, max-age=31536000, immutable`
- 长期缓存 1 年，减少重复请求

**API 响应：**
- `Cache-Control: no-cache`
- 不缓存动态数据

### 4. API 速率限制
- 基础速率：10 请求/秒
- 突发容量：20 个请求
- 作用：防止 DDoS 攻击和 API 滥用
- `/api/health` 不限流（用于监控探测）

### 5. 日志配置
- 访问日志：`/var/log/nginx/flourish-access.log`
- 错误日志：`/var/log/nginx/flourish-error.log`
- 静态资源访问不记录日志（减少 I/O）

## 部署方式

**在服务器上执行：**

```bash
# 1. 确保脚本有执行权限
chmod +x /root/Flourishing/server/scripts/optimize-nginx.sh

# 2. 执行优化（会自动备份原配置）
sudo bash /root/Flourishing/server/scripts/optimize-nginx.sh
```

脚本会自动：
- 备份当前配置到 `/etc/nginx/conf.d/flourish.conf.backup.YYYYMMDD_HHMMSS`
- 生成优化后的配置
- 测试配置正确性（`nginx -t`）
- 重新加载 Nginx（`systemctl reload nginx`）

## 如何回滚

如果优化后出现问题，使用备份文件回滚：

```bash
# 查看备份文件
ls -lt /etc/nginx/conf.d/flourish.conf.backup.*

# 恢复备份（替换为实际的备份文件名）
sudo cp /etc/nginx/conf.d/flourish.conf.backup.YYYYMMDD_HHMMSS /etc/nginx/conf.d/flourish.conf

# 测试并重载
sudo nginx -t && sudo systemctl reload nginx
```

## 验证优化效果

**1. 检查 gzip 是否生效：**
```bash
curl -I -H "Accept-Encoding: gzip" http://47.93.29.237/api/health
# 应该看到: Content-Encoding: gzip
```

**2. 检查缓存 headers：**
```bash
# 静态资源应该有长期缓存
curl -I http://47.93.29.237/some-static-file.css

# API 响应不应该缓存
curl -I http://47.93.29.237/api/health
```

**3. 检查安全 headers：**
```bash
curl -I http://47.93.29.237 | grep -E "X-Frame-Options|X-Content-Type"
```

**4. 测试速率限制：**
```bash
# 快速发送多个请求，超过限制后应该返回 503
for i in {1..30}; do curl -s -o /dev/null -w "%{http_code}\n" http://47.93.29.237/api/health; done
```

## 注意事项

- 优化后首次访问可能需要重新下载资源（因为缓存策略改变）
- 速率限制可能影响频繁调用 API 的客户端（需要根据实际情况调整 `rate` 参数）
- 如果后续配置 HTTPS，需要在 `server` 块中添加 SSL 相关配置
