const { spawn } = require('child_process');
const config = require('../../config/default');
const logger = require('../utils/logger');

/**
 * Claude CLI 适配器
 * 负责调用 Claude CLI 并处理输入输出
 */
class ClaudeAdapter {
  constructor() {
    this.cliPath = config.claude.cliPath;
    this.timeoutPerStep = config.execution.timeoutPerStep;
  }

  /**
   * 执行 Claude 对话
   * 调用格式: claude "用户提示词"
   *
   * @param {string} prompt - 用户提示词
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<Object>} 执行结果
   */
  async executePrompt(prompt, sessionId) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      logger.info('执行 Claude CLI 调用', { prompt: prompt.substring(0, 100), sessionId });

      // Claude CLI 调用格式: claude "prompt"
      // 直接将 prompt 作为参数传递
      const child = spawn(this.cliPath, [prompt], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          CLAUDE_SESSION_ID: sessionId // 传递会话 ID
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
        logger.error('Claude CLI 执行超时', { prompt: prompt.substring(0, 100), timeout: this.timeoutPerStep });
        reject(new Error(`Claude 执行超时 (${this.timeoutPerStep}秒)`));
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
          command: prompt,
          sessionId
        };

        if (code === 0) {
          logger.info('Claude CLI 执行成功', {
            promptLength: prompt.length,
            outputLength: stdout.length,
            duration
          });
          resolve(result);
        } else {
          logger.error('Claude CLI 执行失败', {
            prompt: prompt.substring(0, 100),
            exitCode: code,
            error: stderr
          });
          resolve(result); // 即使失败也返回结果，由上层处理
        }
      });

      // 处理进程错误
      child.on('error', (error) => {
        clearTimeout(timeout);
        logger.error('Claude CLI 进程错误', {
          prompt: prompt.substring(0, 100),
          error: error.message
        });
        reject(error);
      });
    });
  }

  /**
   * 带自动重试的执行
   * @param {string} prompt - 用户提示词
   * @param {string} sessionId - 会话 ID
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object>} 执行结果
   */
  async executeWithRetry(prompt, sessionId, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executePrompt(prompt, sessionId);

        if (result.success) {
          return result;
        }

        // 记录失败
        logger.warn(`Claude CLI 执行失败 (${attempt}/${maxRetries})`, {
          prompt: prompt.substring(0, 100),
          exitCode: result.exitCode
        });

        // 最后一次尝试后返回结果
        if (attempt === maxRetries) {
          return result;
        }

        // 等待一段时间后重试（指数退避）
        await this.sleep(1000 * attempt);

      } catch (error) {
        lastError = error;
        logger.warn(`Claude CLI 执行异常 (${attempt}/${maxRetries})`, {
          prompt: prompt.substring(0, 100),
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
   * 检查 Claude CLI 是否可用
   * @returns {Promise<boolean>} 是否可用
   */
  async isAvailable() {
    try {
      // 尝试执行一个简单的命令来检查 Claude CLI 是否可用
      const child = spawn(this.cliPath, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      return new Promise((resolve) => {
        let hasOutput = false;

        child.stdout.on('data', () => {
          hasOutput = true;
        });

        child.stderr.on('data', () => {
          hasOutput = true;
        });

        child.on('close', (code) => {
          // 如果有输出或者退出码为0，认为可用
          resolve(hasOutput || code === 0);
        });

        child.on('error', () => {
          resolve(false);
        });

        // 超时保护
        setTimeout(() => {
          child.kill();
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      logger.error('检查 Claude CLI 可用性失败', { error: error.message });
      return false;
    }
  }

  /**
   * 获取 Claude CLI 版本
   * @returns {Promise<string>} 版本信息
   */
  async getVersion() {
    try {
      const child = spawn(this.cliPath, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      return new Promise((resolve) => {
        let output = '';

        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        child.stderr.on('data', (data) => {
          output += data.toString();
        });

        child.on('close', () => {
          resolve(output.trim() || 'unknown');
        });

        child.on('error', () => {
          resolve('unknown');
        });

        // 超时保护
        setTimeout(() => {
          child.kill();
          resolve('unknown');
        }, 5000);
      });
    } catch (error) {
      logger.error('获取 Claude CLI 版本失败', { error: error.message });
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

module.exports = new ClaudeAdapter();
