const { Client } = require('@larksuiteoapi/node-sdk');
const config = require('../../config/default');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// 创建飞书客户端
const feishuClient = new Client({
  appId: config.feishu.appId,
  appSecret: config.feishu.appSecret
});

// 支持的文件类型映射（从扩展名映射到飞书 API 支持的 file_type）
const SUPPORTED_FILE_TYPES = {
  '.doc': 'doc',
  '.docx': 'doc',
  '.xls': 'xls',
  '.xlsx': 'xls',
  '.ppt': 'ppt',
  '.pptx': 'ppt',
  '.pdf': 'pdf',
  '.mp4': 'mp4',
  '.opus': 'opus',
  // 其他类型使用 stream
  'default': 'stream'
};

// 多媒体类型映射（用于确定消息类型）
const MEDIA_TYPES = {
  // 音频格式
  '.mp3': 'audio',
  '.wav': 'audio',
  '.aac': 'audio',
  '.ogg': 'audio',
  '.flac': 'audio',
  '.m4a': 'audio',
  // 视频格式
  '.mp4': 'video',
  '.avi': 'video',
  '.mov': 'video',
  '.mkv': 'video',
  '.flv': 'video',
  '.webm': 'video'
};

/**
 * 飞书消息发送器
 */
class FeishuSender {
  /**
   * 发送文本消息
   * @param {string} chatId - 聊天 ID
   * @param {string} content - 消息内容
   * @returns {Promise<Object>} 发送结果
   */
  async sendTextMessage(chatId, content) {
    try {
      const response = await feishuClient.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text: content })
        }
      });

      logger.info('发送文本消息成功', { chatId, messageId: response.data.message_id });
      return response.data;
    } catch (error) {
      logger.error('发送文本消息失败', { chatId, error: error.message });
      throw error;
    }
  }

  /**
   * 上传图片
   * @param {string} imagePath - 图片文件路径
   * @param {string} imageType - 图片类型 (message/avatar)
   * @returns {Promise<string>} 图片的 image_key
   */
  async uploadImage(imagePath, imageType = 'message') {
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`图片文件不存在: ${imagePath}`);
      }

      const imageBuffer = fs.readFileSync(imagePath);
      const fileName = path.basename(imagePath);
      
      logger.info('开始上传图片', { imagePath, fileName, size: imageBuffer.length });

      const response = await feishuClient.im.v1.image.create({
        data: {
          image_type: imageType,
          image: imageBuffer,
          file_name: fileName
        }
      });

      const imageKey = response.image_key;
      logger.info('图片上传成功', { imageKey });
      return imageKey;
    } catch (error) {
      logger.error('上传图片失败', { imagePath, error: error.message });
      throw error;
    }
  }

  /**
   * 上传文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} 文件的 file_key
   */
  async uploadFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const fileExt = path.extname(fileName).toLowerCase();
      
      // 映射文件类型到飞书支持的类型
      let fileType = SUPPORTED_FILE_TYPES[fileExt] || SUPPORTED_FILE_TYPES['default'];
      
      logger.info('开始上传文件', { filePath, fileName, size: fileBuffer.length, fileType });

      const response = await feishuClient.im.file.create({
        data: {
          file_type: fileType,
          file_name: fileName,
          file: fileBuffer
        }
      });

      const fileKey = response.file_key;
      logger.info('文件上传成功', { fileKey });
      return fileKey;
    } catch (error) {
      logger.error('上传文件失败', { filePath, error: error.message });
      throw error;
    }
  }

  /**
   * 发送图片消息
   * @param {string} chatId - 聊天 ID
   * @param {string} imageKey - 图片的 image_key
   * @returns {Promise<Object>} 发送结果
   */
  async sendImageMessage(chatId, imageKey) {
    try {
      const response = await feishuClient.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          msg_type: 'image',
          content: JSON.stringify({ image_key: imageKey })
        }
      });

      logger.info('发送图片消息成功', { chatId, messageId: response.data.message_id, imageKey });
      return response.data;
    } catch (error) {
      logger.error('发送图片消息失败', { chatId, imageKey, error: error.message });
      throw error;
    }
  }

  /**
   * 发送文件消息
   * @param {string} chatId - 聊天 ID
   * @param {string} fileKey - 文件的 file_key
   * @returns {Promise<Object>} 发送结果
   */
  async sendFileMessage(chatId, fileKey) {
    try {
      const response = await feishuClient.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          msg_type: 'file',
          content: JSON.stringify({ file_key: fileKey })
        }
      });

      logger.info('发送文件消息成功', { chatId, messageId: response.data.message_id, fileKey });
      return response.data;
    } catch (error) {
      logger.error('发送文件消息失败', { chatId, fileKey, error: error.message });
      throw error;
    }
  }

  /**
   * 发送音频消息
   * @param {string} chatId - 聊天 ID
   * @param {string} fileKey - 音频文件的 file_key
   * @returns {Promise<Object>} 发送结果
   */
  async sendAudioMessage(chatId, fileKey) {
    try {
      const response = await feishuClient.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          msg_type: 'audio',
          content: JSON.stringify({ file_key: fileKey })
        }
      });

      logger.info('发送音频消息成功', { chatId, messageId: response.data.message_id, fileKey });
      return response.data;
    } catch (error) {
      logger.error('发送音频消息失败', { chatId, fileKey, error: error.message });
      throw error;
    }
  }

  /**
   * 发送视频消息
   * @param {string} chatId - 聊天 ID
   * @param {string} fileKey - 视频文件的 file_key
   * @returns {Promise<Object>} 发送结果
   */
  async sendVideoMessage(chatId, fileKey) {
    try {
      const response = await feishuClient.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          msg_type: 'media',
          content: JSON.stringify({ file_key: fileKey })
        }
      });

      logger.info('发送视频消息成功', { chatId, messageId: response.data.message_id, fileKey });
      return response.data;
    } catch (error) {
      logger.error('发送视频消息失败', { chatId, fileKey, error: error.message });
      throw error;
    }
  }

  /**
   * 判断文件类型
   * @param {string} filePath - 文件路径
   * @returns {string} 文件类型 (image/audio/video/file)
   */
  getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    // 图片类型
    if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext)) {
      return 'image';
    }
    
    // 音频类型
    if (MEDIA_TYPES[ext] === 'audio') {
      return 'audio';
    }
    
    // 视频类型
    if (MEDIA_TYPES[ext] === 'video') {
      return 'video';
    }
    
    // 默认为普通文件
    return 'file';
  }

  /**
   * 上传并发送图片
   * @param {string} chatId - 聊天 ID
   * @param {string} imagePath - 图片文件路径
   * @param {string} imageType - 图片类型 (message/avatar)
   * @returns {Promise<Object>} 发送结果
   */
  async sendImage(chatId, imagePath, imageType = 'message') {
    const imageKey = await this.uploadImage(imagePath, imageType);
    return await this.sendImageMessage(chatId, imageKey);
  }

  /**
   * 上传并发送文件
   * @param {string} chatId - 聊天 ID
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 发送结果
   */
  async sendFile(chatId, filePath) {
    const fileType = this.getFileType(filePath);
    
    if (fileType === 'image') {
      return await this.sendImage(chatId, filePath);
    } else if (fileType === 'audio') {
      const fileKey = await this.uploadFile(filePath);
      return await this.sendAudioMessage(chatId, fileKey);
    } else if (fileType === 'video') {
      const fileKey = await this.uploadFile(filePath);
      return await this.sendVideoMessage(chatId, fileKey);
    } else {
      const fileKey = await this.uploadFile(filePath);
      return await this.sendFileMessage(chatId, fileKey);
    }
  }

  /**
   * 发送富文本消息
   * @param {string} chatId - 聊天 ID
   * @param {string} title - 标题
   * @param {string} content - 内容
   * @returns {Promise<Object>} 发送结果
   */
  async sendRichTextMessage(chatId, title, content) {
    try {
      // content 现在是一个二维数组，每个子数组代表一个文本元素
      // 需要将其转换为飞书卡片格式
      const cardContent = JSON.stringify({
        config: {
          wide_screen_mode: true
        },
        header: {
          template: 'blue',
          title: {
            content: title,
            tag: 'plain_text'
          }
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: content.map(line => 
                line.map(item => {
                  let text = item.text;
                  // 先去除尾部的换行符,再添加加粗标记
                  text = text.replace(/\n$/, '');
                  if (item.style === 'bold') {
                    text = `**${text}**`;
                  }
                  return text;
                }).join('')
              ).join('\n')
            }
          }
        ]
      });

      logger.info('准备发送富文本消息', { chatId, title, contentPreview: content.slice(0, 2).map(l => l[0].text).join(' ') + '...' });

      // 根据飞书 SDK v1.58.0 的正确 API 调用方式
      const response = await feishuClient.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          msg_type: 'interactive',
          content: cardContent
        }
      });

      logger.info('发送富文本消息成功', { chatId, messageId: response.data.message_id });
      return response.data;
    } catch (error) {
      logger.error('发送富文本消息失败', { 
        chatId, 
        error: error.message,
        code: error.code,
        errorData: error.response?.data,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)).substring(0, 1000)
      });
      throw error;
    }
  }

  /**
   * 格式化执行结果为富文本
   * @param {Object} result - 执行结果
   * @returns {string} 格式化后的内容
   */
  formatExecutionResult(result) {
    let content = '';
    
    // 执行状态
    const statusIcon = result.success ? '✅' : '❌';
    const statusText = result.success ? '执行成功' : '执行失败';
    content += `${statusIcon} ${statusText}\n`;
    
    // 命令
    if (result.command) {
      content += `\n**执行命令:**\n${result.command}\n`;
    }
    
    // 输出
    if (result.output) {
      const outputText = result.output.length > 500
        ? result.output.substring(0, 500) + '...'
        : result.output;
      content += `\n**执行输出:**\n\`\`\`\n${outputText}\n\`\`\`\n`;
    }
    
    // 下一阶段
    if (result.nextPhase) {
      content += `\n**下一阶段:** ${result.nextPhase}\n`;
    }
    
    // 循环深度
    if (result.loopDepth !== undefined) {
      content += `\n**循环深度:** ${result.loopDepth}\n`;
    }
    
    return content;
  }

  /**
   * 发送执行结果
   * @param {string} chatId - 聊天 ID
   * @param {Object} result - 执行结果
   * @returns {Promise<Object>} 发送结果
   */
  async sendExecutionResult(chatId, result) {
    const title = result.success ? '✅ 执行成功' : '❌ 执行失败';
    const content = this.formatExecutionResult(result);
    
    // 将文本内容转换为富文本格式
    const richContent = [
      [
        { tag: 'text', text: `${title}\n`, style: 'bold' }
      ],
      [
        { tag: 'text', text: content }
      ]
    ];
    
    // 检测并上传多媒体文件
    if (result.output) {
      const filePattern = /(?:[a-zA-Z]:\\|\/)?[\w\-\\\/\.]+\.\w+/g;
      const files = result.output.match(filePattern) || [];
      
      // 1. 图片文件
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
      const imageFiles = files.filter(file => {
        const ext = file.toLowerCase();
        return imageExtensions.some(imgExt => ext.endsWith(imgExt));
      });
      
      for (const imagePath of imageFiles) {
        try {
          if (fs.existsSync(imagePath)) {
            const imageKey = await this.uploadImage(imagePath, 'message');
            await this.sendImageMessage(chatId, imageKey);
            logger.info('图片发送成功', { imagePath, imageKey });
          }
        } catch (error) {
          logger.error('上传图片失败', { imagePath, error: error.message });
        }
      }
      
      // 2. 音频文件
      const audioExtensions = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a'];
      const audioFiles = files.filter(file => {
        const ext = file.toLowerCase();
        return audioExtensions.some(audioExt => ext.endsWith(audioExt));
      });
      
      for (const audioPath of audioFiles) {
        try {
          if (fs.existsSync(audioPath)) {
            const fileKey = await this.uploadFile(audioPath);
            await this.sendAudioMessage(chatId, fileKey);
            logger.info('音频发送成功', { audioPath, fileKey });
          }
        } catch (error) {
          logger.error('上传音频失败', { audioPath, error: error.message });
        }
      }
      
      // 3. 视频文件
      const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.webm'];
      const videoFiles = files.filter(file => {
        const ext = file.toLowerCase();
        return videoExtensions.some(videoExt => ext.endsWith(videoExt));
      });
      
      for (const videoPath of videoFiles) {
        try {
          if (fs.existsSync(videoPath)) {
            const fileKey = await this.uploadFile(videoPath);
            await this.sendVideoMessage(chatId, fileKey);
            logger.info('视频发送成功', { videoPath, fileKey });
          }
        } catch (error) {
          logger.error('上传视频失败', { videoPath, error: error.message });
        }
      }
      
      // 4. 办公文档文件
      const docExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf', '.txt', '.csv', '.md'];
      const docFiles = files.filter(file => {
        const ext = file.toLowerCase();
        return docExtensions.some(docExt => ext.endsWith(docExt));
      });
      
      for (const docPath of docFiles) {
        try {
          if (fs.existsSync(docPath)) {
            const fileKey = await this.uploadFile(docPath);
            await this.sendFileMessage(chatId, fileKey);
            logger.info('文档发送成功', { docPath, fileKey });
          }
        } catch (error) {
          logger.error('上传文档失败', { docPath, error: error.message });
        }
      }
    }
    
    return await this.sendRichTextMessage(chatId, title, richContent);
  }

  /**
   * 发送进度摘要
   * @param {string} chatId - 聊天 ID
   * @param {Object} summary - 进度摘要
   * @returns {Promise<Object>} 发送结果
   */
  async sendProgressSummary(chatId, summary) {
    let content = [];
    
    // 标题
    content.push([
      { tag: 'text', text: '📊 任务进度摘要\n', style: 'bold' }
    ]);
    
    // 当前阶段
    if (summary.currentPhase) {
      content.push([
        { tag: 'text', text: `当前阶段: ${summary.currentPhase}` }
      ]);
    }
    
    // 循环次数
    if (summary.loopCount !== undefined) {
      content.push([
        { tag: 'text', text: `已完成循环: ${summary.loopCount}` }
      ]);
    }
    
    // 总执行时间
    if (summary.totalTime) {
      content.push([
        { tag: 'text', text: `总执行时间: ${summary.totalTime}` }
      ]);
    }
    
    // 最近状态
    if (summary.lastStatus) {
      const statusEmoji = summary.lastStatus === 'success' ? '✅' : '⚠️';
      content.push([
        { tag: 'text', text: `最近状态: ${statusEmoji} ${summary.lastStatus}` }
      ]);
    }
    
    return await this.sendRichTextMessage(chatId, '📊 任务进度摘要', content);
  }

  /**
   * 发送错误消息
   * @param {string} chatId - 聊天 ID
   * @param {string} error - 错误信息
   * @returns {Promise<Object>} 发送结果
   */
  async sendErrorMessage(chatId, error) {
    const content = [
      [
        { tag: 'text', text: '❌ 发生错误\n', style: 'bold' }
      ],
      [
        { tag: 'text', text: error }
      ]
    ];
    return await this.sendRichTextMessage(chatId, '❌ 发生错误', content);
  }

  /**
   * 发送欢迎消息
   * @param {string} chatId - 聊天 ID
   * @returns {Promise<Object>} 发送结果
   */
  async sendWelcomeMessage(chatId) {
    const content = [
      [
        { tag: 'text', text: '👋 欢迎使用飞书 iFlow 桥接服务\n', style: 'bold' }
      ],
      [
        { tag: 'text', text: '发送消息即可调用 iFlow CLI 执行任务。' }
      ],
      [
        { tag: 'text', text: '\n功能特性:' }
      ],
      [
        { tag: 'text', text: '• 自动识别执行结果并继续处理' }
      ],
      [
        { tag: 'text', text: '• 支持 YOLO 模式（自动确认）' }
      ],
      [
        { tag: 'text', text: '• 默认启用 superpowers 技能' }
      ],
      [
        { tag: 'text', text: '• 长时间任务自动输出进度摘要' }
      ]
    ];
    
    return await this.sendRichTextMessage(chatId, '👋 欢迎', content);
  }
}

module.exports = new FeishuSender();
