const logger = require('../utils/logger');

/**
 * 结果分析器 - 分析 iFlow CLI 输出并提取 NEXT_PHASE
 */
class ResultAnalyzer {
  constructor() {
    // NEXT_PHASE 模式配置
    this.nextPhasePatterns = [
      // 中文模式
      /(?:下一阶段|next\s*phase|next\s*step)[:：]\s*([^\n]+)/i,
      /(?:阶段目标|phase\s*goal|step\s*goal)[:：]\s*([^\n]+)/i,
      /(?:继续|continue)[:：]\s*([^\n]+)/i,
      // 英文模式
      /NEXT_PHASE:\s*([^\n]+)/i,
      /NEXT_GOAL:\s*([^\n]+)/i
    ];

    // 完成模式
    this.completionPatterns = [
      /(?:完成|completed|done|finished|success)/i,
      /(?:任务结束|task\s+completed|task\s+done)/i,
      /(?:没有下一阶段|no\s+next\s+phase|no\s+next\s+step)/i
    ];

    // 错误模式
    this.errorPatterns = [
      /(?:错误|error|failed|failure)/i,
      /(?:异常|exception|crash)/i
    ];

    // 等待用户输入模式
    this.inputPatterns = [
      /(?:请输入|please\s+input|enter\s+your)/i,
      /(?:等待|waiting|awaiting)/i,
      /\?$/  // 以问号结尾
    ];
  }

  /**
   * 分析执行结果
   * @param {Object} result - 执行结果
   * @returns {Object} 分析结果
   */
  analyze(result) {
    const analysis = {
      canContinue: false,
      nextPhase: null,
      isComplete: false,
      hasError: false,
      needsInput: false,
      summary: '',
      confidence: 0
    };

    if (!result || !result.output) {
      return analysis;
    }

    const output = result.output;

    // 检查是否完成
    analysis.isComplete = this.checkCompletion(output);

    // 检查是否有错误
    analysis.hasError = this.checkError(output);

    // 检查是否需要用户输入
    analysis.needsInput = this.checkInput(output);

    // 提取下一阶段
    if (!analysis.isComplete) {
      const nextPhase = this.extractNextPhase(output);
      if (nextPhase) {
        analysis.nextPhase = nextPhase.trim();
        analysis.canContinue = true;
        analysis.confidence = this.calculateConfidence(output, nextPhase);
      }
    }

    // 生成摘要
    analysis.summary = this.generateSummary(result, analysis);

    logger.info('分析执行结果', {
      canContinue: analysis.canContinue,
      nextPhase: analysis.nextPhase,
      isComplete: analysis.isComplete,
      hasError: analysis.hasError,
      confidence: analysis.confidence
    });

    return analysis;
  }

  /**
   * 检查是否完成
   * @param {string} output - 输出内容
   * @returns {boolean} 是否完成
   */
  checkCompletion(output) {
    return this.completionPatterns.some(pattern => pattern.test(output));
  }

  /**
   * 检查是否有错误
   * @param {string} output - 输出内容
   * @returns {boolean} 是否有错误
   */
  checkError(output) {
    return this.errorPatterns.some(pattern => pattern.test(output));
  }

  /**
   * 检查是否需要用户输入
   * @param {string} output - 输出内容
   * @returns {boolean} 是否需要输入
   */
  checkInput(output) {
    return this.inputPatterns.some(pattern => pattern.test(output));
  }

  /**
   * 提取下一阶段
   * @param {string} output - 输出内容
   * @returns {string|null} 下一阶段内容
   */
  extractNextPhase(output) {
    for (const pattern of this.nextPhasePatterns) {
      const match = output.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // 如果没有找到显式标记，尝试从最后一段提取
    const lines = output.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1].trim();
      // 如果最后一行不是状态描述，可能是下一阶段的提示
      if (!this.completionPatterns.some(p => p.test(lastLine)) &&
          !this.errorPatterns.some(p => p.test(lastLine))) {
        return lastLine;
      }
    }

    return null;
  }

  /**
   * 计算置信度
   * @param {string} output - 输出内容
   * @param {string} nextPhase - 下一阶段内容
   * @returns {number} 置信度 (0-1)
   */
  calculateConfidence(output, nextPhase) {
    let confidence = 0;

    // 如果有显式标记，置信度较高
    if (this.nextPhasePatterns.some(p => p.test(output))) {
      confidence += 0.6;
    }

    // 如果下一阶段内容较长，置信度增加
    if (nextPhase && nextPhase.length > 10) {
      confidence += 0.2;
    }

    // 如果输出中包含"继续"、"下一步"等关键词
    if (/继续|下一步|next|continue/i.test(output)) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1);
  }

  /**
   * 生成摘要
   * @param {Object} result - 执行结果
   * @param {Object} analysis - 分析结果
   * @returns {string} 摘要内容
   */
  generateSummary(result, analysis) {
    let summary = '';

    // 执行状态
    if (analysis.hasError) {
      summary += '❌ 执行出现错误\n';
    } else if (analysis.isComplete) {
      summary += '✅ 任务已完成\n';
    } else {
      summary += '⏳ 执行中\n';
    }

    // 命令
    if (result.command) {
      summary += `命令: ${result.command}\n`;
    }

    // 下一阶段
    if (analysis.nextPhase) {
      summary += `下一阶段: ${analysis.nextPhase}\n`;
    }

    // 输出摘要（最多 200 字符）
    if (result.output) {
      const outputSummary = result.output
        .replace(/\n/g, ' ')
        .substring(0, 200);
      summary += `输出: ${outputSummary}...\n`;
    }

    return summary.trim();
  }

  /**
   * 提取关键信息
   * @param {string} output - 输出内容
   * @returns {Object} 关键信息对象
   */
  extractKeyInfo(output) {
    const info = {
      files: [],
      urls: [],
      numbers: [],
      errors: [],
      images: []  // 新增: 提取图片文件
    };

    // 提取文件路径
    const filePattern = /(?:[a-zA-Z]:\\|\/)?[\w\-\\\/\.]+\.\w+/g;
    const files = output.match(filePattern);
    if (files) {
      info.files = [...new Set(files)]; // 去重
      
      // 从文件中筛选出图片文件
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
      info.images = info.files.filter(file => {
        const ext = file.toLowerCase();
        return imageExtensions.some(imgExt => ext.endsWith(imgExt));
      });
    }

    // 提取 URL
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = output.match(urlPattern);
    if (urls) {
      info.urls = [...new Set(urls)];
    }

    // 提取数字
    const numberPattern = /\b\d+\b/g;
    const numbers = output.match(numberPattern);
    if (numbers) {
      info.numbers = numbers.slice(0, 10); // 最多保留 10 个
    }

    // 提取错误信息
    const errorPattern = /(?:error|错误|exception|异常|failed|失败)[:：]\s*([^\n]+)/gi;
    const errors = [];
    let match;
    while ((match = errorPattern.exec(output)) !== null) {
      errors.push(match[1]);
    }
    info.errors = errors;

    return info;
  }

  /**
   * 判断是否需要人工干预
   * @param {Object} analysis - 分析结果
   * @param {number} loopDepth - 当前循环深度
   * @returns {boolean} 是否需要干预
   */
  needsIntervention(analysis, loopDepth = 0) {
    const maxLoopDepth = parseInt(process.env.MAX_LOOP_DEPTH || '100');

    // 有错误时需要干预
    if (analysis.hasError) {
      return true;
    }

    // 需要用户输入时需要干预
    if (analysis.needsInput) {
      return true;
    }

    // 超过最大循环深度时需要干预
    if (loopDepth >= maxLoopDepth) {
      logger.warn('超过最大循环深度', { loopDepth, maxLoopDepth });
      return true;
    }

    // 置信度过低时可能需要干预
    if (analysis.canContinue && analysis.confidence < 0.3) {
      logger.warn('置信度过低', { confidence: analysis.confidence });
      return true;
    }

    return false;
  }
}

module.exports = new ResultAnalyzer();