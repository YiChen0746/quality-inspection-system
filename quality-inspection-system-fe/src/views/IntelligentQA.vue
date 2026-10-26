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

      <!-- 技能中心：可互动按钮，点击即用（开源化：支持自建/导入/分享技能包） -->
      <div class="skill-section">
        <div class="skill-header">
          <span class="session-title">🛠 技能中心</span>
          <div class="skill-header-actions">
            <button type="button" class="skill-mini-btn" title="创建自己的技能" @click="openSkillForm()">＋ 添加</button>
            <button type="button" class="skill-mini-btn" title="导入他人分享的技能包或分享码" @click="importDialogVisible = true">📥 导入</button>
          </div>
        </div>
        <input ref="importPackInput" type="file" accept=".json,application/json" style="display: none" @change="handleImportPack" />
        <div class="skill-grid">
          <div
            v-for="(skill, idx) in allSkills"
            :key="skill.name"
            class="skill-btn-wrap"
          >
            <button
              class="skill-btn"
              :disabled="data.isLoading"
              @click="useSkill(skill)"
            >
              <span class="skill-icon">{{ skill.icon }}</span>
              <span class="skill-name">{{ skill.name }}</span>
              <span class="skill-desc">{{ skill.desc }}</span>
            </button>
            <!-- 卡片操作：分享 / 编辑(fork) / 删除 -->
            <div class="skill-actions">
              <span class="skill-tag" title="内置技能" v-if="idx < builtinSkills.length">内置</span>
              <span class="skill-tag mine" title="你创建的技能" v-else>自建</span>
              <button type="button" class="skill-op" title="分享（分享码 / 文件）" @click.stop="openShareDialog(skill)">📤</button>
              <button
                type="button"
                class="skill-op"
                :title="idx < builtinSkills.length ? '复制一份来修改（Fork）' : '编辑此技能'"
                @click.stop="idx < builtinSkills.length ? openSkillForm(skill) : openSkillForm(skill, idx - builtinSkills.length)"
              >✎</button>
              <button
                v-if="idx >= builtinSkills.length"
                type="button"
                class="skill-op danger"
                title="删除此技能"
                @click.stop="removeUserSkill(idx - builtinSkills.length)"
              >✕</button>
            </div>
          </div>
        </div>
        <div class="skill-tip">💡 每个技能都能 ✎ Fork 修改、📤 导出分享；收到别人的 .json 技能包点「导入」即可使用</div>
      </div>

      <!-- 添加/编辑技能弹窗 -->
      <el-dialog v-model="skillFormVisible" :title="skillEditIndex >= 0 ? '编辑技能' : '创建新技能'" width="480px" append-to-body>
        <div class="skill-form">
          <div class="skill-form-row">
            <div class="skill-form-field icon-field">
              <label>图标</label>
              <div class="icon-presets">
                <span
                  v-for="ic in SKILL_ICON_PRESETS"
                  :key="ic"
                  class="icon-preset"
                  :class="{ active: skillForm.icon === ic }"
                  @click="skillForm.icon = ic"
                >{{ ic }}</span>
              </div>
            </div>
          </div>
          <div class="skill-form-row">
            <div class="skill-form-field">
              <label>技能名称 *</label>
              <input v-model="skillForm.name" maxlength="12" placeholder="如：押金纠纷分析" />
            </div>
            <div class="skill-form-field">
              <label>一句话描述</label>
              <input v-model="skillForm.desc" maxlength="14" placeholder="如：押金退还问题逐条分析" />
            </div>
          </div>
          <div class="skill-form-row">
            <div class="skill-form-field">
              <label>触发方式</label>
              <div class="radio-line">
                <label class="radio-item"><input v-model="skillForm.action" type="radio" value="prompt" /> 填入模板（我补充内容后发送）</label>
                <label class="radio-item"><input v-model="skillForm.action" type="radio" value="send" /> 直接发送（一点就问）</label>
              </div>
            </div>
          </div>
          <div class="skill-form-row">
            <div class="skill-form-field">
              <label>提示词 / 问题内容 *</label>
              <textarea v-model="skillForm.text" rows="5" placeholder="写清楚让 AI 做什么。提示：想留填写位置，可以用「」或引号包住"></textarea>
            </div>
          </div>
          <div v-if="skillForm.action === 'prompt'" class="skill-form-row">
            <div class="skill-form-field">
              <label>光标停在距末尾 {{ skillForm.cursorBefore }} 个字符处</label>
              <input v-model.number="skillForm.cursorBefore" type="range" min="0" :max="skillForm.text.length" />
              <div class="cursor-preview">预览：{{ skillForm.text.slice(0, skillForm.text.length - skillForm.cursorBefore) }}<span class="cursor-mark">|</span>{{ skillForm.text.slice(skillForm.text.length - skillForm.cursorBefore) }}</div>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button @click="triggerImportPack">📥 从 JSON 导入</el-button>
          <el-button @click="skillFormVisible = false">取消</el-button>
          <el-button type="primary" @click="saveUserSkill">保存技能</el-button>
        </template>
      </el-dialog>

      <!-- 技能分享弹窗：分享码 + 文件两种方式 -->
      <el-dialog v-model="skillShareVisible" title="📤 分享技能" width="480px" append-to-body>
        <div class="share-box">
          <div class="share-label">方式一：复制分享码，粘贴发给同学（微信/QQ 直接发文本）</div>
          <textarea class="share-code" :value="skillShareCode" rows="4" readonly @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
          <el-button type="primary" @click="copyShareCode">📋 复制分享码</el-button>
          <el-divider>或</el-divider>
          <div class="share-label">方式二：下载 .json 技能包文件</div>
          <el-button v-if="skillSharing" @click="exportSkill(skillSharing)">💾 下载技能包文件</el-button>
        </div>
      </el-dialog>

      <!-- 导入技能弹窗：文件 / 分享码 -->
      <el-dialog v-model="importDialogVisible" title="📥 导入技能" width="480px" append-to-body>
        <div class="share-box">
          <div class="share-label">方式一：粘贴他人发来的分享码（LQA1: 开头）</div>
          <textarea class="share-code" v-model="importPasteCode" rows="4" placeholder="把分享码完整粘贴到这里…"></textarea>
          <el-button type="primary" :disabled="!importPasteCode.trim()" @click="importFromCode">安装技能</el-button>
          <el-divider>或</el-divider>
          <div class="share-label">方式二：选择 .json 技能包文件</div>
          <el-button @click="triggerImportPack">📂 选择文件</el-button>
        </div>
      </el-dialog>
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
import { reactive, ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus';
import Message from '@/components/Message/index.vue';
import { getAuthHeaders } from '@Setup/storage/user.js';
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
const router = useRouter();

// ==================== 技能中心（开源化：内置技能 + 社区自建技能包） ====================
// action 类型：prompt=填入模板并定位光标待用户补充 | send=直接发送 | api=调接口取真实数据 | nav=跳转页面
interface Skill {
  icon: string;
  name: string;
  desc: string;
  action: 'prompt' | 'send' | 'api' | 'nav';
  text?: string;          // prompt/send 用的文本
  cursorBefore?: number;  // prompt 模式：光标定位在距末尾 N 个字符处
  api?: string;           // api 模式的接口地址
  path?: string;          // nav 模式的路由
}

// 技能包文件格式（可分享给他人导入，类似 GitHub 分享 gist）
// { skillpack: "legal-qa-skill", version: 1, icon, name, desc, action, text, cursorBefore }
const SKILLPACK_KEY = 'legal-qa-user-skills';

const builtinSkills: Skill[] = [
  {
    icon: '⚠️', name: '条款风险速查', desc: '粘贴条款秒评风险', action: 'prompt',
    text: '【条款风险速查】请评估以下合同条款的法律风险，指出问题所在并给出具体修改建议：\n「」',
    cursorBefore: 1
  },
  {
    icon: '⚖️', name: '法条原文检索', desc: '按主题查法条原文', action: 'prompt',
    text: '【法条检索】请检索并完整列出与“”相关的现行法律条文（注明《法律名称》第X条及条文原文）：',
    cursorBefore: 24
  },
  {
    icon: '🎓', name: '新手避坑指南', desc: '大学生签合同常见坑', action: 'send',
    text: '我是第一次签合同的大学应届生。请分别告诉我签【租房合同】和【兼职/实习劳务合同】时最容易踩的 5 个坑，每个坑给出对应的法律依据（《法律名称》第X条）和一句可操作的防范建议。'
  },
  {
    icon: '📊', name: '我的合同概览', desc: '合同总数与风险统计', action: 'api',
    api: '/api/dashboard_stats'
  },
  {
    icon: '⏰', name: '到期提醒', desc: '30 天内到期合同', action: 'api',
    api: '/api/expiring_contracts?days=30'
  },
  {
    icon: '📄', name: '去起草合同', desc: '专家智能体帮你写', action: 'nav',
    path: '/contract-draft'
  }
];

// ============ 开源化：用户自建技能（localStorage 持久化，可导入导出分享） ============
const userSkills = ref<Skill[]>([]);

try {
  const saved = localStorage.getItem(SKILLPACK_KEY);
  if (saved) userSkills.value = JSON.parse(saved);
} catch (e) { /* 忽略损坏数据 */ }

const saveUserSkills = () => {
  try { localStorage.setItem(SKILLPACK_KEY, JSON.stringify(userSkills.value)); } catch (e) { /* ignore */ }
};

// 展示列表 = 内置 + 自建
const allSkills = computed<Skill[]>(() => [...builtinSkills, ...userSkills.value]);

// 添加/编辑技能弹窗
const skillFormVisible = ref(false);
const skillEditIndex = ref(-1); // -1=新建，>=0=编辑对应自建技能
const skillForm = reactive<Skill>({
  icon: '✨',
  name: '',
  desc: '',
  action: 'prompt',
  text: '',
  cursorBefore: 0
});

const SKILL_ICON_PRESETS = ['✨', '⚠️', '⚖️', '🎓', '📊', '⏰', '📄', '🧾', '🔍', '💡', '🛡️', '📝'];

const openSkillForm = (skill?: Skill, index = -1) => {
  if (skill) {
    // 编辑自建技能，或从内置技能“Fork”一份来改
    Object.assign(skillForm, {
      icon: skill.icon, name: skill.name, desc: skill.desc,
      action: skill.action, text: skill.text || '', cursorBefore: skill.cursorBefore ?? 0
    });
    skillEditIndex.value = index;
  } else {
    Object.assign(skillForm, { icon: '✨', name: '', desc: '', action: 'prompt', text: '', cursorBefore: 0 });
    skillEditIndex.value = -1;
  }
  skillFormVisible.value = true;
};

const saveUserSkill = () => {
  if (!skillForm.name.trim()) { ElMessage.warning('请填写技能名称'); return; }
  if (!skillForm.text.trim()) { ElMessage.warning('请填写提示词/问题内容'); return; }
  const item: Skill = {
    icon: skillForm.icon || '✨',
    name: skillForm.name.trim(),
    desc: skillForm.desc.trim() || '自定义技能',
    action: skillForm.action === 'send' ? 'send' : 'prompt',
    text: skillForm.text,
    cursorBefore: skillForm.action === 'prompt' ? Math.max(0, Math.min(skillForm.cursorBefore ?? 0, skillForm.text.length)) : 0
  };
  if (skillEditIndex.value >= 0) {
    userSkills.value[skillEditIndex.value] = item;
  } else {
    // 重名检查
    if (allSkills.value.some(s => s.name === item.name)) {
      ElMessage.warning('已存在同名技能，请换个名字');
      return;
    }
    userSkills.value.push(item);
  }
  saveUserSkills();
  skillFormVisible.value = false;
  ElMessage.success(skillEditIndex.value >= 0 ? '技能已更新' : `技能「${item.name}」已添加`);
};

const removeUserSkill = (index: number) => {
  const skill = userSkills.value[index];
  ElMessageBox.confirm(`确定删除技能「${skill.name}」吗？`, '删除技能', { type: 'warning' })
    .then(() => {
      userSkills.value.splice(index, 1);
      saveUserSkills();
      ElMessage.success('已删除');
    })
    .catch(() => {});
};

// 导出单个技能为 .json 技能包文件（分享给他人）
const exportSkill = (skill: Skill) => {
  const pack = {
    skillpack: 'legal-qa-skill',
    version: 1,
    exportedAt: new Date().toISOString(),
    icon: skill.icon, name: skill.name, desc: skill.desc,
    action: skill.action, text: skill.text || '',
    cursorBefore: skill.cursorBefore ?? 0
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `skill-${skill.name.replace(/[\\/:*?"<>|\s]+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ============ 技能分享码（base64 文本码，微信/群里直接粘贴传播） ============
// 格式：LQA1:<base64(utf-8(json))>，前缀便于识别与容错
const encodeSkillPack = (skill: Skill): string => {
  const pack = {
    skillpack: 'legal-qa-skill',
    version: 1,
    icon: skill.icon, name: skill.name, desc: skill.desc,
    action: skill.action, text: skill.text || '',
    cursorBefore: skill.cursorBefore ?? 0
  };
  const json = JSON.stringify(pack);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return 'LQA1:' + btoa(bin);
};

const decodeSkillPack = (code: string): Skill => {
  const raw = String(code || '').trim().replace(/\s+/g, '');
  if (!raw.startsWith('LQA1:')) throw new Error('分享码格式不对，应以 LQA1: 开头');
  const bin = atob(raw.slice(5));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const pack = JSON.parse(new TextDecoder().decode(bytes));
  if (pack.skillpack !== 'legal-qa-skill' || !pack.name || !pack.text) throw new Error('分享码内容无效');
  return {
    icon: pack.icon || '✨',
    name: String(pack.name),
    desc: pack.desc || '来自分享码',
    action: pack.action === 'send' ? 'send' : 'prompt',
    text: String(pack.text),
    cursorBefore: Number(pack.cursorBefore) || 0
  };
};

// 分享弹窗：显示分享码 + 复制 + 下载文件
const skillShareVisible = ref(false);
const skillShareCode = ref('');
const skillSharing = ref<Skill | null>(null);
const openShareDialog = (skill: Skill) => {
  try {
    skillSharing.value = skill;
    skillShareCode.value = encodeSkillPack(skill);
    skillShareVisible.value = true;
  } catch (e) {
    ElMessage.error('生成分享码失败');
  }
};

const copyShareCode = async () => {
  try {
    await navigator.clipboard.writeText(skillShareCode.value);
    ElMessage.success('分享码已复制，粘贴发给同学即可');
  } catch (e) {
    // 剪贴板 API 不可用时降级为手动选择
    const ta = document.createElement('textarea');
    ta.value = skillShareCode.value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    ElMessage.success('分享码已复制');
  }
};

// 导入弹窗：文件 / 分享码 两种方式
const importDialogVisible = ref(false);
const importPasteCode = ref('');
const importPackInput = ref<HTMLInputElement | null>(null);
const triggerImportPack = () => importPackInput.value?.click();

const installSkill = (skill: Skill) => {
  if (allSkills.value.some(s => s.name === skill.name)) {
    ElMessage.warning(`已存在同名技能「${skill.name}」，请先删除或重命名`);
    return;
  }
  userSkills.value.push(skill);
  saveUserSkills();
  ElMessage.success(`技能「${skill.name}」已安装到技能中心`);
};

const handleImportPack = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 允许重复选择同一文件
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const pack = JSON.parse(String(reader.result));
      if (pack.skillpack !== 'legal-qa-skill' || !pack.name || !pack.text) {
        throw new Error('不是有效的技能包文件');
      }
      installSkill({
        icon: pack.icon || '✨',
        name: String(pack.name),
        desc: pack.desc || '来自技能包',
        action: pack.action === 'send' ? 'send' : 'prompt',
        text: String(pack.text),
        cursorBefore: Number(pack.cursorBefore) || 0
      });
    } catch (e: any) {
      ElMessage.error(e.message || '技能包解析失败，请检查文件内容');
    }
  };
  reader.readAsText(file);
};

const importFromCode = () => {
  try {
    const skill = decodeSkillPack(importPasteCode.value);
    installSkill(skill);
    importPasteCode.value = '';
    importDialogVisible.value = false;
  } catch (e: any) {
    ElMessage.error(e.message || '分享码无效');
  }
};

// 使用技能：可互动按钮的统一入口
const useSkill = async (skill: Skill) => {
  if (data.isLoading) return;

  if (skill.action === 'nav' && skill.path) {
    router.push(skill.path);
    return;
  }

  if (skill.action === 'prompt' && skill.text) {
    // 填入模板文本，光标定位到待填写处，用户补充后回车即发送
    data.questionMessage = skill.text;
    await adjustTextareaHeight();
    await nextTick();
    if (textareaRef.value) {
      textareaRef.value.focus();
      const pos = skill.text.length - (skill.cursorBefore ?? 0);
      textareaRef.value.setSelectionRange(pos, pos);
    }
    ElMessage.success('已填入模板，补充内容后按 Enter 发送');
    return;
  }

  if (skill.action === 'send' && skill.text) {
    data.questionMessage = skill.text;
    await onSubmit();
    return;
  }

  if (skill.action === 'api' && skill.api) {
    await runApiSkill(skill);
    return;
  }
};

// api 类技能：调真实业务接口，把数据格式化成聊天消息
const runApiSkill = async (skill: Skill) => {
  data.messageList.push({ type: EMessageType.User, content: `${skill.icon} ${skill.name}`, loading: false });
  const botIdx = data.messageList.push({ type: EMessageType.Bot, content: '', loading: true }) - 1;
  scrollToBottom();

  try {
    const resp = await fetch(skill.api!, { headers: { 'Content-Type': 'application/json', ...getAuthHeaders() } });
    const json = await resp.json();
    if (json.err_code !== 0) throw new Error(json.message || '查询失败');

    let content = '';
    if (skill.api!.includes('dashboard_stats')) {
      const d = json.data;
      content =
        `📊 你的合同数据概览：\n\n` +
        `• 合同总数：${d.totalContracts} 份\n` +
        `• 本月新增：${d.monthNew} 份\n` +
        `• 30 天内到期：${d.expiringCount} 份\n` +
        `• 高风险合同：${d.highRiskCount} 份\n` +
        `• 平均风险分：${d.avgRiskScore} 分\n\n` +
        (d.highRiskCount > 0 ? `⚠️ 有 ${d.highRiskCount} 份高风险合同，建议尽快去「合同审查」做深度检查。` : `✅ 当前没有高风险合同，继续保持。`);
    } else if (skill.api!.includes('expiring_contracts')) {
      const list = json.data || [];
      if (list.length === 0) {
        content = `⏰ 未来 30 天内没有即将到期的合同，可以放心。`;
      } else {
        content = `⏰ 未来 30 天内有 ${list.length} 份合同即将到期：\n\n` +
          list.map((c: any, i: number) =>
            `${i + 1}. 《${c.fileName}》（${c.contractType || '未分类'}）\n   到期日：${c.expiryDate}，还剩 ${c.daysLeft} 天，风险等级：${c.riskLevel || '未评估'}`
          ).join('\n\n') +
          `\n\n建议提前与对方沟通续签或终止事宜，避免被动违约。`;
      }
    }

    data.messageList[botIdx] = { type: EMessageType.Bot, content, loading: false };
  } catch (e: any) {
    data.messageList[botIdx] = { type: EMessageType.Bot, content: `查询失败：${e.message || '网络错误'}，请稍后再试。`, loading: false };
  }
  scrollToBottom();
};

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

/* ============ 技能中心 ============ */
.skill-section {
  border-top: 1px solid #e5e7eb;
  padding-bottom: 12px;
  flex-shrink: 0;
}

.skill-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;
}
.skill-header .session-title { padding: 0; font-size: 12px; }

.skill-header-actions { display: flex; gap: 6px; }

.skill-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 12px;
  max-height: 240px;
  overflow-y: auto;
}

.skill-mini-btn {
  padding: 3px 8px;
  font-size: 11px;
  color: #0A9AAE;
  background: #ecfeff;
  border: 1px solid #a5e3ec;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.skill-mini-btn:hover { background: #0A9AAE; color: white; border-color: #0A9AAE; }

.skill-tip {
  padding: 8px 12px 0;
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.4;
}

.skill-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 12px;
}

.skill-btn-wrap {
  position: relative;
  display: flex;
}

.skill-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.skill-btn:hover:not(:disabled) {
  background: #ecfeff;
  border-color: #0A9AAE;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(10, 154, 174, 0.15);
}

.skill-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skill-icon {
  font-size: 18px;
  line-height: 1;
}

.skill-name {
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
}

.skill-desc {
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.2;
}

/* 卡片右上角操作区（hover 浮现） */
.skill-actions {
  position: absolute;
  top: -7px;
  right: -4px;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.skill-btn-wrap:hover .skill-actions { opacity: 1; }

.skill-tag {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 8px;
  background: #e5e7eb;
  color: #6b7280;
  white-space: nowrap;
}
.skill-tag.mine { background: #d1fae5; color: #059669; }

.skill-op {
  width: 18px;
  height: 18px;
  font-size: 10px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: all 0.15s;
}
.skill-op:hover { border-color: #0A9AAE; color: #0A9AAE; }
.skill-op.danger:hover { border-color: #ef4444; color: #ef4444; }

/* 技能编辑弹窗表单 */
.skill-form { display: flex; flex-direction: column; gap: 14px; }
.skill-form-row { display: flex; gap: 12px; }
.skill-form-field { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.skill-form-field label { font-size: 12px; color: #606266; font-weight: 600; }
.skill-form-field input[type="text"],
.skill-form-field input:not([type]),
.skill-form-field textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
.skill-form-field input:focus,
.skill-form-field textarea:focus { outline: none; border-color: #0A9AAE; }
.icon-presets { display: flex; flex-wrap: wrap; gap: 4px; }
.icon-preset {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.icon-preset:hover { border-color: #0A9AAE; }
.icon-preset.active { border-color: #0A9AAE; background: #ecfeff; box-shadow: 0 0 0 2px rgba(10,154,174,0.15); }
.radio-line { display: flex; flex-direction: column; gap: 6px; }
.radio-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #303133; font-weight: 400 !important; cursor: pointer; }
.cursor-preview {
  font-size: 12px;
  color: #303133;
  background: #f8fafc;
  border: 1px dashed #d4d7de;
  border-radius: 6px;
  padding: 6px 8px;
  line-height: 1.5;
  word-break: break-all;
  max-height: 64px;
  overflow: auto;
}
.cursor-mark { color: #0A9AAE; font-weight: 700; animation: cursor-blink 1s steps(1) infinite; }
@keyframes cursor-blink { 50% { opacity: 0; } }

/* 分享 / 导入弹窗 */
.share-box { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.share-label { font-size: 13px; color: #303133; font-weight: 600; }
.share-code {
  width: 100%;
  padding: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 12px;
  font-family: Consolas, monospace;
  color: #303133;
  background: #f8fafc;
  box-sizing: border-box;
  resize: vertical;
  word-break: break-all;
  line-height: 1.5;
}
.share-code:focus { outline: none; border-color: #0A9AAE; }
.share-box .el-button { align-self: flex-start; }
.share-box .el-divider { width: 100%; margin: 6px 0; }
.share-box .el-divider__text { font-size: 12px; color: #909399; }

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
