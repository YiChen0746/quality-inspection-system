// DeepSeek API 服务（经后端代理调用）
// 密钥只保存在后端环境变量中，前端不再持有任何大模型密钥；
// 本文件仅负责把对话消息发送到后端 /api/deepseek/chat 并解析响应。
import { getUserInfo } from '@Setup/storage/user.js';

interface DeepSeekMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DeepSeekStreamResponse {
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string;
  }>;
}

class DeepSeekService {
  // 后端代理地址（相对路径：本地走 Vite 代理，线上走 Nginx 反代）
  private proxyURL = `${import.meta.env.VITE_API_BASE || ''}/api/deepseek/chat`;

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getUserInfo()?.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  // 流式聊天完成
  async chatCompletionStream(
    messages: DeepSeekMessage[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch(this.proxyURL, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ messages, stream: true })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek 代理 Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed: DeepSeekStreamResponse = JSON.parse(data);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (parseError) {
              console.warn('解析流数据失败:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('DeepSeek 代理 Stream Error:', error);
      if (error instanceof Error) {
        onError(new Error(`法务助手暂时无法回答，请稍后重试。错误信息: ${error.message}`));
      } else {
        onError(new Error('调用DeepSeek失败，请稍后重试'));
      }
    }
  }

  // 保留原有的非流式方法作为备用
  async chatCompletion(messages: DeepSeekMessage[]): Promise<string> {
    try {
      const response = await fetch(this.proxyURL, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ messages, stream: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek 代理 Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      const content = data?.data?.answer;

      if (content) {
        return String(content).trim();
      } else {
        throw new Error(data?.message || 'DeepSeek 代理返回了空响应');
      }
    } catch (error) {
      console.error('DeepSeek 代理 Error:', error);
      if (error instanceof Error) {
        throw new Error(`法务助手暂时无法回答，请稍后重试。错误信息: ${error.message}`);
      } else {
        throw new Error('调用DeepSeek失败，请稍后重试');
      }
    }
  }
}

export const deepSeekService = new DeepSeekService();
