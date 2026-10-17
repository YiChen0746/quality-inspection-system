// 通用 OpenAI 兼容大模型代理（DeepSeek / 智谱GLM / 硅基流动 / 本地Ollama 均可接入）
// 浏览器 -> 本服务 -> 大模型API。密钥只存在于服务端环境变量中，前端不再持有任何密钥。
const express = require('express');
const axios = require('axios');
const { ChatSession, ChatMessage } = require('../models');

const router = express.Router();

// 优先读通用 LLM_* 变量，兼容旧的 DEEPSEEK_* 变量
const LLM_BASE = process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const LLM_KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

// 与原前端 deepseek.ts 一致的系统提示词，由服务端注入，防止前端伪造 system 角色
const SYSTEM_PROMPT =
  '你是一个专业的法务助手，专门帮助用户解答法律相关问题。请用中文回答，回答要准确、专业、易懂。' +
  '对于合同相关问题，请提供实用的建议和注意事项。支持markdown格式输出。';

// 从第一条用户消息提取会话标题（取前 20 字）
function extractTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return '新会话';
  const text = firstUser.content.trim().replace(/\s+/g, ' ');
  return text.slice(0, 20) + (text.length > 20 ? '...' : '');
}

// POST /api/deepseek/chat
// body: { messages, session_id?, stream?, temperature?, max_tokens? }
// session_id 存在时：携带历史上下文 + 保存用户/助手消息 + 更新会话标题
router.post('/chat', async (req, res) => {
  if (!LLM_KEY) {
    return res.status(500).json({ err_code: 500, message: '服务端未配置 LLM_API_KEY（大模型密钥），请联系管理员' });
  }

  const userId = req.user?.id;
  const { messages = [], stream = true, temperature = 0.7, max_tokens = 2000, session_id: sessionIdParam } = req.body || {};
  const sessionId = sessionIdParam ? parseInt(sessionIdParam) : null;

  // 只接受 user/assistant 消息，且限制单条长度，system 由服务端注入
  const safeMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  if (safeMessages.length === 0) {
    return res.status(400).json({ err_code: 400, message: '缺少有效的对话消息' });
  }

  // ============ 会话历史逻辑 ============
  let historyMessages = [];
  let targetSessionId = sessionId;
  let isNewSession = false;

  if (userId && targetSessionId) {
    // 有会话ID：从数据库加载历史消息作为上下文
    try {
      const session = await ChatSession.findOne({
        where: { id: targetSessionId, user_id: userId }
      });
      if (session) {
        const history = await ChatMessage.findAll({
          where: { session_id: targetSessionId, user_id: userId },
          order: [['created_at', 'ASC']],
          attributes: ['role', 'content']
        });
        historyMessages = history.map(m => ({ role: m.role, content: m.content }));
      } else {
        targetSessionId = null; // 会话不存在，按无会话处理
      }
    } catch (dbErr) {
      console.error('加载会话历史失败:', dbErr);
    }
  } else if (userId && !targetSessionId && safeMessages.length > 0) {
    // 没有会话ID且是新对话：自动创建一个新会话
    try {
      const title = extractTitle(safeMessages);
      const newSession = await ChatSession.create({
        user_id: userId,
        title
      });
      targetSessionId = newSession.id;
      isNewSession = true;
    } catch (dbErr) {
      console.error('自动创建会话失败:', dbErr);
    }
  }

  // 合并历史 + 新消息（最多保留 20 轮，防止上下文过长）
  const allMessages = [...historyMessages, ...safeMessages].slice(-40);

  const upstreamBody = {
    model: LLM_MODEL,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...allMessages],
    temperature,
    max_tokens,
    stream: Boolean(stream),
  };

  // 保存用户消息（流式和非流式都先存用户消息）
  let userMsgSaved = false;
  if (userId && targetSessionId) {
    try {
      const lastUserMsg = [...safeMessages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        await ChatMessage.create({
          session_id: targetSessionId,
          user_id: userId,
          role: 'user',
          content: lastUserMsg.content
        });
        userMsgSaved = true;
        // 更新会话时间和标题
        await ChatSession.update(
          { updated_at: new Date(), ...(isNewSession ? {} : {}) },
          { where: { id: targetSessionId, user_id: userId } }
        );
        // 如果是新会话且有标题，已经在创建时设置了
        // 如果不是新会话且只有1条用户消息（首轮），也更新标题
        if (!isNewSession && historyMessages.length === 0) {
          const title = extractTitle(safeMessages);
          await ChatSession.update(
            { title, updated_at: new Date() },
            { where: { id: targetSessionId, user_id: userId } }
          );
        }
      }
    } catch (dbErr) {
      console.error('保存用户消息失败:', dbErr);
    }
  }

  try {
    const upstream = await axios.post(`${LLM_BASE}/chat/completions`, upstreamBody, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_KEY}`,
      },
      responseType: stream ? 'stream' : 'json',
      timeout: 120000,
    });

    if (!stream) {
      const content = upstream.data?.choices?.[0]?.message?.content || '';
      const trimmed = content.trim();

      // 保存助手消息
      if (userId && targetSessionId && userMsgSaved) {
        try {
          await ChatMessage.create({
            session_id: targetSessionId,
            user_id: userId,
            role: 'assistant',
            content: trimmed
          });
          await ChatSession.update(
            { updated_at: new Date() },
            { where: { id: targetSessionId, user_id: userId } }
          );
        } catch (dbErr) {
          console.error('保存助手消息失败:', dbErr);
        }
      }

      return res.json({
        err_code: 0,
        message: '获取成功',
        data: { answer: trimmed, session_id: targetSessionId }
      });
    }

    // 流式：SSE 透传，同时累积内容以便结束时保存
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // 在 SSE 流最开始推送一条 session 信息，让前端知道当前 session_id
    if (targetSessionId) {
      res.write(`data: ${JSON.stringify({ type: 'session', session_id: targetSessionId, is_new: isNewSession })}\n\n`);
    }
    res.flushHeaders();

    let accumulatedContent = '';
    let buffer = '';

    const parseAndAccumulate = (chunkStr) => {
      // SSE 解析：按行分割，找 "data: " 开头的
      const lines = chunkStr.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const data = JSON.parse(dataStr);
          const delta = data.choices?.[0]?.delta?.content;
          if (delta) accumulatedContent += delta;
        } catch (e) {
          // 忽略解析失败的块
        }
      }
    };

    // 客户端断开时中止上游请求
    const clientClosed = () => {
      upstream.data.destroy();
    };
    req.on('close', clientClosed);

    // 透传数据 + 累积内容
    upstream.data.on('data', (chunk) => {
      const chunkStr = chunk.toString('utf-8');
      buffer += chunkStr;
      parseAndAccumulate(chunkStr);
      res.write(chunk);
    });

    upstream.data.on('end', async () => {
      res.end();
      // 流结束后保存助手消息
      if (userId && targetSessionId && userMsgSaved && accumulatedContent.trim()) {
        try {
          await ChatMessage.create({
            session_id: targetSessionId,
            user_id: userId,
            role: 'assistant',
            content: accumulatedContent.trim()
          });
          await ChatSession.update(
            { updated_at: new Date() },
            { where: { id: targetSessionId, user_id: userId } }
          );
        } catch (dbErr) {
          console.error('流式保存助手消息失败:', dbErr);
        }
      }
    });

    upstream.data.on('error', (err) => {
      console.error('上游流式错误:', err.message);
      if (!res.writableEnded) res.end();
    });

  } catch (error) {
    const status = error?.response?.status || 500;
    const detail = error?.response?.data?.error?.message || error.message || '上游服务错误';
    console.error('DeepSeek 代理失败:', status, detail);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: `调用失败(${status})：${detail}` })}\n\n`);
      return res.end();
    }
    return res.status(status === 401 || status === 402 ? 502 : status).json({
      err_code: 502,
      message: `调用失败(${status})：${detail}`,
    });
  }
});

module.exports = router;
