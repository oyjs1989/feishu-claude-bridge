const SessionManager = require('./SessionManager');
const IFlowAdapter = require('./IFlowAdapter');
const ResultAnalyzer = require('./ResultAnalyzer');
const ProgressManager = require('./ProgressManager');
const FeishuSender = require('./FeishuSender');
const { extractSessionId } = require('../utils/sessionIdGenerator');
const config = require('../../config/default');
const logger = require('../utils/logger');

/**
 * 事件处理器 - 处理飞书消息事件
 * 
 * 注意：根据飞书 SDK 文档，EventDispatcher 已经根据事件类型进行了分发
 * 传入的 data 参数已经是解包后的事件对象，结构如下：
 * {
 *   message: { chat_id, content, msg_type, message_id, ... },
 *   sender: { sender_id, sender_type, ... },
 *   chat_id: string (可选)
 * }
 * 
 * 参考文档: https://feishu.apifox.cn/doc-7518429
 */
class EventHandler {
  constructor() {
    this.processingSessions = new Set(); // 正在处理的会话 ID
  }

  /**
   * 处理飞书消息事件
   * @param {Object} data - 飞书事件对象（已由 EventDispatcher 解包）
   */
  async handle(data) {
    try {
      // 检查事件类型
      const eventType = data.event_type || data.type;
      
      // 处理消息已读事件
      if (eventType === 'im.message.message_read_v1') {
        this.handleMessageRead(data);
        return;
      }

      logger.info('【EventHandler】处理消息事件', { 
        hasMessage: !!data.message,
        hasChatId: !!data.message?.chat_id,
        hasSender: !!data.sender,
        dataKeys: Object.keys(data),
        fullDataPreview: JSON.stringify(data).substring(0, 800)
      });

      // 验证消息对象
      if (!data.message) {
        logger.warn('事件中没有消息对象', { data });
        return;
      }

      const message = data.message;
      
      // 解析消息内容
      let content;
      try {
        content = JSON.parse(message.content);
      } catch (parseError) {
        logger.error('解析消息内容失败', { content: message.content, error: parseError.message });
        return;
      }

      // 检查消息类型（支持 msg_type 和 message_type 两种格式）
      const msgType = message.msg_type || message.message_type;
      logger.info('消息类型检查', { 
        msgType,
        hasMsgType: !!message.msg_type,
        hasMessageType: !!message.message_type,
        messageKeys: Object.keys(message),
        messageTypeValue: message.msg_type,
        message_messageTypeValue: message.message_type
      });
      
      if (!msgType) {
        logger.warn('消息中没有类型信息', { message });
        return;
      }

      if (msgType !== 'text') {
        logger.info('忽略非文本消息', { 
          msg_type: msgType,
          message_id: message.message_id,
          expected: 'text'
        });
        return;
      }

      if (!content.text) {
        logger.warn('文本消息中没有 text 字段', { content });
        return;
      }

      const text = content.text.trim();
      if (!text) {
        logger.info('忽略空文本消息');
        return;
      }

      const chatId = message.chat_id;
      const senderId = data.sender?.sender_id;

      logger.info('收到有效消息', { 
        chatId, 
        senderId, 
        text: text.substring(0, 50),
        messageId: message.message_id
      });

      // 检查是否正在处理该会话
      const sessionId = extractSessionId(chatId, senderId);
      if (this.processingSessions.has(sessionId)) {
        logger.info('会话正在处理中，跳过', { sessionId });
        return;
      }

      // 处理消息
      await this.processMessage(chatId, senderId, text, message.message_id);

    } catch (error) {
      logger.error('处理消息事件失败', { error: error.message, stack: error.stack });
    }
  }

  /**
   * 处理消息已读事件
   * @param {Object} data - 飞书事件对象
   */
  handleMessageRead(data) {
    logger.info('【EventHandler】处理消息已读事件', { 
      messageId: data.message_id,
      readerId: data.reader?.reader_id,
      timestamp: data.timestamp
    });
    // 消息已读事件不需要特殊处理，这里只记录日志
  }

  /**
   * 处理消息
   * @param {string} chatId - 会话 ID
   * @param {string} senderId - 发送者 ID
   * @param {string} text - 消息文本
   * @param {string} messageId - 消息 ID
   */
  async processMessage(chatId, senderId, text, messageId) {
    const sessionId = extractSessionId(chatId, senderId);
    
    try {
      this.processingSessions.add(sessionId);
      
      // 发送正在处理的消息
      await FeishuSender.sendTextMessage(chatId, '🤖 正在处理您的请求，请稍候...');

      // 默认使用 Skill 模式: 将用户消息作为 skill 调用
      const skillCommand = text.trim();
      logger.info('准备调用 Skill', { sessionId, skillCommand });

      // 使用 IFlowAdapter 的 skill 执行方法（内部会调用 Skill 工具）
      const result = await IFlowAdapter.executeSkill(skillCommand, sessionId);
      
      // 分析结果
      const analysis = ResultAnalyzer.analyze(result);
      
      // 发送结果
      await FeishuSender.sendExecutionResult(chatId, result);

      // 如果有进度信息，继续监控
      if (analysis.hasProgress) {
        await ProgressManager.monitor(sessionId, chatId);
      }

    } catch (error) {
      logger.error('处理消息失败', { sessionId, error: error.message, stack: error.stack });
      await FeishuSender.sendErrorMessage(chatId, error.message);
    } finally {
      this.processingSessions.delete(sessionId);
    }
  }

  /**
   * 解析命令
   * @param {string} text - 消息文本
   * @returns {Object} { command, args }
   */
  parseCommand(text) {
    const parts = text.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    
    return { command, args };
  }
}

module.exports = new EventHandler();