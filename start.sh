#!/usr/bin/env bash
# 另一个我 - 前后端一键启动脚本

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 启动另一个我 (Other Me)..."
echo ""

# 检查后台依赖
check_dependency() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ 错误: 未找到 $1，请先安装"
        exit 1
    fi
}

check_dependency node
check_dependency npm

# 检查虚拟环境
if [ ! -d "$PROJECT_ROOT/backend/venv" ]; then
    echo "⚠️ 警告: 后端虚拟环境不存在，请先创建并安装依赖:"
    echo "   cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# 启动后端
echo "📦 启动后端 (端口 6016)..."
cd "$PROJECT_ROOT/backend"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 6016 --reload > "$PROJECT_ROOT/backend.log" 2>&1 &
BACKEND_PID=$!

# 启动前端
echo "🎨 启动前端 (端口 6018)..."
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动!"
echo "   后端 API: http://localhost:6016"
echo "   前端页面: http://localhost:6018"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 捕获中断信号，优雅退出
trap "echo ''; echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

# 等待进程
wait
