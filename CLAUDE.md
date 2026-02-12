# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a bridge service that connects Feishu (Lark) messaging with iFlow CLI. Users send messages in Feishu chat, which are received via WebSocket, then forwarded as Skill invocations to the iFlow CLI. The service automatically sends execution results back to Feishu, including any generated files (images, audio, video, documents).

## Essential Commands

### Development
```bash
# Start service
npm start

# Development with auto-reload
npm run dev

# Using PM2 (recommended for production)
pm2 start src/index.js --name feishu-iflow-bridge
```

### Configuration
Copy `config/default.js` to `config/config.js` and fill in Feishu credentials. All configuration is environment variable based:
- `FEISHU_APP_ID`, `FEISHU_APP_SECRET` - Feishu app credentials
- `IFLOW_CLI_PATH` - Path to iFlow CLI executable (defaults to 'iflow')
- `YOLO_MODE` - Auto-confirm mode (default: true)
- `SUPERPOWERS_ENABLED` - Enable superpowers mode (default: true)
- `MAX_LOOP_DEPTH` - Maximum execution loop depth (default: 100)
- `TIMEOUT_PER_STEP` - Timeout per step in seconds (default: 300)
- `PROGRESS_INTERVAL` - Progress report interval in seconds (default: 180)

## Architecture

### Core Flow
1. **WebSocketManager** establishes long connection to Feishu Hubble API
2. **EventHandler** receives and validates incoming messages
3. **IFlowAdapter** executes iFlow CLI with Skill invocations
4. **ResultAnalyzer** parses execution results
5. **FeishuSender** sends results back to Feishu, auto-uploading any files found in output
6. **ProgressManager** monitors long-running tasks and sends periodic updates

### Key Design Patterns

**Message Flow**: Feishu messages are treated as direct Skill invocations. When a user sends text, it's passed to `IFlowAdapter.executeSkill()` which spawns an iFlow CLI process with the text as the skill parameter.

**File Detection**: FeishuSender scans CLI output for file paths using regex patterns, then automatically uploads and sends files based on extension:
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`
- Audio: `.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`, `.m4a`
- Video: `.mp4`, `.avi`, `.mov`, `.mkv`, `.flv`, `.webm`
- Documents: `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.pdf`, `.txt`, `.csv`, `.md`

**Session Management**: Each chat+sender combination gets a unique session ID (see `utils/sessionIdGenerator.js`). Sessions are persisted as Markdown files in `data/sessions/`, tracking execution history and loop depth.

**YOLO Mode**: When enabled (default), the `--yolo` flag is passed to iFlow CLI to auto-confirm all operations without user interaction.

### Module Responsibilities

- **WebSocketManager** (`src/modules/WebSocketManager.js`): Uses `@larksuiteoapi/node-sdk` WSClient to maintain WebSocket connection. Registers event handler for `im.message.receive_v1` events.

- **EventHandler** (`src/modules/EventHandler.js`): Validates message structure, extracts text content, prevents duplicate processing with `processingSessions` Set, routes to IFlowAdapter.

- **IFlowAdapter** (`src/modules/IFlowAdapter.js`): Spawns child processes for iFlow CLI. Key method is `executeSkill(skillInput, sessionId)` which passes session ID via `IFLOW_SESSION_ID` environment variable. Includes timeout handling and retry logic.

- **FeishuSender** (`src/modules/FeishuSender.js`): Handles all Feishu API interactions. Uses `@larksuiteoapi/node-sdk` Client for message sending. Implements file upload/send for images, audio, video, and documents. Formats rich text using Feishu interactive cards.

- **SessionManager** (`src/modules/SessionManager.js`): Manages session state in memory and persists to Markdown files. Tracks execution history, loop depth, and next phase information.

- **ProgressManager** (`src/modules/ProgressManager.js`): Runs periodic checks on active sessions, sends progress summaries to Feishu when tasks exceed the configured interval.

- **ResultAnalyzer** (`src/modules/ResultAnalyzer.js`): Parses iFlow CLI output to extract structured information (not yet read but referenced in EventHandler).

### Important Implementation Details

**Event Structure**: The Feishu SDK EventDispatcher pre-processes events. By the time they reach our handler, the event is already unpacked with structure:
```javascript
{
  message: { chat_id, content, msg_type, message_id, ... },
  sender: { sender_id, sender_type, ... }
}
```

**Message Type Detection**: Check both `msg_type` and `message_type` fields since Feishu SDK versions differ in field naming.

**File Upload**: Different file types use different Feishu API methods:
- Images: `feishuClient.im.v1.image.create()` returns `image_key`
- Other files: `feishuClient.im.file.create()` returns `file_key`
- File type parameter mapping defined in `SUPPORTED_FILE_TYPES` constant

**Process Management**: iFlow CLI processes are spawned with `shell: true` and communicate via stdio. Stdout/stderr are collected and returned in result objects. Timeouts use `setTimeout` with process.kill('SIGTERM').

## Development Notes

- All logging uses Winston logger (`src/utils/logger.js`)
- Session files are stored in `data/sessions/` as Markdown
- Log files are stored in `logs/` (configurable via `LOG_DIR`)
- The service gracefully handles SIGTERM/SIGINT for clean shutdown
- Uncaught exceptions trigger service stop before exit
