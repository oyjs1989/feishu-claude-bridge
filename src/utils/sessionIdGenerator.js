const crypto = require('crypto');

/**
 * 生成唯一的会话 ID
 * @returns {string} 会话 ID
 */
function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `session_${timestamp}_${random}`;
}

/**
 * 从飞书事件中提取会话 ID（兼容旧格式）
 * @param {Object} event - 飞书事件对象
 * @returns {string} 会话 ID
 */
function extractSessionIdFromEvent(event) {
  // 使用用户 ID + 群组 ID + 时间戳作为会话标识
  const userId = event?.sender?.sender_id?.user_id || event?.sender?.user_id || 'unknown';
  const chatId = event?.chat_id || event?.message?.chat_id || 'unknown';
  const timestamp = Date.now().toString(36);
  const hash = crypto.createHash('md5').update(`${userId}_${chatId}`).digest('hex').substring(0, 8);
  return `session_${hash}_${timestamp}`;
}

/**
 * 从 chatId 和 senderId 生成会话 ID
 * @param {string} chatId - 聊天 ID
 * @param {string} senderId - 发送者 ID
 * @returns {string} 会话 ID
 */
function extractSessionId(chatId, senderId) {
  // 使用用户 ID + 群组 ID + 时间戳作为会话标识
  const userId = senderId || 'unknown';
  const chatIdStr = chatId || 'unknown';
  const timestamp = Date.now().toString(36);
  const hash = crypto.createHash('md5').update(`${userId}_${chatIdStr}`).digest('hex').substring(0, 8);
  return `session_${hash}_${timestamp}`;
}

module.exports = {
  generateSessionId,
  extractSessionId,
  extractSessionIdFromEvent
};