<template>
  <div class="scrollable-container">
    <!-- 顶部统计卡 -->
    <div class="dashboard-container">
      <div class="card" v-for="card in cards" :key="card.title">
        <p class="card-title">{{ card.title }}</p>
        <h2>{{ card.value }}</h2>
        <p class="card-intro">{{ card.introduction }}</p>
      </div>
    </div>

    <!-- 健康度仪表盘 -->
    <div class="section-card">
      <div class="section-header">
        <h3>💚 合同库健康度总览</h3>
        <button class="btn-refresh" @click="loadOverview" :disabled="overviewLoading">{{ overviewLoading ? '刷新中…' : '刷新' }}</button>
      </div>
      <div class="health-body" v-if="overview">
        <div class="health-score">
          <el-progress type="dashboard" :percentage="overview.health.totalScore" :color="healthColor" :width="140">
            <template #default>
              <div class="score-num">{{ overview.health.totalScore }}</div>
              <div class="score-label">{{ overview.health.level }}</div>
            </template>
          </el-progress>
          <p class="health-comment">{{ overview.health.comment }}</p>
        </div>
        <div class="health-radar">
          <canvas ref="radarCanvas"></canvas>
        </div>
      </div>
      <el-empty v-else description="暂无审查记录" />
    </div>

    <!-- 图表区：审查/起草趋势 + 合同类型分布 -->
    <div class="chart-container">
      <div class="chart">
        <h3>合同审查统计</h3>
        <div class="chart-body"><canvas ref="reviewCanvas"></canvas></div>
      </div>
      <div class="chart">
        <h3>合同起草统计</h3>
        <div class="chart-body"><canvas ref="draftCanvas"></canvas></div>
      </div>
      <div class="chart">
        <h3>必备条款覆盖率</h3>
        <div class="chart-body"><canvas ref="coverageCanvas"></canvas></div>
      </div>
    </div>

    <!-- 异常合同清单 -->
    <div class="section-card">
      <div class="section-header"><h3>⚠️ 异常合同清单</h3></div>
      <el-table :data="overview?.abnormalContracts || []" size="small" border stripe max-height="360" empty-text="暂无异常合同">
        <el-table-column prop="contractName" label="合同名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="contractType" label="合同类型" width="140" show-overflow-tooltip />
        <el-table-column label="风险等级" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.riskLevel === 'high' ? 'danger' : 'info'" size="small">
              {{ row.riskLevel === 'high' ? '高风险' : '未评级' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 到期预警 -->
    <div class="section-card">
      <div class="section-header"><h3>📅 到期 / 履行预警</h3></div>
      <div class="alert-grid" v-if="overview">
        <div class="alert-col expired">
          <h4>已逾期（{{ overview.expiryAlerts.expired.length }}）</h4>
          <div class="alert-list">
            <div class="alert-item" v-for="a in overview.expiryAlerts.expired" :key="'e'+a.id">
              <div class="alert-name">{{ a.contractName }}</div>
              <div class="alert-tip">{{ a.tip }}</div>
              <div class="alert-action">{{ a.action }}</div>
            </div>
            <p v-if="!overview.expiryAlerts.expired.length" class="alert-empty">暂无逾期合同</p>
          </div>
        </div>
        <div class="alert-col soon">
          <h4>30 天内到期（{{ overview.expiryAlerts.within30.length }}）</h4>
          <div class="alert-list">
            <div class="alert-item" v-for="a in overview.expiryAlerts.within30" :key="'w30'+a.id">
              <div class="alert-name">{{ a.contractName }}</div>
              <div class="alert-tip">{{ a.tip }}</div>
              <div class="alert-action">{{ a.action }}</div>
            </div>
            <p v-if="!overview.expiryAlerts.within30.length" class="alert-empty">暂无</p>
          </div>
        </div>
        <div class="alert-col later">
          <h4>90 天内到期（{{ overview.expiryAlerts.within90.length }}）</h4>
          <div class="alert-list">
            <div class="alert-item" v-for="a in overview.expiryAlerts.within90" :key="'w90'+a.id">
              <div class="alert-name">{{ a.contractName }}</div>
              <div class="alert-tip">{{ a.tip }}</div>
              <div class="alert-action">{{ a.action }}</div>
            </div>
            <p v-if="!overview.expiryAlerts.within90.length" class="alert-empty">暂无</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 多智能体分析议事厅 -->
    <div class="section-card cockpit-card">
      <div class="section-header">
        <h3>🧠 多智能体合同库分析</h3>
        <el-button type="primary" size="small" :loading="analyzing" :disabled="analyzing" @click="startAnalyze">
          {{ analyzing ? '分析中…' : '启动多智能体分析' }}
        </el-button>
      </div>

      <el-empty v-if="!analyzeEvents.length && !analyzeResult" description="点击启动，8 个分析智能体将依次对合同库进行会诊" />

      <div class="cockpit-feed" v-if="analyzeEvents.length">
        <div class="feed-item" v-for="(e, i) in analyzeEvents" :key="i" :class="'grp-' + (e.group || '')">
          <span class="feed-role">{{ e.label }}</span>
          <div class="feed-content" v-html="formatFeedContent(e)"></div>
        </div>
      </div>

      <div class="analysis-result" v-if="analyzeResult">
        <el-tabs v-model="resultTab">
          <el-tab-pane label="条款挖掘" name="clauses">
            <div v-if="analyzeResult.clauses?.length">
              <div class="result-item" v-for="(c, i) in analyzeResult.clauses" :key="i">
                <el-tag size="small" :type="c.frequency === '高' ? 'danger' : c.frequency === '中' ? 'warning' : 'info'">{{ c.frequency }}</el-tag>
                <b>{{ c.name }}</b>：{{ c.issue }}
              </div>
            </div>
            <el-empty v-else description="无数据" />
          </el-tab-pane>
          <el-tab-pane label="风险模式" name="patterns">
            <div v-if="analyzeResult.patterns?.length">
              <div class="result-item" v-for="(p, i) in analyzeResult.patterns" :key="i">
                <b>{{ p.name }}</b>（{{ p.scenario }}）<br /><span class="muted">影响：{{ p.impact }}</span>
              </div>
            </div>
            <el-empty v-else description="无数据" />
          </el-tab-pane>
          <el-tab-pane label="异常处置" name="anomalies">
            <div v-if="analyzeResult.anomalies?.length">
              <div class="result-item" v-for="(a, i) in analyzeResult.anomalies" :key="i">
                <el-tag size="small" :type="a.priority === '高' ? 'danger' : a.priority === '中' ? 'warning' : 'info'">{{ a.priority }}</el-tag>
                <b>{{ a.contractName }}</b>：{{ a.reason }} → {{ a.action }}
              </div>
            </div>
            <el-empty v-else description="无异常" />
          </el-tab-pane>
          <el-tab-pane label="治理建议" name="strategies">
            <div v-if="analyzeResult.strategies?.length">
              <div class="result-item" v-for="(s, i) in analyzeResult.strategies" :key="i">
                <el-tag size="small" :type="s.priority === '高' ? 'danger' : s.priority === '中' ? 'warning' : 'info'">{{ s.priority }}</el-tag>
                <b>{{ s.content }}</b><br /><span class="muted">收益：{{ s.benefit }}</span>
              </div>
            </div>
            <el-empty v-else description="无数据" />
          </el-tab-pane>
          <el-tab-pane label="健康评分" name="health">
            <div v-if="analyzeResult.health" class="health-inline">
              <el-progress :percentage="analyzeResult.health.totalScore" :color="healthColor" :stroke-width="18" />
              <p>{{ analyzeResult.health.comment }}</p>
            </div>
            <el-empty v-else description="无数据" />
          </el-tab-pane>
        </el-tabs>
        <p class="calls-info">本次分析共调用大模型 {{ analyzeResult.calls || 0 }} 次</p>
      </div>
    </div>

    <!-- 谈判推演 -->
    <div class="section-card">
      <div class="section-header"><h3>🎯 谈判推演助手</h3></div>
      <div class="negotiate-bar">
        <el-select v-model="negotiateType" placeholder="选择一类高频风险" filterable style="width: 320px;">
          <el-option v-for="t in negotiateOptions" :key="t" :label="t" :value="t" />
        </el-select>
        <el-button type="primary" :loading="negotiating" @click="runNegotiate">生成谈判策略</el-button>
      </div>
      <div class="negotiate-result" v-if="negotiateResult">
        <h4>📌 谈判要点</h4>
        <ul><li v-for="(p, i) in negotiateResult.points" :key="i">{{ p }}</li></ul>
        <h4>🛡️ 可接受底线</h4>
        <p>{{ negotiateResult.bottomLine }}</p>
        <h4>🔄 让步顺序</h4>
        <ol><li v-for="(c, i) in negotiateResult.concessionOrder" :key="i">{{ c }}</li></ol>
        <h4>💬 谈判话术</h4>
        <p class="script">{{ negotiateResult.script }}</p>
      </div>
    </div>

    <!-- 交互式追问 -->
    <div class="section-card">
      <div class="section-header"><h3>💬 交互式追问</h3></div>
      <div class="qa-input">
        <el-input v-model="qaQuestion" placeholder="例如：我这两个月哪类合同风险最高？" @keyup.enter="askQA" />
        <el-button type="primary" :loading="qaLoading" @click="askQA">提问</el-button>
      </div>
      <div class="qa-list">
        <div class="qa-item" v-for="(q, i) in qaHistory" :key="i">
          <div class="qa-q">🙋 {{ q.question }}</div>
          <div class="qa-a">{{ q.answer }}</div>
        </div>
        <el-empty v-if="!qaHistory.length" description="基于你的合同审查历史回答问题" />
      </div>
    </div>

    <!-- 历史洞察（保留原有） -->
    <div class="insights-container" v-if="historyInsights">
      <div class="insights-header">
        <h3>🧠 历史洞察 · 个性化经验总结</h3>
        <button class="insights-refresh" @click="loadHistoryInsights(true)" :disabled="historyLoading">
          {{ historyLoading ? '刷新中…' : '刷新洞察' }}
        </button>
      </div>
      <div v-if="!historyInsights.hasHistory" class="insights-empty">
        <p>📭 完成 2 份以上合同审查后，这里会自动总结你的常见遗漏点和风险模式</p>
      </div>
      <template v-else>
        <div class="insights-meta">
          <span>📊 已基于 <b>{{ historyInsights.totalRecords }}</b> 份合同的审查历史生成洞察</span>
          <span class="risk-badges">
            <span class="risk-badge low">低风险 {{ historyInsights.riskLevelDist?.low || 0 }}</span>
            <span class="risk-badge mid">中风险 {{ historyInsights.riskLevelDist?.mid || 0 }}</span>
            <span class="risk-badge high">高风险 {{ historyInsights.riskLevelDist?.high || 0 }}</span>
          </span>
        </div>
        <div class="insights-grid">
          <div class="insights-col">
            <div class="insights-card">
              <h4>⚠️ 常见遗漏项（{{ historyInsights.commonOmissions?.length || 0 }}）</h4>
              <ul class="insights-list">
                <li v-for="(item, i) in historyInsights.commonOmissions" :key="'o'+i">{{ item }}</li>
                <li v-if="!historyInsights.commonOmissions?.length">暂无数据</li>
              </ul>
            </div>
          </div>
          <div class="insights-col">
            <div class="insights-card">
              <h4>🔍 常见不足项（{{ historyInsights.commonDeficiencies?.length || 0 }}）</h4>
              <ul class="insights-list">
                <li v-for="(item, i) in historyInsights.commonDeficiencies" :key="'d'+i">{{ item }}</li>
                <li v-if="!historyInsights.commonDeficiencies?.length">暂无数据</li>
              </ul>
            </div>
          </div>
          <div class="insights-col">
            <div class="insights-card reminders">
              <h4>💡 个性化风险提醒</h4>
              <ul class="insights-list">
                <li v-for="(item, i) in historyInsights.reminders" :key="'r'+i">{{ item }}</li>
                <li v-if="!historyInsights.reminders?.length">暂无数据</li>
              </ul>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import Chart from 'chart.js/auto';
import { ElMessage } from 'element-plus';
import { getAuthHeaders } from '@Setup/storage/user.js';

export default {
  data() {
    return {
      cards: [
        { title: '审查合同总数', value: '0个', introduction: '已审查的合同总数量' },
        { title: '起草合同总数', value: '0个', introduction: '已起草的合同总数量' },
        { title: '今日审查', value: '0个', introduction: '今日审查的合同数量' },
        { title: '今日起草', value: '0个', introduction: '今日起草的合同数量' }
      ],
      reviewChart: null,
      draftChart: null,
      coverageChart: null,
      radarChart: null,
      statisticsData: { summary: { totalReview: 0, totalDraft: 0, todayReview: 0, todayDraft: 0 }, reviewData: [], draftData: [], dateRange: [] },
      // 合同库概览
      overview: null,
      overviewLoading: false,
      // 多智能体分析
      analyzing: false,
      analyzeEvents: [],
      analyzeResult: null,
      resultTab: 'clauses',
      // 谈判推演
      negotiateType: '',
      negotiating: false,
      negotiateResult: null,
      // 追问
      qaQuestion: '',
      qaLoading: false,
      qaHistory: [],
      // 历史洞察
      historyInsights: null,
      historyLoading: false,
      historyFetchedAt: 0
    };
  },
  computed: {
    healthColor() {
      const s = this.overview?.health?.totalScore ?? this.analyzeResult?.health?.totalScore ?? 0;
      if (s >= 85) return '#67c23a';
      if (s >= 70) return '#409eff';
      if (s >= 55) return '#e6a23c';
      return '#f56c6c';
    },
    negotiateOptions() {
      const opts = new Set();
      (this.overview?.clauseCoverage || []).forEach(c => opts.add(c.name + '覆盖率不足'));
      (this.analyzeResult?.clauses || []).forEach(c => opts.add(c.name));
      (this.analyzeResult?.patterns || []).forEach(p => opts.add(p.name));
      return ['逾期付款违约金过低', '违约责任不对等', '知识产权归属不清', '争议解决条款缺失', ...[...opts]].slice(0, 15);
    }
  },
  async mounted() {
    const insightsTask = this.loadHistoryInsights();
    await Promise.all([this.fetchStatisticsData(), this.loadOverview()]);
    this.updateCardData();
    await insightsTask;
    await this.$nextTick();
    this.renderReviewChart();
    this.renderDraftChart();
    this.renderCoverageChart();
    this.renderRadarChart();
  },
  async activated() {
    await Promise.all([this.fetchStatisticsData(), this.loadOverview()]);
    this.updateCardData();
    await this.loadHistoryInsights();
    await this.$nextTick();
    this.destroyCharts();
    this.renderReviewChart();
    this.renderDraftChart();
    this.renderCoverageChart();
    this.renderRadarChart();
  },
  beforeUnmount() {
    this.destroyCharts();
  },
  methods: {
    destroyCharts() {
      ['reviewChart', 'draftChart', 'coverageChart', 'radarChart'].forEach(k => {
        if (this[k]) { this[k].destroy(); this[k] = null; }
      });
    },
    getCanvas(refName) {
      const c = this.$refs[refName];
      return c && c.isConnected ? c : null;
    },
    // ============ 合同库概览（健康分/条款覆盖/异常/到期） ============
    async loadOverview() {
      this.overviewLoading = true;
      try {
        const resp = await fetch('/api/multi-agent/portfolio-overview', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        const data = await resp.json();
        if (data.err_code === 0) this.overview = data.data;
      } catch (e) {
        console.warn('获取合同库概览失败:', e);
      } finally {
        this.overviewLoading = false;
      }
    },
    // ============ 历史洞察 ============
    async loadHistoryInsights(force = false) {
      if (this.historyLoading) return;
      const TTL = 10 * 60 * 1000;
      if (!force && this.historyInsights && Date.now() - this.historyFetchedAt < TTL) return;
      this.historyLoading = true;
      try {
        const resp = await fetch('/api/multi-agent/history-summary', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        const data = await resp.json();
        this.historyFetchedAt = Date.now();
        if (data.err_code === 0 && data.data) this.historyInsights = data.data;
        else this.historyInsights = { hasHistory: false, totalRecords: 0, commonOmissions: [], commonDeficiencies: [], reminders: [], riskLevelDist: { low: 0, mid: 0, high: 0 } };
      } catch (e) {
        console.warn('获取历史洞察失败:', e);
        this.historyInsights = { hasHistory: false, totalRecords: 0, commonOmissions: [], commonDeficiencies: [], reminders: [], riskLevelDist: { low: 0, mid: 0, high: 0 } };
      } finally {
        this.historyLoading = false;
      }
    },
    // ============ 统计数据 ============
    async fetchStatisticsData() {
      try {
        const response = await fetch('/api/contract_statistics?days=30', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        if (response.ok) {
          const result = await response.json();
          if (result.err_code === 0) this.statisticsData = result.data;
        }
      } catch (e) {
        console.error('获取统计数据失败:', e);
      }
    },
    updateCardData() {
      const { summary } = this.statisticsData;
      this.cards[0].value = `${summary.totalReview}个`;
      this.cards[1].value = `${summary.totalDraft}个`;
      this.cards[2].value = `${summary.todayReview}个`;
      this.cards[3].value = `${summary.todayDraft}个`;
    },
    // ============ 图表渲染 ============
    renderReviewChart() {
      const canvas = this.getCanvas('reviewCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 360);
      gradient.addColorStop(0, 'rgba(220, 53, 69, 0.4)');
      gradient.addColorStop(1, 'rgba(220, 53, 69, 0)');
      if (this.reviewChart) { this.reviewChart.destroy(); this.reviewChart = null; }
      const stale = Chart.getChart(canvas); if (stale) stale.destroy();
      this.reviewChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.statisticsData.dateRange,
          datasets: [{ label: '审查合同数量', data: this.statisticsData.reviewData.map(i => i.count), borderColor: '#dc3545', pointBackgroundColor: '#fff', pointBorderColor: '#dc3545', pointRadius: 4, tension: 0.3, fill: true, backgroundColor: gradient, borderWidth: 2 }]
        },
        options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { color: '#333' } } }, scales: { x: { ticks: { color: '#555', maxRotation: 45, maxTicksLimit: 10 } }, y: { beginAtZero: true, ticks: { color: '#555', stepSize: 1 }, grid: { color: '#e9ecef' } } } }
      });
    },
    renderDraftChart() {
      const canvas = this.getCanvas('draftCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 360);
      gradient.addColorStop(0, 'rgba(40, 167, 69, 0.4)');
      gradient.addColorStop(1, 'rgba(40, 167, 69, 0)');
      if (this.draftChart) { this.draftChart.destroy(); this.draftChart = null; }
      const stale = Chart.getChart(canvas); if (stale) stale.destroy();
      this.draftChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.statisticsData.dateRange,
          datasets: [{ label: '起草合同数量', data: this.statisticsData.draftData.map(i => i.count), borderColor: '#28a745', pointBackgroundColor: '#fff', pointBorderColor: '#28a745', pointRadius: 4, tension: 0.3, fill: true, backgroundColor: gradient, borderWidth: 2 }]
        },
        options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { color: '#333' } } }, scales: { x: { ticks: { color: '#555', maxRotation: 45, maxTicksLimit: 10 } }, y: { beginAtZero: true, ticks: { color: '#555', stepSize: 1 }, grid: { color: '#e9ecef' } } } }
      });
    },
    renderCoverageChart() {
      const canvas = this.getCanvas('coverageCanvas');
      if (!canvas || !this.overview?.clauseCoverage?.length) return;
      if (this.coverageChart) { this.coverageChart.destroy(); this.coverageChart = null; }
      const stale = Chart.getChart(canvas); if (stale) stale.destroy();
      this.coverageChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: this.overview.clauseCoverage.map(c => c.name),
          datasets: [{ label: '覆盖率(%)', data: this.overview.clauseCoverage.map(c => c.ratio), backgroundColor: c => c.raw >= 80 ? '#67c23a' : c.raw >= 50 ? '#e6a23c' : '#f56c6c' }]
        },
        options: { animation: false, indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, max: 100, ticks: { color: '#555' }, grid: { color: '#e9ecef' } }, y: { ticks: { color: '#333', font: { size: 11 } } } } }
      });
    },
    renderRadarChart() {
      const canvas = this.getCanvas('radarCanvas');
      if (!canvas || !this.overview?.health?.dimensions?.length) return;
      if (this.radarChart) { this.radarChart.destroy(); this.radarChart = null; }
      const stale = Chart.getChart(canvas); if (stale) stale.destroy();
      this.radarChart = new Chart(canvas.getContext('2d'), {
        type: 'radar',
        data: {
          labels: this.overview.health.dimensions.map(d => d.name),
          datasets: [{ label: '得分(满分20)', data: this.overview.health.dimensions.map(d => d.score), backgroundColor: 'rgba(64,158,255,0.25)', borderColor: '#409eff', pointBackgroundColor: '#409eff', borderWidth: 2 }]
        },
        options: { animation: false, responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 20, ticks: { color: '#888', stepSize: 5 }, grid: { color: '#e9ecef' }, pointLabels: { color: '#333', font: { size: 12 } } } }, plugins: { legend: { display: false } } }
      });
    },
    // ============ 多智能体分析（流式） ============
    async startAnalyze() {
      if (this.analyzing) return;
      this.analyzing = true;
      this.analyzeEvents = [];
      this.analyzeResult = null;
      try {
        const resp = await fetch('/api/multi-agent/analyze-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({})
        });
        if (!resp.ok || !resp.body) {
          ElMessage.error('分析请求失败');
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            let evt;
            try { evt = JSON.parse(t); } catch { continue; }
            if (evt.type === 'ping') continue;
            this.handleAnalyzeEvent(evt);
          }
        }
      } catch (e) {
        ElMessage.error('分析中断：' + e.message);
      } finally {
        this.analyzing = false;
      }
    },
    handleAnalyzeEvent(evt) {
      const roleLabels = {
        analystStat: '统计员', analystMiner: '条款挖掘员', analystPattern: '模式识别员',
        analystAnomaly: '异常检测员', analystStrategy: '策略顾问', analystNegotiator: '谈判推演员',
        analystHealth: '健康度评分员', analystAlert: '到期预警员'
      };
      const roleGroups = {
        analystStat: 'observe', analystMiner: 'observe',
        analystPattern: 'cognition', analystAnomaly: 'cognition',
        analystStrategy: 'advice', analystHealth: 'advice', analystAlert: 'advice'
      };
      if (evt.type === 'start') {
        this.analyzeEvents.push({ label: '分析开始', text: `共 ${evt.data.total} 份合同，模型 ${evt.data.model}` });
      } else if (evt.type === 'notice') {
        this.analyzeEvents.push({ label: '提示', text: evt.data.message });
      } else if (evt.type === 'overview') {
        this.analyzeEvents.push({ label: '概览就绪', text: `健康分 ${evt.data.health.totalScore}，异常合同 ${evt.data.abnormalContracts.length} 份` });
      } else if (evt.type === 'agent:speech') {
        const r = evt.data.role;
        this.analyzeEvents.push({ label: roleLabels[r] || r, group: roleGroups[r] || '', text: evt.data.text });
      } else if (['miner', 'pattern', 'anomaly', 'strategy', 'health', 'alert'].includes(evt.type)) {
        const map = { miner: 'analystMiner', pattern: 'analystPattern', anomaly: 'analystAnomaly', strategy: 'analystStrategy', health: 'analystHealth', alert: 'analystAlert' };
        const r = map[evt.type];
        this.analyzeEvents.push({ label: roleLabels[r] || r, group: roleGroups[r] || '', text: JSON.stringify(evt.data) });
      } else if (evt.type === 'done') {
        this.analyzeResult = { ...evt.data, ...evt.data.summary };
        this.analyzeEvents.push({ label: '分析完成', text: `调用 ${evt.data.calls || 0} 次，失败 ${evt.data.failedCalls || 0} 次` });
      } else if (evt.type === 'error') {
        this.analyzeEvents.push({ label: '错误', text: evt.data.message });
      }
    },
    formatFeedContent(e) {
      if (!e.text) return '';
      let s = String(e.text);
      if (s.startsWith('{')) {
        try {
          const obj = JSON.parse(s);
          if (obj.clauses) s = obj.clauses.map(c => `<b>${c.name}</b>(${c.frequency})：${c.issue}`).join('<br>');
          else if (obj.patterns) s = obj.patterns.map(p => `<b>${p.name}</b>：${p.scenario}`).join('<br>');
          else if (obj.anomalies) s = obj.anomalies.map(a => `<b>${a.contractName}</b>：${a.reason} → ${a.action}`).join('<br>');
          else if (obj.strategies) s = obj.strategies.map(x => `<b>[${x.priority}]</b> ${x.content}`).join('<br>');
          else if (obj.totalScore !== undefined) s = `健康分 <b>${obj.totalScore}</b>（${obj.level}）：${obj.comment}`;
          else if (obj.expired || obj.within30) s = `逾期 ${(obj.expired || []).length}，30天内 ${(obj.within30 || []).length}，90天内 ${(obj.within90 || []).length}`;
        } catch { /* 原样 */ }
      }
      return s;
    },
    // ============ 谈判推演 ============
    async runNegotiate() {
      if (!this.negotiateType) { ElMessage.warning('请先选择风险类型'); return; }
      this.negotiating = true;
      this.negotiateResult = null;
      try {
        const resp = await fetch('/api/multi-agent/negotiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ riskType: this.negotiateType })
        });
        const data = await resp.json();
        if (data.err_code === 0 && data.data) this.negotiateResult = data.data;
        else ElMessage.error(data.message || '推演失败');
      } catch (e) {
        ElMessage.error('推演失败：' + e.message);
      } finally {
        this.negotiating = false;
      }
    },
    // ============ 交互式追问 ============
    async askQA() {
      const q = this.qaQuestion.trim();
      if (!q) return;
      this.qaLoading = true;
      try {
        const resp = await fetch('/api/multi-agent/history-qa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ question: q })
        });
        const data = await resp.json();
        const answer = (data.err_code === 0 && data.data) ? data.data.answer : (data.message || '回答失败');
        this.qaHistory.unshift({ question: q, answer });
        this.qaQuestion = '';
      } catch (e) {
        ElMessage.error('提问失败：' + e.message);
      } finally {
        this.qaLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.scrollable-container {
  padding: 20px;
  min-height: 100vh;
  background-color: #f5f7fa;
}
.dashboard-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  padding: 0 20px;
}
.card {
  background: #fff;
  border-radius: 10px;
  padding: 22px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  text-align: center;
}
.card h2 { font-size: 2rem; margin: 8px 0; color: #409eff; }
.card-title { margin: 0; font-weight: 600; color: #333; }
.card-intro { margin: 6px 0 0; font-size: 13px; color: #909399; }

.section-card {
  background: #fff;
  border-radius: 10px;
  padding: 22px;
  margin: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  border-bottom: 2px solid #f0f2f5;
  padding-bottom: 12px;
}
.section-header h3 { margin: 0; font-size: 1.25rem; color: #303133; }
.btn-refresh, .insights-refresh {
  background: #ecf5ff; color: #409eff; border: none; padding: 7px 18px;
  border-radius: 6px; cursor: pointer; font-size: 13px; transition: background 0.2s;
}
.btn-refresh:hover, .insights-refresh:hover { background: #d9ecff; }
.btn-refresh:disabled, .insights-refresh:disabled { background: #e0e0e0; color: #888; cursor: not-allowed; }

.health-body { display: flex; gap: 40px; align-items: center; }
.health-score { width: 200px; text-align: center; }
.score-num { font-size: 2.4rem; font-weight: bold; color: #409eff; }
.score-label { font-size: 14px; color: #606266; margin-top: -6px; }
.health-comment { margin-top: 10px; font-size: 13px; color: #606266; }
.health-radar { flex: 1; height: 320px; position: relative; }

.chart-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 20px;
  margin: 20px;
}
.chart {
  background: #fff; border-radius: 10px; padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  height: 400px; display: flex; flex-direction: column; min-width: 0;
}
.chart-body { position: relative; flex: 1 1 auto; min-height: 0; }
.chart-body canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.chart h3 { margin-bottom: 16px; font-size: 1.1rem; color: #333; text-align: center; }

.alert-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.alert-col { background: #fafafa; border-radius: 8px; padding: 14px; border: 1px solid #ebeef5; }
.alert-col h4 { margin: 0 0 10px; font-size: 14px; }
.alert-col.expired { border-left: 4px solid #f56c6c; }
.alert-col.soon { border-left: 4px solid #e6a23c; }
.alert-col.later { border-left: 4px solid #409eff; }
.alert-list { max-height: 220px; overflow-y: auto; }
.alert-item { padding: 8px 0; border-bottom: 1px dashed #ebeef5; font-size: 13px; }
.alert-name { font-weight: 600; color: #303133; }
.alert-tip { color: #f56c6c; margin: 3px 0; }
.alert-action { color: #606266; }
.alert-empty { color: #c0c4cc; font-size: 13px; }

.cockpit-feed { max-height: 420px; overflow-y: auto; margin-bottom: 16px; }
.feed-item { padding: 10px 14px; margin-bottom: 8px; border-radius: 8px; font-size: 13px; line-height: 1.7; }
.feed-item.grp-observe { background: #f0f9eb; }
.feed-item.grp-cognition { background: #fdf6ec; }
.feed-item.grp-advice { background: #ecf5ff; }
.feed-role { display: inline-block; font-weight: 600; color: #409eff; margin-right: 8px; }
.feed-content { display: inline; color: #303133; white-space: pre-wrap; word-break: break-word; }

.result-item { padding: 8px 0; border-bottom: 1px dashed #ebeef5; font-size: 13px; line-height: 1.7; }
.result-item .el-tag { margin-right: 6px; }
.muted { color: #909399; font-size: 12px; }
.health-inline { max-width: 500px; }
.calls-info { margin-top: 10px; font-size: 12px; color: #909399; text-align: right; }

.negotiate-bar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.negotiate-result { background: #fafafa; border-radius: 8px; padding: 18px; }
.negotiate-result h4 { margin: 12px 0 6px; color: #303133; }
.negotiate-result ul, .negotiate-result ol { margin: 0; padding-left: 22px; line-height: 1.8; }
.negotiate-result .script { background: #ecf5ff; padding: 12px; border-radius: 6px; color: #409eff; white-space: pre-wrap; }

.qa-input { display: flex; gap: 12px; margin-bottom: 16px; }
.qa-list { max-height: 360px; overflow-y: auto; }
.qa-item { margin-bottom: 14px; }
.qa-q { font-weight: 600; color: #303133; margin-bottom: 4px; }
.qa-a { background: #f4f4f5; padding: 10px 14px; border-radius: 6px; color: #303133; line-height: 1.7; }

.insights-container { background: #fff; border-radius: 10px; padding: 24px; margin: 20px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06); }
.insights-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid #ecf5ff; padding-bottom: 12px; }
.insights-header h3 { margin: 0; font-size: 1.3rem; color: #333; }
.insights-empty { text-align: center; padding: 30px; color: #909399; font-size: 14px; }
.insights-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; font-size: 13px; color: #606266; }
.insights-meta b { color: #409eff; font-size: 15px; }
.risk-badges { display: flex; gap: 8px; }
.risk-badge { font-size: 12px; padding: 4px 12px; border-radius: 14px; font-weight: 500; }
.risk-badge.low { background: #f0f9eb; color: #67c23a; }
.risk-badge.mid { background: #fdf6ec; color: #e6a23c; }
.risk-badge.high { background: #fef0f0; color: #f56c6c; }
.insights-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.insights-card { background: #fafafa; border-radius: 8px; padding: 16px; border: 1px solid #eef5f5; }
.insights-card.reminders { background: linear-gradient(135deg, #fff9e6 0%, #fff4d1 100%); border-color: #ffe48a; }
.insights-card h4 { margin: 0 0 12px; font-size: 14px; color: #333; font-weight: 600; }
.insights-list { margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.75; color: #4b5565; }
.insights-list li { margin-bottom: 4px; }

@media (max-width: 900px) {
  .dashboard-container { grid-template-columns: repeat(2, 1fr); }
  .alert-grid, .insights-grid { grid-template-columns: 1fr; }
  .health-body { flex-direction: column; }
}
</style>
