// DeepSeek 流式对话代理
// 浏览器 -> 本服务 -> DeepSeek。密钥只存在于服务端环境变量中，前端不再持有任何密钥。
const express = require('express');
const axios = require('axios');

const router = express.Router();

const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';

// 与原前端 deepseek.ts 一致的系统提示词，由服务端注入，防止前端伪造 system 角色
const SYSTEM_PROMPT =
  '你是一个专业的法务助手，专门帮助用户解答法律相关问题。请用中文回答，回答要准确、专业、易懂。' +
  '对于合同相关问题，请提供实用的建议和注意事项。支持markdown格式输出。';

// POST /api/deepseek/chat
// body: { messages: [{role: 'user'|'assistant', content}], stream?: boolean, temperature?, max_tokens? }
// stream=true（默认）时以 SSE 透传 DeepSeek 的流式响应；stream=false 时返回普通 JSON
router.post('/chat', async (req, res) => {
  if (!DEEPSEEK_KEY) {
    return res.status(500).json({ err_code: 500, message: '服务端未配置 DEEPSEEK_API_KEY，请联系管理员' });
  }

  const { messages = [], stream = true, temperature = 0.7, max_tokens = 2000 } = req.body || {};

  // 只接受 user/assistant 消息，且限制单条长度，system 由服务端注入
  const safeMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20) // 防止上下文过长
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  if (safeMessages.length === 0) {
    return res.status(400).json({ err_code: 400, message: '缺少有效的对话消息' });
  }

  const upstreamBody = {
    model: 'deepseek-chat',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...safeMessages],
    temperature,
    max_tokens,
    stream: Boolean(stream),
  };

  try {
    const upstream = await axios.post(`${DEEPSEEK_BASE}/chat/completions`, upstreamBody, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      responseType: stream ? 'stream' : 'json',
      timeout: 120000,
    });

    if (!stream) {
      const content = upstream.data?.choices?.[0]?.message?.content || '';
      return res.json({ err_code: 0, message: '获取成功', data: { answer: content.trim() } });
    }

    // 流式：SSE 透传
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 客户端断开时中止上游请求，避免资源浪费
    const clientClosed = () => {
      upstream.data.destroy();
    };
    req.on('close', clientClosed);

    upstream.data.pipe(res);
    upstream.data.on('end', () => res.end());
  } catch (error) {
    const status = error?.response?.status || 500;
    const detail = error?.response?.data?.error?.message || error.message || '上游服务错误';
    console.error('DeepSeek 代理失败:', status, detail);
    if (res.headersSent) {
      // SSE 已开始，只能以事件形式告知错误
      res.write(`data: ${JSON.stringify({ error: `调用DeepSeek失败(${status})：${detail}` })}\n\n`);
      return res.end();
    }
    return res.status(status === 401 || status === 402 ? 502 : status).json({
      err_code: 502,
      message: `调用DeepSeek失败(${status})：${detail}`,
    });
  }
});

module.exports = router;
