#!/bin/bash

# 飞书 iFlow 桥接服务 - 安装依赖脚本

echo "正在安装飞书 iFlow 桥接服务依赖..."

# 检查 Node.js 版本
if ! command -v node &> /dev/null; then
  echo "错误: 未安装 Node.js"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
  echo "错误: Node.js 版本必须 >= 16.0.0, 当前版本: $(node -v)"
  exit 1
fi

echo "Node.js 版本检查通过: $(node -v)"

# 安装依赖
echo "正在安装 npm 依赖..."
npm install

# 创建必要的目录
mkdir -p data/sessions
mkdir -p logs
mkdir -p config

# 检查 .env 文件
if [ ! -f .env ]; then
  echo "未找到 .env 文件, 从 .env.example 创建..."
  cp .env.example .env
  echo "请编辑 .env 文件并填写正确的配置信息"
  echo "需要配置的关键参数:"
  echo "  - FEISHU_APP_ID"
  echo "  - FEISHU_APP_SECRET"
  echo "  - FEISHU_ENCRYPT_KEY"
  echo "  - FEISHU_VERIFICATION_TOKEN"
  echo "  - IFLOW_CLI_PATH"
  exit 1
fi

echo "依赖安装完成!"
echo "运行 ./start.sh 启动服务"