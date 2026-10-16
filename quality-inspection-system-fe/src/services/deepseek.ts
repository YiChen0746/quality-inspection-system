// DeepSeek API 服务
interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
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
  private baseURL = 'https://api.deepseek.com/v1';
  private apiKey = 'sk-f643949fa70c4b7e97faa2588ef3fd05';

  // 流式聊天完成
  async chatCompletionStream(
    messages: DeepSeekMessage[], 
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const requestBody: DeepSeekRequest = {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的法务助手，专门帮助用户解答法律相关问题。请用中文回答，回答要准确、专业、易懂。对于合同相关问题，请提供实用的建议和注意事项。支持markdown格式输出。'
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: true
      };

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek API Error Response:', errorText);
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
              const content = parsed.choices[0]?.delta?.content;
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
      console.error('DeepSeek Stream API Error:', error);
      if (error instanceof Error) {
        onError(new Error(`法务助手暂时无法回答，请稍后重试。错误信息: ${error.message}`));
      } else {
        onError(new Error('调用DeepSeek API失败，请稍后重试'));
      }
    }
  }

  // 保留原有的非流式方法作为备用
  async chatCompletion(messages: DeepSeekMessage[]): Promise<string> {
    try {
      const requestBody: DeepSeekRequest = {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的法务助手，专门帮助用户解答法律相关问题。请用中文回答，回答要准确、专业、易懂。对于合同相关问题，请提供实用的建议和注意事项。'
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 2000
      };

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data: DeepSeekResponse = await response.json();
      
      if (data.choices && data.choices.length > 0 && data.choices[0].message.content) {
        return data.choices[0].message.content.trim();
      } else {
        throw new Error('DeepSeek API返回了空响应');
      }
    } catch (error) {
      console.error('DeepSeek API Error:', error);
      if (error instanceof Error) {
        throw new Error(`法务助手暂时无法回答，请稍后重试。错误信息: ${error.message}`);
      } else {
        throw new Error('调用DeepSeek API失败，请稍后重试');
      }
    }
  }
}

export const deepSeekService = new DeepSeekService();
