#!/bin/bash
# Mac 双击启动入口
# 检查 Docker 是否在跑，自动 compose up 并打开浏览器

cd "$(dirname "$0")"

# 1. 检查 Docker
if ! command -v docker >/dev/null 2>&1; then
  cat <<EOF

❌ 没检测到 Docker。

请先去 https://www.docker.com/products/docker-desktop 下载并安装 Docker Desktop，
装完打开它（Docker 鲸鱼图标在状态栏出现），再回来双击这个脚本。

按任意键退出...
EOF
  read -n 1
  exit 1
fi

# 2. 检查 Docker daemon 是否在运行
if ! docker info >/dev/null 2>&1; then
  cat <<EOF

⏳ Docker 还没启动。

请打开 Docker Desktop（菜单栏里找到鲸鱼图标），等它变成"绿色 Running"状态，
然后再双击这个脚本。

按任意键退出...
EOF
  read -n 1
  exit 1
fi

# 3. 启动
echo ""
echo "🎬 正在启动 播客视频生成器..."
echo ""

docker compose up -d --build

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ 启动失败，请把上面的报错截图发给开发者"
  read -n 1
  exit 1
fi

echo ""
echo "✅ 已启动，正在打开浏览器..."
sleep 2
open http://localhost:3010

cat <<EOF

==========================================
 播客视频生成器已就绪
 浏览器地址：http://localhost:3010

 关闭：在 Docker Desktop 里点停止
       或运行 docker compose down
==========================================

EOF
