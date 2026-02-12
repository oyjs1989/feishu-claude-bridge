# Go 重构评估报告（修正版）

## 目标澄清

### 原架构
```
飞书消息 → WebSocket → Bridge Service → iFlow CLI → 结果返回飞书
```

### 新架构
```
飞书消息 → WebSocket → Bridge Service → Claude Code → 结果返回飞书
```

**关键变化：** 只替换 iFlow CLI → Claude Code

---

## 重新评估：需要改动的部分

### ✅ 保留不变（约 70%）

1. **WebSocketManager.js** (70行) - ✅ 完全保留
   - 飞书 WebSocket 长连接
   - 事件接收和分发

2. **FeishuSender.js** (454行) - ✅ 完全保留
   - 消息发送
   - 文件上传（图片、音频、视频、文档）
   - 富文本卡片

3. **EventHandler.js** (126行) - ⚠️ 基本保留（微调）
   - 消息解析
   - 命令分发
   - 只需修改调用接口

4. **SessionManager.js** (231行) - ✅ 完全保留
   - 会话状态管理
   - Markdown 持久化

5. **ProgressManager.js** (107行) - ✅ 完全保留
   - 进度监控
   - 定期摘要

6. **ResultAnalyzer.js** (189行) - ⚠️ 需要调整
   - 输出解析逻辑需要适配 Claude Code 的输出格式

### 🔄 需要重写（约 15%）

1. **IFlowAdapter.js** (205行) → **ClaudeCodeAdapter.js**
   - 从 `spawn iflow CLI` 改为调用 Claude Code API
   - 这是核心变化点！

### 📊 工作量统计

| 模块 | 代码行数 | 状态 | 工作量 |
|------|---------|------|--------|
| WebSocketManager | 70 | ✅ 保留 | 0天 |
| FeishuSender | 454 | ✅ 保留 | 0天 |
| SessionManager | 231 | ✅ 保留 | 0天 |
| ProgressManager | 107 | ✅ 保留 | 0天 |
| EventHandler | 126 | ⚠️ 微调 | 0.5天 |
| ResultAnalyzer | 189 | ⚠️ 调整 | 1天 |
| **IFlowAdapter** | **205** | **🔄 重写** | **2-3天** |
| 基础设施 | 203 | ✅ 保留 | 0天 |
| **总计** | **1,585** | | **3.5-4.5天** |

---

## 核心问题：如何与 Claude Code 交互？

### 关键问题
Claude Code 的通信方式是什么？

#### 方案 A：Claude Code 提供 HTTP API

```javascript
// 替换 IFlowAdapter.js 的 spawn 逻辑
async executeSkill(skillInput, sessionId) {
  const response = await fetch('http://localhost:8080/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: skillInput,
      session_id: sessionId,
      stream: false  // 或者 true 支持流式
    })
  });

  const result = await response.json();

  return {
    success: result.success,
    output: result.response,
    duration: result.duration,
    sessionId: sessionId
  };
}
```

**Go 重写复杂度：⭐⭐ (简单)**
- 使用 `net/http` 标准库
- 约 50-80 行代码

#### 方案 B：Claude Code 是 CLI 工具

```go
// Go 实现
func (a *ClaudeCodeAdapter) Execute(input string, sessionID string) (*Result, error) {
    cmd := exec.Command("claude", "chat", input)
    cmd.Env = append(os.Environ(), "CLAUDE_SESSION_ID="+sessionID)

    // ... 类似 IFlowAdapter 的逻辑
    output, err := cmd.CombinedOutput()

    return &Result{
        Success: err == nil,
        Output: string(output),
    }, err
}
```

**Go 重写复杂度：⭐ (非常简单)**
- 完全复用现有逻辑
- 只改命令名称和参数

#### 方案 C：Claude Code 提供 WebSocket

```javascript
// Node.js 实现
class ClaudeCodeAdapter {
  constructor() {
    this.ws = new WebSocket('ws://localhost:8080/chat');
  }

  async executeSkill(skillInput, sessionId) {
    return new Promise((resolve) => {
      this.ws.send(JSON.stringify({
        message: skillInput,
        session_id: sessionId
      }));

      this.ws.onmessage = (event) => {
        resolve(JSON.parse(event.data));
      };
    });
  }
}
```

**Go 重写复杂度：⭐⭐⭐ (中等)**
- 需要 `gorilla/websocket` 库
- 约 100-150 行代码

#### 方案 D：Claude Code 提供 gRPC

```go
// Go 实现
func (a *ClaudeCodeAdapter) Execute(input string, sessionID string) (*Result, error) {
    conn, _ := grpc.Dial("localhost:50051")
    client := pb.NewClaudeCodeClient(conn)

    resp, err := client.Chat(context.Background(), &pb.ChatRequest{
        Message:   input,
        SessionId: sessionID,
    })

    return &Result{
        Success: err == nil,
        Output: resp.Response,
    }, err
}
```

**Go 重写复杂度：⭐⭐⭐⭐ (较复杂)**
- 需要 protobuf 定义
- 约 200-300 行代码（含 proto）

---

## 重新评估：Go 重构方案

### 方案 1：部分重构（推荐）

**只用 Go 重写 Adapter 层**

```
飞书模块 (Node.js) ← 保持不变
    ↓
EventHandler (Node.js) ← 保持不变
    ↓
ClaudeCodeAdapter (Go) ← 重写这部分
    ↓
Claude Code
```

**实现方式：**
- Go 编写 HTTP 微服务
- Node.js 通过 HTTP 调用 Go 服务
- Go 服务负责与 Claude Code 交互

**优势：**
- ✅ 最小改动（飞书集成保持不变）
- ✅ 快速开发（3-5天）
- ✅ 渐进式迁移
- ✅ 风险最低

**架构：**
```
┌──────────────────────────────────────┐
│   Node.js Bridge Service              │
│   ├─ WebSocketManager (飞书)         │
│   ├─ FeishuSender (飞书)             │
│   ├─ EventHandler                    │
│   └─ SessionManager                  │
└────────────┬─────────────────────────┘
             │ HTTP
             ↓
┌──────────────────────────────────────┐
│   Go Adapter Service                  │
│   └─ ClaudeCodeAdapter                │
└────────────┬─────────────────────────┘
             │
             ↓
     Claude Code API/CLI
```

**代码量：** 约 200-300 行 Go 代码

### 方案 2：完全重构

**全部用 Go 重写**

**需要处理：**
1. 飞书 Go SDK 集成（**问题：飞书官方 Go SDK 功能可能不如 Node.js SDK**）
2. WebSocket 长连接管理
3. 所有业务逻辑

**优势：**
- ✅ 性能最优
- ✅ 单一技术栈
- ✅ 部署简单（单一二进制）

**劣势：**
- ❌ 开发周期长（10-14天）
- ❌ 飞书 Go SDK 可能功能受限
- ❌ 需要重新测试飞书集成
- ❌ 风险较高

---

## 关键决策点

### 🎯 首要问题：Claude Code 的通信方式是什么？

请提供以下信息：

1. **Claude Code 是 CLI 工具还是提供 API？**
   - CLI：`claude chat "your prompt"`
   - HTTP API：`POST http://localhost:8080/chat`
   - WebSocket：`ws://localhost:8080/chat`
   - 其他？

2. **Claude Code 的输入输出格式？**
   - 输入：纯文本？JSON？
   - 输出：纯文本？JSON？流式？

3. **是否需要会话管理？**
   - 每次调用独立？
   - 需要传递会话上下文？

4. **是否有速率限制或并发限制？**

---

## 推荐方案：混合架构（最佳性价比）

### 架构设计

```
┌────────────────────────────────────────────────────────┐
│              Node.js Bridge Service                     │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                │
│  │   飞书模块    │    │  业务逻辑     │                │
│  │              │    │              │                │
│  │ WebSocket    │───▶│ EventHandler │                │
│  │ Manager      │    │ Session Mgr  │                │
│  │              │    │ Progress Mgr │                │
│  │ FeishuSender │◀───│ Result       │                │
│  │              │    │ Analyzer     │                │
│  └──────────────┘    └───────┬──────┘                │
│                              │                        │
└──────────────────────────────┼────────────────────────┘
                               │ HTTP/gRPC
                               ↓
┌──────────────────────────────────────────────────────┐
│              Go Adapter Service                       │
│                                                       │
│  ┌─────────────────────────────────────────┐        │
│  │      ClaudeCodeAdapter                   │        │
│  │                                          │        │
│  │  ├─ HTTP Client / CLI Executor          │        │
│  │  ├─ Request Queue                       │        │
│  │  ├─ Retry Logic                         │        │
│  │  ├─ Timeout Control                     │        │
│  │  └─ Response Parser                     │        │
│  └─────────────────────────────────────────┘        │
│                                                       │
└───────────────────────┬───────────────────────────────┘
                        │
                        ↓
                 Claude Code API/CLI
```

### 开发周期：5-7 天

**Day 1: 架构设计**
- 确定 Claude Code 的通信方式
- 设计接口协议
- 定义数据结构

**Day 2-3: Go Adapter 开发**
- 实现 ClaudeCodeAdapter
- HTTP 服务器
- 错误处理和重试

**Day 4: Node.js 集成**
- 修改 IFlowAdapter → 调用 Go 服务
- 修改 ResultAnalyzer → 适配 Claude Code 输出
- 修改 EventHandler → 调整命令格式

**Day 5: 测试**
- 单元测试
- 集成测试
- 端到端测试

**Day 6-7: 优化与文档**
- 性能优化
- 错误处理完善
- 部署文档

### 代码量估算

```
Go Adapter Service:     200-300 行
Node.js 修改:          100-150 行
测试代码:              200-300 行
──────────────────────────────
总计:                  500-750 行
```

### 难度评级：⭐⭐⭐ (中等)

**降低难度的因素：**
- ✅ 飞书集成保持不变（最复杂的部分）
- ✅ 核心业务逻辑保持不变
- ✅ 只需适配一个模块

**增加难度的因素：**
- ⚠️ 需要协调两种语言
- ⚠️ 需要设计通信协议
- ⚠️ Claude Code 的具体 API 未知

---

## 最小 PoC 方案

### 1 天验证可行性

```go
// main.go - Go Adapter Service (约 100 行)
package main

import (
    "encoding/json"
    "net/http"
    "os/exec"
)

type ChatRequest struct {
    Message   string `json:"message"`
    SessionID string `json:"session_id"`
}

type ChatResponse struct {
    Success  bool   `json:"success"`
    Response string `json:"response"`
    Duration int64  `json:"duration_ms"`
}

func chatHandler(w http.ResponseWriter, r *http.Request) {
    var req ChatRequest
    json.NewDecoder(r.Body).Decode(&req)

    // 调用 Claude Code（假设是 CLI）
    cmd := exec.Command("claude", "chat", req.Message)
    output, err := cmd.CombinedOutput()

    resp := ChatResponse{
        Success:  err == nil,
        Response: string(output),
    }

    json.NewEncoder(w).Encode(resp)
}

func main() {
    http.HandleFunc("/chat", chatHandler)
    http.ListenAndServe(":8080", nil)
}
```

```javascript
// Node.js 修改 (约 30 行)
// src/modules/ClaudeCodeAdapter.js
const axios = require('axios');

class ClaudeCodeAdapter {
  async executeSkill(skillInput, sessionId) {
    const response = await axios.post('http://localhost:8080/chat', {
      message: skillInput,
      session_id: sessionId
    });

    return {
      success: response.data.success,
      output: response.data.response,
      duration: response.data.duration_ms,
      sessionId: sessionId
    };
  }
}

module.exports = new ClaudeCodeAdapter();
```

---

## 总结与建议

### ✅ 推荐：混合架构（Node.js + Go）

**理由：**
1. **最小改动**：飞书集成保持不变（70% 代码）
2. **快速开发**：5-7 天完成
3. **风险可控**：飞书部分已验证稳定
4. **渐进式**：未来可逐步迁移更多模块到 Go

### 🚀 立即行动

**首要任务：** 确认 Claude Code 的通信方式

然后我可以立即帮你：
1. 设计详细的接口协议
2. 生成 Go Adapter 代码框架
3. 提供 Node.js 修改方案
4. 编写测试用例

### 💡 关键问题

**请告诉我：Claude Code 如何调用？**
- CLI 命令行？
- HTTP API？
- WebSocket？
- 其他方式？

**有了这个信息，我可以给出精确的实现方案。**
