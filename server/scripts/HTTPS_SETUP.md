# HTTPS 配置指南

## 前置条件

在执行 HTTPS 配置前，你需要：

1. **拥有一个域名**（例如：`flourish.example.com`）
2. **DNS 配置**：将域名的 A 记录指向服务器 IP `47.93.29.237`
3. **防火墙开放**：确保 80 和 443 端口开放

## 验证 DNS 配置

在配置 HTTPS 前，先验证 DNS 是否生效：

```bash
# 在任意电脑上执行
nslookup your-domain.com

# 或者
ping your-domain.com
```

应该看到解析结果指向 `47.93.29.237`。

## 执行 HTTPS 配置

**在服务器上执行：**

```bash
# 1. 确保脚本有执行权限
chmod +x /root/Flourishing/server/scripts/setup-https.sh

# 2. 执行配置（替换为你的域名）
sudo bash /root/Flourishing/server/scripts/setup-https.sh your-domain.com
```

脚本会自动：
- 安装 Certbot 和 Nginx 插件
- 更新 Nginx 配置的 `server_name`
- 申请 Let's Encrypt SSL 证书
- 配置 HTTPS 重定向
- 设置证书自动续期

## 配置后的步骤

### 1. 更新后端 CORS 配置

SSH 登录服务器，编辑环境变量：

```bash
vi /root/Flourishing/server/.env
```

修改 `ALLOWED_ORIGINS`，将 HTTP 改为 HTTPS：

```env
ALLOWED_ORIGINS=https://your-domain.com
```

重启后端：

```bash
pm2 restart flourish-api
```

### 2. 测试 HTTPS 访问

在浏览器访问：
```
https://your-domain.com
```

应该看到：
- 浏览器地址栏显示🔒锁图标
- 可以正常访问应用
- API 请求正常工作

### 3. 验证证书

```bash
# 查看证书信息
sudo certbot certificates

# 测试自动续期（不会真正续期）
sudo certbot renew --dry-run
```

## Let's Encrypt 证书说明

- **有效期**：90 天
- **自动续期**：Certbot 会自动配置 cron 任务，在证书到期前 30 天自动续期
- **费用**：完全免费

## 如果域名暂时没有

如果你暂时没有域名，可以：

1. **购买域名**：
   - 阿里云：约 60-80 元/年（.com）
   - Namecheap：约 $10-15/年
   
2. **使用免费域名**（不推荐生产环境）：
   - Freenom：提供 .tk/.ml/.ga 等免费域名
   - 但这些域名可能被浏览器标记为不安全

3. **暂时使用 HTTP**：
   - 继续使用 IP 访问
   - 等有域名后再配置 HTTPS

## 故障排查

### 证书申请失败

**错误：**`Certbot failed to authenticate some domains`

**原因：**
- DNS 解析未生效
- 80 端口未开放
- Nginx 配置错误

**解决：**
```bash
# 检查 DNS
nslookup your-domain.com

# 检查端口
curl http://your-domain.com

# 检查 Nginx 配置
nginx -t
```

### HTTPS 可访问但 API 调用失败

**原因：** 后端 CORS 配置仍然是 HTTP

**解决：** 更新 `server/.env` 的 `ALLOWED_ORIGINS` 为 HTTPS，并重启服务

### 证书续期失败

**检查续期日志：**
```bash
tail -50 /var/log/letsencrypt/letsencrypt.log
```

**手动续期：**
```bash
sudo certbot renew
```

## 回滚到 HTTP

如果 HTTPS 配置后出现问题，可以回滚：

```bash
# 恢复备份的 Nginx 配置
sudo cp /etc/nginx/conf.d/flourish.conf.backup.before_https.* /etc/nginx/conf.d/flourish.conf

# 测试并重载
sudo nginx -t && sudo systemctl reload nginx
```

## 推荐域名选择

建议使用：
- **yourproject.com** - 如果可用
- **flourish-ai.com** - 契合项目名称
- **yourname-flourish.com** - 个人项目

避免使用：
- 包含 `-app`、`-online` 的域名（显得不专业）
- 免费的 .tk/.ml 域名（浏览器可能不信任）
