# 飞书 iFlow 桥接服务

通过飞书消息调用 iFlow CLI 执行任务的桥接服务。

## 功能特性

- 📨 **消息接收**: 通过 WebSocket 长连接实时接收飞书消息
- 🤖 **命令执行**: 调用 iFlow CLI 执行用户指定的命令
- 📁 **文件回传**: 支持多种格式的文件自动回传
  - 📷 图片: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`
  - 🎵 音频: `.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`, `.m4a`
  - 🎬 视频: `.mp4`, `.avi`, `.mov`, `.mkv`, `.flv`, `.webm`
  - 📄 文档: `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.pdf`, `.txt`, `.csv`, `.md`
- 📊 **进度监控**: 实时监控任务执行进度
- 💬 **富文本**: 支持富文本消息发送
- 🔐 **安全**: 飞书官方 SDK v1.58.0

## 技术栈

- **Node.js** >= 16.0.0
- **@larksuiteoapi/node-sdk** v1.58.0
- **WebSocket** - 长连接通信
- **PM2** - 进程管理

## 安装

```bash
# 克隆仓库
git clone https://github.com/Wuguoshuo/feishu-iflow-bridge.git
cd feishu-iflow-bridge

# 安装依赖
npm install

# 配置环境变量
cp config/default.js config/config.js
# 编辑 config/config.js, 填入飞书应用的 App ID 和 App Secret
```

## 配置

在 `config/config.js` 中配置:

```javascript
module.exports = {
  appId: 'your-app-id',           // 飞书应用 ID
  appSecret: 'your-app-secret',   // 飞书应用密钥
  chatId: 'your-chat-id',         // 目标群聊 ID
  // ... 其他配置
};
```

## 使用

### 启动服务

```bash
# 直接启动
npm start

# 使用 PM2 启动 (推荐)
pm2 start src/index.js --name feishu-iflow-bridge
```

### 发送命令

在飞书中发送消息到配置的群聊:

```
检查当前环境
生成一个小猫的图片
回传生成的文件
```

## 架构设计

```
┌─────────────┐     WebSocket      ┌──────────────┐
│   飞书群聊   │ <─────────────────> │  桥接服务    │
└─────────────┘                     └──────┬───────┘
                                             │
                                             │ iFlow CLI
                                             ▼
                                    ┌──────────────┐
                                    │  iFlow 系统  │
                                    └──────────────┘
```

### 核心模块

- **WebSocketManager**: WebSocket 长连接管理
- **EventHandler**: 飞书事件处理
- **FeishuSender**: 飞书消息发送
- **IFlowAdapter**: iFlow CLI 适配器
- **ProgressManager**: 进度监控
- **ResultAnalyzer**: 结果分析
- **SessionManager**: 会话管理

## 文档

- [接口设计](docs/接口设计.md)
- [数据存储设计](docs/数据存储设计.md)
- [核心模块设计](docs/核心模块设计.md)
- [系统架构设计](docs/系统架构设计.md)

## Docker 支持

```bash
# 构建镜像
docker build -t feishu-iflow-bridge .

# 运行容器
docker run -d --name feishu-iflow-bridge \
  -v $(pwd)/config:/app/config \
  -e APP_ID=your-app-id \
  -e APP_SECRET=your-app-secret \
  feishu-iflow-bridge
```

## 许可证

MIT

## 作者

Wuguoshuo

## 链接

- [GitHub 仓库](https://github.com/Wuguoshuo/feishu-iflow-bridge)
