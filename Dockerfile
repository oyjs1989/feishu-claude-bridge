# 使用官方 Node.js 镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 创建必要的目录
RUN mkdir -p data/sessions logs

# 暴露端口 (如果需要)
# EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 启动服务
CMD ["node", "src/index.js"]