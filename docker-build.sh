#!/bin/bash

# 飞书 iFlow 桥接服务 - Docker 部署脚本

echo "开始构建 Docker 镜像..."

# 构建镜像
docker build -t feishu-iflow-bridge:latest .

echo "Docker 镜像构建完成!"
echo "运行以下命令启动服务:"
echo "  docker run -d --name feishu-iflow-bridge \\"
echo "    -p 3000:3000 \\"
echo "    -v \$(pwd)/data:/app/data \\"
echo "    -v \$(pwd)/logs:/app/logs \\"
echo "    --env-file .env \\"
echo "    feishu-iflow-bridge:latest"