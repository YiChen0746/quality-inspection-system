<template>
  <div class="contract-review-container">
    <!-- 顶部标题区域 -->
    <div class="header-section">
      <div class="header-content">
        <div class="title-area">
          <h1 class="main-title">
            <el-icon class="title-icon"><Document /></el-icon>
            智能合同审查系统
          </h1>
          <p class="subtitle">AI驱动的专业合同分析，为您的法务工作保驾护航</p>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 功能切换标签页 -->
      <el-tabs v-model="mainTab" class="main-tabs" type="card">
        <el-tab-pane label="新建审查" name="new">
          <!-- 上传区域 -->
          <div class="upload-section" v-show="currentStage === 'upload'">
        <el-card class="upload-card" shadow="hover">
          <div class="card-header">
            <h2 class="section-title">
              <el-icon><Upload /></el-icon>
              上传合同文件
            </h2>
            <p class="section-desc">支持多种格式，智能识别合同内容</p>
          </div>

          <div class="upload-area">
            <el-upload
              ref="uploadRef"
              class="contract-uploader"
              drag
              multiple
              :auto-upload="false"
              :before-upload="beforeUpload"
              :on-change="handleFileChange"
              :show-file-list="false"
              accept=".jpg,.jpeg,.png,.docx"
              :class="{ 'is-dragover': isDragover }"
              @dragover="isDragover = true"
              @dragleave="isDragover = false"
            >
              <div class="upload-content">
                <div class="upload-icon">
                  <el-icon v-if="!selectedFiles.length" class="upload-icon-default"><UploadFilled /></el-icon>
                  <el-icon v-else class="success-icon"><Check /></el-icon>
                </div>
                <div class="upload-text">
                  <div class="primary-text" v-if="!selectedFiles.length">
                    拖拽文件到此处，或 <em>点击选择文件</em>
                  </div>
                  <div class="primary-text success-text" v-else>
                    已选择 {{ selectedFiles.length }} 个文件，可继续添加
                  </div>
                  <div class="secondary-text">
                    支持 JPG、PNG、DOCX 格式，单文件最大 10MB；合同照片将自动 OCR 识别文字；支持一次批量导入多份合同
                  </div>
                </div>
              </div>
            </el-upload>

            <!-- 已选文件列表（批量导入） -->
            <div class="file-chips" v-if="selectedFiles.length">
              <div class="file-chip" v-for="(f, i) in selectedFiles" :key="i">
                <el-icon><Document /></el-icon>
                <span class="file-chip-name" :title="f.name">{{ f.name }}</span>
                <el-icon class="file-chip-del" @click="removeFile(i)"><Close /></el-icon>
              </div>
            </div>
          </div>

          <div class="options-area" v-if="selectedFiles.length">
            <!-- 网络状态检测 -->
            <div class="network-status" v-if="showNetworkStatus">
              <div class="status-indicator" :class="networkStatus.type">
                <el-icon><component :is="networkStatus.icon" /></el-icon>
                <span>{{ networkStatus.message }}</span>
              </div>
              <el-button 
                type="text" 
                size="small" 
                @click="testConnection"
                :loading="testingConnection"
              >
                测试连接
              </el-button>
            </div>
            
            <div class="analysis-position">
              <label class="option-label">分析立场</label>
              <el-select 
                v-model="analysisPosition" 
                placeholder="请选择分析立场"
                class="position-select"
                size="large"
              >
                <el-option 
                  v-for="option in positionOptions"
                  :key="option.value"
                  :label="option.label" 
                  :value="option.value"
                >
                  <div class="option-item">
                    <span>{{ option.label }}</span>
                    <span class="option-desc">{{ option.desc }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>

            <el-button 
              type="primary" 
              size="large" 
              class="start-btn"
              @click="startAnalysis"
              :loading="isStarting"
            >
              <el-icon></el-icon>
              开始智能分析
            </el-button>
          </div>
        </el-card>
      </div>

      <!-- 处理进度区域 -->
      <div class="processing-section" v-show="currentStage === 'processing'">
        <el-card class="progress-card" shadow="always">
          <div class="progress-header">
            <h2 class="section-title">
              <el-icon class="rotating"><Loading /></el-icon>
              正在分析合同<template v-if="selectedFiles.length > 1">（第 {{ currentFileIndex + 1 }} / {{ selectedFiles.length }} 份）</template>
            </h2>
            <p class="section-desc">
              <template v-if="selectedFiles.length > 1">正在处理：{{ selectedFiles[currentFileIndex]?.name }}　</template>
              AI正在深度解析您的合同内容，请稍候...
            </p>
          </div>

          <!-- 进度步骤 -->
          <div class="steps-container">
            <el-steps 
              :active="currentStep" 
              finish-status="success" 
              align-center
              class="custom-steps"
            >
              <el-step title="文件上传" description="上传合同文件" />
              <el-step title="OCR识别" description="提取文字内容" />
              <el-step title="AI分析" description="智能合同分析" />
              <el-step title="生成报告" description="生成分析报告" />
            </el-steps>
          </div>

          <!-- 当前处理状态 -->
          <div class="current-status">
            <div class="status-card">
              <div class="status-icon">
                <el-icon class="rotating" v-if="currentProcessing"><Loading /></el-icon>
                <el-icon class="success" v-else-if="currentStep > 0"><Check /></el-icon>
                <el-icon v-else><Clock /></el-icon>
              </div>
              <div class="status-content">
                <div class="status-title">{{ currentStatusTitle }}</div>
                <div class="status-desc">{{ currentStatusDesc }}</div>
              </div>
              <div class="status-progress">
                <el-progress 
                  :percentage="currentProgress" 
                  :stroke-width="6"
                  :show-text="false"
                  color="#409eff"
                />
              </div>
            </div>
            
            <!-- 重试按钮 -->
            <div v-if="!currentProcessing && currentStep > 0 && currentStep < 3" class="retry-section">
              <el-button 
                type="warning" 
                @click="retryAnalysis"
                :loading="isRetrying"
                class="retry-btn"
              >
                <el-icon><Refresh /></el-icon>
                重试分析
              </el-button>
              <p class="retry-tip">如果分析失败，可以点击重试按钮重新开始</p>
            </div>
          </div>

          <!-- 处理日志 -->
          <div class="logs-container" v-if="processLogs.length > 0">
            <div class="logs-header">
              <h3>处理日志</h3>
              <el-button text @click="toggleLogs">
                {{ showLogs ? '收起' : '展开' }}
                <el-icon><ArrowDown v-if="!showLogs" /><ArrowUp v-else /></el-icon>
              </el-button>
            </div>
            <el-collapse-transition>
              <div class="logs-content" v-show="showLogs">
                <div 
                  class="log-item" 
                  v-for="(log, index) in processLogs" 
                  :key="index"
                  :class="getLogClass(log.step)"
                >
                  <div class="log-icon">
                    <el-icon><component :is="getLogIcon(log.step)" /></el-icon>
                  </div>
                  <div class="log-content">
                    <div class="log-message">{{ log.message }}</div>
                    <div class="log-time">{{ formatTime(log.time) }}</div>
                  </div>
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </el-card>
      </div>

      <!-- 结果展示区域 -->
      <div class="result-section" v-show="currentStage === 'result'">
        <el-card class="result-card" shadow="hover">
          <div class="result-header">
            <div class="header-left">
              <h2 class="section-title">
                <el-icon class="success-icon"><CircleCheck /></el-icon>
                合同审查报告
              </h2>
              <p class="section-desc">基于AI深度分析生成的专业报告</p>
            </div>
            <div class="header-actions">
              <el-button 
                type="warning" 
                class="deep-review-btn"
                @click="goDeepReview"
              >
                <el-icon class="btn-icon"><Promotion /></el-icon>
                <span class="btn-text">转深度审查</span>
              </el-button>
              <el-button 
                type="success" 
                class="export-btn"
                @click="exportReport"
              >
                <el-icon class="btn-icon"><Download /></el-icon>
                <span class="btn-text">导出报告</span>
              </el-button>
              <el-button 
                type="primary"
                class="reanalyze-btn"
                @click="resetAnalysis"
                plain
              >
                <el-icon class="btn-icon"><Refresh /></el-icon>
                <span class="btn-text">重新分析</span>
              </el-button>
            </div>
          </div>

          <!-- 批量结果切换：每份合同一份报告，按钮切换查看 -->
          <div class="result-switcher" v-if="batchResults.length > 1">
            <span class="result-switcher-label">批量结果（{{ batchResults.length }} 份）：</span>
            <el-button
              v-for="(r, i) in batchResults"
              :key="i"
              size="small"
              :type="i === activeResultIndex ? 'primary' : 'default'"
              :disabled="!r.data"
              :title="r.data ? r.fileName : r.fileName + '（分析失败：' + (r.error || '未知错误') + '）'"
              @click="switchResult(i)"
            >
              {{ r.fileName }}
            </el-button>
          </div>

          <el-tabs v-model="activeTab" class="result-tabs" type="card">
            <!-- 调试信息 -->
            <!-- <div v-if="reviewResult" style="background: #f0f9ff; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; border: 1px solid #409eff;">
              <h4 style="margin: 0 0 0.5rem 0; color: #409eff;">调试信息</h4>
              <pre style="font-size: 0.8rem; margin: 0; white-space: pre-wrap;">{{ JSON.stringify(reviewResult, null, 2) }}</pre>
            </div> -->
            
            <el-tab-pane label="基本信息" name="basic">
              <div class="tab-content">
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">合同名称</div>
                    <div class="info-value">{{ reviewResult?.contract_name || '未识别' }}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">合同类型</div>
                    <div class="info-value">{{ reviewResult?.contract_type || '未识别' }}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">生效日期</div>
                    <div class="info-value">{{ reviewResult?.effective_date || '未识别' }}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">终止日期</div>
                    <div class="info-value">{{ reviewResult?.termination_date || '未识别' }}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">管辖权</div>
                    <div class="info-value">{{ reviewResult?.jurisdiction || '未识别' }}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">分析立场</div>
                    <div class="info-value">{{ reviewResult?.analysis_position || '中立' }}</div>
                  </div>
                </div>

                <div class="content-sections">
                  <div class="content-section">
                    <h3 class="content-title">
                      <el-icon><User /></el-icon>
                      涉及主体
                    </h3>
                    <div class="content-box">
                      <pre>{{ reviewResult?.parties_involved || '暂无信息' }}</pre>
                    </div>
                  </div>

                  <div class="content-section">
                    <h3 class="content-title">
                      <el-icon><Document /></el-icon>
                      合同摘要
                    </h3>
                    <div class="content-box">
                      <pre>{{ reviewResult?.contract_summary || '暂无信息' }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="风险条款" name="risk">
              <div class="tab-content">
                <el-alert
                  title="风险提示"
                  type="warning"
                  description="以下条款可能存在法律风险，建议重点关注"
                  show-icon
                  :closable="false"
                  class="risk-alert"
                />
                <div class="content-box risk-content">
                  <pre>{{ reviewResult?.risk_clauses || '暂无风险条款识别' }}</pre>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="核心条款" name="core">
              <div class="tab-content">
                <el-alert
                  title="核心条款解读"
                  type="info"
                  description="以下是合同的核心条款及专业解读"
                  show-icon
                  :closable="false"
                  class="core-alert"
                />
                <div class="content-box core-content">
                  <pre>{{ reviewResult?.core_clauses || '暂无核心条款识别' }}</pre>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </div>
        </el-tab-pane>
        
        <!-- 历史记录标签页 -->
        <el-tab-pane label="历史记录" name="history">
          <div class="history-section">
            <el-card class="history-card" shadow="hover">
              <div class="history-header">
                <h2 class="section-title">
                  <el-icon><Document /></el-icon>
                  历史审查记录
                </h2>
                <p class="section-desc">查看和管理您的历史合同审查报告</p>
              </div>
              
              <!-- 搜索和操作区域 -->
              <div class="history-actions">
                <el-input
                  v-model="historySearch"
                  placeholder="搜索合同名称、类型或分析立场"
                  class="search-input"
                  clearable
                  @keyup.enter="loadHistoryData"
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
                <el-button type="primary" @click="loadHistoryData" :loading="historyLoading">
                  <el-icon><Search /></el-icon>
                  搜索
                </el-button>
                <!-- <el-checkbox v-model="includeMiniapp" @change="reloadHistory" style="margin-left:12px;">
                  同时显示小程序历史
                </el-checkbox> -->
              </div>
              
              <!-- 历史记录列表 -->
              <div class="history-list">
                <el-table
                  :data="historyList"
                  v-loading="historyLoading"
                  style="width: 100%"
                  @row-click="viewHistoryDetail"
                >
                  <el-table-column prop="contract_name" label="合同名称" min-width="200">
                    <template #default="{ row }">
                      <div class="contract-name">
                        <el-icon><Document /></el-icon>
                        <span>{{ row.contract_name }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  
                  <el-table-column prop="contract_type" label="合同类型" width="120" />
                  
                  <el-table-column prop="analysis_position" label="分析立场" width="100">
                    <template #default="{ row }">
                      <el-tag :type="getPositionTagType(row.analysis_position)">
                        {{ row.analysis_position }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  
                  <el-table-column prop="risk_level" label="风险等级" width="100">
                    <template #default="{ row }">
                      <el-tag :type="row.risk_level === '有风险' ? 'danger' : 'success'">
                        {{ row.risk_level }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  
                  <el-table-column prop="created_at" label="审查时间" width="180">
                    <template #default="{ row }">
                      {{ formatDate(row.created_at) }}
                    </template>
                  </el-table-column>
                  
                  <el-table-column prop="source" label="来源" width="100">
                    <template #default="{ row }">
                      <el-tag size="small" :type="row.source === 'miniapp' ? 'warning' : 'info'">
                        {{ row.source === 'miniapp' ? '小程序' : '网页' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  
                  <el-table-column label="操作" width="200" fixed="right">
                    <template #default="{ row }">
                      <el-button type="primary" size="small" @click.stop="viewHistoryDetail(row)">
                        <el-icon><View /></el-icon>
                        查看详情
                      </el-button>
                      <el-button type="success" size="small" @click.stop="exportHistoryReport(row)">
                        <el-icon><Download /></el-icon>
                        导出报告
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
                
                <!-- 分页 -->
                <div class="pagination-wrapper">
                  <el-pagination
                    v-model:current-page="historyPagination.page"
                    v-model:page-size="historyPagination.limit"
                    :page-sizes="[10, 20, 50, 100]"
                    :total="historyPagination.total"
                    layout="total, sizes, prev, pager, next, jumper"
                    @size-change="handleSizeChange"
                    @current-change="handleCurrentChange"
                  />
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getAuthHeaders } from '@Setup/storage/user.js';
import { 
  Document, Upload, UploadFilled, Check, Loading, Clock,
  CircleCheck, Download, Refresh, ArrowDown, ArrowUp, User,
  Warning, InfoFilled, Star, Search, View, Promotion, Close
} from '@element-plus/icons-vue';

const router = useRouter();

// 响应式数据
const uploadRef = ref();
const selectedFiles = ref<any[]>([]); // 批量导入：支持一次多份合同
const currentFileIndex = ref(0);      // 批量处理时当前文件下标
const batchResults = ref<any[]>([]);  // 每份合同一份审查结果：{ fileName, data, error }
const activeResultIndex = ref(0);     // 结果区当前展示的合同下标
const analysisPosition = ref('中立');
const currentStage = ref<'upload' | 'processing' | 'result'>('upload');
const currentStep = ref(0);
const currentProgress = ref(0);
const activeTab = ref('basic');
const mainTab = ref('new'); // 主标签页：new-新建审查，history-历史记录
const isDragover = ref(false);
const isStarting = ref(false);
const currentProcessing = ref(false);
const showLogs = ref(false);

// 历史记录相关数据
const historyList = ref<any[]>([]);
const historyLoading = ref(false);
const historyPagination = ref({
  page: 1,
  limit: 10,
  total: 0
});
const historySearch = ref('');
const includeMiniapp = ref<boolean>(false);
const selectedHistoryItem = ref<any>(null);

// 处理日志
const processLogs = ref<Array<{
  step: string;
  message: string;
  time: Date;
}>>([]);

// 审查结果
const reviewResult = ref<any>(null);

// 立场选项
const positionOptions = [
  { value: '中立', label: '中立立场', desc: '客观分析' },
  { value: '甲方', label: '甲方立场', desc: '维护甲方利益' },
  { value: '乙方', label: '乙方立场', desc: '维护乙方利益' },
  { value: '第三方', label: '第三方立场', desc: '独立专业视角' }
];

// 网络状态和连接测试
const networkStatus = ref({
  type: 'info', // 'info', 'success', 'warning', 'error'
  icon: Clock,
  message: '正在连接AI服务...'
});
const showNetworkStatus = ref(false);
const testingConnection = ref(false);

// 当前状态标题和描述
const currentStatusTitle = computed(() => {
  switch (currentStep.value) {
    case 0: return '准备上传文件';
    case 1: return '正在进行OCR识别';
    case 2: return '正在进行AI分析';
    case 3: return '正在生成报告';
    default: return '等待处理';
  }
});

const currentStatusDesc = computed(() => {
  switch (currentStep.value) {
    case 0: return '文件上传中，请稍候...';
    case 1: return '正在识别合同中的文字内容...';
    case 2: return 'AI正在深度分析合同条款...';
    case 3: return '正在整理分析结果并生成报告...';
    default: return '';
  }
});

// 文件上传前验证
const beforeUpload = (file: File) => {
  const isValidType = ['image/jpeg', 'image/jpg', 'image/png',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
                      .includes(file.type);
  
  if (!isValidType) {
    ElMessage.error('只支持 JPG、PNG、DOCX 格式的文件！');
    return false;
  }

  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过 10MB！');
    return false;
  }

  return false; // 阻止默认上传
};

// 处理文件选择（批量导入：逐个校验后加入待审队列）
const handleFileChange = (file: any) => {
  if (!file.raw) return;
  const raw = file.raw as File;

  const isValidType = ['image/jpeg', 'image/jpg', 'image/png',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
                      .includes(raw.type);
  if (!isValidType) {
    ElMessage.error(`「${raw.name}」格式不支持，仅支持 JPG、PNG、DOCX`);
    return;
  }
  if (raw.size / 1024 / 1024 >= 10) {
    ElMessage.error(`「${raw.name}」超过 10MB 限制`);
    return;
  }
  if (selectedFiles.value.some((f) => f.name === raw.name && f.size === raw.size)) {
    ElMessage.warning(`「${raw.name}」已在列表中`);
    return;
  }

  selectedFiles.value.push(raw);
  isDragover.value = false;
  ElMessage.success(`已添加「${raw.name}」，共 ${selectedFiles.value.length} 份待审合同`);

  // 显示网络状态并自动检测连接
  showNetworkStatus.value = true;
  testConnection();
};

// 从待审队列移除文件
const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1);
};

// 开始分析（批量：逐份处理）
const startAnalysis = async () => {
  if (!selectedFiles.value.length) {
    ElMessage.error('请先选择文件！');
    return;
  }

  isStarting.value = true;
  ElMessage.info(`正在启动分析流程，共 ${selectedFiles.value.length} 份合同...`);

  // 延迟一下，让用户看到按钮的loading状态
  setTimeout(() => {
    currentStage.value = 'processing';
    isStarting.value = false;
    currentProcessing.value = true;
    processContract();
  }, 800);
};

// 处理合同（批量循环，逐份走流式接口）
const processContract = async () => {
  // 重置状态
  currentStep.value = 0;
  currentProgress.value = 0;
  processLogs.value = [];
  batchResults.value = [];
  activeResultIndex.value = 0;
  reviewResult.value = null;

  const total = selectedFiles.value.length;

  for (let i = 0; i < total; i++) {
    currentFileIndex.value = i;
    const file = selectedFiles.value[i];
    addProcessLog('upload', total > 1 ? `开始处理第 ${i + 1}/${total} 份：${file.name}` : '开始上传合同文件...');
    currentStep.value = 0;
    currentProgress.value = 0;

    try {
      await processOneFile(file);
    } catch (error: any) {
      console.error(`「${file.name}」处理失败:`, error);
      batchResults.value.push({ fileName: file.name, data: null, error: error?.message || '网络错误' });
      addProcessLog('error', `「${file.name}」处理失败：${error?.message || '网络错误'}`);
    }
  }

  // 全部处理完成
  currentProcessing.value = false;
  const firstOk = batchResults.value.findIndex((r) => r.data);
  if (firstOk >= 0) {
    activeResultIndex.value = firstOk;
    reviewResult.value = batchResults.value[firstOk].data;
    const okCount = batchResults.value.filter((r) => r.data).length;
    setTimeout(() => {
      currentStage.value = 'result';
      ElMessage.success(
        total > 1
          ? `批量审查完成：共 ${total} 份，成功 ${okCount} 份${okCount < total ? '，失败条目已置灰' : ''}`
          : '合同审查完成！'
      );
    }, 600);
  } else {
    ElMessage.error('所有文件均审查失败，请重试');
    setTimeout(() => {
      currentStage.value = 'upload';
    }, 2000);
  }
};

// 单份合同的流式处理：返回 Promise，流结束时 resolve
const processOneFile = (file: File) => {
  return new Promise<any>(async (resolve, reject) => {
    try {
      const formData = new FormData();
      formData.append('contract_file', file);
      formData.append('analysis_position', analysisPosition.value);

      const response = await fetch('/api/contract-review/review', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      if (!response.ok) {
        throw new Error('网络请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let settled = false;
      const settleOnce = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            try {
              handleProcessStep(JSON.parse(buffer), file.name, settleOnce, resolve, reject);
            } catch (e) {
              console.warn('解析最后数据失败:', e, '原始数据:', buffer);
            }
          }
          // 流结束但未收到完成/错误事件（异常情况），兜底 settle
          settleOnce(() => reject(new Error('服务响应异常中断')));
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              handleProcessStep(JSON.parse(line), file.name, settleOnce, resolve, reject);
            } catch (e) {
              console.warn('解析响应数据失败:', e, '原始数据:', line);
            }
          }
        }
      }
    } catch (error) {
      reject(error);
    }
  });
};
//     let doneReading = false;
//     while (!doneReading) {
//       const { done, value } = await reader.read();
      
//       if (done) {
//         doneReading = true;
//         break;
//       }

//       buffer += decoder.decode(value, { stream: true });
//       const lines = buffer.split('\n');
//       buffer = lines.pop() || '';

//       for (const line of lines) {
//         if (line.trim()) {
//           try {
//             const data = JSON.parse(line);
//             handleProcessStep(data);
//           } catch (e) {
//             console.warn('解析响应数据失败:', e);
//           }
//         }
//       }
//     }

//   } catch (error) {
//     console.error('处理失败:', error);
//     ElMessage.error('合同处理失败，请重试');
//     currentProcessing.value = false;
//     // 回到上传阶段
//     setTimeout(() => {
//       currentStage.value = 'upload';
//     }, 2000);
//   }
// };

// 处理各个步骤（fileName 为当前文件名；settleOnce/resolve/reject 用于批量循环逐份推进）
const handleProcessStep = (data: any, fileName: string, settleOnce: (fn: () => void) => void, resolve: (v?: any) => void, reject: (e?: any) => void) => {
  switch (data.step) {
    case 'upload_success':
      currentStep.value = 1;
      currentProgress.value = 25;
      addProcessLog('upload', data.message);
      break;

    case 'ocr_processing':
      currentStep.value = 1;
      currentProgress.value = 40;
      addProcessLog('ocr', data.message);
      break;

    case 'ocr_success':
      currentStep.value = 2;
      currentProgress.value = 60;
      addProcessLog('ocr', data.message);
      break;

    case 'ai_analyzing':
      currentStep.value = 2;
      currentProgress.value = 80;
      addProcessLog('ai', data.message);
      break;

    case 'analysis_complete':
      currentStep.value = 3;
      currentProgress.value = 100;
      addProcessLog('complete', `「${fileName}」${data.message}`);
      batchResults.value.push({ fileName, data: data.data, error: null });
      settleOnce(() => resolve(data.data));
      break;

    case 'ocr_error':
      addProcessLog('error', `「${fileName}」${data.message}`);
      batchResults.value.push({ fileName, data: null, error: data.message });
      // 格式不支持等可预期错误直接提示原因，而不是只显示“所有文件均审查失败”
      ElMessage.error(`「${fileName}」${data.message}`);
      settleOnce(() => resolve(null)); // 批量模式下继续处理下一份
      break;

    case 'ai_error': {
      addProcessLog('error', `「${fileName}」${data.message}`);
      batchResults.value.push({ fileName, data: null, error: data.message });

      // 根据错误类型显示不同的提示
      if (data.message.includes('超时') || data.message.includes('中断')) {
        ElMessage.error({
          message: `「${fileName}」AI分析超时，可能是网络问题。建议：1. 检查网络连接 2. 稍后重试 3. 尝试上传较小的文件`,
          duration: 8000,
          showClose: true
        });
      } else if (data.message.includes('API密钥')) {
        ElMessage.error({
          message: 'AI服务配置错误，请联系管理员',
          duration: 5000,
          showClose: true
        });
      } else if (data.message.includes('请求频率过高')) {
        ElMessage.error({
          message: 'AI服务繁忙，请稍后重试',
          duration: 5000,
          showClose: true
        });
      } else {
        ElMessage.error(`「${fileName}」${data.message}`);
      }

      settleOnce(() => resolve(null)); // 批量模式下继续处理下一份
      break;
    }

    case 'system_error':
      addProcessLog('error', `「${fileName}」${data.message}`);
      batchResults.value.push({ fileName, data: null, error: data.message });
      ElMessage.error(`「${fileName}」系统错误，请稍后重试`);
      settleOnce(() => resolve(null)); // 批量模式下继续处理下一份
      break;
  }
};

// 切换批量结果中当前展示的合同报告
const switchResult = (index: number) => {
  const item = batchResults.value[index];
  if (!item || !item.data) return;
  activeResultIndex.value = index;
  reviewResult.value = item.data;
  activeTab.value = 'basic';
};

// 添加处理日志
const addProcessLog = (step: string, message: string) => {
  processLogs.value.push({
    step,
    message,
    time: new Date()
  });
};

// 获取日志图标
const getLogIcon = (step: string) => {
  switch (step) {
    case 'upload': return Upload;
    case 'ocr': return Document;
    case 'ai': return Star;
    case 'complete': return Check;
    case 'error': return Warning;
    default: return InfoFilled;
  }
};

// 获取日志样式类
const getLogClass = (step: string) => {
  switch (step) {
    case 'complete': return 'success';
    case 'error': return 'error';
    default: return 'info';
  }
};

// 格式化时间
const formatTime = (time: Date) => {
  return time.toLocaleTimeString();
};

// 切换日志显示
const toggleLogs = () => {
  showLogs.value = !showLogs.value;
};

// 导出报告
const exportReport = async () => {
  if (!reviewResult.value) {
    ElMessage.warning('请先完成合同审查');
    return;
  }

  // 调试信息
  console.log('导出报告 - reviewResult:', reviewResult.value);
  console.log('导出报告 - result_id:', reviewResult.value.result_id);
  console.log('导出报告 - id:', reviewResult.value.id);

  // 尝试获取result_id，优先使用result_id，如果没有则使用id
  const resultId = reviewResult.value.result_id || reviewResult.value.id;
  
  if (!resultId) {
    console.error('无法获取result_id，reviewResult结构:', reviewResult.value);
    ElMessage.error('导出失败：无法获取审查结果ID');
    return;
  }

  try {
    ElMessage.info('正在生成报告，请稍候...');
    
    const requestBody = {
      result_id: resultId
    };
    
    console.log('导出报告请求参数:', requestBody);
    
    const response = await fetch('/api/contract-review/export_review_report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reviewResult.value.contract_name || '合同审查报告'}_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      ElMessage.success('审查报告导出成功！');
    } else {
      const errorData = await response.json();
      console.error('导出失败响应:', errorData);
      ElMessage.error(errorData.message || '导出失败，请稍后重试');
    }
  } catch (error) {
    console.error('导出失败:', error);
    ElMessage.error('导出失败，请稍后重试');
  }
};

// 重新分析
const resetAnalysis = () => {
  currentStage.value = 'upload';
  selectedFiles.value = [];
  currentFileIndex.value = 0;
  batchResults.value = [];
  activeResultIndex.value = 0;
  reviewResult.value = null;
  currentStep.value = 0;
  currentProgress.value = 0;
  processLogs.value = [];
  currentProcessing.value = false;
  analysisPosition.value = '中立';
  ElMessage.success('已重置，可以重新上传文件');
};

// 把快速初筛识别出的正文带到多智能体页面做深度审查
const goDeepReview = () => {
  const content = reviewResult.value?.contract_content;
  if (!content || !String(content).trim()) {
    ElMessage.warning('未获取到合同正文，无法转深度审查');
    return;
  }
  sessionStorage.setItem('deep-review-payload', JSON.stringify({
    name: reviewResult.value?.contract_name || batchResults.value[activeResultIndex.value]?.fileName || '',
    content: String(content)
  }));
  router.push('/multi-agent');
};

// 网络状态和连接测试
const testConnection = async () => {
  testingConnection.value = true;
  networkStatus.value = {
    type: 'info',
    icon: Loading,
    message: '正在测试连接...'
  };

  try {
    const response = await fetch('/api/contract-review/test_connection', { headers: getAuthHeaders() });
    if (response.ok) {
      networkStatus.value = {
        type: 'success',
        icon: Check,
        message: 'AI服务连接正常'
      };
      ElMessage.success('AI服务连接正常！');
    } else {
      const errorData = await response.json();
      networkStatus.value = {
        type: 'error',
        icon: Warning,
        message: errorData.message || 'AI服务连接失败'
      };
      ElMessage.error(errorData.message || 'AI服务连接失败');
    }
  } catch (error) {
    networkStatus.value = {
      type: 'error',
      icon: Warning,
      message: '网络请求失败，请检查网络连接'
    };
    ElMessage.error('网络请求失败，请检查网络连接');
  } finally {
    testingConnection.value = false;
  }
};

// 重试分析
const isRetrying = ref(false);
const retryAnalysis = async () => {
  if (!selectedFiles.value.length) {
    ElMessage.error('请先选择文件！');
    return;
  }

  isRetrying.value = true;
  ElMessage.info('正在重新启动分析流程...');
  
  // 延迟一下，让用户看到按钮的loading状态
  setTimeout(() => {
    currentStage.value = 'processing';
    isRetrying.value = false;
    currentProcessing.value = true;
    processContract();
  }, 800);
};

// 历史记录相关方法

// 加载历史记录数据
const loadHistoryData = async () => {
  try {
    historyLoading.value = true;
    const params = new URLSearchParams({
      page: historyPagination.value.page.toString(),
      limit: historyPagination.value.limit.toString(),
      search: historySearch.value,
      include_miniapp: includeMiniapp.value ? '1' : '0'
    });
    
    const response = await fetch(`/api/contract-review/history?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    });

    if (response.ok) {
      const result = await response.json();
      if (result.err_code === 0) {
        historyList.value = result.data.list;
        historyPagination.value.total = result.data.total;
      } else {
        ElMessage.error(result.message || '获取历史记录失败');
      }
    } else {
      ElMessage.error('网络请求失败');
    }
  } catch (error) {
    console.error('获取历史记录失败:', error);
    ElMessage.error('获取历史记录失败，请稍后重试');
  } finally {
    historyLoading.value = false;
  }
};

// 触发重新加载
const reloadHistory = () => {
  historyPagination.value.page = 1;
  loadHistoryData();
};

// 查看历史记录详情
const viewHistoryDetail = async (row: any) => {
  try {
    const response = await fetch(`/api/contract-review/result/${row.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    });

    if (response.ok) {
      const result = await response.json();
      if (result.err_code === 0) {
        selectedHistoryItem.value = result.data;
        // 切换到新建审查标签页并显示详情
        mainTab.value = 'new';
        currentStage.value = 'result';
        reviewResult.value = result.data;
        activeTab.value = 'basic';
        ElMessage.success('历史记录加载成功');
      } else {
        ElMessage.error(result.message || '获取详情失败');
      }
    } else {
      ElMessage.error('网络请求失败');
    }
  } catch (error) {
    console.error('获取详情失败:', error);
    ElMessage.error('获取详情失败，请稍后重试');
  }
};

// 导出历史报告
const exportHistoryReport = async (row: any) => {
  if (!row || !row.id) {
    console.error('导出历史报告失败：无效的行数据', row);
    ElMessage.error('导出失败：无效的审查记录');
    return;
  }

  try {
    ElMessage.info('正在生成报告，请稍候...');
    
    const requestBody = {
      result_id: row.id
    };
    
    console.log('导出历史报告请求参数:', requestBody);
    
    const response = await fetch('/api/contract-review/export_review_report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${row.contract_name || '合同审查报告'}_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      ElMessage.success('审查报告导出成功！');
    } else {
      const errorData = await response.json();
      console.error('导出历史报告失败响应:', errorData);
      ElMessage.error(errorData.message || '导出失败，请稍后重试');
    }
  } catch (error) {
    console.error('导出历史报告失败:', error);
    ElMessage.error('导出失败，请稍后重试');
  }
};

// 获取分析立场标签类型
const getPositionTagType = (position: string) => {
  switch (position) {
    case '甲方': return 'danger';
    case '乙方': return 'warning';
    case '第三方': return 'info';
    default: return 'success';
  }
};

// 格式化日期
const formatDate = (date: string | Date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 分页大小改变
const handleSizeChange = (size: number) => {
  historyPagination.value.limit = size;
  historyPagination.value.page = 1;
  loadHistoryData();
};

// 当前页改变
const handleCurrentChange = (page: number) => {
  historyPagination.value.page = page;
  loadHistoryData();
};

// 监听主标签页变化，加载历史数据
watch(mainTab, (newTab) => {
  if (newTab === 'history') {
    loadHistoryData();
  }
});

// 组件挂载时初始化
onMounted(() => {
  // 如果当前在历史记录标签页，加载数据
  if (mainTab.value === 'history') {
    loadHistoryData();
  }
});
</script>

<style scoped lang="scss">
.contract-review-container {
  min-height: 100vh;
  background: #ffffff;
  padding: 0;
}

.header-section {
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  padding: 1.5rem 0;
  
  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .title-area {
      .main-title {
        color: #2c3e50;
        font-size: 1.6rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        
        .title-icon {
          font-size: 1.6rem;
          color: #409eff;
        }
      }
      
      .subtitle {
        color: #6c757d;
        font-size: 0.9rem;
        margin: 0;
      }
    }
    
  }
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

// 主标签页样式
.main-tabs {
  margin-bottom: 2rem;
  
  :deep(.el-tabs__header) {
    margin-bottom: 1.5rem;
  }
  
  :deep(.el-tabs__item) {
    font-size: 1.1rem;
    font-weight: 500;
  }
}

// 历史记录样式
.history-section {
  .history-card {
    border-radius: 16px;
    border: none;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    
    :deep(.el-card__body) {
      padding: 2rem;
    }
  }
  
  .history-header {
    text-align: center;
    margin-bottom: 2rem;
    
    .section-title {
      font-size: 1.1rem;
      font-weight: 500;
      color: #2c3e50;
      margin: 0 0 0.5rem 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    
    .section-desc {
      color: #6c757d;
      font-size: 0.9rem;
      margin: 0;
    }
  }
  
  .history-actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    align-items: center;
    
    .search-input {
      flex: 1;
      max-width: 400px;
    }
  }
  
  .history-list {
    .contract-name {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
    }
    
    :deep(.el-table) {
      border-radius: 8px;
      overflow: hidden;
      
      .el-table__header {
        background-color: #f8f9fa;
      }
      
      .el-table__row {
        cursor: pointer;
        transition: background-color 0.2s;
        
        &:hover {
          background-color: #f8f9fa;
        }
      }
    }
    
    .pagination-wrapper {
      display: flex;
      justify-content: center;
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e9ecef;
    }
  }
}

.upload-section, .processing-section, .result-section {
  margin-bottom: 2rem;
}

.upload-card, .progress-card, .result-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  
  :deep(.el-card__body) {
    padding: 2rem;
  }
}

.card-header, .result-header {
  text-align: center;
  margin-bottom: 2rem;
  
  .section-title {
    font-size: 1.1rem;
    font-weight: 500;
    color: #2c3e50;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .section-desc {
    color: #7f8c8d;
    font-size: 0.85rem;
    margin: 0;
  }
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-align: left;
  
  .header-left {
    .section-title {
      justify-content: flex-start;
      
      .success-icon {
        color: #67c23a;
      }
    }
  }
  
  .header-actions {
    display: flex;
    gap: 1rem;
    
    .export-btn {
      background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
      border: none;
      border-radius: 6px;
      padding: 0.35rem 0.75rem;
      font-weight: 500;
      box-shadow: 0 1px 4px rgba(103, 194, 58, 0.2);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        transition: left 0.5s;
      }
      
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(103, 194, 58, 0.35);
        
        &::before {
          left: 100%;
        }
      }
      
      &:active {
        transform: translateY(0);
      }
      
      .btn-icon {
        font-size: 0.8rem;
        margin-right: 0.3rem;
        transition: transform 0.3s ease;
      }
      
      .btn-text {
        font-size: 0.8rem;
        letter-spacing: 0.2px;
      }
      
      &:hover .btn-icon {
        transform: translateY(-1px);
      }
    }
    
    .reanalyze-btn {
      background: transparent;
      border: 1px solid #409eff;
      border-radius: 6px;
      padding: 0.35rem 0.75rem;
      font-weight: 500;
      color: #409eff;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 100%;
        background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
        transition: width 0.3s ease;
        z-index: -1;
      }
      
      &:hover {
        color: white;
        border-color: #409eff;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);
        
        &::before {
          width: 100%;
        }
        
        .btn-icon {
          transform: rotate(180deg);
        }
      }
      
      &:active {
        transform: translateY(0);
      }
      
      .btn-icon {
        font-size: 0.8rem;
        margin-right: 0.3rem;
        transition: transform 0.5s ease;
      }
      
      .btn-text {
        font-size: 0.8rem;
        letter-spacing: 0.2px;
      }
    }
  }
}

.upload-area {
  margin-bottom: 2rem;

  // 批量导入：已选文件列表
  .file-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;

    .file-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f0f7ff;
      border: 1px solid #c8e0fa;
      color: #2f5e8f;
      border-radius: 16px;
      padding: 5px 10px 5px 12px;
      font-size: 13px;
      max-width: 320px;

      .file-chip-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-chip-del {
        cursor: pointer;
        color: #9ab3cc;
        border-radius: 50%;
        padding: 1px;

        &:hover {
          color: #f56c6c;
          background: #fde8e8;
        }
      }
    }
  }
  
  .contract-uploader {
    :deep(.el-upload) {
      width: 100%;
    }
    
    :deep(.el-upload-dragger) {
      width: 100%;
      height: 200px;
      border: 2px dashed #d9d9d9;
      border-radius: 12px;
      background: #fafafa;
      transition: all 0.3s ease;
      
      &:hover, &.is-dragover {
        border-color: #409eff;
        background: #f0f9ff;
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(64, 158, 255, 0.15);
      }
    }
  }
  
  .upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    
    .upload-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      
      .upload-icon-default {
        color: #c0c4cc;
      }
      
      .success-icon {
        color: #67c23a;
      }
    }
    
    .upload-text {
      text-align: center;
      
      .primary-text {
        font-size: 1rem;
        color: #606266;
        margin-bottom: 0.5rem;
        
        &.success-text {
          color: #67c23a;
          font-weight: 500;
        }
        
        em {
          color: #409eff;
          font-style: normal;
          font-weight: 500;
        }
      }
      
      .secondary-text {
        font-size: 0.85rem;
        color: #909399;
      }
    }
  }
}

.options-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 12px;
  
  .network-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    background-color: #e1f3d8;
    border: 1px solid #a5d6a7;
    color: #2e7d32;
    font-weight: 500;
    font-size: 0.9rem;

    .status-indicator {
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      gap: 0.3rem;

      &.info {
        color: #409eff;
      }
      &.success {
        color: #67c23a;
      }
      &.warning {
        color: #e6a23c;
      }
      &.error {
        color: #f56c6c;
      }
    }
  }

  .analysis-position {
    display: flex;
    align-items: center;
    gap: 1rem;
    
    .option-label {
      font-weight: 500;
      color: #2c3e50;
      white-space: nowrap;
      font-size: 0.9rem;
    }
    
    .position-select {
      width: 200px;
      
      :deep(.el-select__wrapper) {
        border-radius: 8px;
      }
    }
  }
  
  .start-btn {
    border-radius: 8px;
    padding: 0.75rem 2rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(64, 158, 255, 0.4);
    }
  }
}

.option-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  .option-desc {
    font-size: 0.75rem;
    color: #909399;
    margin-left: auto;
  }
}

.progress-header {
  text-align: center;
  margin-bottom: 2rem;
  
  .rotating {
    animation: rotate 2s linear infinite;
  }
}

.steps-container {
  margin-bottom: 2rem;
  
  .custom-steps {
    :deep(.el-step__title) {
      font-size: 0.85rem;
      font-weight: 500;
    }
    
    :deep(.el-step__description) {
      font-size: 0.75rem;
    }
  }
}

.current-status {
  margin-bottom: 2rem;
  
  .status-card {
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    
    .status-icon {
      font-size: 2rem;
      
      .rotating {
        color: #409eff;
        animation: rotate 2s linear infinite;
      }
      
      .success {
        color: #67c23a;
      }
    }
    
    .status-content {
      flex: 1;
      
      .status-title {
        font-size: 0.95rem;
        font-weight: 500;
        color: #2c3e50;
        margin-bottom: 0.25rem;
      }
      
      .status-desc {
        font-size: 0.85rem;
        color: #7f8c8d;
      }
    }
    
    .status-progress {
      width: 120px;
    }
  }
}

.logs-container {
  .logs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    
    h3 {
      margin: 0;
      font-size: 0.9rem;
      color: #2c3e50;
    }
  }
  
  .logs-content {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
    max-height: 200px;
    overflow-y: auto;
    
    .log-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid #e9ecef;
      
      &:last-child {
        border-bottom: none;
      }
      
      &.success {
        .log-icon {
          color: #67c23a;
        }
      }
      
      &.error {
        .log-icon {
          color: #f56c6c;
        }
      }
      
      &.info {
        .log-icon {
          color: #409eff;
        }
      }
      
      .log-icon {
        margin-top: 0.125rem;
      }
      
      .log-content {
        flex: 1;
        
        .log-message {
          font-size: 0.85rem;
          color: #2c3e50;
          margin-bottom: 0.25rem;
        }
        
        .log-time {
          font-size: 0.7rem;
          color: #909399;
        }
      }
    }
  }
}

// 批量结果切换条
.result-switcher {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: #f5f8fd;
  border: 1px solid #e3ecf8;
  border-radius: 10px;

  .result-switcher-label {
    font-size: 13px;
    font-weight: 600;
    color: #44546a;
    margin-right: 4px;
  }

  .el-button {
    margin-left: 0;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.result-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 1.5rem;
  }
  
  :deep(.el-tabs__item) {
    font-weight: 500;
  }
  
  .tab-content {
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
      
      .info-item {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 1rem;
        
        .info-label {
          font-size: 0.8rem;
          color: #7f8c8d;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }
        
        .info-value {
          font-size: 0.9rem;
          color: #2c3e50;
          font-weight: 500;
        }
      }
    }
    
    .content-sections {
      .content-section {
        margin-bottom: 2rem;
        
        .content-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
          color: #2c3e50;
          margin-bottom: 1rem;
          font-weight: 500;
        }
      }
    }
    
    .content-box {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 1.5rem;
      line-height: 1.6;
      
      &.risk-content {
        border-left: 4px solid #e6a23c;
        background: #fef9e7;
      }
      
      &.core-content {
        border-left: 4px solid #409eff;
        background: #f0f9ff;
      }
      
      pre {
        white-space: pre-wrap;
        word-wrap: break-word;
        margin: 0;
        font-family: inherit;
        font-size: 0.85rem;
        color: #2c3e50;
      }
    }
    
    .risk-alert, .core-alert {
      margin-bottom: 1.5rem;
    }
  }
}

.retry-section {
  text-align: center;
  margin-top: 1.5rem;
  padding: 1rem;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  color: #faad14;
  font-size: 0.9rem;
  font-weight: 500;

  .retry-btn {
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #faad14 0%, #ffd666 100%);
    border: none;
    border-radius: 6px;
    padding: 0.4rem 1rem;
    font-weight: 500;
    box-shadow: 0 1px 4px rgba(250, 173, 20, 0.2);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s;
    }

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(250, 173, 20, 0.35);
      
      &::before {
        left: 100%;
      }
    }

    &:active {
      transform: translateY(0);
    }

    .btn-icon {
      font-size: 0.8rem;
      margin-right: 0.3rem;
      transition: transform 0.3s ease;
    }

    .btn-text {
      font-size: 0.8rem;
      letter-spacing: 0.2px;
    }

    &:hover .btn-icon {
      transform: translateY(-1px);
    }
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }
  
  .main-content {
    padding: 1rem;
  }
  
  .options-area {
    flex-direction: column;
    gap: 1rem;
  }
  
  .result-header {
    flex-direction: column;
    gap: 1.5rem;
    text-align: center;
    
    .header-left .section-title {
      justify-content: center;
    }
    
    .header-actions {
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      
      .export-btn,
      .reanalyze-btn {
        min-width: 90px;
        padding: 0.3rem 0.6rem;
        
        .btn-text {
          font-size: 0.75rem;
        }
        
        .btn-icon {
          font-size: 0.75rem;
          margin-right: 0.25rem;
        }
      }
    }
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
