$SERVER    = "root@47.93.29.237"
$REMOTE    = "/root/Flourishing"
$LOCAL     = "C:\Users\maggie.zhang\Desktop\code\Flourishing"
$SSH_OPTS  = @("-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes")

function Log  { param($m, $c = "Cyan")   Write-Host "[deploy] $m" -ForegroundColor $c }
function Step { param($m)                Write-Host "" ; Write-Host ">>> $m" -ForegroundColor Yellow }

Step "1. Build frontend"
Set-Location $LOCAL
npm run build
Log "Frontend built" Green

Step "2. Build backend"
Set-Location ($LOCAL + "\server")
npm run build
Log "Backend built" Green

Step "3. Upload files"
$distDest   = $SERVER + ":" + $REMOTE + "/dist/index.html"
$serverDest = $SERVER + ":" + $REMOTE + "/server/"
$pkgDest    = $SERVER + ":" + $REMOTE + "/server/package.json"

Log "Uploading dist/index.html ..."
& scp @SSH_OPTS ($LOCAL + "\dist\index.html") $distDest

Log "Uploading server/dist/ ..."
& scp @SSH_OPTS -r ($LOCAL + "\server\dist") $serverDest

Log "Uploading server/package.json ..."
& scp @SSH_OPTS ($LOCAL + "\server\package.json") $pkgDest

Log "Upload complete" Green

Step "4. Restart server"
$tmpScript = [System.IO.Path]::GetTempFileName() + ".sh"
$scriptContent = "#!/bin/bash`ncd " + $REMOTE + "/server`nnpm install --omit=dev 2>&1 | tail -3`npm2 restart flourish-api`npm2 save`npm2 list`nsleep 2`ncurl -s http://localhost:80/api/health"
$scriptContent | Set-Content -Path $tmpScript -Encoding ASCII

$tmpDest = $SERVER + ":/tmp/flourish-deploy.sh"
& scp @SSH_OPTS $tmpScript $tmpDest
& ssh @SSH_OPTS $SERVER "bash /tmp/flourish-deploy.sh && rm /tmp/flourish-deploy.sh"
Remove-Item $tmpScript -Force

Write-Host ""
Write-Host "Deploy complete! http://47.93.29.237" -ForegroundColor Green
