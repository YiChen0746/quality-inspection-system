import { deepSeekService } from '@/services/deepseek';

interface TMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TRes {
  response: string;
}

interface TReq {
  messages: TMessage[]
}

interface TStreamReq extends TReq {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

// 流式智能问答方法
export const getIntelligentQAResultStream = async (req: TStreamReq): Promise<void> => {
  try {
    // 将消息格式转换为 DeepSeek API 格式
    const deepSeekMessages = req.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // 调用 DeepSeek 流式 API
    await deepSeekService.chatCompletionStream(
      deepSeekMessages,
      req.onChunk,
      req.onComplete,
      req.onError
    );
  } catch (error) {
    console.error('DeepSeek Stream API 调用失败:', error);
    req.onError(error instanceof Error ? error : new Error('未知错误'));
  }
}

// 保留原有的非流式方法作为备用
export const getIntelligentQAResult = async (req: TReq): Promise<TRes> => {
  try {
    // 将消息格式转换为 DeepSeek API 格式
    const deepSeekMessages = req.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // 调用 DeepSeek API
    const response = await deepSeekService.chatCompletion(deepSeekMessages);
    
    return {
      response: response
    };
  } catch (error) {
    console.error('DeepSeek API 调用失败:', error);
    throw error;
  }
}
