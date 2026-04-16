#!/bin/bash
# 运营小助手 - 双击启动脚本
# 会自动:检查依赖、启动服务、打开浏览器

cd "$(dirname "$0")"

echo ""
echo "🌸 ========================================"
echo "   运营小助手 正在启动..."
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未检测到 Node.js"
  echo ""
  echo "请先安装 Node.js (版本 ≥ 18):"
  echo "  官网下载: https://nodejs.org/zh-cn"
  echo "  或用 Homebrew: brew install node"
  echo ""
  read -p "按回车键关闭窗口..."
  exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js 版本: $NODE_VERSION"

# 自动安装依赖
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 首次启动,正在安装依赖(约30秒)..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败,请检查网络"
    read -p "按回车键关闭窗口..."
    exit 1
  fi
fi

# 如果没有 .env,提示用户
if [ ! -f ".env" ]; then
  echo ""
  echo "⚠️  未检测到 .env 配置文件"
  echo "   当前将以【规则模式】运行(字段为占位值)"
  echo "   如需 AI 分析,请复制 .env.example 为 .env 并填入 LLM_API_KEY"
  echo ""
fi

# 找空闲端口(默认 3000,占用则顺延)
PORT=${PORT:-3000}
while lsof -i:$PORT >/dev/null 2>&1; do
  PORT=$((PORT+1))
done

echo ""
echo "🚀 启动服务于端口 $PORT ..."
echo "========================================"
echo ""

# 延迟 1.5 秒后打开浏览器
(sleep 1.5 && open "http://localhost:$PORT") &

# 启动服务(前台运行,关闭窗口即停止)
PORT=$PORT node server.js
