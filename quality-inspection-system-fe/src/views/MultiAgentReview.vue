<template>
  <div class="multi-agent-page">
    <div class="page-header">
      <h1>多智能体合同审查</h1>
      <p>借鉴 FMARLJP 框架：核心角色—元角色分层协作 · 辩论驱动的动态法条检索 · 全链条终审精炼</p>
    </div>

    <div class="layout">
      <!-- 左侧：输入与角色编排 -->
      <div class="input-column">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-title">审查输入</div>
          </template>

          <el-select
            v-model="selectedContractId"
            placeholder="选择已上传/已生成的合同（可选）"
            clearable
            filterable
            style="width: 100%; margin-bottom: 12px;"
            @change="handleSelectContract"
          >
            <el-option
              v-for="c in contracts"
              :key="c.id"
              :label="`${c.fileName || '未命名'}（ID:${c.id}）`"
              :value="c.id"
            />
          </el-select>

          <el-input
            v-model="form.contractName"
            placeholder="合同名称（可选）"
            style="margin-bottom: 12px;"
          />

          <el-input
            v-model="form.contractContent"
            type="textarea"
            :rows="14"
            resize="none"
            placeholder="粘贴合同全文，或在上方选择已有合同后自动载入……"
          />

          <div class="input-footer">
            <span class="char-count">{{ form.contractContent.length }} 字</span>
            <el-button
              type="primary"
              :loading="loading"
              @click="startReview"
            >
              {{ loading ? '多智能体审查中…' : '启动多智能体审查' }}
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="panel roles-panel">
          <template #header>
            <div class="panel-title">元角色编排（3 组 9 角色）</div>
          </template>
          <div class="role-group" v-for="group in roleGroups" :key="group.title">
            <div class="role-group-title">
              <span class="dot" :style="{ background: group.color }"></span>
              {{ group.title }}
            </div>
            <div class="role-list">
              <span class="role-chip" v-for="role in group.roles" :key="role.name">
                {{ role.label }}
              </span>
            </div>
          </div>
          <div class="role-note">
            每个元角色只承担单一职责，降低单角色认知负荷；检索式随辩论轮次迭代重写。
          </div>
        </el-card>
      </div>

      <!-- 右侧：过程与结果 -->
      <div class="result-column">
        <!-- 虚拟法庭：实时播放后端推送的庭审过程（结束后保留，可当回放看） -->
        <el-card
          shadow="never"
          class="panel court-panel"
          v-if="loading || courtEvents.length"
          v-show="!courtCollapsed"
        >
          <template #header>
            <div class="panel-title court-panel-title">
              <span>虚拟法庭 · 庭审实况</span>
              <el-button size="small" text @click="courtCollapsed = true">收起画面</el-button>
            </div>
          </template>
          <VirtualCourt
            :contract-name="form.contractName || (result && result.contractName)"
            :events="courtEvents"
            :stream-done="!loading"
          />
        </el-card>
        <div class="court-collapsed-bar" v-if="courtEvents.length && courtCollapsed">
          <span>庭审画面已收起</span>
          <el-button size="small" text type="primary" @click="courtCollapsed = false">展开庭审画面</el-button>
        </div>

        <el-card shadow="never" class="panel empty-panel" v-if="!loading && !result">
          <el-empty description="输入合同后启动审查，这里会展示庭审全过程和终审结论" />
        </el-card>

        <template v-if="result">
          <!-- 结论总览 -->
          <el-card shadow="never" class="panel verdict-overview">
            <div class="verdict-left">
              <el-progress
                type="dashboard"
                :percentage="result.verdict.score"
                :color="scoreColor"
                :width="120"
              >
                <template #default>
                  <div class="score-value" :style="{ color: scoreColor }">{{ result.verdict.score }}</div>
                  <div class="score-label">风险评分</div>
                </template>
              </el-progress>
            </div>
            <div class="verdict-right">
              <div class="verdict-title">
                {{ result.contractName }}
                <el-tag :type="levelTagType" effect="dark" size="small">
                  {{ result.verdict.level }}风险
                </el-tag>
              </div>
              <div class="verdict-summary">{{ result.verdict.summary || '—' }}</div>
              <div class="verdict-meta">
                <span>模型：{{ result.model }}</span>
                <span>大模型调用：{{ result.stats.llmCalls }} 次（失败 {{ result.stats.failedCalls }} 次）</span>
                <span>耗时：{{ (result.stats.elapsedMs / 1000).toFixed(1) }} 秒</span>
                <span>检索法条：{{ result.knowledge.length }} 条</span>
              </div>
              <div class="verdict-actions">
                <el-button size="small" @click="exportReport">导出审查报告(JSON)</el-button>
                <el-button size="small" type="primary" plain @click="startReview">重新审查</el-button>
              </div>
            </div>
          </el-card>

          <el-card shadow="never" class="panel">
            <el-tabs v-model="activeTab">
              <!-- 审查结论 -->
              <el-tab-pane label="审查结论" name="verdict">
                <div class="section-title">风险条款（{{ result.verdict.findings.length }}）</div>
                <el-table
                  v-if="result.verdict.findings.length"
                  :data="result.verdict.findings"
                  size="small"
                  border
                  class="verdict-table"
                >
                  <el-table-column prop="clause" label="条款位置" width="150" />
                  <el-table-column prop="risk" label="风险说明" min-width="220" show-overflow-tooltip />
                  <el-table-column label="等级" width="70" align="center">
                    <template #default="{ row }">
                      <el-tag :type="riskTagType(row.level)" size="small">{{ row.level }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="basis" label="法律依据" width="180" show-overflow-tooltip />
                  <el-table-column prop="suggestion" label="修改建议" min-width="220" show-overflow-tooltip />
                </el-table>
                <el-empty v-else description="模型未返回结构化风险条款" :image-size="60" />

                <div class="section-title" style="margin-top: 20px;">要素—结论映射</div>
                <el-table
                  v-if="result.verdict.factorConclusion.length"
                  :data="result.verdict.factorConclusion"
                  size="small"
                  border
                >
                  <el-table-column prop="factor" label="合同要素" width="150" />
                  <el-table-column prop="evidence" label="条款/事实依据" min-width="200" show-overflow-tooltip />
                  <el-table-column prop="basis" label="法律依据" width="180" show-overflow-tooltip />
                  <el-table-column prop="conclusion" label="结论" min-width="180" show-overflow-tooltip />
                </el-table>
                <el-empty v-else description="模型未返回要素映射" :image-size="60" />

                <div class="section-title" style="margin-top: 20px;">残余争议处理</div>
                <div v-if="result.verdict.residualDisputes.length" class="residual-list">
                  <div class="residual-item" v-for="(r, i) in result.verdict.residualDisputes" :key="i">
                    <div class="residual-title">{{ r.title }}</div>
                    <div class="residual-handling">{{ r.handling }}</div>
                  </div>
                </div>
                <el-empty v-else description="无残余争议" :image-size="60" />

                <div class="raw-verdict" v-if="result.verdict.raw">
                  <div class="section-title">模型原始输出（降级展示）</div>
                  <pre>{{ result.verdict.raw }}</pre>
                </div>

                <div class="disclaimer">{{ result.verdict.disclaimer }}</div>
              </el-tab-pane>

              <!-- 庭审记录 -->
              <el-tab-pane label="庭审记录" name="debate">
                <div v-for="(group, gi) in debateGroups" :key="gi" class="debate-group">
                  <div class="debate-group-title">
                    第 {{ group.round }} 轮 · {{ group.focus }}
                  </div>
                  <div
                    v-for="(msg, mi) in group.messages"
                    :key="mi"
                    class="debate-msg"
                    :class="msg.side === 'A' ? 'side-a' : msg.side === 'B' ? 'side-b' : 'side-judge'"
                  >
                    <div class="msg-role">{{ msg.roleLabel }}</div>
                    <div class="msg-content">{{ msg.content }}</div>
                    <div class="msg-query" v-if="msg.query">
                      <el-tag size="small" type="info">检索式</el-tag>
                      {{ msg.query }}
                    </div>
                  </div>
                </div>
                <el-empty v-if="!debateGroups.length" description="暂无庭审记录" :image-size="60" />
              </el-tab-pane>

              <!-- 争议焦点 -->
              <el-tab-pane label="争议焦点" name="focus">
                <div v-for="stage in result.stages" :key="stage.focus.id" class="focus-card">
                  <div class="focus-head">
                    <span class="focus-title">{{ stage.focus.title }}</span>
                    <el-tag :type="riskTagType(stage.focus.severity)" size="small">
                      {{ stage.focus.severity }}
                    </el-tag>
                  </div>
                  <div class="focus-reason">{{ stage.focus.reason }}</div>
                  <div class="focus-clauses" v-if="stage.focus.relatedClauses.length">
                    <el-tag
                      v-for="(c, i) in stage.focus.relatedClauses"
                      :key="i"
                      size="small"
                      effect="plain"
                      class="clause-tag"
                    >{{ c }}</el-tag>
                  </div>
                  <div class="focus-block" v-if="stage.agreed.length">
                    <span class="block-label">已达成共识：</span>{{ stage.agreed.join('；') }}
                  </div>
                  <div class="focus-block" v-if="stage.residual.length">
                    <span class="block-label">残余争议：</span>
                    {{ stage.residual.map((r) => r.title).join('；') }}
                  </div>
                  <div class="focus-block" v-if="stage.nextQueries.length">
                    <span class="block-label">补充检索：</span>
                    {{ stage.nextQueries.join('；') }}
                  </div>
                </div>
              </el-tab-pane>

              <!-- 动态检索 -->
              <el-tab-pane label="动态检索知识" name="knowledge">
                <div class="kb-hint">
                  检索由各方法条检索元角色生成的查询式驱动，范围覆盖法规库、系统历史审查案例与合同模板标准条款；第二轮会基于上一轮结果与最新辩论重写查询式。
                </div>
                <div class="knowledge-grid">
                  <div class="knowledge-card" v-for="item in result.knowledge" :key="item.id">
                    <div class="knowledge-head">
                      <span class="knowledge-title">{{ item.title }}</span>
                      <el-tag
                        size="small"
                        :type="item.type === 'history' ? 'warning' : item.type === 'template' ? 'info' : 'success'"
                      >
                        {{ item.type === 'history' ? '历史案例' : item.type === 'template' ? '标准模板' : '法规' }}
                      </el-tag>
                      <el-tag size="small" type="info">相关度 {{ item.score }}</el-tag>
                    </div>
                    <div class="knowledge-category">
                      {{ item.category }} · {{ item.source }}
                      <span v-if="item.effectiveDate"> · {{ item.effectiveDate }} 施行</span>
                    </div>
                    <div class="knowledge-content">{{ item.content }}</div>
                  </div>
                </div>
                <el-empty v-if="!result.knowledge.length" description="本轮未检索到相关知识" :image-size="60" />
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import { getAuthHeaders } from '@Setup/storage/user.js';
import VirtualCourt from '@/components/VirtualCourt.vue';

export default {
  name: 'MultiAgentReview',
  components: { VirtualCourt },
  data() {
    return {
      contracts: [],
      selectedContractId: null,
      form: {
        contractName: '',
        contractContent: ''
      },
      loading: false,
      elapsed: 0,
      activeStep: 0,
      timer: null,
      stepTimer: null,
      result: null,
      activeTab: 'verdict',
      // 虚拟法庭：后端推送的庭审事件按到达顺序累积
      courtEvents: [],
      courtCollapsed: false,
      streamAbort: null,
      roleGroups: [
        {
          title: '审判组 JudgeTeam',
          color: '#7c5cff',
          roles: [
            { name: 'JudgeFocus', label: '争议焦点确认' },
            { name: 'JudgeDebate', label: '庭审主持' },
            { name: 'JudgeVerdict', label: '终审裁决' }
          ]
        },
        {
          title: '委托方组 PartyA（甲方）',
          color: '#2f6fed',
          roles: [
            { name: 'PartyALead', label: '首席主张' },
            { name: 'PartyAEvidence', label: '条款证据审查' },
            { name: 'PartyALegal', label: '法律检索' }
          ]
        },
        {
          title: '相对方组 PartyB（乙方）',
          color: '#e6862b',
          roles: [
            { name: 'PartyBLead', label: '首席抗辩' },
            { name: 'PartyBEvidence', label: '条款证据审查' },
            { name: 'PartyBLegal', label: '法律检索' }
          ]
        }
      ]
    };
  },
  computed: {
    scoreColor() {
      const s = this.result?.verdict?.score || 0;
      if (s <= 40) return '#2e9e5b';
      if (s <= 70) return '#e6a23c';
      return '#f56c6c';
    },
    levelTagType() {
      const level = this.result?.verdict?.level;
      if (level === '低') return 'success';
      if (level === '高') return 'danger';
      return 'warning';
    },
    debateGroups() {
      if (!this.result) return [];
      const groups = [];
      const index = new Map();
      for (const msg of this.result.debate) {
        const key = `${msg.round}-${msg.focus}`;
        if (!index.has(key)) {
          index.set(key, { round: msg.round, focus: msg.focus, messages: [] });
          groups.push(index.get(key));
        }
        index.get(key).messages.push(msg);
      }
      return groups;
    }
  },
  mounted() {
    this.loadContracts();
    this.consumeDeepReviewPayload();
  },
  beforeUnmount() {
    this.clearTimers();
    // 离开页面时中断未完成的流式庭审，避免连接悬挂
    if (this.streamAbort) {
      try {
        this.streamAbort.abort();
      } catch (error) {
        console.warn('中断庭审流失败:', error);
      }
      this.streamAbort = null;
    }
  },
  methods: {
    // 接收快速初筛页面“转深度审查”带过来的正文
    consumeDeepReviewPayload() {
      try {
        const raw = sessionStorage.getItem('deep-review-payload');
        if (!raw) return;
        sessionStorage.removeItem('deep-review-payload');
        const payload = JSON.parse(raw);
        if (payload && payload.content) {
          this.form.contractName = payload.name || '';
          this.form.contractContent = payload.content;
          ElMessage.success('已带入快速初筛识别出的合同正文，可直接启动深度审查');
        }
      } catch (error) {
        console.warn('读取深度审查入参失败:', error);
      }
    },

    riskTagType(level) {
      if (level === '低') return 'success';
      if (level === '高') return 'danger';
      return 'warning';
    },

    async loadContracts() {
      try {
        const resp = await fetch('/api/files', { headers: getAuthHeaders() });
        const data = await resp.json();
        if (data.err_code === 0) {
          this.contracts = data.files || [];
        }
      } catch (error) {
        console.error('加载合同列表失败:', error);
      }
    },

    async handleSelectContract(id) {
      if (!id) return;
      try {
        const resp = await fetch(`/api/multi-agent/contract_content/${id}`, { headers: getAuthHeaders() });
        const data = await resp.json();
        if (data.err_code === 0) {
          this.form.contractName = data.data.fileName || this.form.contractName;
          this.form.contractContent = data.data.content || '';
          if (!data.data.content) {
            ElMessage.warning('该合同没有可读取的正文，请手动粘贴合同内容');
          }
        } else {
          ElMessage.error(data.message || '读取合同失败');
        }
      } catch (error) {
        console.error('读取合同正文失败:', error);
        ElMessage.error('读取合同正文失败');
      }
    },

    startTimer() {
      this.elapsed = 0;
      this.activeStep = 0;
      this.timer = setInterval(() => {
        this.elapsed += 1;
      }, 1000);
      // 仅用于进度展示：按典型阶段耗时推进
      this.stepTimer = setInterval(() => {
        if (this.activeStep < 4) this.activeStep += 1;
      }, 9000);
    },

    clearTimers() {
      if (this.timer) clearInterval(this.timer);
      if (this.stepTimer) clearInterval(this.stepTimer);
      this.timer = null;
      this.stepTimer = null;
    },

    async startReview() {
      const content = (this.form.contractContent || '').trim();
      if (content.length < 50) {
        ElMessage.warning('请先输入至少 50 字的合同正文');
        return;
      }

      this.loading = true;
      this.result = null;
      this.activeTab = 'verdict';
      this.courtEvents = [];
      this.courtCollapsed = false;
      this.startTimer();

      try {
        const payload = {
          contractContent: content,
          contractName: this.form.contractName,
          contractId: this.selectedContractId || undefined
        };
        // 优先走流式接口：庭审过程按真实顺序推送到虚拟法庭
        const streamed = await this.runStreamReview(payload);
        if (!streamed) {
          // 浏览器不支持流式读取或流式接口不可用时，退回一次性接口
          await this.runPlainReview(payload);
        }
      } catch (error) {
        console.error('多智能体审查失败:', error);
        ElMessage.error(error.message || '网络错误或审查超时，请稍后重试');
      } finally {
        this.loading = false;
        this.clearTimers();
      }
    },

    // 流式审查：逐行读取 NDJSON，边到边推进虚拟法庭
    async runStreamReview(payload) {
      if (typeof window === 'undefined' || !window.ReadableStream || !window.TextDecoder) return false;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      this.streamAbort = controller;

      let resp;
      try {
        resp = await fetch('/api/multi-agent/review-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(payload),
          signal: controller ? controller.signal : undefined
        });
      } catch (error) {
        console.warn('流式接口不可用，改用普通接口:', error.message);
        return false;
      }

      if (!resp.ok || !resp.body || !resp.body.getReader) {
        console.warn('流式接口不可用（状态码 ' + resp.status + '），改用普通接口');
        return false;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let finished = false;

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          let evt;
          try {
            evt = JSON.parse(line);
          } catch (e) {
            continue;
          }
          if (evt.type === 'ping') continue;
          this.courtEvents.push(evt);
          if (evt.type === 'done') {
            this.result = evt.data;
            this.activeStep = 5;
            finished = true;
            ElMessage.success('多智能体审查完成');
          } else if (evt.type === 'error') {
            throw new Error((evt.data && evt.data.message) || '庭审中断');
          }
        }
      }
      return true;
    },

    // 兼容路径：不支持流式时仍可完成审查（虚拟法庭会一次性补齐所有事件）
    async runPlainReview(payload) {
      const resp = await fetch('/api/multi-agent/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.err_code === 0) {
        this.result = data.data;
        this.activeStep = 5;
        this.replayFromResult(data.data);
        ElMessage.success('多智能体审查完成');
      } else {
        throw new Error(data.message || '审查失败');
      }
    },

    // 用完整结果补出一套事件，让虚拟法庭仍能按顺序回放
    replayFromResult(data) {
      const events = [{ type: 'start', data: { contractName: data.contractName } }];
      if (data.focuses && data.focuses.length) {
        events.push({ type: 'focuses', data: data.focuses });
      }
      (data.debate || []).forEach((msg) => {
        const role = msg.role;
        const group = msg.side === 'A' ? 'partyA' : msg.side === 'B' ? 'partyB' : 'judge';
        events.push({ type: 'agent:speech', data: { role, label: msg.roleLabel, group, round: msg.round, text: msg.content } });
        if (msg.query) {
          events.push({ type: 'agent:query', data: { role, side: msg.side, query: msg.query } });
        }
      });
      if (data.knowledge && data.knowledge.length) {
        events.push({ type: 'knowledge', data: { round: 2, items: data.knowledge } });
      }
      (data.stages || []).forEach((st) => {
        events.push({ type: 'summary', data: { agreed: st.agreed || [], residual: st.residual || [] } });
      });
      events.push({ type: 'verdict', data: data.verdict });
      events.push({ type: 'done', data });
      this.courtEvents = events;
    },

    exportReport() {
      if (!this.result) return;
      const blob = new Blob([JSON.stringify(this.result, null, 2)], {
        type: 'application/json;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.result.contractName || '合同'}_多智能体审查报告.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
};
</script>

<style scoped>
.multi-agent-page {
  padding: 20px 24px 32px;
  background: #f5f7fb;
  min-height: calc(100vh - 60px);
  box-sizing: border-box;
}
.page-header h1 {
  margin: 0;
  font-size: 22px;
  color: #1f2d3d;
}
.page-header p {
  margin: 6px 0 18px;
  font-size: 13px;
  color: #7a8699;
}
.layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.input-column {
  width: 380px;
  flex: 0 0 380px;
}
.result-column {
  flex: 1;
  min-width: 0;
}
.panel {
  border-radius: 10px;
  border: 1px solid #e8edf5;
  margin-bottom: 16px;
}
.panel-title {
  font-weight: 600;
  color: #1f2d3d;
}
/* 虚拟法庭：卡片内边距去掉，让暗色舞台铺满 */
.court-panel :deep(.el-card__header) {
  padding: 12px 16px;
  border-bottom: 1px solid #e8edf5;
}
.court-panel :deep(.el-card__body) {
  padding: 0;
}
.court-panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.court-collapsed-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #f2f5fb;
  border: 1px solid #e8edf5;
  border-radius: 10px;
  padding: 10px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #475467;
}
.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
.char-count {
  font-size: 12px;
  color: #9aa5b5;
}
.roles-panel {
  background: #fbfcfe;
}
.role-group {
  margin-bottom: 14px;
}
.role-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #34405a;
  margin-bottom: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.role-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.role-chip {
  font-size: 12px;
  color: #475467;
  background: #eef2f9;
  border-radius: 12px;
  padding: 4px 10px;
}
.role-note {
  font-size: 12px;
  color: #8a94a6;
  line-height: 1.6;
  border-top: 1px dashed #e3e9f2;
  padding-top: 10px;
}
.running-box {
  padding: 26px 34px 18px;
}
.running-tip {
  margin-top: 22px;
  text-align: center;
  font-size: 13px;
  color: #7a8699;
}
.empty-panel {
  min-height: 420px;
  display: flex;
  align-items: center;
}
.verdict-overview :deep(.el-card__body) {
  display: flex;
  gap: 26px;
  align-items: center;
  padding: 20px 26px;
}
.score-value {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
}
.score-label {
  font-size: 12px;
  color: #8a94a6;
  margin-top: 2px;
}
.verdict-right {
  flex: 1;
  min-width: 0;
}
.verdict-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 700;
  color: #1f2d3d;
  margin-bottom: 8px;
}
.verdict-summary {
  font-size: 13px;
  color: #4b5565;
  line-height: 1.7;
}
.verdict-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 10px;
  font-size: 12px;
  color: #8a94a6;
}
.verdict-actions {
  margin-top: 12px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #34405a;
  margin-bottom: 10px;
}
.verdict-table {
  width: 100%;
}
.residual-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.residual-item {
  background: #fff8ee;
  border: 1px solid #f6e2c8;
  border-radius: 8px;
  padding: 10px 12px;
}
.residual-title {
  font-size: 13px;
  font-weight: 600;
  color: #8a5a16;
}
.residual-handling {
  font-size: 12px;
  color: #7a6448;
  margin-top: 4px;
  line-height: 1.6;
}
.raw-verdict pre {
  white-space: pre-wrap;
  word-break: break-all;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  color: #4b5565;
  max-height: 320px;
  overflow: auto;
}
.disclaimer {
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px dashed #e3e9f2;
  font-size: 12px;
  color: #9aa5b5;
}
.debate-group {
  margin-bottom: 22px;
}
.debate-group-title {
  font-size: 13px;
  font-weight: 600;
  color: #34405a;
  border-left: 3px solid #2f6fed;
  padding-left: 8px;
  margin-bottom: 10px;
}
.debate-msg {
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 10px;
  background: #fff;
  border: 1px solid #e8edf5;
}
.debate-msg.side-a {
  border-left: 3px solid #2f6fed;
  background: #f7faff;
}
.debate-msg.side-b {
  border-left: 3px solid #e6862b;
  background: #fffaf4;
}
.debate-msg.side-judge {
  border-left: 3px solid #7c5cff;
  background: #faf8ff;
}
.msg-role {
  font-size: 12px;
  font-weight: 600;
  color: #5b6474;
  margin-bottom: 4px;
}
.msg-content {
  font-size: 13px;
  color: #34405a;
  line-height: 1.7;
  white-space: pre-wrap;
}
.msg-query {
  margin-top: 8px;
  font-size: 12px;
  color: #7a8699;
  background: #f2f4f8;
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.focus-card {
  border: 1px solid #e8edf5;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.focus-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.focus-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
}
.focus-reason {
  font-size: 13px;
  color: #5b6474;
  line-height: 1.7;
}
.focus-clauses {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.clause-tag {
  max-width: 100%;
}
.focus-block {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7688;
  line-height: 1.7;
}
.block-label {
  font-weight: 600;
  color: #475467;
}
.kb-hint {
  font-size: 12px;
  color: #8a94a6;
  background: #f5f7fb;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
}
.knowledge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.knowledge-card {
  border: 1px solid #e3ebf6;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fbfdff;
}
.knowledge-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.knowledge-title {
  font-size: 13px;
  font-weight: 600;
  color: #24406b;
  line-height: 1.5;
}
.knowledge-category {
  font-size: 12px;
  color: #8aa0bd;
  margin: 4px 0 6px;
}
.knowledge-content {
  font-size: 12px;
  color: #4b5565;
  line-height: 1.7;
}
</style>
