<template>
  <div class="IntelligentQA">
    <!-- 左侧历史会话侧边栏 -->
    <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <button class="new-chat-btn" @click="startNewChat">
          <svg class="plus-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span v-if="!sidebarCollapsed">新对话</span>
        </button>
        <button class="toggle-btn" @click="sidebarCollapsed = !sidebarCollapsed" :title="sidebarCollapsed ? '展开' : '收起'">
          <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path :d="sidebarCollapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <div class="session-list" v-if="!sidebarCollapsed">
        <div class="session-title">历史会话</div>
        <el-scrollbar height="calc(100vh - 140px)">
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
        </el-scrollbar>
      </div>
    </div>

    <!-- 右侧聊天区 -->
    <div class="chat-main">
      <div class="chat-header" v-if="!sidebarCollapsed">
        <span class="header-title">{{ currentSessionTitle || '智能法务助手' }}</span>
      </div>

      <div class="chat-list-container">
        <el-scrollbar ref="chatScrollRef">
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
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, nextTick, onMounted } from 'vue'
import { Service } from '@element-plus/icons-vue'
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
const chatScrollRef = ref<any>(null);
const sidebarCollapsed = ref(false);
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
const scrollToBottom = async () => {
  await nextTick();
  if (chatScrollRef.value) {
    const scrollbar = chatScrollRef.value;
    if (scrollbar.setScrollTop) {
      scrollbar.setScrollTop(99999);
    }
  }
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
    // 如果删除的是当前会话，清空聊天区
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
        // 刷新会话列表（因为可能新建了会话或更新了标题）
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
});
</script>

<style lang="less">
.IntelligentQA{
  height: calc(100vh - 60px);
  background-color: #dff9f8;
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ========== 侧边栏 ========== */
.sidebar {
  width: 260px;
  min-width: 260px;
  background: #1a1a2e;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease, min-width 0.3s ease;
  border-right: 1px solid rgba(255, 255, 255, 0.1);

  &.collapsed {
    width: 60px;
    min-width: 60px;
  }
}

.sidebar-header {
  padding: 16px 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.new-chat-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #0A9AAE, #0891b2);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(10, 154, 174, 0.4);
  }

  .plus-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
}

.toggle-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  color: #a0a0b0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .toggle-icon {
    width: 16px;
    height: 16px;
  }
}

.session-list {
  flex: 1;
  overflow: hidden;
  padding: 12px 0;
}

.session-title {
  padding: 0 16px 8px;
  font-size: 12px;
  color: #808090;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin: 2px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  &.active {
    background: rgba(10, 154, 174, 0.2);
    color: #0A9AAE;
  }

  .session-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .session-name {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #808090;
    cursor: pointer;
    border-radius: 4px;
    opacity: 0;
    transition: all 0.2s ease;
    flex-shrink: 0;

    svg {
      width: 14px;
      height: 14px;
    }

    &:hover {
      background: rgba(255, 80, 80, 0.2);
      color: #ff6b6b;
    }
  }

  &:hover .delete-btn {
    opacity: 1;
  }
}

.empty-sessions {
  padding: 20px;
  text-align: center;
  color: #606070;
  font-size: 13px;
}

/* ========== 聊天主区域 ========== */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}

.chat-header {
  width: 100%;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;

  .header-title {
    font-size: 15px;
    font-weight: 600;
    color: #1a1a2e;
  }
}

.chat-list-container{
  width: 100%;
  max-width: 850px;
  height: calc(100vh - 180px);
  min-height: calc(100vh - 180px);
  margin-bottom: -10px;
  overflow: hidden;
  scroll-behavior: smooth;
  margin-top: 20px;
  padding: 0 20px;
  box-sizing: border-box;
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

  &:hover {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
    border-color: rgba(10, 154, 174, 0.2);
  }

  &:focus-within {
    box-shadow: 0 16px 48px rgba(10, 154, 174, 0.15);
    border-color: #0A9AAE;
    transform: translateY(-2px);
  }
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

  &::placeholder {
    color: #94a3b8;
    font-weight: 400;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
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

  &:hover:not(.disabled) {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 8px 20px rgba(10, 154, 174, 0.4);
  }

  &:active:not(.disabled) {
    transform: translateY(0) scale(0.98);
    transition: all 0.1s ease;
  }

  &.disabled {
    background: #e2e8f0;
    color: #94a3b8;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  &.loading {
    background: linear-gradient(135deg, #0A9AAE 0%, #0891b2 100%);
    cursor: not-allowed;
  }
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
  .sidebar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.3s ease;

    &:not(.collapsed) {
      transform: translateX(0);
    }
  }

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
</style>
