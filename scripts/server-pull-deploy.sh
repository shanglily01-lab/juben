#!/usr/bin/env bash
# 在服务器上拉取代码并部署。第一次和以后更新都执行这一条。
#
# 事前：
#   1. 安全组放行 22、80、443。
#   2. dahuangshu.vip 和 www.dahuangshu.vip 的 A 记录指向这台机器的公网 IP。
#
# 不要把本文件内容直接粘贴进 SSH 窗口。粘贴后脚本里的 exit 会关掉登录会话。
# 先保存成文件，再执行：
#   sudo bash /root/server-pull-deploy.sh
# 私有仓库再加一个只在这次命令里使用的令牌，不要写进文件：
#   sudo GH_TOKEN=github_pat_xxx bash /root/server-pull-deploy.sh

set -euo pipefail

DOMAIN="${DOMAIN:-dahuangshu.vip}"
APP_DIR="${APP_DIR:-/opt/dahuangshu}"
REPO_SLUG="${REPO_SLUG:-shanglily01-lab/juben}"
BRANCH="${BRANCH:-main}"
CERTBOT_EMAIL="shanglily01@gmail.com"
PUBLIC_URL="https://github.com/${REPO_SLUG}.git"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请用 root 运行：sudo bash server-pull-deploy.sh" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=l
mkdir -p /etc/needrestart/conf.d
printf '%s\n' '$nrconf{restart} = "l";' > /etc/needrestart/conf.d/no-restart.conf

if [[ -z "${DEPLOY_DETACHED:-}" ]]; then
  export DEPLOY_DETACHED=1
  nohup bash "$0" "$@" >> /var/log/dahuangshu-deploy.log 2>&1 &
  echo "部署已转到后台。SSH 断开后也会继续。"
  echo "查看进度：tail -f /var/log/dahuangshu-deploy.log"
  exit 0
fi

apt-get update
apt-get install -y git ca-certificates

if [[ -n "${GH_TOKEN:-}" ]]; then
  FETCH_URL="https://x-access-token:${GH_TOKEN}@github.com/${REPO_SLUG}.git"
else
  FETCH_URL="$PUBLIC_URL"
fi

git_safe() {
  git -c safe.directory="$APP_DIR" -C "$APP_DIR" "$@"
}

if [[ -d "$APP_DIR/.git" ]]; then
  echo "==> 拉取 ${BRANCH}"
  git_safe remote set-url origin "$FETCH_URL"
  git_safe fetch origin "$BRANCH"
  git_safe checkout "$BRANCH"
  git_safe pull --ff-only origin "$BRANCH"
  git_safe remote set-url origin "$PUBLIC_URL"
elif [[ -e "$APP_DIR" ]] && [[ -n "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]]; then
  echo "$APP_DIR 里已有文件，但不是 git 仓库。把这个目录挪走后再运行。" >&2
  exit 1
else
  echo "==> 克隆 ${PUBLIC_URL}"
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$FETCH_URL" "$APP_DIR"
  git_safe remote set-url origin "$PUBLIC_URL"
fi

export DOMAIN APP_DIR CERTBOT_EMAIL
bash "$APP_DIR/scripts/deploy-ubuntu.sh"
