# Flourish AI 一键部署脚本
# 使用方法: 在PowerShell中运行 .\deploy-server.ps1

$SERVER = "root@47.93.29.237"
$REMOTE_DIR = "/opt/flourish-ai"
$LOCAL_DIR = "C:\Users\yanmingzhang\Desktop\Code\Flourishing-latest"

Write-Host "=== Flourish AI 部署 ===" -ForegroundColor Green

# 1. 打包项目（排除不需要的文件）
Write-Host "打包项目文件..." -ForegroundColor Yellow

$archive = "$LOCAL_DIR\flourish-ai-deploy.tar.gz"

# 使用 tar 打包（Windows 10+ 自带 tar）
tar -czf $archive `
    --exclude="node_modules" `
    --exclude="dist" `
    --exclude=".git" `
    --exclude="*.log" `
    -C $LOCAL_DIR `
    src/ data/ public/ scripts/ server/ docs/ `
    package.json package-lock.json `
    tsconfig.json tsconfig.app.json tsconfig.node.json `
    vite.config.ts eslint.config.js index.html `
    deploy.sh server/.env

Write-Host "打包完成: $archive" -ForegroundColor Green

# 2. 上传到服务器
Write-Host "上传到服务器..." -ForegroundColor Yellow
scp $archive "${SERVER}:/tmp/"

# 3. 远程执行部署
Write-Host "在服务器上执行部署..." -ForegroundColor Yellow
ssh $SERVER @"
set -e
cd /tmp

# 解压
rm -rf $REMOTE_DIR
mkdir -p $REMOTE_DIR
tar -xzf flourish-ai-deploy.tar.gz -C $REMOTE_DIR

# 确保 deploy.sh 可执行
chmod +x $REMOTE_DIR/deploy.sh

# 执行部署脚本
cd $REMOTE_DIR
bash deploy.sh

# 清理
rm -f /tmp/flourish-ai-deploy.tar.gz
"@

Write-Host ""
Write-Host "=== 部署完成! ===" -ForegroundColor Green
Write-Host "访问: http://47.93.29.237" -ForegroundColor Cyan
