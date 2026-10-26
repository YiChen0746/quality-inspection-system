<template>
  <div class="contract-draft-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>合同起草</h1>
      <p>填写表单信息，一键生成专业合同文档</p>
    </div>

    <div class="main-content">
      <!-- 左侧：合同模板选择 -->
      <div class="template-section">
        <h3>选择合同模板</h3>
        <div class="template-list">
          <div 
            v-for="template in templates" 
            :key="template.id"
            class="template-item"
            :class="{ active: selectedTemplate?.id === template.id }"
            @click="selectTemplate(template)"
          >
            <div class="template-name">{{ template.name }}</div>
            <div class="template-desc">{{ template.description }}</div>
            <div class="template-category">{{ template.category }}</div>
            <button class="btn-use-template" @click.stop="useTemplate(template)">使用模板</button>
          </div>
        </div>
      </div>

      <!-- 中间：表单填写 -->
      <div class="form-section">
        <!-- 专家一键起草卡片 -->
        <div class="expert-card">
          <div class="expert-header">
            <span class="expert-title">🤖 不知道怎么写？专家帮你一键起草</span>
            <span class="expert-sub">用大白话说清楚你的需求就行，支持语音输入</span>
          </div>
          <div class="expert-body">
            <div class="expert-type-row">
              <select v-model="expertForm.contractType" class="expert-type-select">
                <option value="">🎯 AI 自动识别合同类型</option>
                <option v-for="(p, t) in expertPersonas" :key="t" :value="t">{{ p.icon }} {{ t }}</option>
              </select>
            </div>
            <div class="expert-desc-wrap">
              <textarea
                v-model="expertForm.description"
                class="expert-desc"
                rows="3"
                placeholder="例如：我想把朝阳区一套两居室租给一个上班族，月租3500，押一付三，租期一年，物业费我出…"
              ></textarea>
              <button
                v-if="speechSupported"
                type="button"
                class="btn-mic"
                :class="{ recording: isRecording }"
                :title="isRecording ? '点击停止录音' : '点击开始语音输入'"
                @click="toggleSpeech"
              >{{ isRecording ? '⏹ 停止' : '🎙 语音' }}</button>
            </div>
            <div v-if="speechInterim" class="speech-interim">🎤 {{ speechInterim }}</div>
            <button
              type="button"
              class="btn-expert-generate"
              :disabled="isExpertGenerating"
              @click="expertGenerate"
            >
              <span v-if="isExpertGenerating">{{ expertIcon }} 专家起草中…（约 30-60 秒）</span>
              <span v-else>⚡ 专家一键生成合同初稿</span>
            </button>
          </div>
        </div>

        <h3>填写合同信息</h3>
        <form @submit.prevent="generateContract" class="contract-form">
          <div class="form-group" :class="{ focused: activeField === 'contractName' }">
            <label for="contractName">合同名称 *</label>
            <input 
              type="text" 
              id="contractName" 
              v-model="contractForm.contractName" 
              placeholder="请输入合同名称"
              :class="{ error: errors.contractName }"
              @focus="onFieldFocus('contractName')"
              @input="onFieldInput($event, 'contractName')"
              @keydown="onSuggestionKeyDown($event)"
            >
            <div v-if="showSuggestions && activeField === 'contractName' && suggestions.length" class="suggestion-popover">
              <button
                v-for="(s, i) in suggestions"
                :key="i"
                type="button"
                class="suggestion-item"
                @mousedown.prevent="applySuggestion(s)"
              >{{ s }}</button>
            </div>
            <span v-if="errors.contractName" class="error-message">{{ errors.contractName }}</span>
          </div>

          <div class="form-row">
            <div class="form-group" :class="{ focused: activeField === 'partyA' }">
              <label for="partyA">甲方 *</label>
              <input 
                type="text" 
                id="partyA" 
                v-model="contractForm.partyA" 
                placeholder="请输入甲方名称"
                :class="{ error: errors.partyA }"
                @focus="onFieldFocus('partyA')"
              >
              <span v-if="errors.partyA" class="error-message">{{ errors.partyA }}</span>
            </div>

            <div class="form-group" :class="{ focused: activeField === 'partyB' }">
              <label for="partyB">乙方 *</label>
              <input 
                type="text" 
                id="partyB" 
                v-model="contractForm.partyB" 
                placeholder="请输入乙方名称"
                :class="{ error: errors.partyB }"
                @focus="onFieldFocus('partyB')"
              >
              <span v-if="errors.partyB" class="error-message">{{ errors.partyB }}</span>
            </div>
          </div>

          <div class="form-group">
            <label for="thirdParty">第三方</label>
            <input 
              type="text" 
              id="thirdParty" 
              v-model="contractForm.thirdParty" 
              placeholder="如有第三方请填写，无则留空"
              @focus="onFieldFocus('thirdParty')"
            >
          </div>

          <div class="form-row">
            <div class="form-group" :class="{ focused: activeField === 'subject' }">
              <label for="subject">合同主体 *</label>
              <select 
                id="subject" 
                v-model="contractForm.subject"
                :class="{ error: errors.subject }"
                @focus="onFieldFocus('subject')"
                @change="onFieldFocus('subject')"
              >
                <option value="">请选择合同主体</option>
                <option value="个人">个人</option>
                <option value="公司">公司</option>
                <option value="其他组织">其他组织</option>
              </select>
              <span v-if="errors.subject" class="error-message">{{ errors.subject }}</span>
            </div>

            <div class="form-group" :class="{ focused: activeField === 'contractType' }">
              <label for="contractType">合同类型</label>
              <select id="contractType" v-model="contractForm.contractType" @focus="onFieldFocus('contractType')" @change="onFieldFocus('contractType')">
                <option value="">请选择合同类型</option>
                <option value="买卖合同">买卖合同</option>
                <option value="租赁合同">租赁合同</option>
                <option value="服务合同">服务合同</option>
                <option value="劳动合同">劳动合同</option>
                <option value="借款合同">借款合同</option>
                <option value="其他">其他</option>
              </select>
            </div>
          </div>

          <div class="form-group" :class="{ focused: activeField === 'expiryDate' }">
            <label for="expiryDate">到期日期</label>
            <el-date-picker
              v-model="contractForm.expiryDate"
              type="date"
              placeholder="请选择合同到期日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
              @focus="onFieldFocus('expiryDate')"
              @change="onFieldFocus('expiryDate')"
            />
          </div>

          <div class="form-group description-group" :class="{ focused: activeField === 'description' }">
            <label for="description">合同描述 *</label>
            <textarea 
              id="description" 
              v-model="contractForm.description" 
              placeholder="请详细描述合同的主要内容、标的物、服务内容等"
              rows="4"
              :class="{ error: errors.description }"
              @focus="onFieldFocus('description')"
              @input="onFieldInput($event, 'description')"
              @keydown="onSuggestionKeyDown($event)"
            ></textarea>
            <!-- 描述补全建议条 -->
            <div v-if="showSuggestions && activeField === 'description' && suggestions.length" class="suggestion-inline">
              <span class="suggestion-inline-label">AI 续写建议：</span>
              <button
                v-for="(s, i) in suggestions"
                :key="i"
                type="button"
                class="suggestion-inline-btn"
                @mousedown.prevent="applySuggestion(s)"
              >{{ s }}（回车插入）</button>
            </div>
            <span v-if="errors.description" class="error-message">{{ errors.description }}</span>
          </div>

          <div class="form-actions">
            <button type="button" @click="resetForm" class="btn-secondary">重置表单</button>
            <button type="submit" :disabled="isGenerating" class="btn-primary">
              <span v-if="isGenerating">生成中...</span>
              <span v-else>一键生成合同</span>
            </button>
          </div>
        </form>
      </div>

      <!-- 中间右侧：起草指引面板 -->
      <div class="guidance-section">
        <div class="guidance-header">
          <span class="guidance-icon">🎯</span>
          <h3>起草指引</h3>
        </div>

        <!-- 环节进度条（可点击跳转，必填项带 * 标记） -->
        <div class="guidance-progress">
          <div
            v-for="step in guidance.data.formProgress || []"
            :key="step.key"
            class="progress-node clickable"
            :class="{ filled: step.filled, active: step.key === guidance.currentKey }"
            :title="'点击查看「' + step.label + '」的指引'"
            @click="onFieldFocus(step.key)"
          >
            <span class="progress-dot"></span>
            <span class="progress-label">{{ step.label }}<span v-if="step.required" class="req-mark">*</span></span>
          </div>
        </div>

        <!-- 当前环节 -->
        <div v-if="guidance.data.currentStep" class="guidance-card current">
          <div class="card-title">
            当前在填 · 第 {{ guidance.data.currentStep.index }} / {{ guidance.data.currentStep.total }} 步
          </div>
          <div class="card-sub">{{ guidance.data.currentStep.label }}</div>
          <div class="card-hint">
            <span v-if="guidance.loadingHint" class="loading-dot">●●● 思考中</span>
            <span v-else>{{ guidance.data.hint || guidance.data.currentStep.desc }}</span>
          </div>
        </div>

        <!-- 下一环节 / 全部完成态 -->
        <div v-if="guidance.data.nextStep" class="guidance-card next">
          <div class="card-title">下一步该写什么</div>
          <div class="card-sub next-step-sub">{{ guidance.data.nextStep.label }}</div>
          <div class="card-hint">{{ guidance.data.nextStep.desc }}</div>
        </div>
        <div v-else-if="guidance.data.completed" class="guidance-card done">
          <div class="card-title">✅ 必填项已全部填完</div>
          <div class="card-hint">可以点击「一键生成合同」生成初稿，生成后还可以做风险评估和 AI 修改。</div>
        </div>

        <!-- 指引加载失败提示（不再静默） -->
        <div v-if="guidance.error" class="guidance-card error-card">
          <div class="card-hint">⚠️ {{ guidance.error }}</div>
        </div>

        <!-- 法条依据 -->
        <div v-if="guidance.data.legalBasis && guidance.data.legalBasis.length" class="guidance-card law">
          <div class="card-title">📚 相关法条依据</div>
          <div class="law-list">
            <div v-for="(law, i) in guidance.data.legalBasis" :key="i" class="law-item">
              <div class="law-head">
                <span class="law-name">《{{ law.law }}》</span>
                <span v-if="law.article" class="law-article">{{ law.article }}</span>
                <span v-if="law.topic" class="law-topic">{{ law.topic }}</span>
              </div>
              <div class="law-content" :title="law.content">{{ law.content }}</div>
            </div>
          </div>
          <!-- 通俗摘要（后端已返回，展示给新手看） -->
          <div v-if="guidance.data.basisSummary" class="law-summary">📖 通俗解读：{{ guidance.data.basisSummary }}</div>
        </div>
        <div v-else class="guidance-card law empty">
          <div class="card-title">📚 法条依据</div>
          <div class="card-hint muted">填写更多内容后，这里会自动显示相关法律条文</div>
        </div>

        <!-- 提示 -->
        <div class="guidance-tip">
          💡 点击任一输入框可查看针对该字段的专属指引
        </div>
      </div>

      <!-- 右侧：合同预览和历史记录 -->
      <div class="preview-section">
        <div class="section-tabs">
          <button 
            :class="{ active: activeTab === 'preview' }" 
            @click="activeTab = 'preview'"
          >
            合同预览
          </button>
          <button 
            :class="{ active: activeTab === 'history' }" 
            @click="activeTab = 'history'"
          >
            历史记录
          </button>
        </div>

        <!-- 合同预览 -->
        <div v-if="activeTab === 'preview'" class="preview-content">
          <div v-if="!currentContract" class="empty-state">
            <img src="../assets/images/pen1.png" alt="合同起草" class="empty-icon">
            <p>请填写左侧表单信息生成合同</p>
          </div>
          
          <div v-else class="contract-preview">
            <div class="preview-header">
              <h4>{{ currentContract.contractInfo?.contractName || '合同预览' }}</h4>
              <div class="preview-actions">
                <el-button size="small" type="warning" @click="scoreCurrentContract" :loading="isScoring">
                  风险评分
                </el-button>
                <button @click="regenerateContract" class="btn-icon" title="重新生成">
                  <i class="icon-refresh">🔄</i>
                </button>
                <button @click="showExportDialog" class="btn-icon" title="导出合同">
                  <i class="icon-download">📥</i>
                </button>
              </div>
            </div>

            <!-- 风险评分结果 -->
            <div v-if="riskScore" class="risk-score-panel">
              <div class="score-header">
                <el-progress
                  type="dashboard"
                  :percentage="riskScore.score"
                  :color="scoreColor"
                  :width="90"
                >
                  <template #default>
                    <span class="score-value">{{ riskScore.score }}</span>
                  </template>
                </el-progress>
                <div class="score-level">
                  <div class="level-label">风险等级{{ reviseRound > 0 ? `（第 ${reviseRound + 1} 轮评估）` : '' }}</div>
                  <el-tag :type="riskScore.level === '高' ? 'danger' : (riskScore.level === '中' ? 'warning' : 'success')" size="large">
                    {{ riskScore.level }}风险
                  </el-tag>
                  <button class="btn-revise-inline" :disabled="isRevising" @click="openReviseDialog">
                    <span v-if="isRevising">AI 修改中...</span>
                    <span v-else>🔄 AI 补充修改</span>
                  </button>
                </div>
              </div>
              <div v-if="riskScore.risks?.length" class="score-detail">
                <div class="detail-title">风险点：</div>
                <ul>
                  <li v-for="(r, i) in riskScore.risks" :key="'r'+i">{{ r }}</li>
                </ul>
              </div>
              <div v-if="riskScore.suggestions?.length" class="score-detail">
                <div class="detail-title">建议：</div>
                <ul>
                  <li v-for="(s, i) in riskScore.suggestions" :key="'s'+i">{{ s }}</li>
                </ul>
              </div>

              <!-- 轮次进展提示 -->
              <div v-if="reviseRound > 0" class="revise-round-tip">
                ✅ 已完成 {{ reviseRound }} 轮 AI 修改。应用修改后可再次点击"风险评估"复评，未达低风险可继续下一轮修改，直至完善。
              </div>
            </div>

            <div class="contract-content">
              <textarea
                v-model="currentContract.contractContent"
                class="contract-textarea"
                @input="adjustTextareaHeight"
                ref="contractTextarea"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- 历史记录 -->
        <div v-if="activeTab === 'history'" class="history-content">
          <div v-if="contractHistory.length === 0" class="empty-state">
            <p>暂无历史记录</p>
          </div>
          
          <div v-else class="history-list">
            <div 
              v-for="(contract, index) in contractHistory" 
              :key="index"
              class="history-item"
              @click="selectHistoryContract(contract)"
            >
              <div class="history-title">{{ contract.contractInfo?.contractName }}</div>
              <div class="history-time">{{ contract.contractInfo?.generateTime }}</div>
              <div class="history-parties">
                {{ contract.contractInfo?.partyA }} ↔ {{ contract.contractInfo?.partyB }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 导出格式选择对话框 -->
  <el-dialog
    v-model="exportDialogVisible"
    title="导出合同"
    width="360px"
    :close-on-click-modal="true"
  >
    <div class="export-format-options">
      <div
        class="export-option"
        :class="{ active: exportFormat === 'docx' }"
        @click="exportFormat = 'docx'"
      >
        <div class="export-icon">📄</div>
        <div class="export-text">
          <div class="export-title">Word 文档 (.docx)</div>
          <div class="export-desc">适合编辑修改</div>
        </div>
      </div>
      <div
        class="export-option"
        :class="{ active: exportFormat === 'pdf' }"
        @click="exportFormat = 'pdf'"
      >
        <div class="export-icon">📕</div>
        <div class="export-text">
          <div class="export-title">PDF 文件 (.pdf)</div>
          <div class="export-desc">适合打印分享</div>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="exportDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="isExporting" @click="handleExport">
        确认导出
      </el-button>
    </template>
  </el-dialog>

  <!-- 补充修改弹窗（支持无限轮次） -->
  <el-dialog
    v-model="reviseDialogVisible"
    :title="`第 ${reviseRound + 1} 轮 AI 补充修改`"
    width="640px"
    :close-on-click-modal="false"
    @closed="resetReviseState"
  >
    <!-- 第一步：选择修改方式 -->
    <div v-if="reviseStep === 'choose'" class="revise-choose">
      <div v-if="reviseHistory.length" class="revise-history">
        <div class="history-title">📋 已完成轮次：</div>
        <div v-for="(h, i) in reviseHistory" :key="i" class="history-item">
          <div class="history-head">第 {{ h.round }} 轮（{{ h.mode === 'direct' ? '智能体直接修改' : 'AI 辅助逐条修改' }}）· {{ h.applied }} 处修改</div>
          <div class="history-summary">{{ h.summary }}</div>
        </div>
      </div>
      <div class="revise-mode-card" @click="startRevise('direct')">
        <div class="mode-icon">🤖</div>
        <div class="mode-text">
          <div class="mode-title">智能体直接修改</div>
          <div class="mode-desc">AI 根据最新风险建议自动修订全文，改完给你确认</div>
        </div>
        <div class="mode-arrow">→</div>
      </div>
      <div class="revise-mode-card" @click="startRevise('guide')">
        <div class="mode-icon">✍️</div>
        <div class="mode-text">
          <div class="mode-title">AI 辅助逐条修改</div>
          <div class="mode-desc">AI 给出每处"原文 → 改后"的修改说明，由你逐条采纳</div>
        </div>
        <div class="mode-arrow">→</div>
      </div>
      <div class="revise-loop-tip">💡 修改完成后重新"风险评估"，未达低风险可继续下一轮，直至满意为止</div>
    </div>

    <!-- direct：智能体改完，等用户确认 -->
    <div v-else-if="reviseStep === 'direct'" v-loading="isRevising" class="revise-direct">
      <template v-if="!isRevising && reviseResult">
        <div class="revise-summary">
          <div class="summary-title">AI 修改说明：</div>
          <pre class="summary-content">{{ reviseResult.changeSummary || '已按建议完成修订' }}</pre>
        </div>
        <div class="revise-preview-title">修订后全文预览：</div>
        <div class="revise-preview">{{ reviseResult.revisedText }}</div>
        <div class="revise-confirm-tip">AI 已按风险建议修改完成，是否应用这份修订版？</div>
      </template>
    </div>

    <!-- guide：逐条采纳 -->
    <div v-else-if="reviseStep === 'guide'" v-loading="isRevising" class="revise-guide">
      <template v-if="!isRevising">
        <div v-if="guideItems.length === 0" class="guide-empty">AI 未能给出具体修改项，建议使用"智能体直接修改"模式</div>
        <div
          v-for="(item, idx) in guideItems"
          :key="idx"
          class="guide-item"
          :class="{ applied: guideApplied.includes(idx) }"
        >
          <div class="guide-explain">{{ idx + 1 }}. {{ item.explain }}</div>
          <div v-if="item.original" class="guide-diff">
            <div class="diff-row old"><span class="diff-tag">原文</span>{{ item.original }}</div>
            <div class="diff-row new"><span class="diff-tag">改为</span>{{ item.revised }}</div>
          </div>
          <div v-else class="guide-diff">
            <div class="diff-row new"><span class="diff-tag">补充</span>{{ item.revised }}</div>
          </div>
          <div class="guide-actions">
            <button v-if="!guideApplied.includes(idx)" class="btn-adopt" @click="applyGuideItem(idx)">采纳</button>
            <span v-else class="adopted-mark">✓ 已采纳</span>
          </div>
        </div>
        <div v-if="guideApplied.length" class="guide-applied-tip">已采纳 {{ guideApplied.length }} / {{ guideItems.length }} 条修改，已同步到合同正文</div>
      </template>
    </div>

    <template #footer>
      <template v-if="reviseStep === 'choose'">
        <el-button @click="reviseDialogVisible = false">取消</el-button>
      </template>
      <template v-else-if="reviseStep === 'direct'">
        <el-button :disabled="isRevising" @click="reviseStep = 'choose'">返回</el-button>
        <el-button type="danger" plain :disabled="isRevising || !reviseResult" @click="reviseDialogVisible = false">放弃修改</el-button>
        <el-button type="primary" :disabled="isRevising || !reviseResult" @click="applyDirectRevise">✓ 应用修改</el-button>
      </template>
      <template v-else-if="reviseStep === 'guide'">
        <el-button :disabled="isRevising" @click="reviseStep = 'choose'">返回</el-button>
        <el-button type="primary" :disabled="isRevising || !guideItems.length || guideApplied.length === guideItems.length" @click="applyAllGuideItems">全部采纳</el-button>
        <el-button type="success" @click="finishGuideRevise">完成</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script>
import { ElMessage, ElLoading } from 'element-plus';
import { getAuthHeaders } from '@Setup/storage/user.js';

export default {
  name: 'ContractDraft',
  data() {
    return {
      activeTab: 'preview',
      selectedTemplate: null,
      templates: [],
      isGenerating: false,
      contractForm: {
        contractName: '',
        partyA: '',
        partyB: '',
        thirdParty: '',
        description: '',
        subject: '',
        contractType: '',
        expiryDate: ''
      },
      errors: {},
      currentContract: null,
      contractHistory: [],
      exportDialogVisible: false,
      exportFormat: 'docx',
      isExporting: false,
      riskScore: null,
      isScoring: false,

      // ============ 补充修改（无限轮次） ============
      reviseDialogVisible: false,
      reviseStep: 'choose',     // choose | direct | guide
      isRevising: false,
      reviseResult: null,       // direct 模式结果 { revisedText, changeSummary }
      guideItems: [],           // guide 模式逐条修改项
      guideApplied: [],         // 已采纳的索引
      reviseRound: 0,           // 已完成的修改轮次
      reviseHistory: [],        // 每轮记录 { round, mode, applied, summary }

      // ============ 专家一键起草（Phase 2） ============
      expertPersonas: {
        '买卖合同': { icon: '🛒' },
        '租赁合同': { icon: '🏠' },
        '劳务合同': { icon: '👷' },
        '服务合同': { icon: '🛠️' },
        '借款合同': { icon: '💰' },
        '委托合同': { icon: '📋' },
        '仓储合同': { icon: '📦' },
        '建设工程合同': { icon: '🏗️' }
      },
      expertForm: { contractType: '', description: '' },
      isExpertGenerating: false,
      expertIcon: '🤖',
      speechSupported: false,
      isRecording: false,
      speechInterim: '',
      recognition: null,

      // ============ 起草指引 & 自动补全 ============
      activeField: '',
      showSuggestions: false,
      suggestions: [],
      guidance: {
        currentKey: '',
        loadingHint: false,
        error: '',
        data: {
          currentStep: null,
          nextStep: null,
          completed: false,
          hint: '',
          legalBasis: [],
          basisSummary: '',
          formProgress: []
        }
      },
      // debounce timers
      _guidanceTimer: null,
      _autocompleteTimer: null
    };
  },
  computed: {
    scoreColor() {
      const s = this.riskScore?.score || 0;
      if (s <= 40) return '#67c23a';
      if (s <= 70) return '#e6a23c';
      return '#f56c6c';
    }
  },
  watch: {
    // 表单内容自动保存，刷新页面不丢（问题清单 #22）
    contractForm: {
      deep: true,
      handler(v) {
        try { sessionStorage.setItem('contract-draft-form', JSON.stringify(v)); } catch (e) { /* ignore */ }
      }
    }
  },
  mounted() {
    this.loadTemplates();
    this.loadHistoryFromStorage();
    // 恢复上次未完成的表单
    try {
      const saved = sessionStorage.getItem('contract-draft-form');
      if (saved) Object.assign(this.contractForm, JSON.parse(saved));
    } catch (e) { /* ignore */ }
    // 首次加载默认指引
    this.$nextTick(() => this.fetchGuidance('contractName'));
    // 初始化语音识别（Chrome/Edge 的 Web Speech API）
    this.initSpeech();
  },
  methods: {
    // ==================== 专家一键起草（Phase 2） ====================

    // 初始化 Web Speech API 语音识别
    initSpeech() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { this.speechSupported = false; return; }
      this.speechSupported = true;
      const rec = new SR();
      rec.lang = 'zh-CN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let final = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }
        if (final) {
          // 最终结果追加到描述框
          const cur = (this.expertForm.description || '').trimEnd();
          this.expertForm.description = cur ? cur + final : final;
          this.speechInterim = '';
        } else {
          this.speechInterim = interim;
        }
      };
      rec.onend = () => {
        this.isRecording = false;
        this.speechInterim = '';
      };
      rec.onerror = (e) => {
        this.isRecording = false;
        this.speechInterim = '';
        if (e.error === 'not-allowed') {
          ElMessage.error('麦克风权限被拒绝，请在浏览器地址栏允许麦克风访问');
        } else if (e.error !== 'aborted') {
          ElMessage.warning('语音识别异常：' + e.error);
        }
      };
      this.recognition = rec;
    },

    toggleSpeech() {
      if (!this.recognition) return;
      if (this.isRecording) {
        this.recognition.stop();
        this.isRecording = false;
      } else {
        try {
          this.recognition.start();
          this.isRecording = true;
        } catch (e) {
          // start 在运行中重复调用会抛错，忽略
        }
      }
    },

    async expertGenerate() {
      if (!this.expertForm.description || this.expertForm.description.trim().length < 10) {
        ElMessage.warning('请先用一句话描述你的需求（说清楚：谁、做什么、多少钱、什么条件）');
        return;
      }
      this.isExpertGenerating = true;
      this.expertIcon = this.expertForm.contractType
        ? (this.expertPersonas[this.expertForm.contractType]?.icon || '🤖')
        : '🎯';
      try {
        const response = await fetch('/api/contract_expert_generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            contractType: this.expertForm.contractType,
            description: this.expertForm.description,
            contractForm: this.contractForm
          })
        });
        const data = await response.json();
        if (data.err_code === 0) {
          const { contractText, contractType } = data.data;
          // 初稿填入预览区，并回填表单便于继续精修
          this.currentContract = {
            ...(this.currentContract || {}),
            contractName: this.contractForm.contractName || `${contractType}（AI 起草）`,
            contractContent: contractText
          };
          this.activeTab = 'preview';
          if (!this.contractForm.description) this.contractForm.description = this.expertForm.description;
          if (!this.contractForm.contractType && contractType) this.contractForm.contractType = contractType;
          this.contractHistory.unshift({
            name: this.currentContract.contractName,
            content: contractText,
            time: new Date().toLocaleString()
          });
          this.saveHistoryToStorage();
          ElMessage.success(`${contractType}专家已生成初稿，可在预览区查看修改，或继续风险评估`);
        } else {
          ElMessage.error(data.message || '专家起草失败，请稍后重试');
        }
      } catch (error) {
        console.error('专家起草失败:', error);
        ElMessage.error('网络错误，请稍后重试');
      } finally {
        this.isExpertGenerating = false;
      }
    },

    // 加载合同模板
    async loadTemplates() {
      try {
        const response = await fetch('/api/contract_templates', { headers: getAuthHeaders() });
        const data = await response.json();
        if (data.err_code === 0) {
          this.templates = data.data;
        }
      } catch (error) {
        console.error('加载模板失败:', error);
      }
    },

    // 选择模板
    selectTemplate(template) {
      this.selectedTemplate = template;
      // 根据模板自动填充部分信息
      if (template.category) {
        this.contractForm.contractType = template.category;
      }
    },

    // 使用模板：把模板名称和模板内容一键填充到表单
    useTemplate(template) {
      this.selectedTemplate = template;
      this.contractForm.contractName = template.name.replace(/模板$/, '合同');
      if (template.category) {
        this.contractForm.contractType = template.category;
      }
      if (template.content) {
        this.contractForm.description = template.content;
      }
      ElMessage.success(`已应用模板「${template.name}」，请补充甲乙双方信息`);
    },

    // 对当前合同进行风险评分
    async scoreCurrentContract() {
      if (!this.currentContract) {
        ElMessage.warning('请先生成合同内容');
        return;
      }
      this.isScoring = true;
      this.riskScore = null;
      try {
        const response = await fetch('/api/score_contract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            contractContent: this.currentContract.contractContent,
            contractName: this.currentContract.contractInfo?.contractName,
            contractId: this.currentContract.contractInfo?.contractId
          })
        });
        const data = await response.json();
        if (data.err_code === 0) {
          this.riskScore = data.data;
          ElMessage.success('风险评分完成');
        } else {
          ElMessage.error(data.message || '评分失败');
        }
      } catch (error) {
        console.error('风险评分失败:', error);
        ElMessage.error('网络错误，请稍后重试');
      } finally {
        this.isScoring = false;
      }
    },

    // ==================== 二轮补充修改 ====================

    openReviseDialog() {
      if (!this.currentContract?.contractContent?.trim()) {
        ElMessage.warning('请先生成合同再进行二轮修改');
        return;
      }
      this.reviseStep = 'choose';
      this.reviseDialogVisible = true;
    },

    resetReviseState() {
      this.reviseStep = 'choose';
      this.reviseResult = null;
      this.guideItems = [];
      this.guideApplied = [];
      this.isRevising = false;
    },

    async startRevise(mode) {
      this.isRevising = true;
      this.reviseStep = mode;
      try {
        const response = await fetch('/api/contract_revise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            mode,
            contractText: this.currentContract.contractContent,
            suggestions: this.riskScore?.suggestions || [],
            risks: this.riskScore?.risks || []
          })
        });
        const data = await response.json();
        if (data.err_code === 0) {
          if (mode === 'direct') {
            this.reviseResult = {
              revisedText: data.data.revisedText,
              changeSummary: data.data.changeSummary
            };
          } else {
            this.guideItems = data.data.items || [];
          }
        } else {
          ElMessage.error(data.message || 'AI 修订失败');
          this.reviseStep = 'choose';
        }
      } catch (error) {
        console.error('二轮修改失败:', error);
        ElMessage.error('网络错误，请稍后重试');
        this.reviseStep = 'choose';
      } finally {
        this.isRevising = false;
      }
    },

    // direct 模式：应用修订全文
    applyDirectRevise() {
      if (!this.reviseResult?.revisedText) return;
      this.currentContract.contractContent = this.reviseResult.revisedText;
      this.riskScore = null; // 修改后旧评分失效，提示重新评分
      // 记录本轮
      this.reviseRound += 1;
      this.reviseHistory.push({
        round: this.reviseRound,
        mode: 'direct',
        applied: (String(this.reviseResult.changeSummary || '').match(/^\d+[\.、]/gm) || []).length || 1,
        summary: String(this.reviseResult.changeSummary || '已按建议完成修订').replace(/^\d+[\.、]\s*/gm, '；').trim()
      });
      this.reviseDialogVisible = false;
      ElMessage.success(`第 ${this.reviseRound} 轮修订已应用，请重新进行风险评估`);
    },

    // guide 模式：逐条采纳
    applyGuideItem(idx) {
      const item = this.guideItems[idx];
      if (!item) return;
      const content = this.currentContract.contractContent;
      if (item.original && content.includes(item.original)) {
        // 原文替换
        this.currentContract.contractContent = content.replace(item.original, item.revised);
      } else if (!item.original) {
        // 补充新增：追加到最后一个条款之后（正文末尾）
        this.currentContract.contractContent = content.trimEnd() + '\n' + item.revised + '\n';
      } else {
        // 原文未逐字命中，宽松匹配（忽略空白差异）
        const norm = s => String(s).replace(/\s+/g, '');
        const raw = String(content);
        const target = norm(item.original);
        let found = false;
        // 滑动窗口找原文中连续片段
        for (let i = 0; i < raw.length && !found; i++) {
          for (let j = i + 10; j <= raw.length; j++) {
            if (norm(raw.slice(i, j)) === target) {
              this.currentContract.contractContent = raw.slice(0, i) + item.revised + raw.slice(j);
              found = true;
              break;
            }
          }
        }
        if (!found) {
          ElMessage.warning(`第 ${idx + 1} 条未在原文中定位到，已作为补充条款追加`);
          this.currentContract.contractContent = raw.trimEnd() + '\n' + item.revised + '\n';
        }
      }
      this.guideApplied.push(idx);
      ElMessage.success(`第 ${idx + 1} 条修改已应用`);
    },

    // guide 模式：全部采纳
    applyAllGuideItems() {
      for (let i = 0; i < this.guideItems.length; i++) {
        if (!this.guideApplied.includes(i)) {
          this.applyGuideItem(i);
        }
      }
      ElMessage.success('全部修改已应用');
    },

    // guide 模式：完成本轮（有采纳才计轮次）
    finishGuideRevise() {
      if (this.guideApplied.length > 0) {
        this.riskScore = null; // 修改后旧评分失效
        this.reviseRound += 1;
        this.reviseHistory.push({
          round: this.reviseRound,
          mode: 'guide',
          applied: this.guideApplied.length,
          summary: this.guideApplied.map(i => String(this.guideItems[i]?.explain || '')).filter(Boolean).slice(0, 5).join('；')
        });
        ElMessage.success(`第 ${this.reviseRound} 轮修订已应用，请重新进行风险评估`);
      }
      this.reviseDialogVisible = false;
    },

    // 表单验证
    validateForm() {
      this.errors = {};
      
      if (!this.contractForm.contractName || this.contractForm.contractName.length < 4) {
        this.errors.contractName = '合同名称至少需要4个字符';
      }
      
      if (!this.contractForm.partyA || this.contractForm.partyA.length < 2) {
        this.errors.partyA = '甲方名称至少需要2个字符';
      }
      
      if (!this.contractForm.partyB || this.contractForm.partyB.length < 2) {
        this.errors.partyB = '乙方名称至少需要2个字符';
      }
      
      if (!this.contractForm.description || this.contractForm.description.length < 10) {
        this.errors.description = '合同描述至少需要10个字符';
      }
      
      if (!this.contractForm.subject) {
        this.errors.subject = '请选择合同主体';
      }
      
      return Object.keys(this.errors).length === 0;
    },

    // 生成合同
    async generateContract() {
      if (!this.validateForm()) {
        ElMessage.warning('请检查表单填写');
        return;
      }

      this.isGenerating = true;
      const loading = ElLoading.service({
        lock: true,
        text: '正在生成合同，请稍候...',
        background: 'rgba(0, 0, 0, 0.7)'
      });

      try {
        const response = await fetch('/api/generate_contract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify(this.contractForm)
        });

        const data = await response.json();
        
        if (data.err_code === 0) {
          this.currentContract = data.data;
          this.contractHistory.unshift(data.data);
          this.saveHistoryToStorage();
          this.activeTab = 'preview';
          ElMessage.success('合同生成成功！');
        } else {
          ElMessage.error(data.message || '合同生成失败');
        }
      } catch (error) {
        console.error('生成合同失败:', error);
        ElMessage.error('网络错误，请稍后重试');
      } finally {
        this.isGenerating = false;
        loading.close();
      }
    },

    // 重新生成合同
    async regenerateContract() {
      if (!this.currentContract) return;
      await this.generateContract();
    },

    // 显示导出格式选择对话框
    showExportDialog() {
      if (!this.currentContract) {
        ElMessage.warning('请先生成合同内容');
        return;
      }
      this.exportFormat = 'docx';
      this.exportDialogVisible = true;
    },

    // 执行导出（根据选择的格式调用对应接口）
    async handleExport() {
      if (!this.currentContract) return;

      this.isExporting = true;
      const isPdf = this.exportFormat === 'pdf';
      const apiUrl = isPdf ? '/api/export_contract_pdf' : '/api/export_contract_docx';
      const fileExt = isPdf ? 'pdf' : 'docx';

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            contractContent: this.currentContract.contractContent,
            contractName: this.currentContract.contractInfo?.contractName
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${this.currentContract.contractInfo?.contractName || '合同'}.${fileExt}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          ElMessage.success(`导出${isPdf ? 'PDF' : 'Word'}成功！`);
          this.exportDialogVisible = false;
        } else {
          // 尝试解析后端返回的错误信息
          try {
            const errData = await response.json();
            ElMessage.error(errData.message || '导出失败，请稍后重试');
          } catch {
            ElMessage.error('导出失败，请稍后重试');
          }
        }
      } catch (error) {
        console.error('导出失败:', error);
        ElMessage.error('导出失败，请稍后重试');
      } finally {
        this.isExporting = false;
      }
    },

    // 选择历史合同
    selectHistoryContract(contract) {
      this.currentContract = contract;
      this.activeTab = 'preview';
    },

    // ==================== 起草指引 & 补全相关方法 ====================

    onFieldFocus(fieldKey) {
      this.activeField = fieldKey;
      this.showSuggestions = false;
      this.fetchGuidance(fieldKey);
    },

    onFieldInput(evt, fieldKey) {
      // 指引：表单改变也刷新（debounce 300ms）
      this.fetchGuidance(fieldKey, true);
      // 补全：description 和 contractName 触发
      if ((fieldKey === 'description' || fieldKey === 'contractName') && evt?.target) {
        const partial = evt.target.value || '';
        clearTimeout(this._autocompleteTimer);
        this._autocompleteTimer = setTimeout(() => this.fetchAutocomplete(fieldKey, partial), 500);
      }
    },

    onSuggestionKeyDown(e) {
      if (e.key === 'Enter' && this.showSuggestions && this.suggestions.length) {
        // 不是 submit 场景：光标在字段上且补全有数据
        if (this.activeField === 'description' || this.activeField === 'contractName') {
          e.preventDefault();
          e.stopPropagation();
          this.applySuggestion(this.suggestions[0]);
        }
      } else if (e.key === 'Escape') {
        this.showSuggestions = false;
      }
    },

    applySuggestion(suggestion) {
      if (this.activeField === 'contractName') {
        this.contractForm.contractName = suggestion;
      } else if (this.activeField === 'description') {
        // 追加到当前描述末尾（如果已有内容且不以标点结尾，加个逗号）
        const cur = (this.contractForm.description || '').trimEnd();
        if (!cur) {
          this.contractForm.description = suggestion;
        } else if (/[。！？；,，、：:]$/.test(cur)) {
          this.contractForm.description = cur + suggestion;
        } else {
          this.contractForm.description = cur + '，' + suggestion;
        }
      }
      this.showSuggestions = false;
      this.suggestions = [];
      // 补全后也刷新指引
      this.fetchGuidance(this.activeField);
    },

    async fetchGuidance(fieldKey, debounced = false) {
      clearTimeout(this._guidanceTimer);
      const run = () => {
        this.guidance.currentKey = fieldKey;

        // 缓存命中（同字段 + 填写进度未变）直接复用，不发请求（问题清单 #11）
        const filledSig = Object.keys(this.contractForm).filter(k => String(this.contractForm[k] || '').trim()).join(',');
        const cacheKey = `${fieldKey}|${this.contractForm.contractType || ''}|${filledSig}`;
        this._guidanceCache = this._guidanceCache || {};
        if (this._guidanceCache[cacheKey]) {
          this.guidance.data = this._guidanceCache[cacheKey];
          this.guidance.error = '';
          this.guidance.loadingHint = false;
          return;
        }

        // 取消未完成的旧请求 + 序号校验，杜绝竞态互相覆盖（问题清单 #13）
        if (this._guidanceAbort) this._guidanceAbort.abort();
        const ctrl = new AbortController();
        this._guidanceAbort = ctrl;
        const seq = ++this._guidanceSeq;

        this.guidance.loadingHint = true;
        this.guidance.error = '';
        fetch('/api/contract_guidance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ currentField: fieldKey, contractForm: this.contractForm }),
          signal: ctrl.signal
        }).then(r => r.json())
          .then(data => {
            if (seq !== this._guidanceSeq) return; // 过期响应直接丢弃
            if (data.err_code === 0) {
              this.guidance.data = data.data;
              this._guidanceCache[cacheKey] = data.data;
            } else {
              this.guidance.error = data.message || '指引加载失败';
            }
          })
          .catch(err => {
            if (err.name === 'AbortError') return; // 被新请求取消，静默
            if (seq === this._guidanceSeq) {
              this.guidance.error = '指引加载失败，请重新点击输入框重试'; // 问题清单 #15：不再静默
            }
          })
          .finally(() => {
            if (seq === this._guidanceSeq) this.guidance.loadingHint = false; // 问题清单 #14
          });
      };
      if (debounced) {
        this._guidanceTimer = setTimeout(run, 350);
      } else {
        run();
      }
    },

    async fetchAutocomplete(fieldKey, partial) {
      if (!partial || partial.trim().length < 2) {
        this.suggestions = [];
        this.showSuggestions = false;
        return;
      }
      try {
        const r = await fetch('/api/contract_autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ field: fieldKey, partialText: partial, contractForm: this.contractForm })
        });
        const data = await r.json();
        if (data.err_code === 0 && data.data?.suggestions?.length) {
          this.suggestions = data.data.suggestions.slice(0, 3);
          this.showSuggestions = true;
        } else {
          this.suggestions = [];
          this.showSuggestions = false;
        }
      } catch (err) {
        console.warn('[autocomplete] failed:', err.message);
      }
    },

    // 重置表单
    resetForm() {
      this.contractForm = {
        contractName: '',
        partyA: '',
        partyB: '',
        thirdParty: '',
        description: '',
        subject: '',
        contractType: '',
        expiryDate: ''
      };
      this.errors = {};
      this.selectedTemplate = null;
      this._guidanceCache = {};
      sessionStorage.removeItem('contract-draft-form');
    },

    // 调整文本域高度
    adjustTextareaHeight() {
      this.$nextTick(() => {
        const textarea = this.$refs.contractTextarea;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        }
      });
    },

    // 保存历史记录到本地存储
    saveHistoryToStorage() {
      try {
        localStorage.setItem('contractHistory', JSON.stringify(this.contractHistory.slice(0, 10))); // 只保存最近10条
      } catch (error) {
        console.error('保存历史记录失败:', error);
      }
    },

    // 从本地存储加载历史记录
    loadHistoryFromStorage() {
      try {
        const history = localStorage.getItem('contractHistory');
        if (history) {
          this.contractHistory = JSON.parse(history);
        }
      } catch (error) {
        console.error('加载历史记录失败:', error);
      }
    }
  }
};
</script>

<style scoped>
.export-format-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.export-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-option:hover {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.export-option.active {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.export-icon {
  font-size: 28px;
  line-height: 1;
}

.export-text {
  flex: 1;
}

.export-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}

.export-desc {
  font-size: 12px;
  color: #909399;
}

.contract-draft-container {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 28px;
  color: #2c3e50;
  margin-bottom: 10px;
}

.page-header p {
  color: #7f8c8d;
  font-size: 16px;
}

.main-content {
  display: flex;
  gap: 12px;
  max-width: 1520px;
  margin: 0 auto;
}

/* 模板选择区域 */
.template-section {
  width: 200px;
  flex-shrink: 0;
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: fit-content;
  position: sticky;
  top: 20px;
}

.template-section h3 {
  margin-bottom: 15px;
  color: #2c3e50;
  font-size: 18px;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.template-item {
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.template-item:hover {
  border-color: #3498db;
  background-color: #f8f9fa;
}

.template-item.active {
  border-color: #2980b9;
  background-color: #e3f2fd;
}

.template-name {
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 5px;
}

.template-desc {
  font-size: 12px;
  color: #7f8c8d;
  margin-bottom: 5px;
}

.template-category {
  font-size: 11px;
  color: #3498db;
  background-color: #ecf0f1;
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-block;
}

/* 表单区域 */
.form-section {
  flex: 1 1 auto;
  min-width: 420px;
  background: white;
  border-radius: 8px;
  padding: 25px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-section h3 {
  margin-bottom: 20px;
  color: #2c3e50;
  font-size: 18px;
}

.contract-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  gap: 15px;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 8px;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.form-group input.error,
.form-group select.error,
.form-group textarea.error {
  border-color: #e74c3c;
}

.error-message {
  color: #e74c3c;
  font-size: 12px;
  margin-top: 5px;
}

.form-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
  margin-top: 10px;
}

.btn-primary,
.btn-secondary {
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
}

.btn-primary {
  background-color: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2980b9;
}

.btn-primary:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #ecf0f1;
  color: #2c3e50;
}

.btn-secondary:hover {
  background-color: #d5dbdb;
}

/* 预览区域 */
.preview-section {
  width: 320px;
  flex-shrink: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.section-tabs {
  display: flex;
  border-bottom: 1px solid #e9ecef;
}

.section-tabs button {
  flex: 1;
  padding: 15px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #7f8c8d;
  transition: all 0.3s ease;
}

.section-tabs button.active {
  color: #3498db;
  border-bottom: 2px solid #3498db;
}

.preview-content,
.history-content {
  flex: 1;
  padding: 20px;
  min-height: 500px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #7f8c8d;
}

.empty-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 15px;
  opacity: 0.5;
}

.contract-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e9ecef;
}

.preview-header h4 {
  margin: 0;
  color: #2c3e50;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  background-color: #f8f9fa;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s ease;
}

.btn-icon:hover {
  background-color: #e9ecef;
}

.contract-content {
  flex: 1;
}

.contract-textarea {
  width: 100%;
  min-height: 400px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 15px;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  font-family: 'Microsoft YaHei', sans-serif;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.history-item:hover {
  border-color: #3498db;
  background-color: #f8f9fa;
}

.history-title {
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 5px;
}

.history-time {
  font-size: 12px;
  color: #7f8c8d;
  margin-bottom: 3px;
}

.history-parties {
  font-size: 12px;
  color: #3498db;
}

.btn-use-template {
  margin-top: 8px;
  padding: 4px 12px;
  font-size: 12px;
  color: #fff;
  background-color: #3498db;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.btn-use-template:hover {
  background-color: #2980b9;
}

.risk-score-panel {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background-color: #fafafa;
  max-height: 260px;
  overflow-y: auto;
}
.score-header {
  display: flex;
  align-items: center;
  gap: 16px;
}
.score-value {
  font-size: 20px;
  font-weight: 700;
}
.score-level .level-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.score-detail {
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
}
.score-detail .detail-title {
  font-weight: 600;
  color: #303133;
}
.score-detail ul {
  margin: 4px 0 0 16px;
  padding: 0;
}
.score-detail li {
  margin-bottom: 2px;
}

/* ============ 专家一键起草卡片 ============ */
.expert-card {
  margin-bottom: 20px;
  border: 1px solid #d9ecff;
  border-radius: 10px;
  background: linear-gradient(135deg, #f5f9ff 0%, #f0fdf4 100%);
  overflow: hidden;
}
.expert-header {
  padding: 12px 16px;
  background: linear-gradient(90deg, #ecf5ff, #f0f9eb);
  border-bottom: 1px solid #d9ecff;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.expert-title { font-size: 14px; font-weight: 700; color: #303133; }
.expert-sub { font-size: 12px; color: #909399; }
.expert-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.expert-type-row { display: flex; }
.expert-type-select {
  flex: 1;
  max-width: 280px;
  padding: 8px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 13px;
  color: #303133;
  background: white;
  outline: none;
}
.expert-type-select:focus { border-color: #409eff; }
.expert-desc-wrap { position: relative; }
.expert-desc {
  width: 100%;
  padding: 10px 96px 10px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: #303133;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}
.expert-desc:focus { border-color: #409eff; outline: none; box-shadow: 0 0 0 2px rgba(64,158,255,0.12); }
.btn-mic {
  position: absolute;
  right: 8px;
  top: 8px;
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 14px;
  background: white;
  color: #606266;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-mic:hover { border-color: #409eff; color: #409eff; }
.btn-mic.recording {
  background: #fef0f0;
  border-color: #f56c6c;
  color: #f56c6c;
  animation: mic-pulse 1.2s infinite;
}
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245,108,108,0.4); }
  50% { box-shadow: 0 0 0 6px rgba(245,108,108,0); }
}
.speech-interim {
  font-size: 12px;
  color: #409eff;
  background: #ecf5ff;
  border-radius: 6px;
  padding: 6px 10px;
}
.btn-expert-generate {
  align-self: flex-start;
  padding: 10px 22px;
  background: linear-gradient(135deg, #409eff, #67c23a);
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-expert-generate:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(64,158,255,0.3); }
.btn-expert-generate:disabled { opacity: 0.65; cursor: not-allowed; }

/* 指引面板新增样式（问题清单修复） */
.progress-node.clickable { cursor: pointer; }
.progress-node.clickable:hover .progress-label { color: #409eff; }
.req-mark { color: #f56c6c; margin-left: 2px; }
.guidance-card.done {
  border: 1px solid #b3e19d;
  background: #f0f9eb;
  border-radius: 8px;
  padding: 12px;
}
.guidance-card.error-card {
  border: 1px solid #fbc4c4;
  background: #fef0f0;
  border-radius: 8px;
  padding: 12px;
}
.law-topic {
  font-size: 11px;
  color: #909399;
  background: #f4f4f5;
  border-radius: 4px;
  padding: 1px 6px;
  margin-left: 6px;
}
.law-summary {
  margin-top: 8px;
  padding: 8px 10px;
  background: #fdf6ec;
  border-radius: 6px;
  font-size: 12px;
  color: #b88230;
  line-height: 1.6;
  white-space: pre-line;
}

/* 响应式设计：1366 笔记本也走桌面布局，更窄才堆叠 */
@media (max-width: 1400px) {
  .main-content {
    flex-direction: column;
  }

  /* 窄屏时把指引放在表单之前，填写时抬头就能看到（问题清单 #21） */
  .guidance-section { order: 1; }
  .form-section { order: 2; }
  .preview-section { order: 3; }

  .template-section,
  .guidance-section,
  .preview-section {
    width: 100%;
  }

  .form-row {
    flex-direction: column;
  }
}

/* ============ 起草指引面板 ============ */
.guidance-section {
  width: 280px;
  flex-shrink: 0;
  background: white;
  border-radius: 8px;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: fit-content;
  position: sticky;
  top: 20px;
}
.guidance-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}
.guidance-header h3 { margin: 0; font-size: 16px; color: #2c3e50; }
.guidance-icon { font-size: 20px; }

/* 环节进度条 */
.guidance-progress {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  padding: 8px 4px;
  background: #fafbfc;
  border-radius: 6px;
}
.progress-node {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #bbb;
}
.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e0e0e0;
  transition: all 0.3s;
}
.progress-node.filled { color: #67c23a; }
.progress-node.filled .progress-dot { background: #67c23a; }
.progress-node.active { color: #409eff; font-weight: 600; }
.progress-node.active .progress-dot { background: #409eff; transform: scale(1.3); box-shadow: 0 0 0 3px rgba(64,158,255,0.2); }

/* 指引卡片通用 */
.guidance-card {
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid #ebf0f5;
  background: #fafbfc;
}
.guidance-card.current { border-color: #409eff; background: #ecf5ff; }
.guidance-card.next    { border-color: #67c23a; background: #f0f9eb; }
.guidance-card.law     { border-color: #faecd8; background: #fdf6ec; }
.guidance-card.law.empty { background: #fafbfc; }
.card-title {
  font-size: 11px;
  font-weight: 600;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.card-sub { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 4px; }
.next-step-sub { color: #67c23a; }
.card-hint { font-size: 13px; color: #606266; line-height: 1.6; }
.card-hint.muted { color: #909399; font-size: 12px; font-style: italic; }
.loading-dot { color: #409eff; font-size: 12px; }

/* 法条列表 */
.law-list { display: flex; flex-direction: column; gap: 8px; }
.law-item {
  padding: 8px 10px;
  background: #ffffff;
  border-left: 3px solid #e6a23c;
  border-radius: 4px;
}
.law-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.law-name { font-weight: 600; color: #e6a23c; font-size: 13px; }
.law-article { font-size: 11px; color: #909399; }
.law-content { font-size: 12px; color: #606266; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.guidance-tip {
  font-size: 12px;
  color: #909399;
  background: #f0f9eb;
  padding: 8px 10px;
  border-radius: 6px;
  text-align: center;
}

/* ============ 聚焦态 & 补全建议 ============ */
.form-group.focused label { color: #409eff; }
.form-group.focused input,
.form-group.focused select,
.form-group.focused textarea {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.15);
}

/* 合同名称字段的下拉补全气泡 */
.suggestion-popover {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  z-index: 100;
  overflow: hidden;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}
.suggestion-item {
  text-align: left;
  padding: 8px 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  transition: background 0.15s;
}
.suggestion-item:hover { background: #ecf5ff; color: #409eff; }

/* 描述字段的底部补全建议条 */
.description-group { position: relative; }
.suggestion-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
  padding: 8px 10px;
  background: #f0f9eb;
  border-radius: 6px;
  border: 1px dashed #67c23a;
}
.suggestion-inline-label { font-size: 12px; color: #67c23a; font-weight: 600; }
.suggestion-inline-btn {
  border: none;
  background: #ffffff;
  color: #303133;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  transition: all 0.15s;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.suggestion-inline-btn:hover {
  background: #67c23a;
  color: white;
  border-color: #67c23a;
}
/* ============ 补充修改（无限轮次） ============ */
/* 评分面板内联按钮：紧挨风险等级 */
.btn-revise-inline {
  margin-top: 8px;
  padding: 7px 16px;
  background: linear-gradient(135deg, #409eff, #67c23a);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn-revise-inline:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 3px 10px rgba(64, 158, 255, 0.35); }
.btn-revise-inline:disabled { opacity: 0.6; cursor: not-allowed; }

/* 轮次进展提示 */
.revise-round-tip {
  margin-top: 12px;
  padding: 9px 12px;
  background: #f0f9eb;
  border: 1px dashed #67c23a;
  border-radius: 8px;
  font-size: 12px;
  color: #5a8a4a;
  line-height: 1.6;
}

/* 弹窗：历史轮次记录 */
.revise-history {
  margin-bottom: 14px;
  padding: 10px 12px;
  background: #fafbfc;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  max-height: 180px;
  overflow-y: auto;
}
.history-title { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 8px; }
.history-item {
  padding: 8px 10px;
  background: #f0f9eb;
  border-left: 3px solid #67c23a;
  border-radius: 4px;
  margin-bottom: 6px;
}
.history-item:last-child { margin-bottom: 0; }
.history-head { font-size: 12px; font-weight: 600; color: #529b2e; margin-bottom: 3px; }
.history-summary { font-size: 11px; color: #606266; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* 无限轮次循环提示 */
.revise-loop-tip {
  margin-top: 12px;
  text-align: center;
  font-size: 12px;
  color: #909399;
}

/* 弹窗：模式选择 */
.revise-choose { display: flex; flex-direction: column; gap: 12px; padding: 8px 4px; }
.revise-mode-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.revise-mode-card:hover { border-color: #409eff; background: #ecf5ff; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(64,158,255,0.15); }
.mode-icon { font-size: 30px; }
.mode-text { flex: 1; }
.mode-title { font-size: 15px; font-weight: 600; color: #303133; margin-bottom: 4px; }
.mode-desc { font-size: 12px; color: #909399; line-height: 1.5; }
.mode-arrow { color: #c0c4cc; font-size: 18px; }

/* 弹窗：direct 确认 */
.revise-direct { min-height: 200px; }
.revise-summary { background: #f0f9eb; border: 1px solid #e1f3d8; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
.summary-title { font-size: 13px; font-weight: 600; color: #67c23a; margin-bottom: 6px; }
.summary-content { font-size: 12px; color: #606266; line-height: 1.7; white-space: pre-wrap; margin: 0; font-family: inherit; }
.revise-preview-title { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 6px; }
.revise-preview {
  max-height: 260px;
  overflow-y: auto;
  background: #fafbfc;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 12px;
  color: #606266;
  line-height: 1.7;
  white-space: pre-wrap;
}
.revise-confirm-tip { text-align: center; font-size: 13px; color: #e6a23c; margin-top: 12px; font-weight: 600; }

/* 弹窗：guide 逐条 */
.revise-guide { max-height: 420px; overflow-y: auto; min-height: 200px; }
.guide-empty { text-align: center; color: #909399; font-size: 13px; padding: 40px 0; }
.guide-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
  transition: all 0.2s;
}
.guide-item.applied { border-color: #e1f3d8; background: #fafdf7; opacity: 0.75; }
.guide-explain { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 8px; }
.guide-diff { display: flex; flex-direction: column; gap: 6px; }
.diff-row {
  display: flex;
  gap: 8px;
  font-size: 12px;
  line-height: 1.6;
  padding: 7px 10px;
  border-radius: 6px;
}
.diff-row.old { background: #fef0f0; color: #a8616a; }
.diff-row.new { background: #f0f9eb; color: #5a8a4a; }
.diff-tag {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  height: fit-content;
}
.diff-row.old .diff-tag { background: #fde2e2; color: #c45656; }
.diff-row.new .diff-tag { background: #d1edc4; color: #529b2e; }
.guide-actions { text-align: right; margin-top: 8px; }
.btn-adopt {
  padding: 5px 16px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-adopt:hover { background: #337ecc; }
.adopted-mark { font-size: 12px; color: #67c23a; font-weight: 600; }
.guide-applied-tip {
  text-align: center;
  font-size: 12px;
  color: #67c23a;
  background: #f0f9eb;
  border-radius: 6px;
  padding: 8px;
  margin-top: 4px;
}
</style>