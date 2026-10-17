const express = require('express');
const { ChatSession, ChatMessage, Op } = require('../models');

const router = express.Router();

// 获取当前用户的会话列表（按更新时间倒序）
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ err_code: 401, message: '未登录' });
    }

    const sessions = await ChatSession.findAll({
      where: { user_id: userId },
      order: [['updated_at', 'DESC']],
      attributes: ['id', 'title', 'created_at', 'updated_at']
    });

    return res.json({
      err_code: 0,
      message: '获取成功',
      data: sessions
    });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return res.status(500).json({ err_code: 500, message: '服务器错误' });
  }
});

// 新建会话
router.post('/sessions', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ err_code: 401, message: '未登录' });
    }

    const { title = '新会话' } = req.body;

    const session = await ChatSession.create({
      user_id: userId,
      title: title.slice(0, 200) || '新会话'
    });

    return res.json({
      err_code: 0,
      message: '创建成功',
      data: {
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at
      }
    });
  } catch (error) {
    console.error('创建会话失败:', error);
    return res.status(500).json({ err_code: 500, message: '服务器错误' });
  }
});

// 删除会话（同时删除会话下的所有消息）
router.delete('/sessions/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const sessionId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ err_code: 401, message: '未登录' });
    }
    if (!sessionId) {
      return res.status(400).json({ err_code: 400, message: '会话ID无效' });
    }

    const session = await ChatSession.findOne({
      where: { id: sessionId, user_id: userId }
    });

    if (!session) {
      return res.status(404).json({ err_code: 404, message: '会话不存在' });
    }

    // 删除消息和会话
    await ChatMessage.destroy({ where: { session_id: sessionId, user_id: userId } });
    await session.destroy();

    return res.json({ err_code: 0, message: '删除成功' });
  } catch (error) {
    console.error('删除会话失败:', error);
    return res.status(500).json({ err_code: 500, message: '服务器错误' });
  }
});

// 获取指定会话的消息列表
router.get('/sessions/:id/messages', async (req, res) => {
  try {
    const userId = req.user?.id;
    const sessionId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ err_code: 401, message: '未登录' });
    }
    if (!sessionId) {
      return res.status(400).json({ err_code: 400, message: '会话ID无效' });
    }

    // 验证会话归属
    const session = await ChatSession.findOne({
      where: { id: sessionId, user_id: userId }
    });
    if (!session) {
      return res.status(404).json({ err_code: 404, message: '会话不存在' });
    }

    const messages = await ChatMessage.findAll({
      where: { session_id: sessionId, user_id: userId },
      order: [['created_at', 'ASC']],
      attributes: ['id', 'role', 'content', 'created_at']
    });

    return res.json({
      err_code: 0,
      message: '获取成功',
      data: {
        session: {
          id: session.id,
          title: session.title,
          created_at: session.created_at,
          updated_at: session.updated_at
        },
        messages
      }
    });
  } catch (error) {
    console.error('获取会话消息失败:', error);
    return res.status(500).json({ err_code: 500, message: '服务器错误' });
  }
});

// 修改会话标题
router.put('/sessions/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const sessionId = parseInt(req.params.id);
    const { title } = req.body;

    if (!userId) {
      return res.status(401).json({ err_code: 401, message: '未登录' });
    }
    if (!sessionId) {
      return res.status(400).json({ err_code: 400, message: '会话ID无效' });
    }
    if (!title) {
      return res.status(400).json({ err_code: 400, message: '标题不能为空' });
    }

    const session = await ChatSession.findOne({
      where: { id: sessionId, user_id: userId }
    });
    if (!session) {
      return res.status(404).json({ err_code: 404, message: '会话不存在' });
    }

    session.title = title.slice(0, 200);
    session.updated_at = new Date();
    await session.save();

    return res.json({
      err_code: 0,
      message: '修改成功',
      data: { id: session.id, title: session.title }
    });
  } catch (error) {
    console.error('修改会话标题失败:', error);
    return res.status(500).json({ err_code: 500, message: '服务器错误' });
  }
});

module.exports = router;
