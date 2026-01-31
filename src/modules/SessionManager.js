const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const SESSION_DIR = path.join(__dirname, '../../data/sessions');

// 确保会话目录存在
async function ensureSessionDir() {
  try {
    await fs.mkdir(SESSION_DIR, { recursive: true });
  } catch (error) {
    logger.error('创建会话目录失败', { error: error.message });
  }
}

/**
 * 会话状态
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    ensureSessionDir();
  }

  /**
   * 创建新会话
   * @param {string} sessionId - 会话 ID
   * @param {Object} event - 飞书事件对象
   * @returns {Object} 会话对象
   */
  async createSession(sessionId, event) {
    const session = {
      id: sessionId,
      userId: event?.sender?.user_id || 'unknown',
      chatId: event?.chat_id || 'unknown',
      message: event?.message?.content || '',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
      loopDepth: 0,
      nextPhase: null,
      lastActivity: new Date().toISOString()
    };

    this.sessions.set(sessionId, session);
    await this.saveSession(sessionId);

    logger.info('创建新会话', { sessionId, userId: session.userId });
    return session;
  }

  /**
   * 获取会话
   * @param {string} sessionId - 会话 ID
   * @returns {Object|null} 会话对象
   */
  async getSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    // 尝试从文件加载
    try {
      const filePath = path.join(SESSION_DIR, `${sessionId}.md`);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // 从 Markdown 中解析会话数据
      const session = this.parseSessionFromMarkdown(content);
      this.sessions.set(sessionId, session);
      
      return session;
    } catch (error) {
      logger.warn('加载会话失败', { sessionId, error: error.message });
      return null;
    }
  }

  /**
   * 更新会话
   * @param {string} sessionId - 会话 ID
   * @param {Object} updates - 更新内容
   * @returns {Object} 更新后的会话
   */
  async updateSession(sessionId, updates) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    Object.assign(session, updates, {
      updatedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    });

    this.sessions.set(sessionId, session);
    await this.saveSession(sessionId);

    logger.debug('更新会话', { sessionId, updates });
    return session;
  }

  /**
   * 添加执行记录
   * @param {string} sessionId - 会话 ID
   * @param {Object} record - 执行记录
   */
  async addExecutionRecord(sessionId, record) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const executionRecord = {
      timestamp: new Date().toISOString(),
      command: record.command,
      output: record.output,
      success: record.success,
      nextPhase: record.nextPhase,
      loopDepth: session.loopDepth
    };

    session.history.push(executionRecord);
    
    // 更新循环深度
    if (record.nextPhase) {
      session.loopDepth++;
      session.nextPhase = record.nextPhase;
    }

    await this.updateSession(sessionId, session);
  }

  /**
   * 保存会话到文件
   * @param {string} sessionId - 会话 ID
   */
  async saveSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      const filePath = path.join(SESSION_DIR, `${sessionId}.md`);
      const markdown = this.formatSessionToMarkdown(session);
      await fs.writeFile(filePath, markdown, 'utf-8');
    } catch (error) {
      logger.error('保存会话失败', { sessionId, error: error.message });
    }
  }

  /**
   * 将会话转换为 Markdown 格式
   * @param {Object} session - 会话对象
   * @returns {string} Markdown 内容
   */
  formatSessionToMarkdown(session) {
    let md = `# 会话记录: ${session.id}\n\n`;
    md += `## 基本信息\n\n`;
    md += `- **会话 ID**: ${session.id}\n`;
    md += `- **用户 ID**: ${session.userId}\n`;
    md += `- **群组 ID**: ${session.chatId}\n`;
    md += `- **状态**: ${session.status}\n`;
    md += `- **创建时间**: ${session.createdAt}\n`;
    md += `- **更新时间**: ${session.updatedAt}\n`;
    md += `- **循环深度**: ${session.loopDepth}\n`;
    
    if (session.nextPhase) {
      md += `- **下一阶段**: ${session.nextPhase}\n`;
    }

    md += `\n## 原始消息\n\n`;
    md += `\`\`\`\n${session.message}\n\`\`\`\n\n`;

    md += `## 执行历史\n\n`;
    if (session.history.length === 0) {
      md += `*暂无执行记录*\n\n`;
    } else {
      session.history.forEach((record, index) => {
        md += `### 执行 #${index + 1}\n\n`;
        md += `- **时间**: ${record.timestamp}\n`;
        md += `- **命令**: ${record.command}\n`;
        md += `- **成功**: ${record.success ? '✅' : '❌'}\n`;
        if (record.nextPhase) {
          md += `- **下一阶段**: ${record.nextPhase}\n`;
        }
        md += `- **循环深度**: ${record.loopDepth}\n`;
        md += `\n**输出**:\n\n`;
        md += `\`\`\`\n${record.output}\n\`\`\`\n\n`;
      });
    }

    return md;
  }

  /**
   * 从 Markdown 解析会话
   * @param {string} markdown - Markdown 内容
   * @returns {Object} 会话对象
   */
  parseSessionFromMarkdown(markdown) {
    // 简化解析 - 实际项目中可以使用更完整的 Markdown 解析器
    const lines = markdown.split('\n');
    const session = {
      history: []
    };

    let inHistory = false;
    let currentRecord = null;

    for (const line of lines) {
      if (line.startsWith('# 会话记录:')) {
        session.id = line.split(': ')[1].trim();
      } else if (line.startsWith('- **用户 ID**:')) {
        session.userId = line.split(': ')[1].trim();
      } else if (line.startsWith('- **群组 ID**:')) {
        session.chatId = line.split(': ')[1].trim();
      } else if (line.startsWith('- **状态**:')) {
        session.status = line.split(': ')[1].trim();
      } else if (line.startsWith('- **创建时间**:')) {
        session.createdAt = line.split(': ')[1].trim();
      } else if (line.startsWith('- **更新时间**:')) {
        session.updatedAt = line.split(': ')[1].trim();
      } else if (line.startsWith('- **循环深度**:')) {
        session.loopDepth = parseInt(line.split(': ')[1].trim()) || 0;
      } else if (line.startsWith('- **下一阶段**:')) {
        session.nextPhase = line.split(': ')[1].trim();
      } else if (line.startsWith('## 原始消息')) {
        inHistory = false;
      } else if (line.startsWith('## 执行历史')) {
        inHistory = true;
      } else if (inHistory && line.startsWith('### 执行 #')) {
        if (currentRecord) {
          session.history.push(currentRecord);
        }
        currentRecord = { timestamp: '', command: '', output: '', success: true, nextPhase: null, loopDepth: 0 };
      } else if (currentRecord && line.startsWith('- **时间**:')) {
        currentRecord.timestamp = line.split(': ')[1].trim();
      } else if (currentRecord && line.startsWith('- **命令**:')) {
        currentRecord.command = line.split(': ')[1].trim();
      } else if (currentRecord && line.startsWith('- **成功**:')) {
        currentRecord.success = line.includes('✅');
      } else if (currentRecord && line.startsWith('- **下一阶段**:')) {
        currentRecord.nextPhase = line.split(': ')[1].trim();
      } else if (currentRecord && line.startsWith('- **循环深度**:')) {
        currentRecord.loopDepth = parseInt(line.split(': ')[1].trim()) || 0;
      } else if (currentRecord && line.startsWith('**输出**:')) {
        // 输出内容在下面的代码块中
      } else if (currentRecord && line.startsWith('```') && currentRecord.output === '') {
        // 开始读取输出
      } else if (currentRecord && line.startsWith('```') && currentRecord.output !== '') {
        // 结束读取输出
      } else if (currentRecord && line.startsWith('```') === false && currentRecord.output !== '' || (currentRecord && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('**'))) {
        currentRecord.output += line + '\n';
      }
    }

    if (currentRecord) {
      session.history.push(currentRecord);
    }

    // 提取原始消息（简化处理）
    const messageMatch = markdown.match(/## 原始消息\n\n```([^`]+)```/);
    if (messageMatch) {
      session.message = messageMatch[1].trim();
    }

    return session;
  }

  /**
   * 清理过期会话
   * @param {number} maxAge - 最大保留时间（毫秒）
   */
  async cleanupExpiredSessions(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessions) {
      const lastActivity = new Date(session.lastActivity).getTime();
      if (now - lastActivity > maxAge) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.deleteSession(sessionId);
    }

    logger.info('清理过期会话', { count: expiredSessions.length });
    return expiredSessions;
  }

  /**
   * 删除会话
   * @param {string} sessionId - 会话 ID
   */
  async deleteSession(sessionId) {
    this.sessions.delete(sessionId);

    try {
      const filePath = path.join(SESSION_DIR, `${sessionId}.md`);
      await fs.unlink(filePath);
      logger.info('删除会话', { sessionId });
    } catch (error) {
      logger.error('删除会话文件失败', { sessionId, error: error.message });
    }
  }

  /**
   * 获取所有活跃会话
   * @returns {Array} 会话列表
   */
  getActiveSessions() {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }
}

module.exports = new SessionManager();