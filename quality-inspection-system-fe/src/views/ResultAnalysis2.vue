<template>
  <div class="scrollable-container" style="background-color: #dff9f8;">
    <div class="dashboard-container">
      <div class="card" v-for="card in cards" :key="card.title" style="height: 200px;">
        <p style="font-size: 16px;">{{ card.title }}</p>
        <h2 style="color: black;font-weight: bold;">{{ card.value }}</h2>
        <p style="font-size: 13px;">{{ card.introduction }}</p>
      </div>
    </div>

    <div class="chart-container">
      <div class="chart">
        <h3 style="margin-top: 0;">合同审查统计</h3>
        <div class="chart-body">
          <canvas ref="reviewCanvas"></canvas>
        </div>
      </div>
      <div class="chart">
        <h3>合同起草统计</h3>
        <div class="chart-body">
          <canvas ref="draftCanvas"></canvas>
        </div>
      </div>
    </div>

    <!-- 🧠 历史洞察 · 个性化经验总结 -->
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
      historyInsights: null,
      historyLoading: false,
      historyFetchedAt: 0,
      statisticsData: {
        summary: {
          totalReview: 0,
          totalDraft: 0,
          todayReview: 0,
          todayDraft: 0
        },
        reviewData: [],
        draftData: [],
        dateRange: []
      }
    };
  },
  async mounted() {
    // 放在最前：让 historyLoading 先置位，避免 keep-alive 首次进入时
    // mounted 与 activated 同时发起两次洞察请求（每次都会消耗一次大模型调用）
    const insightsTask = this.loadHistoryInsights();
    await this.fetchStatisticsData();
    this.updateCardData();
    await insightsTask;
    await this.$nextTick();
    this.renderReviewChart();
    this.renderDraftChart();
  },
  // keep-alive 下每次切回页面都刷新数据，确保审查/起草后统计是最新的
  async activated() {
    await this.fetchStatisticsData();
    this.updateCardData();
    await this.loadHistoryInsights();
    await this.$nextTick();
    this.destroyCharts();
    this.renderReviewChart();
    this.renderDraftChart();
  },
  beforeUnmount() {
    this.destroyCharts();
  },
  methods: {
    destroyCharts() {
      if (this.reviewChart) {
        this.reviewChart.destroy();
        this.reviewChart = null;
      }
      if (this.draftChart) {
        this.draftChart.destroy();
        this.draftChart = null;
      }
    },
    // 取画布；画布必须仍在文档中，否则跳过绘制
    getCanvas(refName) {
      const canvas = this.$refs[refName];
      return canvas && canvas.isConnected ? canvas : null;
    },
    // 从API获取历史洞察（多智能体 HistorySage 总结）
    // 该接口内部会调用一次大模型，故做 10 分钟缓存 + 并发去重：
    // 避免 keep-alive 页面每次切回、以及 mounted/activated 首屏双触发导致的重复调用
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
        if (data.err_code === 0 && data.data) {
          this.historyInsights = data.data;
        } else {
          this.historyInsights = {
            hasHistory: false, totalRecords: 0, message: data.message || '获取洞察失败',
            commonOmissions: [], commonDeficiencies: [], reminders: [],
            frequentRiskTypes: [], riskLevelDist: { low: 0, mid: 0, high: 0 }
          };
        }
      } catch (error) {
        console.warn('获取历史洞察失败:', error);
        this.historyInsights = {
          hasHistory: false, totalRecords: 0, message: '网络错误',
          commonOmissions: [], commonDeficiencies: [], reminders: [],
          frequentRiskTypes: [], riskLevelDist: { low: 0, mid: 0, high: 0 }
        };
      } finally {
        this.historyLoading = false;
      }
    },

    // 从API获取统计数据
    async fetchStatisticsData() {
      try {
        ElMessage.info('正在获取统计数据...');
        
        const response = await fetch('/api/contract_statistics?days=30', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.err_code === 0) {
            this.statisticsData = result.data;
            console.log('获取到的统计数据:', this.statisticsData);
            
            // 检查是否有数据
            const hasData = this.statisticsData.reviewData.some(item => item.count > 0) || 
                           this.statisticsData.draftData.some(item => item.count > 0);
            
            if (!hasData) {
              ElMessage.warning('暂无合同数据，请先进行合同审查或起草操作');
            } else {
              ElMessage.success('数据获取成功');
            }
          } else {
            ElMessage.error(result.message || '获取数据失败');
          }
        } else {
          ElMessage.error('网络请求失败');
        }
      } catch (error) {
        console.error('获取统计数据失败:', error);
        ElMessage.error('获取数据失败，请稍后重试');
      }
    },

    // 更新卡片数据
    updateCardData() {
      const { summary } = this.statisticsData;
      
      this.cards[0].value = `${summary.totalReview}个`;
      this.cards[1].value = `${summary.totalDraft}个`;
      this.cards[2].value = `${summary.todayReview}个`;
      this.cards[3].value = `${summary.todayDraft}个`;
    },

    // 渲染合同审查统计图表
    renderReviewChart() {
      const canvas = this.getCanvas('reviewCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 360);
      gradient.addColorStop(0, 'rgba(220, 53, 69, 0.4)');
      gradient.addColorStop(1, 'rgba(220, 53, 69, 0)');

      // 销毁旧图表
      if (this.reviewChart) {
        this.reviewChart.destroy();
        this.reviewChart = null;
      }
      const staleReview = Chart.getChart(canvas);
      if (staleReview) staleReview.destroy();

      this.reviewChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.statisticsData.dateRange,
          datasets: [
            {
              label: '审查合同数量',
              data: this.statisticsData.reviewData.map(item => item.count),
              borderColor: '#dc3545',
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#dc3545',
              pointHoverBackgroundColor: '#dc3545',
              pointHoverBorderColor: '#ffffff',
              pointRadius: 4,
              pointHoverRadius: 6,
              tension: 0.3,
              fill: true,
              backgroundColor: gradient,
              borderWidth: 2,
            },
          ],
        },
        options: {
          // 关闭动画：避免销毁旧实例后仍有动画帧绘制已置空的画布，导致整个渲染队列报错中断
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#333',
                font: {
                  size: 14,
                },
              },
            },
          },
          scales: {
            x: {
              title: {
                display: true,
                text: '日期',
                color: '#555',
                font: {
                  size: 12,
                },
              },
              ticks: {
                color: '#555',
                font: {
                  size: 10,
                },
                maxRotation: 45,
                maxTicksLimit: 10,
              },
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: '合同数量',
                color: '#555',
                font: {
                  size: 12,
                },
              },
              ticks: {
                color: '#555',
                font: {
                  size: 12,
                },
                stepSize: 1,
              },
              grid: {
                color: '#e9ecef',
              },
            },
          },
        },
      });
    },

    // 渲染合同起草统计图表
    renderDraftChart() {
      const canvas = this.getCanvas('draftCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 360);
      gradient.addColorStop(0, 'rgba(40, 167, 69, 0.4)');
      gradient.addColorStop(1, 'rgba(40, 167, 69, 0)');

      // 销毁旧图表
      if (this.draftChart) {
        this.draftChart.destroy();
        this.draftChart = null;
      }
      const staleDraft = Chart.getChart(canvas);
      if (staleDraft) staleDraft.destroy();

      this.draftChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.statisticsData.dateRange,
          datasets: [
            {
              label: '起草合同数量',
              data: this.statisticsData.draftData.map(item => item.count),
              borderColor: '#28a745',
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#28a745',
              pointHoverBackgroundColor: '#28a745',
              pointHoverBorderColor: '#ffffff',
              pointRadius: 4,
              pointHoverRadius: 6,
              tension: 0.3,
              fill: true,
              backgroundColor: gradient,
              borderWidth: 2,
            },
          ],
        },
        options: {
          // 关闭动画：避免销毁旧实例后仍有动画帧绘制已置空的画布，导致整个渲染队列报错中断
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#333',
                font: {
                  size: 14,
                },
              },
            },
          },
          scales: {
            x: {
              title: {
                display: true,
                text: '日期',
                color: '#555',
                font: {
                  size: 12,
                },
              },
              ticks: {
                color: '#555',
                font: {
                  size: 10,
                },
                maxRotation: 45,
                maxTicksLimit: 10,
              },
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: '合同数量',
                color: '#555',
                font: {
                  size: 12,
                },
              },
              ticks: {
                color: '#555',
                font: {
                  size: 12,
                },
                stepSize: 1,
              },
              grid: {
                color: '#e9ecef',
              },
            },
          },
        },
      });
    },
  }
};
</script>

<style scoped>
body {
  font-family: 'Roboto', sans-serif;
  margin: 0;
  background-color: #f8f9fa;
  overflow-y: auto;
}

.scrollable-container {
  padding: 20px;
  height: 1250px;
}

.dashboard-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  padding: 20px;
}

.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.card h2 {
  font-size: 2rem;
  margin: 0;
  color: #007bff;
}

.card p {
  margin: 10px 0;
  font-weight: bold;
}

.chart-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 20px;
  margin: 20px;
}

.chart {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  height: 420px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 画布放在固定高度的定位容器中，避免 Chart.js 自适应循环导致尺寸不断增大 */
.chart-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.chart-body canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.chart h3 {
  margin-bottom: 20px;
  font-size: 1.5rem;
  color: #333;
  text-align: center;
}

/* ============ 历史洞察面板 ============ */
.insights-container {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  margin: 20px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.insights-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  border-bottom: 2px solid #dff9f8;
  padding-bottom: 12px;
}
.insights-header h3 {
  margin: 0;
  font-size: 1.3rem;
  color: #333;
}
.insights-refresh {
  background: #dff9f8;
  color: #006d6b;
  border: none;
  padding: 8px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s;
}
.insights-refresh:hover { background: #b8f0ed; }
.insights-refresh:disabled { background: #e0e0e0; color: #888; cursor: not-allowed; }

.insights-empty {
  text-align: center;
  padding: 30px;
  color: #909399;
  font-size: 14px;
}

.insights-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  font-size: 13px;
  color: #606266;
}
.insights-meta b { color: #006d6b; font-size: 15px; }

.risk-badges { display: flex; gap: 8px; }
.risk-badge {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 14px;
  font-weight: 500;
}
.risk-badge.low { background: #f0f9eb; color: #67c23a; }
.risk-badge.mid { background: #fdf6ec; color: #e6a23c; }
.risk-badge.high { background: #fef0f0; color: #f56c6c; }

.insights-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.insights-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #eef5f5;
}
.insights-card.reminders {
  background: linear-gradient(135deg, #fff9e6 0%, #fff4d1 100%);
  border-color: #ffe48a;
}
.insights-card h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #333;
  font-weight: 600;
}
.insights-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12.5px;
  line-height: 1.75;
  color: #4b5565;
}
.insights-list li { margin-bottom: 4px; }

@media (max-width: 900px) {
  .insights-grid { grid-template-columns: 1fr; }
}
</style>
  