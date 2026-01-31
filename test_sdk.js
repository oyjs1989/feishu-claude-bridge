const { Client } = require('@larksuiteoapi/node-sdk');
require('dotenv').config();

// 创建飞书客户端
const feishuClient = new Client({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET
});

// 测试消息格式
const chatId = 'oc_c6013115d0ef599c965940f24c9d86be';

console.log('=== 测试 1: 正确格式（params 在 payload 中）===');
console.log('调用方式:');
console.log(`feishuClient.im.message.create({
  params: {
    receive_id_type: 'chat_id',
  },
  data: {
    receive_id: '${chatId}',
    msg_type: 'text',
    content: JSON.stringify({ text: 'Test message 1' })
  }
})`);

console.log('\n=== 测试 2: 错误格式（data 中包含 receive_id_type）===');
console.log('调用方式（错误）:');
console.log(`feishuClient.im.message.create({
  data: {
    receive_id: '${chatId}',
    msg_type: 'text',
    content: JSON.stringify({ text: 'Test message 2' }),
    receive_id_type: 'chat_id'
  }
})`);

console.log('\n=== 分析 ===');
console.log('SDK 类型定义（line 252085-252110）:');
console.log(`create: (payload?: {
  data: {
    receive_id: string;
    msg_type: string;
    content: string;
    uuid?: string;
  };
  params: {
    receive_id_type: "open_id" | "user_id" | "union_id" | "email" | "chat_id";
  };
}, options?)`);