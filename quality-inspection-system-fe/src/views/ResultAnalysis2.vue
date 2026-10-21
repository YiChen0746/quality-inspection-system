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
    await this.fetchStatisticsData();
    this.updateCardData();
    await this.$nextTick();
    this.renderReviewChart();
    this.renderDraftChart();
  },
  // keep-alive 下每次切回页面都刷新数据，确保审查/起草后统计是最新的
  async activated() {
    await this.fetchStatisticsData();
    this.updateCardData();
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
</style>
  