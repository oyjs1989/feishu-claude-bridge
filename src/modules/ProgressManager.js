const config = require('../../config/default');
const FeishuSender = require('./FeishuSender');
const logger = require('../utils/logger');

/**
 * 进度管理器 - 负责长时间任务的进度监控和摘要发送
 */
class ProgressManager {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> { startTime, lastSummaryTime, loopCount }
    this.interval = config.progress.interval * 1000; // 毫秒
    this.enabled = config.progress.enabled;
    this.timer = null;
  }

  /**
   * 启动进度监控
   */
  start() {
    if (!this.enabled) {
      logger.info('进度监控已禁用');
      return;
    }

    logger.info('启动进度监控', { interval: this.interval });

    this.timer = setInterval(() => {
      this.checkProgress();
    }, this.interval);
  }

  /**
   * 停止进度监控
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('进度监控已停止');
    }
  }

  /**
   * 注册会话进行进度监控
   * @param {string} sessionId - 会话 ID
   * @param {string} chatId - 聊天 ID
   */
  registerSession(sessionId, chatId) {
    this.activeSessions.set(sessionId, {
      chatId,
      startTime: Date.now(),
      lastSummaryTime: Date.now(),
      loopCount: 0,
      lastPhase: null
    });

    logger.info('注册进度监控会话', { sessionId, chatId });
  }

  /**
   * 取消会话监控
   * @param {string} sessionId - 会话 ID
   */
  unregisterSession(sessionId) {
    if (this.activeSessions.has(sessionId)) {
      this.activeSessions.delete(sessionId);
      logger.info('取消进度监控会话', { sessionId });
    }
  }

  /**
   * 更新会话进度
   * @param {string} sessionId - 会话 ID
   * @param {Object} sessionData - 会话数据
   */
  updateProgress(sessionId, sessionData) {
    if (!this.activeSessions.has(sessionId)) {
      return;
    }

    const progress = this.activeSessions.get(sessionId);
    progress.loopCount = sessionData.loopCount || 0;
    progress.lastPhase = sessionData.nextPhase || null;

    logger.debug('更新会话进度', { sessionId, loopCount: progress.loopCount });
  }

  /**
   * 检查所有活跃会话的进度
   */
  async checkProgress() {
    const now = Date.now();

    for (const [sessionId, progress] of this.activeSessions.entries()) {
      // 检查是否需要发送进度摘要
      if (now - progress.lastSummaryTime >= this.interval) {
        await this.sendProgressSummary(sessionId, progress);
        progress.lastSummaryTime = now;
      }
    }
  }

  /**
   * 发送进度摘要
   * @param {string} sessionId - 会话 ID
   * @param {Object} progress - 进度数据
   */
  async sendProgressSummary(sessionId, progress) {
    try {
      const totalTime = this.formatDuration(Date.now() - progress.startTime);

      const summary = {
        currentPhase: progress.lastPhase || '执行中',
        loopCount: progress.loopCount,
        totalTime,
        lastStatus: 'running'
      };

      await FeishuSender.sendProgressSummary(progress.chatId, summary);

      logger.info('发送进度摘要', { sessionId, loopCount: progress.loopCount });
    } catch (error) {
      logger.error('发送进度摘要失败', { sessionId, error: error.message });
    }
  }

  /**
   * 格式化持续时间
   * @param {number} ms - 毫秒数
   * @returns {string} 格式化的时间字符串
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  /**
   * 获取会话进度信息
   * @param {string} sessionId - 会话 ID
   * @returns {Object|null} 进度信息
   */
  getProgress(sessionId) {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * 获取所有活跃会话数量
   * @returns {number} 活跃会话数
   */
  getActiveSessionCount() {
    return this.activeSessions.size;
  }
}

module.exports = new ProgressManager();