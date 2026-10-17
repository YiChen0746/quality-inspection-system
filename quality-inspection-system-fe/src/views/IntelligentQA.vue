<template>
  <div class="intelligent-qa">
    <!-- 左侧历史会话侧边栏 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <button class="new-chat-btn" @click="startNewChat">
          <svg class="plus-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>新对话</span>
        </button>
      </div>

      <div class="session-list-wrap">
        <div class="session-title">历史会话</div>
        <div class="session-list">
          <div
            v-for="session in sessions"
            :key="session.id"
            class="session-item"
            :class="{ active: currentSessionId === session.id }"
            @click="loadSession(session.id)"
          >
            <svg class="session-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="session-name">{{ session.title }}</span>
            <button
              class="delete-btn"
              @click.stop="handleDeleteSession(session.id)"
              title="删除会话"
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div v-if="sessions.length === 0" class="empty-sessions">
            暂无历史会话
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧聊天区 -->
    <div class="chat-main">
      <div class="chat-header">
        <span class="header-title">{{ currentSessionTitle || '智能法务助手' }}</span>
      </div>

      <div class="chat-list">
        <Message 
          v-if="!currentSessionId"
          :avatar="bot" 
          message="你好，我是智能法务助理，专门为您解答法律相关问题。有什么法律问题就来问我吧 ~"
          :loading="false"
        ></Message>
        <Message 
          v-for="(message, index) in data.messageList" 
          :key="index" 
          :avatar="message.type" 
          :message="message.content"
          :loading="message.loading"
        ></Message>
      </div>

      <div class="chat-input-area">
        <div class="input-box">
          <textarea
            v-model="data.questionMessage"
            class="input-textarea"
            placeholder="请输入您的法律问题，按 Enter 发送..."
            @keydown="handleKeyDown"
            :disabled="data.isLoading"
            rows="1"
            ref="textareaRef"
            @input="adjustTextareaHeight"
          ></textarea>
          <button 
            @click="onSubmit" 
            class="send-btn"
            :class="{ 'loading': data.isLoading, 'disabled': !data.questionMessage.trim() || data.isLoading }"
            :disabled="!data.questionMessage.trim() || data.isLoading"
          >
            <svg v-if="!data.isLoading" class="send-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div v-else class="loading-spinner">
              <div class="spinner"></div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus';
import Message from '@/components/Message/index.vue';
import {
  getIntelligentQAResultStream,
  getChatSessions,
  getChatSessionMessages,
  deleteChatSession,
  type ChatSessionItem
} from '@Setup/request/index.ts';

enum EMessageType {
  User = 'user',
  Bot = 'bot',
}

interface MessageItem {
  type: EMessageType;
  content: string;
  loading: boolean;
}

const data = reactive({
  questionMessage: '',
  messageList: [] as MessageItem[],
  isLoading: false,
})

const bot = 'bot';
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const sessions = ref<ChatSessionItem[]>([]);
const currentSessionId = ref<number | null>(null);
const currentSessionTitle = ref('');

// 自动调整textarea高度
const adjustTextareaHeight = async () => {
  await nextTick();
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    const scrollHeight = textareaRef.value.scrollHeight;
    const maxHeight = 60;
    textareaRef.value.style.height = Math.min(scrollHeight, maxHeight) + 'px';
  }
};

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    const chatList = document.querySelector('.chat-list');
    if (chatList) {
      chatList.scrollTop = chatList.scrollHeight;
    }
  });
};

// 处理键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    if (event.ctrlKey) {
      return;
    } else {
      event.preventDefault();
      onSubmit();
    }
  }
}

// 加载会话列表
const loadSessions = async () => {
  try {
    const list = await getChatSessions();
    sessions.value = list;
  } catch (error: any) {
    console.error('加载会话列表失败:', error);
  }
}

// 加载指定会话的消息
const loadSession = async (sessionId: number) => {
  if (data.isLoading) return;
  try {
    const detail = await getChatSessionMessages(sessionId);
    currentSessionId.value = sessionId;
    currentSessionTitle.value = detail.session.title;
    data.messageList = detail.messages.map(m => ({
      type: m.role === 'user' ? EMessageType.User : EMessageType.Bot,
      content: m.content,
      loading: false
    }));
    scrollToBottom();
  } catch (error: any) {
    ElMessage.error(error.message || '加载会话失败');
  }
}

// 开始新对话
const startNewChat = () => {
  if (data.isLoading) return;
  currentSessionId.value = null;
  currentSessionTitle.value = '';
  data.messageList = [];
  data.questionMessage = '';
  adjustTextareaHeight();
}

// 删除会话
const handleDeleteSession = async (sessionId: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这个会话吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }

  try {
    await deleteChatSession(sessionId);
    ElMessage.success('删除成功');
    if (currentSessionId.value === sessionId) {
      startNewChat();
    }
    await loadSessions();
  } catch (error: any) {
    ElMessage.error(error.message || '删除失败');
  }
}

// 发送消息
const onSubmit = async () => {
  if (!data.questionMessage.trim()) {
    return ElMessage({ message: '请输入您的法律问题 ~', type: 'warning' });
  }

  if (data.isLoading) {
    return;
  }

  const userQuestion = data.questionMessage.trim();
  data.questionMessage = '';
  adjustTextareaHeight();
  data.isLoading = true;

  // 添加用户消息
  data.messageList.push({
    type: EMessageType.User,
    content: userQuestion,
    loading: false,
  });

  // 添加机器人回复占位符
  const botMessageIndex = data.messageList.push({
    type: EMessageType.Bot,
    content: '',
    loading: true,
  }) - 1;

  scrollToBottom();

  try {
    let accumulatedContent = '';

    await getIntelligentQAResultStream({
      messages: data.messageList
        .filter(m => !m.loading || m.type === EMessageType.User)
        .map(m => ({
          role: m.type === EMessageType.User ? 'user' as const : 'assistant' as const,
          content: m.content
        })),
      sessionId: currentSessionId.value,
      onChunk: (chunk: string) => {
        accumulatedContent += chunk;
        data.messageList[botMessageIndex] = {
          type: EMessageType.Bot,
          content: accumulatedContent,
          loading: true,
        };
        scrollToBottom();
      },
      onComplete: async () => {
        data.messageList[botMessageIndex] = {
          type: EMessageType.Bot,
          content: accumulatedContent,
          loading: false,
        };
        data.isLoading = false;
        scrollToBottom();
        await loadSessions();
      },
      onError: (error: Error) => {
        console.error('流式API调用失败:', error);
        ElMessage.error(error.message || '请求出错，请稍后再试 ~');
        data.messageList.splice(botMessageIndex, 1);
        data.isLoading = false;
      },
      onSessionStart: (sessionId: number, isNew: boolean) => {
        if (!currentSessionId.value) {
          currentSessionId.value = sessionId;
        }
      }
    });

  } catch (error) {
    console.error('API 调用失败:', error);
    ElMessage.error('请求出错，请稍后再试 ~');
    data.messageList.splice(botMessageIndex, 1);
    data.isLoading = false;
  }
}

onMounted(() => {
  loadSessions();
  adjustTextareaHeight();
});
</script>

<style scoped>
.intelligent-qa {
  height: calc(100vh - 60px);
  display: flex;
  background-color: #f5f7fa;
  overflow: hidden;
}

/* ========== 侧边栏（白色主题） ========== */
.sidebar {
  width: 260px;
  min-width: 260px;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  background: #0A9AAE;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.new-chat-btn:hover {
  background: #0891b2;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(10, 154, 174, 0.3);
}

.plus-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.session-list-wrap {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.session-title {
  padding: 12px 16px 8px;
  font-size: 12px;
  color: #9ca3af;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 16px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 2px;
}

.session-item:hover {
  background: #f3f4f6;
}

.session-item.active {
  background: #ecfeff;
  color: #0A9AAE;
}

.session-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #9ca3af;
}

.session-item.active .session-icon {
  color: #0A9AAE;
}

.session-name {
  flex: 1;
  font-size: 13px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item.active .session-name {
  color: #0A9AAE;
  font-weight: 500;
}

.delete-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.delete-btn svg {
  width: 14px;
  height: 14px;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

.session-item:hover .delete-btn {
  opacity: 1;
}

.empty-sessions {
  padding: 24px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}

/* ========== 聊天主区域 ========== */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header {
  padding: 14px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  text-align: center;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.chat-input-area {
  padding: 16px 20px 24px;
  background: #f5f7fa;
}

.input-box {
  position: relative;
  max-width: 750px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.input-box:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border-color: rgba(10, 154, 174, 0.2);
}

.input-box:focus-within {
  box-shadow: 0 8px 24px rgba(10, 154, 174, 0.15);
  border-color: #0A9AAE;
}

.input-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-size: 15px;
  line-height: 1.5;
  color: #1f2937;
  background: transparent;
  padding: 16px 60px 16px 20px;
  min-height: 24px;
  max-height: 96px;
  overflow-y: auto;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.input-textarea::placeholder {
  color: #9ca3af;
}

.input-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-btn {
  position: absolute;
  right: 12px;
  bottom: 10px;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: #0A9AAE;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.send-btn:hover:not(.disabled) {
  background: #0891b2;
  transform: scale(1.05);
}

.send-btn.disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.send-btn.loading {
  background: #0A9AAE;
  cursor: not-allowed;
}

.send-icon {
  width: 18px;
  height: 18px;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式 */
@media (max-width: 768px) {
  .chat-input-area {
    padding: 12px 16px 20px;
  }
}
</style>
