require('dotenv').config();
const WebSocketManager = require('./modules/WebSocketManager');
const EventHandler = require('./modules/EventHandler');
const ProgressManager = require('./modules/ProgressManager');
const SessionManager = require('./modules/SessionManager');
const IFlowAdapter = require('./modules/IFlowAdapter');
const logger = require('./utils/logger');
const config = require('../config/default');

/**
 * 飞书 iFlow 桥接服务 - 主入口文件
 */

class BridgeService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    logger.info('正在初始化飞书 iFlow 桥接服务...');

    // 检查 iFlow CLI 是否可用
    const iflowAvailable = await IFlowAdapter.isAvailable();
    if (!iflowAvailable) {
      logger.warn('iFlow CLI 不可用，某些功能可能无法正常工作');
    } else {
      const version = await IFlowAdapter.getVersion();
      logger.info('iFlow CLI 版本', { version });
    }

    // 启动进度监控
    ProgressManager.start();

    // 注册事件处理器
    WebSocketManager.addEventHandler((event) => {
      EventHandler.handle(event);
    });

    logger.info('飞书 iFlow 桥接服务初始化完成');
  }

  /**
   * 启动服务
   */
  async start() {
    if (this.isRunning) {
      logger.warn('服务已在运行中');
      return;
    }

    try {
      await this.initialize();

      logger.info('正在启动飞书 WebSocket 连接...');
      await WebSocketManager.connect();

      this.isRunning = true;
      logger.info('✅ 飞书 iFlow 桥接服务已启动');

      // 输出服务信息
      this.printServiceInfo();

    } catch (error) {
      logger.error('启动服务失败', { error: error.message });
      process.exit(1);
    }
  }

  /**
   * 停止服务
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('正在停止飞书 iFlow 桥接服务...');

    // 停止 WebSocket 连接
    WebSocketManager.disconnect();

    // 停止进度监控
    ProgressManager.stop();

    // 清理过期会话
    await SessionManager.cleanupExpiredSessions();

    this.isRunning = false;
    logger.info('✅ 飞书 iFlow 桥接服务已停止');
  }

  /**
   * 打印服务信息
   */
  printServiceInfo() {
    console.log('\n========================================');
    console.log('  飞书 iFlow 桥接服务');
    console.log('========================================');
    console.log(`  环境模式: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  YOLO 模式: ${config.execution.yoloMode ? '启用' : '禁用'}`);
    console.log(`  Superpowers: ${config.iflow.superpowersEnabled ? '启用' : '禁用'}`);
    console.log(`  进度监控: ${config.progress.enabled ? `启用 (${config.progress.interval}秒)` : '禁用'}`);
    console.log(`  最大循环深度: ${config.execution.maxLoopDepth}`);
    console.log(`  每步超时: ${config.execution.timeoutPerStep}秒`);
    console.log('========================================\n');
  }
}

// 创建服务实例
const service = new BridgeService();

// 处理进程信号
process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号');
  await service.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号');
  await service.stop();
  process.exit(0);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', { error: error.message, stack: error.stack });
  service.stop().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝', { reason });
});

// 启动服务
service.start().catch((error) => {
  logger.error('服务启动失败', { error: error.message });
  process.exit(1);
});

module.exports = BridgeService;