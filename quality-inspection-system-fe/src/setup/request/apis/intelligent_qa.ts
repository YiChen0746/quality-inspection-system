import { deepSeekService } from '@/services/deepseek';
import { getAuthHeaders } from '@Setup/storage/user.js';

interface TMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TRes {
  response: string;
}

interface TStreamReq {
  messages: TMessage[];
  sessionId?: number | null;
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  onSessionStart?: (sessionId: number, isNew: boolean) => void;
}

// 会话列表项
export interface ChatSessionItem {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

// 会话消息项
export interface ChatMessageItem {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// 会话详情
export interface ChatSessionDetail {
  session: ChatSessionItem;
  messages: ChatMessageItem[];
}

// 流式智能问答方法（支持会话）
export const getIntelligentQAResultStream = async (req: TStreamReq): Promise<void> => {
  try {
    const deepSeekMessages = req.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    await deepSeekService.chatCompletionStream({
      messages: deepSeekMessages,
      sessionId: req.sessionId,
      onChunk: req.onChunk,
      onComplete: req.onComplete,
      onError: req.onError,
      onSessionStart: req.onSessionStart
    });
  } catch (error) {
    console.error('DeepSeek Stream API 调用失败:', error);
    req.onError(error instanceof Error ? error : new Error('未知错误'));
  }
}

// 获取会话列表
export const getChatSessions = async (): Promise<ChatSessionItem[]> => {
  const response = await fetch('/api/chat/sessions', {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('获取会话列表失败');
  const data = await response.json();
  if (data.err_code !== 0) throw new Error(data.message || '获取失败');
  return data.data || [];
}

// 新建会话
export const createChatSession = async (title?: string): Promise<ChatSessionItem> => {
  const response = await fetch('/api/chat/sessions', {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title || '新会话' })
  });
  if (!response.ok) throw new Error('创建会话失败');
  const data = await response.json();
  if (data.err_code !== 0) throw new Error(data.message || '创建失败');
  return data.data;
}

// 删除会话
export const deleteChatSession = async (sessionId: number): Promise<void> => {
  const response = await fetch(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('删除会话失败');
  const data = await response.json();
  if (data.err_code !== 0) throw new Error(data.message || '删除失败');
}

// 获取会话消息
export const getChatSessionMessages = async (sessionId: number): Promise<ChatSessionDetail> => {
  const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('获取会话消息失败');
  const data = await response.json();
  if (data.err_code !== 0) throw new Error(data.message || '获取失败');
  return data.data;
}

// 保留原有的非流式方法作为备用
export const getIntelligentQAResult = async (req: { messages: TMessage[], sessionId?: number }): Promise<TRes> => {
  try {
    const deepSeekMessages = req.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    const response = await deepSeekService.chatCompletion(deepSeekMessages, req.sessionId);
    
    return {
      response: response
    };
  } catch (error) {
    console.error('DeepSeek API 调用失败:', error);
    throw error;
  }
}
