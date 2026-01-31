const { WSClient, EventDispatcher, LoggerLevel } = require('@larksuiteoapi/node-sdk');
const config = require('../../config/default');
const logger = require('../utils/logger');

/**
 * WebSocket 管理器 - 管理与飞书 Hubble WebSocket 的连接
 * 参考飞书官方文档: https://feishu.apifox.cn/doc-7518429
 */
class WebSocketManager {
  constructor() {
    this.wsClient = null;
    this.isConnected = false;
    this.eventHandlers = [];
  }

  /**
   * 连接到飞书 Hubble WebSocket
   */
  async connect() {
    try {
      logger.info('正在启动飞书 WSClient 长连接...');
      
      // 创建飞书 WSClient
      this.wsClient = new WSClient({
        appId: config.feishu.appId,
        appSecret: config.feishu.appSecret,
        loggerLevel: LoggerLevel.info
      });

      // 创建事件分发器
      const eventDispatcher = new EventDispatcher({});
      
      // 注册事件处理器 - 根据飞书官方文档
      // EventDispatcher 会根据事件类型自动分发，data 参数已经是解包后的事件对象
      eventDispatcher.register({
        'im.message.receive_v1': async (data) => {
          logger.info('【飞书SDK】接收到消息事件', { 
            hasMessage: !!data.message,
            hasChatId: !!data.message?.chat_id,
            hasSender: !!data.sender,
            dataType: typeof data,
            dataKeys: Object.keys(data),
            fullDataPreview: JSON.stringify(data).substring(0, 500)
          });
          
          // 调用所有注册的处理器
          for (const handler of this.eventHandlers) {
            try {
              await handler(data);
            } catch (error) {
              logger.error('事件处理器执行失败', { error: error.message, stack: error.stack });
            }
          }
        }
      });

      // 启动长连接
      logger.info('开始调用 wsClient.start()...');
      this.wsClient.start({
        eventDispatcher: eventDispatcher
      });
      
      logger.info('✅ 飞书 WebSocket 长连接已启动');

    } catch (error) {
      logger.error('启动飞书 WSClient 失败', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * 添加事件处理器
   * @param {Function} handler - 事件处理器函数
   */
  addEventHandler(handler) {
    if (typeof handler === 'function') {
      this.eventHandlers.push(handler);
      logger.info('添加事件处理器', { total: this.eventHandlers.length });
    }
  }

  /**
   * 移除事件处理器
   * @param {Function} handler - 事件处理器函数
   */
  removeEventHandler(handler) {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
      logger.info('移除事件处理器', { total: this.eventHandlers.length });
    }
  }

  /**
   * 获取连接状态
   * @returns {boolean} 是否已连接
   */
  getConnectionStatus() {
    return this.isConnected;
  }
}

module.exports = new WebSocketManager();