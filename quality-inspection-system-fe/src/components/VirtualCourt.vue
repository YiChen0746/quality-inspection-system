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
          class="seat"
        >
          <div
            class="actor actor-judge"
            :class="{ speaking: speakerOf(role.key) === 'typing', thinking: thinking[role.key] }"
            :style="{ animationDelay: (judgeRoles.indexOf(role) * 0.4) + 's' }"
          >
            <div class="actor-bubble" v-if="thinking[role.key]"><b></b><b></b><b></b></div>
            <div class="actor-talk" v-else-if="speakerOf(role.key) === 'typing'"><i></i><i></i><i></i></div>
            <div class="actor-head">
              <i class="hair"></i>
              <i class="eye eye-l"></i>
              <i class="eye eye-r"></i>
              <i class="mouth"></i>
            </div>
            <div class="actor-body"><i class="collar"></i></div>
          </div>
          <div class="seat-label">{{ role.label }}</div>
        </div>
      </div>
      <div class="bench-desk"></div>
    </div>

    <!-- 双方席位 -->
    <div class="party-area">
      <div class="party party-a">
        <div class="party-plate">委 托 方 席（甲方）</div>
        <div
          v-for="role in partyARoles"
          :key="role.key"
          class="seat"
        >
          <div
            class="actor actor-a"
            :class="[{ speaking: speakerOf(role.key) === 'typing', thinking: thinking[role.key] }, partyAGenderClass]"
            :style="{ animationDelay: (partyARoles.indexOf(role) * 0.4) + 's' }"
          >
            <div class="actor-bubble" v-if="thinking[role.key]"><b></b><b></b><b></b></div>
            <div class="actor-talk" v-else-if="speakerOf(role.key) === 'typing'"><i></i><i></i><i></i></div>
            <div class="actor-head">
              <i class="hair"></i>
              <i class="eye eye-l"></i>
              <i class="eye eye-r"></i>
              <i class="mouth"></i>
            </div>
            <div class="actor-body"><i class="collar"></i><i class="tie"></i></div>
          </div>
          <div class="seat-label">{{ role.label }}</div>
        </div>
      </div>

      <!-- 中间：字幕与证据台 -->
      <div class="court-center">
        <div class="duel-lane" :class="currentSideClass" v-if="current">
          <span class="duel-pulse"></span>
        </div>
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
          <div class="desk-history" v-if="historyRecords">
            <span class="dh-badge">历史洞察</span>
            <span class="dh-text">已参考您过往 {{ historyRecords }} 份合同的经验</span>
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
          class="seat"
        >
          <div
            class="actor actor-b"
            :class="[{ speaking: speakerOf(role.key) === 'typing', thinking: thinking[role.key] }, partyBGenderClass]"
            :style="{ animationDelay: (partyBRoles.indexOf(role) * 0.4) + 's' }"
          >
            <div class="actor-bubble" v-if="thinking[role.key]"><b></b><b></b><b></b></div>
            <div class="actor-talk" v-else-if="speakerOf(role.key) === 'typing'"><i></i><i></i><i></i></div>
            <div class="actor-head">
              <i class="hair"></i>
              <i class="eye eye-l"></i>
              <i class="eye eye-r"></i>
              <i class="mouth"></i>
            </div>
            <div class="actor-body"><i class="collar"></i><i class="tie"></i></div>
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
    streamDone: { type: Boolean, default: false },
    // 甲方/乙方性别：'male' | 'female' | ''（空表示合同未注明，需随机）
    partyAGender: { type: String, default: '' },
    partyBGender: { type: String, default: '' }
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
      historyRecords: 0,
      historyNote: '',
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
    // 甲方性别：合同注明则用之，否则按合同名哈希稳定随机
    resolvedPartyAGender() {
      if (this.partyAGender === 'male' || this.partyAGender === 'female') return this.partyAGender;
      return this.hashRand(this.contractName + 'A') < 0.5 ? 'male' : 'female';
    },
    resolvedPartyBGender() {
      if (this.partyBGender === 'male' || this.partyBGender === 'female') return this.partyBGender;
      return this.hashRand(this.contractName + 'B') < 0.5 ? 'male' : 'female';
    },
    partyAGenderClass() {
      return 'gender-' + this.resolvedPartyAGender;
    },
    partyBGenderClass() {
      return 'gender-' + this.resolvedPartyBGender;
    },
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
        if (!list || !list.length) return;
        // 新一轮庭审会先把事件数组清空，此时重置播放进度
        if (list.length < this.cursor) this.resetShow();
        // 增量把新事件转成播放操作（必须 deep，否则 push 不会触发）
        for (let i = this.cursor; i < list.length; i += 1) {
          this.enqueue(list[i]);
        }
        this.cursor = list.length;
      },
      deep: true,
      immediate: true
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
    // 基于字符串的稳定哈希，返回 [0,1)，用于合同未注明性别时的稳定随机
    hashRand(str) {
      let h = 2166136261;
      const s = String(str || '');
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) % 1000) / 1000;
    },
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
      this.historyRecords = 0;
      this.historyNote = '';
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
        case 'history-insights':
          // HistorySage 的历史经验：以“案例”卡片落到证据台，并记下参考的合同份数
          this.ops.push({ kind: 'history', data: d });
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
          // 第一轮检索结果到达时点亮“动态检索”阶段
          if (op.round === 1) this.stageIndex = Math.max(this.stageIndex, 2);
          break;
        }
        case 'summary':
          this.summaryList.push({ agreed: op.agreed, residual: op.residual });
          break;
        case 'history': {
          const d = op.data || {};
          if (!d.hasHistory) break;
          const items = [];
          const pushItem = (text, idx) => {
            const t = String(text || '').trim();
            if (!t) return;
            items.push({ id: 'history-' + idx + '-' + t.slice(0, 12), type: 'history', title: t });
          };
          (d.reminders || []).slice(0, 2).forEach((t, i) => pushItem(t, i));
          (d.commonOmissions || []).slice(0, 1).forEach((t, i) => pushItem(t, 10 + i));
          if (!items.length) pushItem(d.message, 99);
          const map = new Map(this.knowledge.map((k) => [k.id, k]));
          items.forEach((item) => map.set(item.id, item));
          this.knowledge = Array.from(map.values());
          this.historyRecords = Number(d.totalRecords) || 0;
          this.historyNote = d.message || '';
          break;
        }
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
        if (op.kind === 'history' && op.data && op.data.hasHistory) {
          this.historyRecords = Number(op.data.totalRecords) || 0;
          this.historyNote = op.data.message || '';
          const items = (op.data.reminders || []).slice(0, 2).map((t, i) => ({
            id: 'history-skip-' + i, type: 'history', title: String(t || '')
          })).filter((it) => it.title.trim());
          const map = new Map(this.knowledge.map((k) => [k.id, k]));
          items.forEach((item) => map.set(item.id, item));
          this.knowledge = Array.from(map.values());
        }
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
/* ===== 整体舞台：浅色柔和 ===== */
.court-stage {
  background: linear-gradient(180deg, #fbfcff 0%, #f3f6fc 60%, #eef3fa 100%);
  border: 1px solid #e4eaf6;
  border-radius: 12px;
  padding: 16px 18px 18px;
  color: #33415c;
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
  background: linear-gradient(135deg, #a495e8, #7f9df0);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  letter-spacing: 1px;
}
.case-name { font-size: 15px; font-weight: 600; letter-spacing: 0.5px; color: #2f3b52; }
.case-status { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.status-live { background: #e3f5ea; color: #3d9b6d; }
.status-done { background: #eee9fb; color: #8578cf; }

.court-controls { display: flex; align-items: center; gap: 8px; }
.court-clock { font-family: Consolas, monospace; font-size: 13px; color: #8a97ad; }

/* 焦点横幅 */
.focus-banner {
  margin-top: 10px;
  background: #f4f1fd;
  border: 1px solid #e0d6f8;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  animation: bannerIn 0.5s ease-out;
}
.focus-label { font-size: 12px; color: #8578cf; letter-spacing: 1px; }
.focus-item { font-size: 13px; display: inline-flex; align-items: center; gap: 6px; color: #43507a; }
.focus-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.sev-高 { background: #f08080; }
.sev-中 { background: #ebb35c; }
.sev-低 { background: #6fbf8f; }

/* 阶段进度 */
.stage-steps { display: flex; gap: 8px; margin-top: 12px; }
.stage-step {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  background: #eef2f9;
  color: #94a1b8;
  font-size: 12px;
  transition: all 0.3s;
}
.stage-step.active { background: #e2ebfc; color: #3e63b8; box-shadow: inset 0 0 0 1px #c3d6f5; }
.stage-step.done { background: #e4f4ea; color: #4a9e74; }
.step-index {
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff;
  box-shadow: inset 0 0 0 1px #d7dfec;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
}

/* ===== 审判席 ===== */
.judge-bench {
  margin: 16px auto 0;
  max-width: 620px;
  background: linear-gradient(180deg, #f6f3fd, #f9f7fe);
  border: 1px solid #e3dbf9;
  border-radius: 12px;
  padding: 10px 14px 14px;
  position: relative;
}
.bench-plate {
  text-align: center;
  font-size: 11px;
  letter-spacing: 6px;
  color: #9c8fd6;
  margin-bottom: 6px;
}
.seat-row { display: flex; justify-content: center; gap: 44px; }
.bench-desk {
  height: 12px;
  margin: 2px auto 0;
  max-width: 460px;
  background: linear-gradient(180deg, #ecdfc9, #dccbaa);
  border-radius: 4px 4px 10px 10px;
  box-shadow: 0 3px 6px rgba(160, 130, 90, 0.18);
}

/* ===== 动画小人 ===== */
.seat { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.seat-label { font-size: 11px; color: #6d7a94; text-align: center; transition: color 0.25s; }

.actor {
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  animation: actorBreath 3.2s ease-in-out infinite;
  transform-origin: 50% 100%;
}
@keyframes actorBreath {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

.actor-head {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #ffd9b8;
  border: 2px solid rgba(150, 110, 70, 0.12);
  position: relative;
  z-index: 2;
}
/* 腮红：贴近卡通形象 */
.actor-head::before,
.actor-head::after {
  content: '';
  position: absolute;
  top: 16px;
  width: 5px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 150, 150, 0.5);
}
.actor-head::before { left: 3px; }
.actor-head::after { right: 3px; }
.eye {
  position: absolute;
  top: 11px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #2c2c2c;
}
.eye-l { left: 7px; }
.eye-r { right: 7px; }
.mouth {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  width: 7px;
  height: 3px;
  border-radius: 0 0 6px 6px;
  background: #c9704f;
}

.actor-body {
  width: 40px;
  height: 34px;
  margin-top: -3px;
  border-radius: 12px 12px 7px 7px;
  position: relative;
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.25s;
}
.collar {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 7px solid rgba(255, 255, 255, 0.9);
}
/* 领带：甲方蓝 / 乙方橙 */
.tie {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 9px solid #2c5cbf;
  z-index: 1;
}
.actor-b .tie { border-top-color: #e07a2c; }

/* ===== 头发 ===== */
.hair {
  position: absolute;
  top: -2px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}
/* 法官：灰白卷发，两侧鬓角 */
.actor-judge .hair {
  width: 29px;
  height: 13px;
  border-radius: 16px 16px 6px 6px;
  background: linear-gradient(180deg, #f0f0f0 0%, #d0d0d0 100%);
}
.actor-judge .hair::before {
  content: '';
  position: absolute;
  top: 6px;
  left: -1px;
  width: 5px;
  height: 8px;
  border-radius: 3px;
  background: inherit;
}
.actor-judge .hair::after {
  content: '';
  position: absolute;
  top: 6px;
  right: -1px;
  width: 5px;
  height: 8px;
  border-radius: 3px;
  background: inherit;
}
/* 甲方/乙方：黑发分头，简洁利落 */
.actor-a .hair,
.actor-b .hair {
  width: 28px;
  height: 12px;
  border-radius: 14px 14px 4px 4px;
  background: linear-gradient(180deg, #3a3a3a 0%, #1a1a1a 100%);
}
/* 斜分头线 */
.actor-a .hair::before,
.actor-b .hair::before {
  content: '';
  position: absolute;
  top: 1px;
  right: 6px;
  width: 1px;
  height: 9px;
  background: rgba(255,255,255,0.18);
  transform: rotate(18deg);
}
/* 男性：短发 */
.actor-a.gender-male .hair,
.actor-b.gender-male .hair {
  width: 27px;
  height: 11px;
}
/* 女性：头发稍长 */
.actor-a.gender-female .hair,
.actor-b.gender-female .hair {
  width: 29px;
  height: 13px;
  border-radius: 15px 15px 5px 5px;
}

/* 法官：黑色法袍 + 白色衣领 */
.actor-judge .actor-body { background: linear-gradient(180deg, #3a3a3a, #1a1a1a); }
.actor-judge .collar { border-top-color: rgba(255, 255, 255, 0.95); }
/* 律师：黑色西装 + 白衬衫 + 彩色领带 */
.actor-a .actor-body { background: linear-gradient(180deg, #2c2c2c, #1a1a1a); }
.actor-b .actor-body { background: linear-gradient(180deg, #2c2c2c, #1a1a1a); }

/* 发言状态：身体摇摆 + 头部点头 + 嘴巴开合 + 光晕 */
.actor.speaking { animation: actorTalk 0.5s ease-in-out infinite; }
@keyframes actorTalk {
  0%, 100% { transform: translateY(0) rotate(-2.5deg); }
  50% { transform: translateY(-4px) rotate(2.5deg); }
}
.actor.speaking .actor-head { animation: headNod 0.5s ease-in-out infinite; }
@keyframes headNod {
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(4deg); }
}
.actor.speaking .mouth { animation: mouthTalk 0.24s linear infinite; }
@keyframes mouthTalk {
  0%, 100% { height: 3px; width: 8px; }
  50% { height: 7px; width: 7px; }
}
.actor.speaking .actor-body { box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25); }
.actor.speaking ~ .seat-label,
.seat:has(.actor.speaking) .seat-label { color: #33415c; font-weight: 600; }

/* 思考状态：头部微侧 */
.actor.thinking .actor-head { animation: headTilt 1.6s ease-in-out infinite; }
@keyframes headTilt {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-9deg); }
}

/* 发言声浪气泡 */
.actor-talk {
  position: absolute;
  top: -14px;
  right: -14px;
  z-index: 3;
  background: #fff;
  border: 1px solid #e3e9f5;
  border-radius: 9px;
  padding: 4px 6px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 15px;
  box-shadow: 0 3px 8px rgba(100, 120, 160, 0.16);
  animation: bubblePop 0.25s ease-out;
}
.actor-talk i {
  width: 3px;
  border-radius: 2px;
  background: #7c9ff0;
  animation: soundBar 0.5s ease-in-out infinite;
}
.actor-b .actor-talk i { background: #eda659; }
.actor-judge .actor-talk i { background: #9a8ade; }
.actor-talk i:nth-child(1) { height: 5px; }
.actor-talk i:nth-child(2) { height: 10px; animation-delay: 0.12s; }
.actor-talk i:nth-child(3) { height: 6px; animation-delay: 0.24s; }
@keyframes soundBar {
  0%, 100% { transform: scaleY(0.45); }
  50% { transform: scaleY(1); }
}

/* 思考气泡 */
.actor-bubble {
  position: absolute;
  top: -16px;
  right: -16px;
  z-index: 3;
  background: #fff;
  border: 1px solid #e3e9f5;
  border-radius: 10px;
  padding: 5px 7px;
  display: flex;
  gap: 3px;
  box-shadow: 0 3px 8px rgba(100, 120, 160, 0.16);
  animation: bubblePop 0.25s ease-out;
}
.actor-talk::after,
.actor-bubble::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 10px;
  border: 4px solid transparent;
  border-top-color: #fff;
}
.actor-bubble b {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #93a2ba;
  animation: blink 1.2s infinite;
}
.actor-bubble b:nth-child(2) { animation-delay: 0.2s; }
.actor-bubble b:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%, 60%, 100% { opacity: 0.25; } 30% { opacity: 1; } }
@keyframes bubblePop {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* ===== 双方席位区 ===== */
.party-area {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 150px;
  gap: 14px;
  margin-top: 14px;
  align-items: start;
}
.party {
  border-radius: 12px;
  padding: 10px 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}
.party-a { background: #eef4fe; border: 1px solid #d4e3fa; }
.party-b { background: #fdf4e9; border: 1px solid #f6e2c6; }
.party-plate {
  font-size: 11px;
  letter-spacing: 2px;
  color: #7d8aa3;
}

/* ===== 辩论光束：发言方的观点飞向对面 ===== */
.duel-lane { position: relative; height: 12px; }
.duel-pulse { position: absolute; top: 2px; width: 8px; height: 8px; border-radius: 50%; opacity: 0; }
.duel-lane.side-a .duel-pulse {
  background: #6b9bf0;
  box-shadow: 0 0 8px 2px rgba(107, 155, 240, 0.55);
  animation: flyRight 1.1s linear infinite;
}
.duel-lane.side-b .duel-pulse {
  background: #eda659;
  box-shadow: 0 0 8px 2px rgba(237, 166, 89, 0.55);
  animation: flyLeft 1.1s linear infinite;
}
.duel-lane.side-judge .duel-pulse {
  background: #9a8ade;
  box-shadow: 0 0 8px 2px rgba(154, 138, 222, 0.55);
  left: calc(50% - 4px);
  animation: judgePulse 1s ease-in-out infinite;
}
@keyframes flyRight {
  0% { left: 0; opacity: 0; transform: scale(0.6); }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { left: calc(100% - 8px); opacity: 0; transform: scale(1); }
}
@keyframes flyLeft {
  0% { right: 0; opacity: 0; transform: scale(0.6); }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { right: calc(100% - 8px); opacity: 0; transform: scale(1); }
}
@keyframes judgePulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.25); }
}

/* ===== 中间字幕 + 证据台 ===== */
.court-center { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.subtitle-box {
  min-height: 108px;
  border-radius: 12px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #e6ecf6;
  border-left: 4px solid #b9c5d9;
  box-shadow: 0 3px 10px rgba(100, 120, 160, 0.08);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  transition: border-color 0.3s, background 0.3s;
}
.subtitle-box.side-a { border-left-color: #6b9bf0; background: #f5f9ff; }
.subtitle-box.side-b { border-left-color: #eda659; background: #fdf9f2; }
.subtitle-box.side-judge { border-left-color: #9a8ade; background: #f8f6fe; }
.subtitle-head { display: flex; align-items: center; gap: 8px; }
.speaker-name { font-size: 13px; font-weight: 600; color: #2f3b52; }
.speaker-round { font-size: 11px; color: #93a1b8; }
.subtitle-text { font-size: 14px; line-height: 1.7; color: #37455e; min-height: 42px; }
.caret { color: #8f7fe0; animation: blinkCaret 0.8s step-end infinite; }
@keyframes blinkCaret { 50% { opacity: 0; } }
.subtitle-query { font-size: 12px; color: #5f83c4; }
.query-tag {
  background: #e2ecfd; color: #4f77bd;
  padding: 1px 6px; border-radius: 3px; margin-right: 6px; font-size: 11px;
}
.subtitle-idle { font-size: 13px; color: #9aa7bd; text-align: center; }

.evidence-desk {
  border-radius: 12px;
  background: #fbfcfe;
  border: 1px dashed #d5deee;
  padding: 8px 10px;
}
.desk-title { font-size: 11px; letter-spacing: 3px; color: #93a1b8; text-align: center; margin-bottom: 6px; }
.desk-body { display: flex; flex-wrap: wrap; gap: 6px; min-height: 26px; }
.evidence-card {
  display: inline-flex; align-items: center; gap: 6px;
  background: #e9f5ee;
  border: 1px solid #c8e6d4;
  color: #3f7d5c;
  border-radius: 6px; padding: 3px 8px; font-size: 11px; max-width: 100%;
}
.ev-type { font-size: 10px; padding: 0 4px; border-radius: 3px; background: rgba(255, 255, 255, 0.75); color: #57705f; }
.ev-history { background: #f8e9cd; color: #a06c1e; }
.ev-template { background: #e6e9ee; color: #5c6675; }
.ev-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.desk-empty { font-size: 11px; color: #a7b3c6; padding: 4px 2px; }
.desk-history { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.dh-badge {
  padding: 1px 8px; border-radius: 999px; font-size: 11px;
  background: rgba(124, 92, 255, 0.18); color: #b9a7ff;
}
.dh-text { font-size: 11px; color: #9aa7c7; }
.desk-queries { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.query-chip {
  font-size: 11px; padding: 2px 8px; border-radius: 10px;
  max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chip-a { background: #e3edfd; color: #4d78c0; }
.chip-b { background: #fbeed9; color: #b5772e; }

/* 入场动画 */
.fly-enter-from { opacity: 0; transform: translateX(-24px) scale(0.9); }
.fly-enter-active { transition: all 0.5s ease-out; }

/* 归纳条 */
.summary-strip { margin-top: 12px; }
.summary-item {
  background: #f4f6fb;
  border-left: 3px solid #aab8d0;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  animation: bannerIn 0.4s ease-out;
}
.summary-tag { color: #8578cf; margin-right: 8px; }
.summary-text { color: #55637e; }

/* ===== 终审裁决 ===== */
.verdict-stage {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 28px;
  background: linear-gradient(90deg, #f4f0fd, #faf8fe);
  border: 1px solid #e0d6f8;
  border-radius: 12px;
  padding: 14px 18px;
  animation: bannerIn 0.5s ease-out;
}
.gavel { position: relative; width: 64px; height: 64px; transform-origin: 70% 80%; }
.gavel.strike { animation: hammer 0.6s ease-out; }
.gavel-head {
  position: absolute; top: 6px; left: 10px; width: 34px; height: 16px;
  background: linear-gradient(180deg, #d3bb92, #a5825a);
  border-radius: 3px; transform: rotate(-20deg);
}
.gavel-handle {
  position: absolute; top: 20px; left: 40px; width: 8px; height: 34px;
  background: linear-gradient(180deg, #b08f5f, #82663d);
  border-radius: 3px; transform: rotate(-20deg);
}
.gavel-base {
  position: absolute; bottom: 2px; left: 6px; width: 40px; height: 8px;
  background: rgba(176, 143, 95, 0.3); border-radius: 4px;
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
.score-unit { font-size: 14px; color: #93a1b8; }
.verdict-meta { display: flex; align-items: center; gap: 10px; margin: 4px 0 6px; }
.verdict-findings { font-size: 12px; color: #6d7a94; }
.verdict-summary { font-size: 13px; line-height: 1.7; color: #43507a; }

@keyframes bannerIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1100px) {
  .party-area { grid-template-columns: 1fr; }
  .seat-row { gap: 24px; }
  .party { flex-direction: row; flex-wrap: wrap; justify-content: center; }
}
</style>
