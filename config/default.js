module.exports = {
  feishu: {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    encryptKey: process.env.FEISHU_ENCRYPT_KEY,
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN,
    hubbleUrl: 'wss://open.feishu.cn/open-apis/hubble-im/v1'
  },
  iflow: {
    cliPath: process.env.IFLOW_CLI_PATH || 'iflow',
    superpowersEnabled: process.env.SUPERPOWERS_ENABLED !== 'false',
    superpowersMode: process.env.SUPERPOWERS_MODE || 'yolo'
  },
  execution: {
    yoloMode: process.env.YOLO_MODE !== 'false',
    autoConfirm: process.env.AUTO_CONFIRM !== 'false',
    maxLoopDepth: parseInt(process.env.MAX_LOOP_DEPTH || '100'),
    timeoutPerStep: parseInt(process.env.TIMEOUT_PER_STEP || '300')
  },
  progress: {
    interval: parseInt(process.env.PROGRESS_INTERVAL || '180'),
    enabled: process.env.PROGRESS_ENABLED !== 'false'
  },
  session: {
    timeout: parseInt(process.env.SESSION_TIMEOUT || '3600'),
    dir: process.env.SESSION_DIR || './data/sessions'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs'
  }
};