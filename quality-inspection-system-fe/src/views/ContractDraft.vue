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
          </div>
        </div>
      </div>

      <!-- 中间：表单填写 -->
      <div class="form-section">
        <h3>填写合同信息</h3>
        <form @submit.prevent="generateContract" class="contract-form">
          <div class="form-group">
            <label for="contractName">合同名称 *</label>
            <input 
              type="text" 
              id="contractName" 
              v-model="contractForm.contractName" 
              placeholder="请输入合同名称"
              :class="{ error: errors.contractName }"
            >
            <span v-if="errors.contractName" class="error-message">{{ errors.contractName }}</span>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="partyA">甲方 *</label>
              <input 
                type="text" 
                id="partyA" 
                v-model="contractForm.partyA" 
                placeholder="请输入甲方名称"
                :class="{ error: errors.partyA }"
              >
              <span v-if="errors.partyA" class="error-message">{{ errors.partyA }}</span>
            </div>

            <div class="form-group">
              <label for="partyB">乙方 *</label>
              <input 
                type="text" 
                id="partyB" 
                v-model="contractForm.partyB" 
                placeholder="请输入乙方名称"
                :class="{ error: errors.partyB }"
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
            >
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="subject">合同主体 *</label>
              <select 
                id="subject" 
                v-model="contractForm.subject"
                :class="{ error: errors.subject }"
              >
                <option value="">请选择合同主体</option>
                <option value="个人">个人</option>
                <option value="公司">公司</option>
                <option value="其他组织">其他组织</option>
              </select>
              <span v-if="errors.subject" class="error-message">{{ errors.subject }}</span>
            </div>

            <div class="form-group">
              <label for="contractType">合同类型</label>
              <select id="contractType" v-model="contractForm.contractType">
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

          <div class="form-group">
            <label for="description">合同描述 *</label>
            <textarea 
              id="description" 
              v-model="contractForm.description" 
              placeholder="请详细描述合同的主要内容、标的物、服务内容等"
              rows="4"
              :class="{ error: errors.description }"
            ></textarea>
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
                <button @click="regenerateContract" class="btn-icon" title="重新生成">
                  <i class="icon-refresh">🔄</i>
                </button>
                <button @click="exportDocx" class="btn-icon" title="导出DOCX">
                  <i class="icon-download">📥</i>
                </button>
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
</template>

<script>
import { ElMessage, ElLoading } from 'element-plus';

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
        contractType: ''
      },
      errors: {},
      currentContract: null,
      contractHistory: []
    };
  },
  mounted() {
    this.loadTemplates();
    this.loadHistoryFromStorage();
  },
  methods: {
    // 加载合同模板
    async loadTemplates() {
      try {
        const response = await fetch('/api/contract_templates');
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
            'Content-Type': 'application/json'
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

    // 导出DOCX
    async exportDocx() {
      if (!this.currentContract) {
        ElMessage.warning('请先生成合同内容');
        return;
      }

      try {
        const response = await fetch('/api/export_contract_docx', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
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
          link.download = `${this.currentContract.contractInfo?.contractName || '合同'}.docx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          ElMessage.success('合同导出成功！');
        } else {
          ElMessage.error('导出失败，请稍后重试');
        }
      } catch (error) {
        console.error('导出失败:', error);
        ElMessage.error('导出失败，请稍后重试');
      }
    },

    // 选择历史合同
    selectHistoryContract(contract) {
      this.currentContract = contract;
      this.activeTab = 'preview';
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
        contractType: ''
      };
      this.errors = {};
      this.selectedTemplate = null;
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
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

/* 模板选择区域 */
.template-section {
  width: 280px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: fit-content;
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
  flex: 1;
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
  width: 400px;
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

/* 响应式设计 */
@media (max-width: 1200px) {
  .main-content {
    flex-direction: column;
  }
  
  .template-section,
  .preview-section {
    width: 100%;
  }
  
  .form-row {
    flex-direction: column;
  }
}
</style>