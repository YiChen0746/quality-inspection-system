<template>
  <div class="court-stage">
    <!-- 顶部：焦点横幅 + 阶段进度 -->
    <div class="court-topbar">
      <div class="case-title">
        <span class="case-badge">模拟庭审</span>
        <span class="case-name">{{ contractName || '未命名合同' }}</span>
        <span class="case-status" :class="statusClass">{{ statusText }}</span>
      </div>
      <div class="court-controls">
        <el-button size="small" :disabled="finished" @click="togglePause">
          {{ paused ? '继续' : '暂停' }}
        </el-button>
        <el-button size="small" @click="cycleSpeed">{{ speed }}x</el-button>
        <el-button size="small" :disabled="finished" @click="skipToVerdict">跳到结论</el-button>
        <span class="court-clock">{{ elapsedText }}</span>
      </div>
    </div>

    <div class="focus-banner" v-if="focusList.length">
      <span class="focus-label">本轮争议焦点</span>
      <span class="focus-item" v-for="(f, i) in focusList" :key="f.id || i">
        <i class="focus-dot" :class="'sev-' + (f.severity || '中')"></i>{{ f.title }}
      </span>
    </div>

    <div class="stage-steps">
      <div
        v-for="(s, i) in stages"
        :key="s.key"
        class="stage-step"
        :class="{ done: stageIndex > i, active: stageIndex === i }"
      >
        <span class="step-index">{{ i + 1 }}</span>
        <span class="step-text">{{ s.label }}</span>
      </div>
    </div>

    <!-- 审判席 -->
    <div class="judge-bench">
      <div class="bench-plate">审 判 席</div>
      <div class="seat-row">
        <div
          v-for="role in judgeRoles"
          :key="role.key"
          class="seat seat-judge"
          :class="{ speaking: speakerOf(role.key) === 'typing', thinking: thinking[role.key] }"
        >
          <div class="avatar judge-avatar">
            <span>{{ role.initial }}</span>
            <i class="wave" v-if="speakerOf(role.key) === 'typing'"></i>
            <i class="dots" v-else-if="thinking[role.key]"><b></b><b></b><b></b></i>
          </div>
          <div class="seat-label">{{ role.label }}</div>
        </div>
      </div>
    </div>

    <!-- 双方席位 -->
    <div class="party-area">
      <div class="party party-a">
        <div class="party-plate">委 托 方 席（甲方）</div>
        <div
          v-for="role in partyARoles"
          :key="role.key"
          class="seat seat-party"
          :class="{ speaking: speakerOf(role.key) === 'typing', thinking: thinking[role.key] }"
        >
          <div class="avatar party-avatar a-avatar">
            <span>{{ role.initial }}</span>
            <i class="wave" v-if="speakerOf(role.key) === 'typing'"></i>
            <i class="dots" v-else-if="thinking[role.key]"><b></b><b></b><b></b></i>
          </div>
          <div class="seat-label">{{ role.label }}</div>
        </div>
      </div>

      <!-- 中间：字幕与证据台 -->
      <div class="court-center">
        <div class="subtitle-box" :class="currentSideClass">
          <template v-if="current">
            <div class="subtitle-head">
              <span class="speaker-name">{{ current.label }}</span>
              <span class="speaker-round" v-if="current.round">第 {{ current.round }} 轮</span>
            </div>
            <div class="subtitle-text">
              {{ typedText }}<span class="caret" v-if="current.shown < current.text.length">▍</span>
            </div>
            <div class="subtitle-query" v-if="current.query">
              <span class="query-tag">检索式</span>{{ current.query }}
            </div>
          </template>
          <div class="subtitle-idle" v-else>
            <template v-if="finished">庭审已结束，可查看下方详细记录</template>
            <template v-else-if="thinkingCount">双方正在准备发言…</template>
            <template v-else>等待下一个环节…</template>
          </div>
        </div>

        <div class="evidence-desk">
          <div class="desk-title">证 据 台 · 动态检索</div>
          <div class="desk-body">
            <transition-group name="fly">
              <div class="evidence-card" v-for="item in visibleKnowledge" :key="item.id">
                <span class="ev-type" :class="'ev-' + (item.type || 'law')">
                  {{ item.type === 'history' ? '案例' : item.type === 'template' ? '模板' : '法规' }}
                </span>
                <span class="ev-title">{{ item.title }}</span>
              </div>
            </transition-group>
            <div class="desk-empty" v-if="!visibleKnowledge.length">检索式命中后，法条会飞入此处</div>
          </div>
          <div class="desk-queries" v-if="queryChips.length">
            <span class="query-chip" v-for="(q, i) in queryChips" :key="i" :class="q.side === 'B' ? 'chip-b' : 'chip-a'">
              {{ q.text }}
            </span>
          </div>
        </div>
      </div>

      <div class="party party-b">
        <div class="party-plate">相 对 方 席（乙方）</div>
        <div
          v-for="role in partyBRoles"
          :key="role.key"
          class="seat seat-party"
          :class="{ speaking: speakerOf(role.key) === 'typing', thinking: thinking[role.key] }"
        >
          <div class="avatar party-avatar b-avatar">
            <span>{{ role.initial }}</span>
            <i class="wave" v-if="speakerOf(role.key) === 'typing'"></i>
            <i class="dots" v-else-if="thinking[role.key]"><b></b><b></b><b></b></i>
          </div>
          <div class="seat-label">{{ role.label }}</div>
        </div>
      </div>
    </div>

    <!-- 庭审主持归纳 -->
    <div class="summary-strip" v-if="summaryList.length">
      <div class="summary-item" v-for="(s, i) in summaryList.slice(-1)" :key="i">
        <span class="summary-tag">庭审主持 · 归纳</span>
        <span class="summary-text">已达成共识 {{ s.agreed }} 条，未决争议 {{ s.residual }} 条</span>
      </div>
    </div>

    <!-- 终审裁决 -->
    <div class="verdict-stage" v-if="showVerdict">
      <div class="gavel" :class="{ strike: gavelStrike }">
        <div class="gavel-head"></div>
        <div class="gavel-handle"></div>
        <div class="gavel-base"></div>
      </div>
      <div class="verdict-panel">
        <div class="verdict-score">
          <span class="score-num" :style="{ color: verdictColor }">{{ displayScore }}</span>
          <span class="score-unit">/100</span>
        </div>
        <div class="verdict-meta">
          <el-tag :type="verdictTagType" effect="dark" size="small">{{ verdict.level }}风险</el-tag>
          <span class="verdict-findings">风险条款 {{ verdict.findings }} 条</span>
        </div>
        <div class="verdict-summary">{{ verdict.summary }}</div>
      </div>
    </div>
  </div>
</template>

<script>
// 虚拟法庭：按后端推送的事件顺序播放真实庭审过程
// 说明：所有字幕内容都来自后端事件，本组件只负责“何时显示、怎么动”，不编造任何案情
export default {
  name: 'VirtualCourt',
  props: {
    contractName: { type: String, default: '' },
    // 后端事件组成的数组：每一项形如 { type, data }
    events: { type: Array, default: () => [] },
    // 后端是否已结束
    streamDone: { type: Boolean, default: false }
  },
  data() {
    return {
      ops: [],
      cursor: 0,
      current: null,
      typedText: '',
      paused: false,
      speed: 2,
      speeds: [1, 2, 4],
      thinking: {},
      activeRole: '',
      focusList: [],
      knowledge: [],
      queryChips: [],
      summaryList: [],
      verdictVisible: false,
      verdictScore: 0,
      verdictData: null,
      gavelStrike: false,
      finished: false,
      elapsed: 0,
      clockTimer: null,
      tickTimer: null,
      holdTimer: null,
      stageIndex: 0,
      stages: [
        { key: 'focus', label: '焦点确认' },
        { key: 'round1', label: '第一轮辩论' },
        { key: 'search', label: '动态检索' },
        { key: 'round2', label: '第二轮攻坚' },
        { key: 'verdict', label: '终审裁决' }
      ],
      judgeRoles: [
        { key: 'judgeFocus', label: '争议焦点确认', initial: '焦' },
        { key: 'judgeDebate', label: '庭审主持', initial: '主' },
        { key: 'judgeVerdict', label: '终审裁决', initial: '审' }
      ],
      partyARoles: [
        { key: 'partyALead', label: '首席主张', initial: '主' },
        { key: 'partyAEvidence', label: '条款证据审查', initial: '证' },
        { key: 'partyALegal', label: '法律检索', initial: '法' }
      ],
      partyBRoles: [
        { key: 'partyBLead', label: '首席抗辩', initial: '辩' },
        { key: 'partyBEvidence', label: '条款证据审查', initial: '证' },
        { key: 'partyBLegal', label: '法律检索', initial: '法' }
      ]
    };
  },
  computed: {
    statusText() {
      if (this.finished) return '已结案';
      if (this.streamDone) return '庭审结束';
      return '庭审进行中';
    },
    statusClass() {
      if (this.finished || this.streamDone) return 'status-done';
      return 'status-live';
    },
    elapsedText() {
      const m = Math.floor(this.elapsed / 60);
      const s = this.elapsed % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },
    thinkingCount() {
      return Object.keys(this.thinking).filter((k) => this.thinking[k]).length;
    },
    visibleKnowledge() {
      return this.knowledge.slice(-6);
    },
    currentSideClass() {
      if (!this.current) return '';
      return this.current.group === 'partyA' ? 'side-a' : this.current.group === 'partyB' ? 'side-b' : 'side-judge';
    },
    showVerdict() {
      return this.verdictVisible && !!this.verdictData;
    },
    verdict() {
      const d = this.verdictData || {};
      return {
        level: d.level || '中',
        findings: (d.findings || []).length,
        summary: d.summary || ''
      };
    },
    displayScore() {
      return this.verdictScore;
    },
    verdictColor() {
      const s = this.verdictScore;
      if (s <= 40) return '#2e9e5b';
      if (s <= 70) return '#e6a23c';
      return '#f56c6c';
    },
    verdictTagType() {
      const l = this.verdict.level;
      if (l === '低') return 'success';
      if (l === '高') return 'danger';
      return 'warning';
    }
  },
  watch: {
    events: {
      handler(list) {
        // 新一轮庭审会先把事件数组清空，此时重置播放进度
        if (list.length < this.cursor) this.resetShow();
        // 增量把新事件转成播放操作
        for (let i = this.cursor; i < list.length; i += 1) {
          this.enqueue(list[i]);
        }
        this.cursor = list.length;
      },
      deep: false
    },
    streamDone(val) {
      if (val) this.ops.push({ kind: 'end' });
    }
  },
  mounted() {
    this.clockTimer = setInterval(() => { this.elapsed += 1; }, 1000);
    this.tickTimer = setInterval(() => { this.tick(); }, 45);
  },
  beforeUnmount() {
    clearInterval(this.clockTimer);
    clearInterval(this.tickTimer);
    if (this.holdTimer) clearTimeout(this.holdTimer);
  },
  methods: {
    // 重新开庭：清空上一轮庭审的全部播放状态
    resetShow() {
      this.ops = [];
      this.cursor = 0;
      this.current = null;
      this.typedText = '';
      this.thinking = {};
      this.focusList = [];
      this.knowledge = [];
      this.queryChips = [];
      this.summaryList = [];
      this.verdictVisible = false;
      this.verdictScore = 0;
      this.verdictData = null;
      this.gavelStrike = false;
      this.finished = false;
      this.stageIndex = 0;
      this.elapsed = 0;
      if (this.holdTimer) {
        clearTimeout(this.holdTimer);
        this.holdTimer = null;
      }
    },

    // 把后端事件翻译成播放动作
    enqueue(evt) {
      if (!evt || !evt.type) return;
      const d = evt.data || {};
      switch (evt.type) {
        case 'start':
          this.ops.push({ kind: 'stage', index: 0 });
          break;
        case 'agent:start':
          this.ops.push({ kind: 'think', role: d.role });
          break;
        case 'agent:speech':
          this.ops.push({
            kind: 'speak',
            role: d.role,
            label: d.label,
            group: d.group,
            round: d.round,
            text: this.cleanSpeech(d.text, d.role)
          });
          break;
        case 'agent:query':
          this.ops.push({ kind: 'query', side: d.side, query: d.query, role: d.role });
          break;
        case 'focuses':
          this.ops.push({ kind: 'focus', list: d });
          break;
        case 'knowledge':
          this.ops.push({ kind: 'knowledge', items: d.items || [], round: d.round });
          break;
        case 'summary':
          this.ops.push({ kind: 'summary', agreed: (d.agreed || []).length, residual: (d.residual || []).length });
          break;
        case 'verdict':
          this.ops.push({ kind: 'verdict', data: d });
          break;
        case 'done':
          this.ops.push({ kind: 'end' });
          break;
        case 'error':
          this.ops.push({ kind: 'error', message: d.message || '庭审中断' });
          break;
        default:
          break;
      }
    },

    // 把模型原始输出（含 JSON）转成可读字幕
    cleanSpeech(raw, role) {
      const text = String(raw || '').trim();
      if (!text) return '（本环节未产生内容）';
      const isLegal = /Legal|Refine/.test(role || '');
      const jsonText = this.extractJson(text);
      if (jsonText) {
        if (isLegal) {
          return jsonText.query ? `提出检索式：${jsonText.query}` : '已提交本轮检索式';
        }
        if (role === 'judgeFocus') {
          const list = Array.isArray(jsonText.focuses) ? jsonText.focuses : [];
          if (list.length) return `经审阅合同文本，确认 ${list.length} 项争议焦点：${list.map((f) => f.title).filter(Boolean).join('；')}`;
        }
        if (role === 'judgeDebate') {
          const agreed = (jsonText.agreed || []).length;
          const residual = (jsonText.residual || []).length;
          const first = (jsonText.residual || [])[0];
          return `本轮归纳：双方就 ${agreed} 项达成共识，尚有 ${residual} 项未决${first && first.title ? '，焦点为「' + first.title + '」' : ''}，进入第二轮攻坚。`;
        }
        if (role === 'judgeVerdict') {
          return jsonText.summary ? `终审复核完毕：${jsonText.summary}` : '终审复核完毕，即将宣布裁决。';
        }
      }
      // 去掉 markdown 代码围栏等残留
      return text.replace(/```[a-zA-Z]*/g, '').replace(/```/g, '').trim();
    },

    extractJson(text) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end <= start) return null;
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (e) {
        return null;
      }
    },

    speakerOf(roleKey) {
      if (!this.current || !roleKey) return '';
      return this.current.role === roleKey ? 'typing' : '';
    },

    tick() {
      if (this.paused) return;
      // 字幕还在打字
      if (this.current) {
        const total = this.current.text.length;
        if (this.current.shown < total) {
          const step = Math.max(1, Math.round(2 * this.speed));
          this.current.shown = Math.min(total, this.current.shown + step);
          this.typedText = this.current.text.slice(0, this.current.shown);
        } else if (!this.holdTimer) {
          // 打字完成后停留一小会儿再切下一条
          const holdMs = Math.max(600, 2200 / this.speed);
          this.holdTimer = setTimeout(() => {
            this.holdTimer = null;
            this.current = null;
            this.typedText = '';
          }, holdMs);
        }
        return;
      }
      if (!this.ops.length) return;
      const op = this.ops.shift();
      this.apply(op);
    },

    apply(op) {
      switch (op.kind) {
        case 'stage':
          this.stageIndex = Math.max(this.stageIndex, op.index);
          break;
        case 'think':
          this.thinking = Object.assign({}, this.thinking, { [op.role]: true });
          break;
        case 'speak':
          this.thinking = Object.assign({}, this.thinking, { [op.role]: false });
          this.current = {
            role: op.role,
            label: op.label,
            group: op.group,
            round: op.round,
            text: op.text,
            shown: 0,
            query: ''
          };
          this.typedText = '';
          this.advanceStage(op);
          break;
        case 'query': {
          const text = String(op.query || '');
          if (text) this.queryChips.push({ side: op.side, text });
          // 若当前字幕是该角色，则把检索式挂到字幕下方
          if (this.current && this.current.role === op.role) this.current.query = text;
          break;
        }
        case 'focus':
          this.focusList = op.list || [];
          break;
        case 'knowledge': {
          const map = new Map(this.knowledge.map((k) => [k.id, k]));
          (op.items || []).forEach((item) => {
            if (item && item.id) map.set(item.id, item);
          });
          this.knowledge = Array.from(map.values());
          break;
        }
        case 'summary':
          this.summaryList.push({ agreed: op.agreed, residual: op.residual });
          break;
        case 'verdict':
          this.verdictData = op.data;
          this.verdictVisible = true;
          this.gavelStrike = true;
          setTimeout(() => { this.gavelStrike = false; }, 700);
          this.rollScore(Number(op.data.score) || 0);
          this.stageIndex = 4;
          break;
        case 'end':
          this.finished = true;
          this.stageIndex = 4;
          break;
        case 'error':
          this.finished = true;
          break;
        default:
          break;
      }
    },

    advanceStage(op) {
      if (op.round === 0) this.stageIndex = Math.max(this.stageIndex, 0);
      else if (op.round === 1) this.stageIndex = Math.max(this.stageIndex, 1);
      else if (op.round === 2) this.stageIndex = Math.max(this.stageIndex, 3);
      else if (op.round === 3) this.stageIndex = Math.max(this.stageIndex, 4);
    },

    rollScore(target) {
      const step = Math.max(1, Math.round(target / 24));
      const timer = setInterval(() => {
        if (this.verdictScore >= target) {
          this.verdictScore = target;
          clearInterval(timer);
          return;
        }
        this.verdictScore = Math.min(target, this.verdictScore + step);
      }, 40);
    },

    togglePause() {
      this.paused = !this.paused;
    },

    cycleSpeed() {
      const idx = this.speeds.indexOf(this.speed);
      this.speed = this.speeds[(idx + 1) % this.speeds.length];
    },

    skipToVerdict() {
      // 把剩余动作一次性结算，直接看结论
      while (this.ops.length) {
        const op = this.ops.shift();
        if (op.kind === 'focus') this.focusList = op.list || [];
        if (op.kind === 'knowledge') {
          const map = new Map(this.knowledge.map((k) => [k.id, k]));
          (op.items || []).forEach((item) => { if (item && item.id) map.set(item.id, item); });
          this.knowledge = Array.from(map.values());
        }
        if (op.kind === 'query') this.queryChips.push({ side: op.side, text: op.query });
        if (op.kind === 'summary') this.summaryList.push({ agreed: op.agreed, residual: op.residual });
        if (op.kind === 'verdict') {
          this.verdictData = op.data;
          this.verdictVisible = true;
          this.verdictScore = Number(op.data.score) || 0;
          this.gavelStrike = true;
        }
        if (op.kind === 'end') this.finished = true;
      }
      this.current = null;
      this.typedText = '';
      this.thinking = {};
      this.stageIndex = 4;
    }
  }
};
</script>

<style scoped>
.court-stage {
  background: radial-gradient(120% 100% at 50% 0%, #1b2440 0%, #131a2e 45%, #0e1424 100%);
  border-radius: 10px;
  padding: 16px 18px 18px;
  color: #e8ecf7;
  position: relative;
  overflow: hidden;
}

/* 顶部条 */
.court-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.case-title { display: flex; align-items: center; gap: 10px; }
.case-badge {
  background: linear-gradient(135deg, #7c5cff, #4a6cf7);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  letter-spacing: 1px;
}
.case-name { font-size: 15px; font-weight: 600; letter-spacing: 0.5px; }
.case-status { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.status-live { background: rgba(46, 158, 91, 0.18); color: #5fe0a0; }
.status-done { background: rgba(124, 92, 255, 0.18); color: #b3a4ff; }

.court-controls { display: flex; align-items: center; gap: 8px; }
.court-clock { font-family: Consolas, monospace; font-size: 13px; color: #9fb0d0; }

/* 焦点横幅 */
.focus-banner {
  margin-top: 10px;
  background: rgba(124, 92, 255, 0.1);
  border: 1px solid rgba(124, 92, 255, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  animation: bannerIn 0.5s ease-out;
}
.focus-label { font-size: 12px; color: #b3a4ff; letter-spacing: 1px; }
.focus-item { font-size: 13px; display: inline-flex; align-items: center; gap: 6px; }
.focus-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.sev-高 { background: #f56c6c; }
.sev-中 { background: #e6a23c; }
.sev-低 { background: #2e9e5b; }

/* 阶段进度 */
.stage-steps { display: flex; gap: 8px; margin-top: 12px; }
.stage-step {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #7f8ca8;
  font-size: 12px;
  transition: all 0.3s;
}
.stage-step.active { background: rgba(74, 108, 247, 0.22); color: #cfd8ff; }
.stage-step.done { background: rgba(46, 158, 91, 0.16); color: #86e6b4; }
.step-index {
  width: 16px; height: 16px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
}

/* 审判席 */
.judge-bench {
  margin: 16px auto 0;
  max-width: 620px;
  background: linear-gradient(180deg, rgba(124, 92, 255, 0.16), rgba(124, 92, 255, 0.04));
  border: 1px solid rgba(124, 92, 255, 0.28);
  border-radius: 10px;
  padding: 10px 14px 12px;
  position: relative;
}
.bench-plate {
  text-align: center;
  font-size: 11px;
  letter-spacing: 6px;
  color: #a892ff;
  margin-bottom: 8px;
}
.seat-row { display: flex; justify-content: center; gap: 44px; }

/* 席位通用 */
.seat { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.seat-label { font-size: 11px; color: #9aa8c4; text-align: center; }
.avatar {
  width: 46px; height: 46px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 600;
  position: relative;
  transition: transform 0.25s, box-shadow 0.25s;
}
.judge-avatar {
  background: linear-gradient(160deg, #6b57d6, #3f4bb5);
  box-shadow: 0 0 0 2px rgba(163, 146, 255, 0.35);
}
.a-avatar {
  background: linear-gradient(160deg, #2f6fed, #1f4aa6);
  box-shadow: 0 0 0 2px rgba(107, 156, 255, 0.3);
}
.b-avatar {
  background: linear-gradient(160deg, #e6862b, #a85f16);
  box-shadow: 0 0 0 2px rgba(255, 184, 107, 0.3);
}
.seat.speaking .avatar { transform: scale(1.12); }
.seat.speaking .judge-avatar { box-shadow: 0 0 18px 4px rgba(163, 146, 255, 0.65); }
.seat.speaking .a-avatar { box-shadow: 0 0 18px 4px rgba(107, 156, 255, 0.65); }
.seat.speaking .b-avatar { box-shadow: 0 0 18px 4px rgba(255, 184, 107, 0.65); }

/* 发言声波 */
.wave {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.45);
  animation: waveOut 1.4s ease-out infinite;
}
@keyframes waveOut {
  0% { transform: scale(0.9); opacity: 0.7; }
  100% { transform: scale(1.45); opacity: 0; }
}

/* 思考中的三点 */
.dots {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(10, 16, 30, 0.9);
  border-radius: 8px;
  padding: 2px 6px;
  display: flex;
  gap: 3px;
}
.dots b {
  width: 4px; height: 4px; border-radius: 50%; background: #9fb0d0;
  animation: blink 1.2s infinite;
}
.dots b:nth-child(2) { animation-delay: 0.2s; }
.dots b:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%, 60%, 100% { opacity: 0.25; } 30% { opacity: 1; } }

/* 双方席位区 */
.party-area {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 150px;
  gap: 14px;
  margin-top: 14px;
  align-items: start;
}
.party {
  border-radius: 10px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}
.party-a { background: rgba(47, 111, 237, 0.09); border: 1px solid rgba(47, 111, 237, 0.25); }
.party-b { background: rgba(230, 134, 43, 0.09); border: 1px solid rgba(230, 134, 43, 0.25); }
.party-plate {
  font-size: 11px; letter-spacing: 2px; color: #9aa8c4;
  writing-mode: horizontal-tb;
}

/* 中间字幕 + 证据台 */
.court-center { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.subtitle-box {
  min-height: 108px;
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
  border-left: 3px solid #6b7ba8;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  transition: border-color 0.3s, background 0.3s;
}
.subtitle-box.side-a { border-left-color: #4a8bff; background: rgba(47, 111, 237, 0.1); }
.subtitle-box.side-b { border-left-color: #ffab5c; background: rgba(230, 134, 43, 0.1); }
.subtitle-box.side-judge { border-left-color: #9a7bff; background: rgba(124, 92, 255, 0.1); }
.subtitle-head { display: flex; align-items: center; gap: 8px; }
.speaker-name { font-size: 13px; font-weight: 600; color: #dfe6f8; }
.speaker-round { font-size: 11px; color: #8b9ab8; }
.subtitle-text { font-size: 14px; line-height: 1.7; color: #eef2fb; min-height: 42px; }
.caret { color: #7c5cff; animation: blinkCaret 0.8s step-end infinite; }
@keyframes blinkCaret { 50% { opacity: 0; } }
.subtitle-query { font-size: 12px; color: #9fc6ff; }
.query-tag {
  background: rgba(74, 139, 255, 0.22); color: #9fc6ff;
  padding: 1px 6px; border-radius: 3px; margin-right: 6px; font-size: 11px;
}
.subtitle-idle { font-size: 13px; color: #7f8ca8; text-align: center; }

.evidence-desk {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  padding: 8px 10px;
}
.desk-title { font-size: 11px; letter-spacing: 3px; color: #8b9ab8; text-align: center; margin-bottom: 6px; }
.desk-body { display: flex; flex-wrap: wrap; gap: 6px; min-height: 26px; }
.evidence-card {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(46, 158, 91, 0.14);
  border: 1px solid rgba(46, 158, 91, 0.3);
  border-radius: 5px; padding: 3px 8px; font-size: 11px; max-width: 100%;
}
.ev-type { font-size: 10px; padding: 0 4px; border-radius: 3px; background: rgba(255, 255, 255, 0.12); }
.ev-history { background: rgba(230, 162, 60, 0.3); }
.ev-template { background: rgba(144, 147, 153, 0.3); }
.ev-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.desk-empty { font-size: 11px; color: #6d7a94; padding: 4px 2px; }
.desk-queries { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.query-chip {
  font-size: 11px; padding: 2px 8px; border-radius: 10px;
  max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chip-a { background: rgba(47, 111, 237, 0.2); color: #a9c8ff; }
.chip-b { background: rgba(230, 134, 43, 0.2); color: #ffc999; }

/* 入场动画 */
.fly-enter-from { opacity: 0; transform: translateX(-24px) scale(0.9); }
.fly-enter-active { transition: all 0.5s ease-out; }

/* 归纳条 */
.summary-strip { margin-top: 12px; }
.summary-item {
  background: rgba(255, 255, 255, 0.05);
  border-left: 3px solid #8b9ab8;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  animation: bannerIn 0.4s ease-out;
}
.summary-tag { color: #a892ff; margin-right: 8px; }
.summary-text { color: #cfd8ea; }

/* 终审裁决 */
.verdict-stage {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 28px;
  background: linear-gradient(90deg, rgba(124, 92, 255, 0.16), rgba(124, 92, 255, 0.04));
  border: 1px solid rgba(124, 92, 255, 0.3);
  border-radius: 10px;
  padding: 14px 18px;
  animation: bannerIn 0.5s ease-out;
}
.gavel { position: relative; width: 64px; height: 64px; transform-origin: 70% 80%; }
.gavel.strike { animation: hammer 0.6s ease-out; }
.gavel-head {
  position: absolute; top: 6px; left: 10px; width: 34px; height: 16px;
  background: linear-gradient(180deg, #c8b083, #8d6f43);
  border-radius: 3px; transform: rotate(-20deg);
}
.gavel-handle {
  position: absolute; top: 20px; left: 40px; width: 8px; height: 34px;
  background: linear-gradient(180deg, #a5844f, #6d552f);
  border-radius: 3px; transform: rotate(-20deg);
}
.gavel-base {
  position: absolute; bottom: 2px; left: 6px; width: 40px; height: 8px;
  background: rgba(200, 176, 131, 0.35); border-radius: 4px;
}
@keyframes hammer {
  0% { transform: rotate(0deg); }
  35% { transform: rotate(-42deg); }
  60% { transform: rotate(12deg); }
  100% { transform: rotate(0deg); }
}
.verdict-panel { flex: 1; min-width: 0; }
.verdict-score { display: flex; align-items: baseline; gap: 4px; }
.score-num { font-size: 40px; font-weight: 700; font-family: Consolas, monospace; }
.score-unit { font-size: 14px; color: #8b9ab8; }
.verdict-meta { display: flex; align-items: center; gap: 10px; margin: 4px 0 6px; }
.verdict-findings { font-size: 12px; color: #9aa8c4; }
.verdict-summary { font-size: 13px; line-height: 1.7; color: #dfe6f8; }

@keyframes bannerIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1100px) {
  .party-area { grid-template-columns: 1fr; }
  .seat-row { gap: 24px; }
  .party { flex-direction: row; }
}
</style>
