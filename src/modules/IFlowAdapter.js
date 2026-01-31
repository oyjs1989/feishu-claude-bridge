const { spawn } = require('child_process');
const config = require('../../config/default');
const logger = require('../utils/logger');

/**
 * iFlow CLI 适配器
 */
class IFlowAdapter {
  constructor() {
    this.cliPath = config.iflow.cliPath;
    this.superpowersEnabled = config.iflow.superpowersEnabled;
    this.superpowersMode = config.iflow.superpowersMode;
    this.yoloMode = config.execution.yoloMode;
    this.timeoutPerStep = config.execution.timeoutPerStep;
  }

  /**
   * 执行 Skill 调用
   * 注意：iFlow CLI 中的 Skill 调用需要通过特殊的命令格式
   * 格式: iflow <skill-name> [arguments]
   * 
   * @param {string} skillInput - Skill 输入内容
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<Object>} 执行结果
   */
  async executeSkill(skillInput, sessionId) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      logger.info('执行 iFlow Skill 调用', { skillInput, sessionId });

      // 构建命令: 直接将 skillInput 作为 iflow CLI 的参数
      // iFlow CLI 会自动识别并调用相应的 Skill
      const args = [skillInput];

      // 添加 YOLO 模式参数（如果启用）
      if (this.yoloMode) {
        args.push('--yolo');
      }

      const child = spawn(this.cliPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          IFLOW_SESSION_ID: sessionId // 传递会话 ID
        }
      });

      let stdout = '';
      let stderr = '';

      // 收集标准输出
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // 收集错误输出
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // 设置超时
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        logger.error('iFlow Skill 执行超时', { skillInput, timeout: this.timeoutPerStep });
        reject(new Error(`Skill 执行超时 (${this.timeoutPerStep}秒)`));
      }, this.timeoutPerStep * 1000);

      // 处理进程退出
      child.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        const result = {
          success: code === 0,
          exitCode: code,
          output: stdout,
          error: stderr,
          duration,
          command: skillInput,
          sessionId
        };

        if (code === 0) {
          logger.info('iFlow Skill 执行成功', { skillInput, duration });
          resolve(result);
        } else {
          logger.error('iFlow Skill 执行失败', { skillInput, exitCode: code, error: stderr });
          resolve(result); // 即使失败也返回结果，由上层处理
        }
      });

      // 处理进程错误
      child.on('error', (error) => {
        clearTimeout(timeout);
        logger.error('iFlow Skill 进程错误', { skillInput, error: error.message });
        reject(error);
      });
    });
  }

  /**
   * 构建 iFlow CLI 命令参数
   * @param {string} input - 输入命令
   * @param {Object} options - 执行选项
   * @returns {Array} 命令参数数组
   */
  buildCommandArgs(input, options = {}) {
    const args = [];

    // 添加 YOLO 模式参数 (自动确认所有操作)
    if (this.yoloMode && options.enableYolo !== false) {
      args.push('--yolo');
    }

    // 添加输入命令
    args.push(input);

    return args;
  }

  /**
   * 执行 iFlow CLI 命令
   * @param {string} input - 输入命令
   * @param {Object} options - 执行选项
   * @returns {Promise<Object>} 执行结果
   */
  async execute(input, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const args = this.buildCommandArgs(input, options);

      logger.info('执行 iFlow CLI 命令', { command: input, args });

      const child = spawn(this.cliPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';

      // 收集标准输出
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // 收集错误输出
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // 设置超时
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        logger.error('iFlow CLI 执行超时', { command: input, timeout: this.timeoutPerStep });
        reject(new Error(`命令执行超时 (${this.timeoutPerStep}秒)`));
      }, this.timeoutPerStep * 1000);

      // 处理进程退出
      child.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        const result = {
          success: code === 0,
          exitCode: code,
          output: stdout,
          error: stderr,
          duration,
          command: input
        };

        if (code === 0) {
          logger.info('iFlow CLI 执行成功', { command: input, duration });
          resolve(result);
        } else {
          logger.error('iFlow CLI 执行失败', { command: input, exitCode: code, error: stderr });
          resolve(result); // 即使失败也返回结果，由上层处理
        }
      });

      // 处理进程错误
      child.on('error', (error) => {
        clearTimeout(timeout);
        logger.error('iFlow CLI 进程错误', { command: input, error: error.message });
        reject(error);
      });
    });
  }

  /**
   * 带自动重试的执行
   * @param {string} input - 输入命令
   * @param {Object} options - 执行选项
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object>} 执行结果
   */
  async executeWithRetry(input, options = {}, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.execute(input, options);
        
        if (result.success) {
          return result;
        }

        // 记录失败
        logger.warn(`iFlow CLI 执行失败 (${attempt}/${maxRetries})`, { 
          command: input, 
          exitCode: result.exitCode 
        });

        // 最后一次尝试后返回结果
        if (attempt === maxRetries) {
          return result;
        }

        // 等待一段时间后重试
        await this.sleep(1000 * attempt);

      } catch (error) {
        lastError = error;
        logger.warn(`iFlow CLI 执行异常 (${attempt}/${maxRetries})`, { 
          command: input, 
          error: error.message 
        });

        if (attempt === maxRetries) {
          throw error;
        }

        await this.sleep(1000 * attempt);
      }
    }

    throw lastError || new Error('执行失败');
  }

  /**
   * 执行会话中的一系列命令
   * @param {Array} commands - 命令数组
   * @param {Object} options - 执行选项
   * @returns {Promise<Array>} 执行结果数组
   */
  async executeBatch(commands, options = {}) {
    const results = [];

    for (const command of commands) {
      try {
        const result = await this.executeWithRetry(command, options);
        results.push(result);

        // 如果失败且不允许继续，则中断
        if (!result.success && !options.continueOnError) {
          break;
        }
      } catch (error) {
        results.push({
          success: false,
          command,
          error: error.message
        });

        if (!options.continueOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * 检查 iFlow CLI 是否可用
   * @returns {Promise<boolean>} 是否可用
   */
  async isAvailable() {
    try {
      const result = await this.execute('--version');
      return result.success || result.output.includes('iflow');
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取 iFlow CLI 版本
   * @returns {Promise<string>} 版本信息
   */
  async getVersion() {
    try {
      const result = await this.execute('--version');
      return result.output.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 辅助函数：睡眠
   * @param {number} ms - 毫秒数
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new IFlowAdapter();