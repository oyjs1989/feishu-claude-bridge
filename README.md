# 飞书 Claude 桥接服务

通过飞书消息与 Claude CLI 进行对话的桥接服务。

## 功能特性

- 📨 **消息接收**: 通过 WebSocket 长连接实时接收飞书消息
- 🤖 **AI 对话**: 调用 Claude CLI 处理用户请求
- 📁 **文件回传**: 自动识别并回传 Claude 生成的文件
  - 📷 图片: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`
  - 🎵 音频: `.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`, `.m4a`
  - 🎬 视频: `.mp4`, `.avi`, `.mov`, `.mkv`, `.flv`, `.webm`
  - 📄 文档: `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.pdf`, `.txt`, `.csv`, `.md`
- 📊 **进度监控**: 实时监控长时间任务执行进度
- 💬 **富文本**: 支持飞书富文本消息显示
- 🔐 **安全**: 飞书官方 SDK v1.58.0

## 技术栈

- **Node.js** >= 16.0.0
- **@larksuiteoapi/node-sdk** v1.58.0 - 飞书官方 SDK
- **Claude CLI** - Claude Code 命令行工具
- **WebSocket** - 长连接通信
- **PM2** - 进程管理（可选）

## 前置要求

1. **Node.js 环境** >= 16.0.0
2. **Claude CLI** 已安装并可用
   ```bash
   # 确认 Claude CLI 可用
   claude --version
   ```
3. **飞书应用** 已创建并配置

## 安装

```bash
# 克隆仓库
git clone git@github.com:oyjs1989/feishu-claude-bridge.git
cd feishu-claude-bridge

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入飞书应用的配置
```

## 配置

### 环境变量

创建 `.env` 文件并配置以下变量：

```bash
# 飞书应用配置
FEISHU_APP_ID=your-app-id
FEISHU_APP_SECRET=your-app-secret
FEISHU_ENCRYPT_KEY=your-encrypt-key
FEISHU_VERIFICATION_TOKEN=your-verification-token

# Claude CLI 配置
CLAUDE_CLI_PATH=claude                # Claude CLI 命令路径，默认为 "claude"

# 执行配置
TIMEOUT_PER_STEP=300                  # 每步超时时间（秒），默认 300

# 进度监控配置
PROGRESS_INTERVAL=180                 # 进度报告间隔（秒），默认 180
PROGRESS_ENABLED=true                 # 是否启用进度监控，默认 true

# 会话配置
SESSION_TIMEOUT=3600                  # 会话超时时间（秒），默认 3600
SESSION_DIR=./data/sessions           # 会话数据目录

# 日志配置
LOG_LEVEL=info                        # 日志级别，默认 info
LOG_DIR=./logs                        # 日志目录
```

## 使用

### 启动服务

```bash
# 直接启动
npm start

# 开发模式（自动重启）
npm run dev

# 使用 PM2 启动（推荐生产环境）
pm2 start src/index.js --name feishu-claude-bridge
```

### 在飞书中使用

在配置好的飞书群聊中直接发送消息，Claude 会自动响应：

```
帮我写一个 JavaScript 排序函数
解释一下什么是闭包
生成一个小猫的图片
```

## 架构设计

```
┌─────────────┐     WebSocket      ┌──────────────┐
│   飞书群聊   │ <─────────────────> │  桥接服务    │
└─────────────┘                     └──────┬───────┘
                                             │
                                             │ Claude CLI
                                             ▼
                                    ┌──────────────┐
                                    │  Claude Code │
                                    └──────────────┘
```

### 核心模块

- **WebSocketManager**: WebSocket 长连接管理
- **EventHandler**: 飞书事件处理与消息路由
- **FeishuSender**: 飞书消息发送与文件上传
- **ClaudeAdapter**: Claude CLI 适配器
- **ProgressManager**: 进度监控
- **ResultAnalyzer**: 结果分析
- **SessionManager**: 会话管理

### 工作流程

1. 用户在飞书发送消息
2. WebSocketManager 接收消息事件
3. EventHandler 解析并提取用户输入
4. ClaudeAdapter 调用 Claude CLI
5. ResultAnalyzer 分析 Claude 的响应
6. FeishuSender 将结果发送回飞书
7. 如果有文件生成，自动识别并上传

## 文档

- [系统架构设计](docs/系统架构设计.md)
- [核心模块设计](docs/核心模块设计.md)
- [接口设计](docs/接口设计.md)
- [数据存储设计](docs/数据存储设计.md)
- [CLI通信机制分析](docs/CLI通信机制分析.md)
- [Go重构评估](docs/Go重构评估_修正版.md)

## Docker 支持

```bash
# 构建镜像
docker build -t feishu-claude-bridge .

# 运行容器
docker run -d --name feishu-claude-bridge \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/data:/app/data \
  -e FEISHU_APP_ID=your-app-id \
  -e FEISHU_APP_SECRET=your-app-secret \
  -e CLAUDE_CLI_PATH=claude \
  feishu-claude-bridge
```

## 故障排查

### Claude CLI 不可用

```bash
# 检查 Claude CLI 是否安装
which claude

# 测试 Claude CLI
claude "Hello"
```

### 飞书连接失败

1. 检查飞书应用配置是否正确
2. 确认网络连接正常
3. 查看日志文件 `logs/` 目录

### 消息无响应

1. 检查飞书群聊是否正确配置
2. 查看服务日志是否有错误
3. 确认 Claude CLI 运行正常

## 开发

### 项目结构

```
feishu-claude-bridge/
├── src/
│   ├── modules/          # 核心模块
│   │   ├── ClaudeAdapter.js
│   │   ├── EventHandler.js
│   │   ├── FeishuSender.js
│   │   ├── WebSocketManager.js
│   │   ├── SessionManager.js
│   │   ├── ProgressManager.js
│   │   └── ResultAnalyzer.js
│   ├── utils/            # 工具函数
│   └── index.js          # 入口文件
├── config/               # 配置文件
├── docs/                 # 文档
├── data/                 # 运行时数据
└── logs/                 # 日志文件
```

### 添加新功能

1. 在 `src/modules/` 创建新模块
2. 在相应位置引入并使用
3. 更新配置文件（如需要）
4. 编写测试
5. 更新文档

## 许可证

MIT

## 作者

oyjs1989

## 致谢

本项目基于 [feishu-iflow-bridge](https://github.com/Wuguoshuo/feishu-iflow-bridge) 改造而来。

## 链接

- [GitHub 仓库](https://github.com/oyjs1989/feishu-claude-bridge)
- [Claude CLI](https://claude.ai/code)
- [飞书开放平台](https://open.feishu.cn/)
