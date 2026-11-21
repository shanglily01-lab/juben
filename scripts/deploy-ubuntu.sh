#!/usr/bin/env bash
# 在 Amazon EC2 的 Ubuntu 上部署大黄书。可重复执行：第一次装环境，之后只更新代码并重启。
#
# 事前：
#   1. 安全组放行 22、80、443。
#   2. dahuangshu.vip 和 www.dahuangshu.vip 的 A 记录指向这台机器的公网 IP。
#   3. 把本仓库放到服务器上（git clone 或 scp 均可）。
#
# 第一次：
#   sudo CERTBOT_EMAIL=你的邮箱 bash scripts/deploy-ubuntu.sh
# 以后更新：
#   sudo bash scripts/deploy-ubuntu.sh
#
# 激活邮件在正式环境必须配置 SMTP。签发证书前注册会发信失败。
# 发信参数写在 /etc/dahuangshu.env，改完执行 systemctl restart dahuangshu。

set -euo pipefail

DOMAIN="${DOMAIN:-dahuangshu.vip}"
WWW_DOMAIN="${WWW_DOMAIN:-www.dahuangshu.vip}"
APP_USER="${APP_USER:-dahuangshu}"
APP_DIR="${APP_DIR:-/opt/dahuangshu}"
DATA_DIR="${DATA_DIR:-/var/lib/dahuangshu}"
ENV_FILE="${ENV_FILE:-/etc/dahuangshu.env}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@dahuangshu.vip}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请用 root 运行：sudo bash scripts/deploy-ubuntu.sh" >&2
  exit 1
fi

if [[ ! -f /etc/os-release ]] || ! grep -q '^ID=ubuntu$' /etc/os-release; then
  echo "这个脚本只适用于 Ubuntu。" >&2
  exit 1
fi

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$SRC/package.json" || ! -f "$SRC/package-lock.json" ]]; then
  echo "请在仓库里运行这个脚本。当前目录是 $SRC" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=l
mkdir -p /etc/needrestart/conf.d
printf '%s\n' '$nrconf{restart} = "l";' > /etc/needrestart/conf.d/no-restart.conf

echo "==> 安装系统包"
apt-get update
apt-get install -y ca-certificates curl gnupg rsync nginx certbot python3-certbot-nginx openssl

if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  echo "==> 安装 Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)'

echo "==> 安装 npm 11"
# 系统自带的 npm 10 会把当前 lock 文件判成不同步，npm ci 直接失败。
npm install -g npm@11

mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
if [[ "$mem_kb" -lt 3500000 ]] && ! swapon --show | grep -q .; then
  echo "==> 内存不足 3.5 GB，添加 2 GB 交换分区，避免构建时系统卡死并断开 SSH"
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
  fi
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$APP_DIR" "$DATA_DIR"
chown "$APP_USER:$APP_USER" "$DATA_DIR"
chmod 750 "$DATA_DIR"

if [[ "$SRC" != "$APP_DIR" ]]; then
  echo "==> 同步代码到 $APP_DIR"
  rsync -a --delete \
    --exclude node_modules \
    --exclude .next \
    --exclude data \
    --exclude exports \
    --exclude .git \
    --exclude .env \
    --exclude .env.local \
    --exclude .env.production \
    "$SRC/" "$APP_DIR/"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> 生成 $ENV_FILE"
  secret="$(openssl rand -base64 48 | tr -d '\n')"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
APP_ORIGIN=https://${DOMAIN}
SESSION_SECRET=${secret}
MOBEN_DATA_DIR=${DATA_DIR}
# 正式环境不配 SMTP 时，注册激活信发不出去。填好后重启服务。
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_SECURE=0
# SMTP_USER=
# SMTP_PASS=
# MAIL_FROM=大黄书 <noreply@${DOMAIN}>
# AI_BASE_URL=https://api.deepseek.com/v1
# AI_API_KEY=
# AI_MODEL=deepseek-chat
EOF
  chmod 600 "$ENV_FILE"
else
  echo "==> 保留已有的 $ENV_FILE"
fi

echo "==> 安装依赖并构建"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
# npm ci 会因可选依赖 @emnapi/core 未写入 lock 而失败。安装后还原 lock，避免下次拉取被本地改动挡住。
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm install --no-audit --no-fund && git checkout -- package-lock.json && NODE_OPTIONS='--max-old-space-size=1024' npm run build"

echo "==> 写入 systemd"
cat > /etc/systemd/system/dahuangshu.service <<EOF
[Unit]
Description=大黄书剧本小说网
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${APP_DIR}/node_modules/.bin/next start -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable dahuangshu
systemctl restart dahuangshu

echo "==> 写入 Nginx"
cat > /etc/nginx/sites-available/dahuangshu <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/dahuangshu /etc/nginx/sites-enabled/dahuangshu
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
  echo "==> 证书已存在，跳过申请"
else
  echo "==> 申请 Let's Encrypt 证书"
  if ! certbot --nginx --non-interactive --agree-tos \
    -m "$CERTBOT_EMAIL" \
    -d "$DOMAIN" -d "$WWW_DOMAIN" \
    --redirect; then
    echo "证书没有签下来。确认 DNS 已经指向这台机器后，执行：" >&2
    echo "  sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN} --redirect" >&2
  fi
fi

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -o /dev/null "http://127.0.0.1:3000/"; then
    echo "站点已在本机 3000 端口响应。"
    echo "对外地址：https://${DOMAIN}"
    echo "发信配置：${ENV_FILE}"
    echo "查看日志：journalctl -u dahuangshu -f"
    exit 0
  fi
  sleep 1
done

echo "服务已安装，但本机 3000 端口还没有返回页面。查看日志：journalctl -u dahuangshu -n 80" >&2
exit 1
