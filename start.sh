#!/bin/bash

# 飞书 iFlow 桥接服务 - 启动脚本

# 设置环境变量
export NODE_ENV=${NODE_ENV:-production}

# 加载 .env 文件
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# 创建必要的目录
mkdir -p data/sessions
mkdir -p logs

# 启动服务
echo "启动飞书 iFlow 桥接服务..."
node src/index.js