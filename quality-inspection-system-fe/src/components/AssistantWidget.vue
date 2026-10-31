<template>
  <!-- 浮动法官助手 -->
  <div
    v-if="visible"
    class="assistant-float"
    :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
    @mousedown="startDrag"
  >
    <!-- 对话框提示 -->
    <div v-if="!panelOpen" class="assistant-bubble" @click.stop="openPanel">
      <span>{{ bubbleText }}</span>
      <div class="bubble-arrow"></div>
    </div>

    <!-- 法官头像 -->
    <div class="assistant-avatar" :class="{ bouncing: !panelOpen }" @click.stop="togglePanel">
      <img src="@/assets/assistant-judge.png" alt="助手" />
      <div v-if="isRecording" class="recording-dot"></div>
    </div>

    <!-- 对话面板 -->
    <transition name="panel">
      <div v-if="panelOpen" class="assistant-panel" @mousedown.stop>
        <!-- 面板头部（可拖动区域） -->
        <div class="panel-header" @mousedown="startDrag">
          <span class="panel-title">⚖️ 约法三章助手</span>
          <button class="panel-close" @click="closePanel">×</button>
        </div>

        <!-- 消息区 -->
        <div class="panel-messages" ref="msgBox">
          <div v-for="(m, i) in messages" :key="i" class="msg-row" :class="m.role">
            <div v-if="m.role === 'bot'" class="msg-avatar">
              <img src="@/assets/assistant-judge.png" />
            </div>
            <div class="msg-bubble">{{ m.text }}</div>
          </div>
          <div v-if="thinking" class="msg-row bot">
            <div class="msg-avatar"><img src="@/assets/assistant-judge.png" /></div>
            <div class="msg-bubble thinking"><span></span><span></span><span></span></div>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="panel-input">
          <input
            v-model="inputText"
            class="input-text"
            placeholder="输入你的问题，或点麦克风说话…"
            @keyup.enter="sendMessage"
          />
          <button
            class="btn-mic"
            :class="{ recording: isRecording }"
            :title="isRecording ? '停止录音' : '语音输入'"
            @click="toggleSpeech"
          >{{ isRecording ? '⏹' : '🎙' }}</button>
          <button class="btn-send" @click="sendMessage">发送</button>
        </div>
        <div v-if="speechInterim" class="speech-hint">🎤 {{ speechInterim }}</div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getAuthHeaders } from '@Setup/storage/user.js'

const router = useRouter()
const route = useRoute()

// 首页：整个助手（头像+弹窗）都不显示
// 多智能体页面：头像保留，但不打开对话弹窗
const isHome = computed(() => route.path === '/knowledge_promotion' || route.path === '/')
const isMultiAgent = computed(() => route.path === '/multi-agent')
const visible = computed(() => !isHome.value)

// ===== 位置与拖动 =====
const pos = reactive({ x: window.innerWidth - 130, y: window.innerHeight - 180 })
let dragging = false
let dragOffset = { x: 0, y: 0 }

const startDrag = (e) => {
  dragging = true
  const rect = e.currentTarget.getBoundingClientRect()
  // 只在头像/头部区域触发拖动（bubble 点击不拖）
  dragOffset.x = e.clientX - rect.left
  dragOffset.y = e.clientY - rect.top
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}
const onDrag = (e) => {
  if (!dragging) return
  pos.x = Math.min(window.innerWidth - 60, Math.max(0, e.clientX - dragOffset.x))
  pos.y = Math.min(window.innerHeight - 60, Math.max(0, e.clientY - dragOffset.y))
}
const stopDrag = () => {
  dragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// ===== 面板 =====
const panelOpen = ref(false)
const togglePanel = () => {
  if (isMultiAgent.value) return  // 多智能体页面禁止打开弹窗
  panelOpen.value = !panelOpen.value
}
const openPanel = () => {
  if (isMultiAgent.value) return
  panelOpen.value = true
}
const closePanel = () => { panelOpen.value = false }

// 进入多智能体页面时自动关闭弹窗
watch(isMultiAgent, (val) => {
  if (val) panelOpen.value = false
})

// ===== 气泡文案 =====
// 用户正在输入/录音时提示语音输入，否则随机友好问候
const greetings = [
  '有不懂的可以问我~',
  '需要帮助随时叫我！',
  '点击我开始对话吧',
  '合同有问题？我来帮你',
  '试试对我说"去合同起草"',
  '我可以带你操作各个功能哦',
  '点我打开智能助手',
]
const greetingIdx = ref(0)
const bubbleText = computed(() => {
  if (inputText.value.trim() || isRecording.value) {
    return '输入太麻烦？试试语音输入'
  }
  return greetings[greetingIdx.value]
})
// 每隔一段时间切换问候语
let greetTimer = null
const rotateGreeting = () => {
  greetingIdx.value = Math.floor(Math.random() * greetings.length)
}

// ===== 消息 =====
const messages = ref([
  { role: 'bot', text: '你好！我是约法三章助手，可以帮你：\n• 说"去合同起草"跳转页面\n• 问我系统怎么用\n• 点麦克风语音输入需求' }
])
const inputText = ref('')
const thinking = ref(false)
const msgBox = ref(null)

const scrollBottom = () => {
  nextTick(() => {
    if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight
  })
}

// 页面导航关键词映射
const navMap = [
  { keys: ['合同起草', '起草合同', '写合同', '起草'], path: '/contract-draft', desc: '合同起草' },
  { keys: ['合同审查', '审查合同', '快速审查', '初筛'], path: '/contract-review', desc: '合同审查' },
  { keys: ['多智能体', '深度审查', '多agent', '多代理'], path: '/multi-agent', desc: '多智能体审查' },
  { keys: ['法务助手', '智能问答', '问答', '助手'], path: '/intelligent_Q_A', desc: '法务助手' },
  { keys: ['合同分析', '分析', '统计'], path: '/result_analysis', desc: '合同分析' },
  { keys: ['首页', '主页', '回去', '返回首页'], path: '/knowledge_promotion', desc: '首页' },
]

const tryNavigate = (text) => {
  for (const item of navMap) {
    if (item.keys.some(k => text.includes(k))) {
      router.push(item.path)
      return `已为你打开【${item.desc}】页面`
    }
  }
  return null
}

// ===== 发送消息 =====
const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text) return
  messages.value.push({ role: 'user', text })
  inputText.value = ''
  scrollBottom()

  // 先尝试导航
  const navResult = tryNavigate(text)
  if (navResult) {
    messages.value.push({ role: 'bot', text: navResult })
    scrollBottom()
    return
  }

  // 否则调用智能问答
  thinking.value = true
  scrollBottom()
  try {
    const resp = await fetch('/api/intelligent_qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ question: text })
    })
    const json = await resp.json()
    let reply
    if (json.err_code === 0 && json.data?.answer) {
      reply = json.data.answer
    } else {
      reply = '我暂时还在学习中~ 你可以试试说"去合同起草"或"怎么审查合同"，我来带你操作。'
    }
    messages.value.push({ role: 'bot', text: reply })
  } catch (e) {
    messages.value.push({ role: 'bot', text: '网络开小差了，请稍后再试。你也可以直接说要去哪个页面，比如"打开合同审查"。' })
  } finally {
    thinking.value = false
    scrollBottom()
  }
}

// ===== 语音输入 =====
const isRecording = ref(false)
const speechInterim = ref('')
let recognition = null

const initSpeech = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return
  const rec = new SR()
  rec.lang = 'zh-CN'
  rec.continuous = false
  rec.interimResults = true
  rec.onresult = (e) => {
    let final = '', interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) final += t
      else interim += t
    }
    if (final) {
      inputText.value = (inputText.value ? inputText.value + ' ' : '') + final
      speechInterim.value = ''
    } else {
      speechInterim.value = interim
    }
  }
  rec.onend = () => { isRecording.value = false; speechInterim.value = '' }
  rec.onerror = (e) => {
    isRecording.value = false
    if (e.error === 'not-allowed') ElMessage.error('请允许麦克风权限')
    else if (e.error !== 'aborted') ElMessage.warning('语音识别异常：' + e.error)
  }
  recognition = rec
}

const toggleSpeech = () => {
  if (!recognition) {
    ElMessage.warning('当前浏览器不支持语音输入，请使用 Chrome 或 Edge')
    return
  }
  if (isRecording.value) {
    recognition.stop()
    isRecording.value = false
  } else {
    try {
      recognition.start()
      isRecording.value = true
    } catch (e) { /* ignore */ }
  }
}

onMounted(() => {
  initSpeech()
  rotateGreeting()
  greetTimer = setInterval(rotateGreeting, 8000)
})
onBeforeUnmount(() => {
  if (recognition) recognition.abort()
  if (greetTimer) clearInterval(greetTimer)
})
</script>

<style scoped>
.assistant-float {
  position: fixed;
  z-index: 9999;
  user-select: none;
}

/* 对话框提示 */
.assistant-bubble {
  position: absolute;
  right: 72px;
  top: 18px;
  background: #fff;
  color: #333;
  padding: 8px 14px;
  border-radius: 14px;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 3px 12px rgba(0,0,0,0.15);
  cursor: pointer;
  animation: floatMsg 2.5s ease-in-out infinite;
}
.bubble-arrow {
  position: absolute;
  right: -6px;
  top: 12px;
  width: 0;
  height: 0;
  border-left: 7px solid #fff;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
}
@keyframes floatMsg {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* 头像 */
.assistant-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(14, 43, 87, 0.35);
  border: 3px solid #fff;
  background: #fff;
  position: relative;
}
.assistant-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.assistant-avatar.bouncing {
  animation: bounce 2s ease-in-out infinite;
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.recording-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff4757;
  border: 2px solid #fff;
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 对话面板 */
.assistant-panel {
  position: absolute;
  right: 0;
  bottom: 78px;
  width: 340px;
  height: 440px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-enter-active, .panel-leave-active {
  transition: all 0.25s ease;
}
.panel-enter-from, .panel-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
}
.panel-header {
  background: linear-gradient(135deg, #0e2b57, #1e4d8c);
  color: #fff;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
}
.panel-title { font-weight: 600; font-size: 15px; }
.panel-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}
.panel-close:hover { opacity: 0.7; }

.panel-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #f5f7fa;
}
.msg-row {
  display: flex;
  margin-bottom: 12px;
  gap: 8px;
}
.msg-row.user { flex-direction: row-reverse; }
.msg-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid #ddd;
}
.msg-avatar img { width: 100%; height: 100%; object-fit: cover; }
.msg-bubble {
  max-width: 240px;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-row.bot .msg-bubble {
  background: #fff;
  border-top-left-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.msg-row.user .msg-bubble {
  background: #1e4d8c;
  color: #fff;
  border-top-right-radius: 4px;
}
.msg-bubble.thinking {
  display: inline-flex;
  gap: 4px;
  padding: 10px 14px;
}
.msg-bubble.thinking span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #999;
  animation: blink 1.4s infinite both;
}
.msg-bubble.thinking span:nth-child(2) { animation-delay: 0.2s; }
.msg-bubble.thinking span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

.panel-input {
  display: flex;
  gap: 6px;
  padding: 10px;
  border-top: 1px solid #eee;
  background: #fff;
}
.input-text {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  outline: none;
}
.input-text:focus { border-color: #1e4d8c; }
.btn-mic, .btn-send {
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
}
.btn-mic {
  background: #f0f0f0;
  color: #666;
}
.btn-mic.recording {
  background: #ff4757;
  color: #fff;
}
.btn-send {
  background: #1e4d8c;
  color: #fff;
}
.btn-send:hover { background: #0e2b57; }
.speech-hint {
  padding: 4px 12px;
  font-size: 12px;
  color: #1e4d8c;
  background: #eef4ff;
  border-top: 1px solid #eee;
}
</style>
