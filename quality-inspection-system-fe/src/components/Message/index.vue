<template>
  <div class="message-container">
    <div :class="`avatar avatar-${avatar}`" ></div>
    <div :class="`message message-${avatar}`">
      <!-- 机器人消息始终使用Markdown渲染，包括流式输出过程中 -->
      <MarkdownRenderer v-if="avatar === 'bot'" :content="displayMessage" />
      <span v-else>{{ message }}</span>
      <el-icon v-if="loading" class="loading-icon"><Loading /></el-icon>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';

const props = defineProps({
  avatar: {
    type: String,
    require: true,
    default: "bot"
  },
  message: {
    type: String,
    require: true,
    default: "......"
  },
  loading: {
    type: Boolean,
    require: true,
    default: false,
  }
});

// 计算显示的消息内容
const displayMessage = computed(() => {
  if (props.loading && (!props.message || props.message.trim() === '')) {
    return '正在思考中...';
  }
  return props.message;
});
</script>

<style lang="less">
.message-container{
  width: 100%;
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  .avatar{
    width: 30px;
    height: 30px;
    background-size: 100% 100%;
    border-radius: 6px;
    margin-right: 6px;
    &-bot{
      background-image: url("./images/lawyer1.png");
      width: 40px;
      height: 40px;
    }
    &-user{
      background-image: url("./images/user3.png");
    }
  }
  .message{
    flex: 1;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    padding: 14px 18px;
    position: relative;
    margin-right: 12px;
    font-size: 14px;
    white-space: pre-line;
    color: #1a1a2e;
    font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei UI, Microsoft YaHei, Source Han Sans CN, sans-serif, Apple Color Emoji, Segoe UI Emoji !important;
    transition: all 0.2s ease;
    &-user{
      background: #ffffff;
    }
    &-bot{
      background: #ffffff;
    }
  }
  
  .loading-icon {
    margin-left: 8px;
    color: #0A9AAE;
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
}
</style>
