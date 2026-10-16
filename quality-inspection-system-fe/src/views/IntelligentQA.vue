<template >
  <div class="IntelligentQA" >
    <div class="chat-list-container">
      <el-scrollbar>
        <Message 
          :avatar="bot" 
          message="你好，我是智能法务助理，专门为您解答法律相关问题。有什么法律问题就来问我吧 ~"
          :loading="false"
        ></Message>
        <Message 
          v-for="message in data.messageList" 
          :key="message.content" 
          :avatar="message.type" 
          :message="message.content"
          :loading="message.loading"
        ></Message>
      </el-scrollbar>
    </div>
    <div class="message-post-container">
      <div class="input-wrapper">
        <div class="textarea-container">
          <textarea
            v-model="data.questionMessage"
            class="custom-textarea"
            placeholder="请输入您的法律问题，按 Enter 发送..."
            @keydown="handleKeyDown"
            :disabled="data.isLoading"
            rows="1"
            ref="textareaRef"
            @input="adjustTextareaHeight"
          ></textarea>
          <button 
            @click="onSubmit" 
            class="send-button"
            :class="{ 'loading': data.isLoading, 'disabled': !data.questionMessage.trim() || data.isLoading }"
            :disabled="!data.questionMessage.trim() || data.isLoading"
          >
            <div class="button-content">
              <svg v-if="!data.isLoading" class="send-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div v-else class="loading-spinner">
                <div class="spinner"></div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script  setup lang="ts">

import { reactive, ref, nextTick } from 'vue'
import { Service } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus';
import Message from '@/components/Message/index.vue';
import { getIntelligentQAResultStream } from '@Setup/request/index.ts';

enum EMessageType {  //消息类型定义
  User = 'user',
  Bot = 'bot',
}

interface MessageItem {
  type: EMessageType;
  content: string;
  loading: boolean;
}

const data = reactive({
  questionMessage: '',  //用户提问
  messageList: [] as MessageItem[],     //保存所有消息
  isLoading: false,     //是否正在加载
})

const bot = 'bot'; // 添加bot变量
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// 自动调整textarea高度
const adjustTextareaHeight = async () => {
  await nextTick();
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    const scrollHeight = textareaRef.value.scrollHeight;
    const maxHeight = 60; // 4行内容的最大高度 (24px * 4)
    textareaRef.value.style.height = Math.min(scrollHeight, maxHeight) + 'px';
  }
};

// 处理键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    if (event.ctrlKey) {
      // Ctrl+Enter 换行
      return; // 让默认行为发生（换行）
    } else {
      // 单独Enter发送
      event.preventDefault();
      onSubmit();
    }
  }
}

const onSubmit = async () => {
  if (!data.questionMessage.trim()) {    // 判断用户输入
    return ElMessage({ message: '请输入您的法律问题 ~', type: 'warning' });
  }

  if (data.isLoading) {
    return;
  }

  console.log("用户输入的问题是：", data.questionMessage)

  const userQuestion = data.questionMessage.trim();
  data.questionMessage = '';  // 立即清空输入框
  adjustTextareaHeight(); // 重置输入框高度
  data.isLoading = true;

  // 将用户输入类型设置为user
  data.messageList.push({
    type: EMessageType.User,
    content: userQuestion,
    loading: false,
  });

  // 添加机器人回复的占位符
  const botMessageIndex = data.messageList.push({
    type: EMessageType.Bot,
    content: '',  // 开始时内容为空
    loading: true,  // 显示为加载状态
  }) - 1;

  // 发送用户输入，DeepSeek服务会自动添加系统提示
  const messages = [{
    role: 'user' as const,
    content: userQuestion,
  }];

  try {
    let accumulatedContent = '';

    // 调用流式 API
    await getIntelligentQAResultStream({
      messages,
      onChunk: (chunk: string) => {
        // 累积内容并实时更新，每次更新都会触发Markdown重新渲染
        accumulatedContent += chunk;
        data.messageList[botMessageIndex] = {
          type: EMessageType.Bot,
          content: accumulatedContent,
          loading: true,  // 仍在接收中，显示加载图标
        };
      },
      onComplete: () => {
        // 流式输出完成，移除加载状态
        data.messageList[botMessageIndex] = {
          type: EMessageType.Bot,
          content: accumulatedContent,
          loading: false,  // 停止加载状态
        };
        data.isLoading = false;
        console.log("流式输出完成，最终内容：", accumulatedContent);
      },
      onError: (error: Error) => {
        console.error('流式API调用失败:', error);
        ElMessage.error(error.message || '请求出错，请稍后再试 ~');
        data.messageList.splice(botMessageIndex, 1);  // 移除占位符
        data.isLoading = false;
      }
    });

  } catch (error) {
    console.error('API 调用失败:', error);
    ElMessage.error('请求出错，请稍后再试 ~');
    data.messageList.splice(botMessageIndex, 1);  // 移除占位符
    data.isLoading = false;
  }
}

</script>

<style lang="less">
.IntelligentQA{
  height: calc(100vh - 60px);
  // background: linear-gradient(180deg, #f5f4f6, #e6ebf7);
  background-color:#dff9f8;
  background-size: cover;
  display: flex;
  flex: 1;
  justify-content: center;
  overflow: hidden;
  position: relative;
  flex-direction: column;
  align-items: center;
  .chat-list-container{
    width:750px;
    min-width: 700px;
    height: calc(100vh - 180px);
    min-height: calc(100vh - 180px);
    margin-bottom: -10px;
    overflow: hidden;
    scroll-behavior: smooth;
    margin-right: 22px;
    margin-top: 20px;
  }
  .message-post-container {
    padding: 0;
    margin-bottom: 20px;
    width: 100%;
    max-width: 750px;
  }

  .input-wrapper {
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    border: 2px solid transparent;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    backdrop-filter: blur(10px);
  }

  .input-wrapper:hover {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
    border-color: rgba(10, 154, 174, 0.2);
  }

  .input-wrapper:focus-within {
    box-shadow: 0 16px 48px rgba(10, 154, 174, 0.15);
    border-color: #0A9AAE;
    transform: translateY(-2px);
  }

  .textarea-container {
    position: relative;
    display: flex;
    align-items: center;
    padding: 16px 20px;
    gap: 16px;
  }

  .custom-textarea {
    flex: 1;
    border: none;
    outline: none;
    resize: none;
    font-size: 15px;
    line-height: 1.5;
    color: #2c3e50;
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 24px;
    max-height: 96px;
    overflow-y: auto;
    transition: all 0.2s ease;
  }

  .custom-textarea::placeholder {
    color: #94a3b8;
    font-weight: 400;
  }

  .custom-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .send-button {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #0A9AAE 0%, #0891b2 100%);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(10, 154, 174, 0.3);
    position: relative;
    overflow: hidden;
  }

  .send-button:hover:not(.disabled) {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 8px 20px rgba(10, 154, 174, 0.4);
    background: linear-gradient(135deg, #0891b2 0%, #0A9AAE 100%);
  }

  .send-button:active:not(.disabled) {
    transform: translateY(0) scale(0.98);
    transition: all 0.1s ease;
  }

  .send-button.disabled {
    background: #e2e8f0;
    color: #94a3b8;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .send-button.loading {
    background: linear-gradient(135deg, #0A9AAE 0%, #0891b2 100%);
    cursor: not-allowed;
  }

  .button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .send-icon {
    width: 20px;
    height: 20px;
    transition: all 0.3s ease;
  }

  .send-button:hover:not(.disabled) .send-icon {
    transform: translateX(2px) translateY(-2px);
  }

  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 滚动条样式 */
  .custom-textarea::-webkit-scrollbar {
    width: 4px;
  }

  .custom-textarea::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-textarea::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }

  .custom-textarea::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .message-post-container {
      margin: 0 16px 20px;
    }
    
    .textarea-container {
      padding: 12px 16px;
    }
    
    .send-button {
      width: 40px;
      height: 40px;
    }
    
    .send-icon {
      width: 18px;
      height: 18px;
    }
  }
}
</style>