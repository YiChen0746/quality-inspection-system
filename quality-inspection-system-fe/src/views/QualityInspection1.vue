<template>
  <div style="background-color: #dff9f8;width: 100%;height: 100%;position: absolute;">
    <img src="../assets/images/he4.png" 
     style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: -1; opacity: 0.3;">
    <div class="container" style="margin-top: 50px;">

      <!-- 即将到期合同提醒 -->
      <div v-if="expiringContracts.length > 0" class="expiring-panel">
        <h4 style="margin: 0 0 8px 0;">⏰ 即将到期合同（30天内）</h4>
        <div
          v-for="item in expiringContracts"
          :key="item.id"
          class="expiring-item"
          :class="{ urgent: item.daysLeft < 7, soon: item.daysLeft >= 7 && item.daysLeft < 30 }"
        >
          <span class="expiring-name">{{ item.fileName }}</span>
          <span class="expiring-date">到期日：{{ item.expiryDate }}（剩余 {{ item.daysLeft }} 天）</span>
        </div>
      </div>

      <div class="search-upload-container">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="搜索合同关键词..."
          class="search-input"
          @keyup.enter="doSearch"
          style="font-size: 15px;flex: 1;height: 40px;"
        />
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="margin-left: 10px;"
        />
        <el-select v-model="searchType" placeholder="全部类型" clearable style="width: 120px;margin-left: 10px;">
          <el-option label="起草" value="draft" />
          <el-option label="审查" value="review" />
        </el-select>
        <el-button type="primary" @click="doSearch" style="margin-left: 10px;">搜索</el-button>
        <el-button @click="resetSearch">重置</el-button>

        <div>
          <button @click="handleClick" style="width: 60px;height: 30px;background-color: black;color: white;border-radius: 5px;font-size: 15px;margin-bottom: 5px;margin-left: 20px;">
            上传
          </button>

          <input
            type="file"
            ref="fileInput"
            @change="uploadFiles"
            style="display: none;"
            multiple
            accept=".docx"
          />
        </div>
      </div>

      <!-- 批量上传结果 -->
      <div v-if="batchResults.length > 0" class="batch-result-panel">
        <h4 style="margin: 0 0 8px 0;">批量上传结果</h4>
        <div v-for="(r, i) in batchResults" :key="i" class="batch-result-item">
          <span :style="{ color: r.success ? '#67c23a' : '#f56c6c' }">
            {{ r.success ? '✓' : '✗' }} {{ r.fileName }} - {{ r.message }}
          </span>
        </div>
      </div>


      <div class="contract-list">
        <div class="contract-item" v-for="contract in filteredContracts" :key="contract.id">
          <div class="contract-name" style="font-size: 14px">
            {{ contract.fileName }}
            <el-tag v-if="contract.contractType" size="small" style="margin-left: 8px;" :type="contract.contractType === 'draft' ? 'primary' : 'success'">
              {{ contract.contractType === 'draft' ? '起草' : '审查' }}
            </el-tag>
            <el-tag v-if="contract.riskLevel" size="small" style="margin-left: 4px;" :type="contract.riskLevel === '高' ? 'danger' : (contract.riskLevel === '中' ? 'warning' : 'success')">
              {{ contract.riskLevel }}风险
            </el-tag>
          </div>
          <div class="contract-actions">
            <button @click="downloadContract(contract)" style="width: 60px;height: 30px;background-color: black;color: white;border-radius: 5px;">下载</button>
            <button @click="deleteContract(contract)" style="width: 60px;height: 30px;background-color: black;color: white;border-radius: 5px; margin-left: 10px;">删除</button>
          </div>
        </div>
      </div>

      <br>
    </div>
  </div>
</template>

<script>
import axios from "axios";
import { ElMessage } from 'element-plus';
export default {
  data() {
    return {
      searchQuery: '',
      dateRange: null,
      searchType: '',
      contracts: [],
      filteredContracts: [],
      selectedFile: null,
      expiringContracts: [],
      batchResults: [],
    };
  },
  mounted() {
    this.getContracts();
    this.getExpiringContracts();
  },
  methods: {
    mapFiles(files) {
      return files.map(file => ({
        fileName: file.fileName,
        id: file.id,
        contractType: file.contractType,
        expiryDate: file.expiryDate,
        riskScore: file.riskScore,
        riskLevel: file.riskLevel,
        uploadTime: file.uploadTime
      }));
    },
    getContracts() {
      axios.get('/api/getContracts')
        .then(response => {
          const files = response.data.files;
          if (Array.isArray(files)) {
            this.contracts = this.mapFiles(files);
          } else {
            console.error("获取的数据格式不正确：", files);
          }
          this.filteredContracts = this.contracts;
        })
        .catch(error => {
          console.error("获取合同列表失败：", error);
        });
    },
    // 获取即将到期合同
    getExpiringContracts() {
      axios.get('/api/expiring_contracts', { params: { days: 30 } })
        .then(response => {
          if (response.data.err_code === 0) {
            this.expiringContracts = response.data.data || [];
          }
        })
        .catch(error => {
          console.error("获取到期提醒失败：", error);
        });
    },
    // 搜索（关键词 + 时间范围 + 类型）
    doSearch() {
      const params = {};
      if (this.searchQuery) params.keyword = this.searchQuery;
      if (this.dateRange && this.dateRange[0]) params.startDate = this.dateRange[0];
      if (this.dateRange && this.dateRange[1]) params.endDate = this.dateRange[1];
      if (this.searchType) params.contractType = this.searchType;

      axios.get('/api/search', { params })
        .then(response => {
          const files = response.data.files;
          if (Array.isArray(files)) {
            this.contracts = this.mapFiles(files);
            this.filteredContracts = this.contracts;
            ElMessage.success(`搜索到 ${files.length} 条记录`);
          }
        })
        .catch(error => {
          console.error("搜索失败：", error);
          ElMessage.error('搜索失败');
        });
    },
    resetSearch() {
      this.searchQuery = '';
      this.dateRange = null;
      this.searchType = '';
      this.getContracts();
    },
    handleClick() {
      this.$refs.fileInput.click(); // 点击隐藏的文件输入框
    },
    // 批量上传：一次请求上传所有选中文件
    uploadFiles(event) {
      const files = event.target.files;
      if (!files.length) {
        console.log("没有文件，未选中文件");
        return;
      }

      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append("files", file);
      });

      axios.post('/api/batch_upload', formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
        .then((res) => {
          if (res.data.err_code === 0) {
            this.batchResults = res.data.data || [];
            ElMessage.success(res.data.message);
          } else {
            ElMessage.error(res.data.message || '批量上传失败');
          }
          this.getContracts();
          this.getExpiringContracts();
        })
        .catch((error) => {
          console.error("批量上传失败：", error);
          ElMessage.error('批量上传失败');
        });

      // 清空 input，允许重复选择同一文件
      event.target.value = '';
    },
    filterContracts() {
      this.filteredContracts = this.contracts.filter(contract =>
        contract.fileName.includes(this.searchQuery)
      );
    },
    downloadContract(contract) {
      const link = document.createElement('a');
      link.href = contract.downloadUrl;
      link.download = contract.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    deleteContract(contract) {
      if (!contract.fileName) {
        console.error('fileName 不存在，无法删除文件');
        return;
      }

      axios.delete(`/api/deleteContract`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          fileName: contract.fileName // 传递文件名到后端
        }
      })
        .then(() => {
          console.log(`文件 ${contract.fileName} 删除成功`);
          // 删除成功后重新获取合同列表
          this.getContracts();
        })
        .catch(error => {
          console.error(`文件 ${contract.fileName} 删除失败：`, error);
        });
    }


  },
};

</script>

  
  <style scoped>
  .expiring-panel {
    background-color: #fff;
    border: 1px solid #e6a23c;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .expiring-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 10px;
    border-radius: 4px;
    margin-bottom: 4px;
    font-size: 13px;
  }
  .expiring-item.urgent {
    background-color: #fef0f0;
    color: #f56c6c;
  }
  .expiring-item.soon {
    background-color: #fdf6ec;
    color: #e6a23c;
  }
  .expiring-name {
    font-weight: 600;
  }
  .batch-result-panel {
    background-color: #fff;
    border: 1px solid #dcdfe6;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .batch-result-item {
    padding: 4px 0;
    font-size: 13px;
  }
  .upload-section {
  margin-bottom: 20px;
}

.upload-section input[type="file"] {
  margin-right: 10px;
}

  .container {
    width: 800px;
    margin: 0 auto;
  }
  .search-upload-container {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}
  
  .search-input {
    width: 100%;
    padding: 10px 40px 10px 20px; /* 给输入框内留出空间放图标 */
   
    border-radius: 5px;
    border: 1px solid #ccc;
    background-image: url('../assets/images/search.png'); /* 替换为你的图标 URL */
    background-position: right 10px center;
    background-repeat: no-repeat;
    background-size: 20px;
}
  .contract-list {
    display: flex;
    flex-direction: column;
  }
  
  .contract-item {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  border-bottom: 1px solid #eee; /* 添加下边框 */
  background-color: #fff;
  border: 1px solid #ddd; /* 为每个合同项添加边框 */
  margin-bottom: 10px; /* 添加项之间的间距 */
  border-radius: 5px; /* 可选：增加圆角 */
}

  
  .contract-name {
    flex: 1;
  }
  
  .contract-actions button {
    margin-left: 10px;
  }
  
  .load-more-btn {
    margin-top: 20px;
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }

    
  .upload-area {
    /* border: 2px dashed #aaa;
    padding: 20px;
    cursor: pointer;
    margin-bottom: 10px;
     */
     width: 500px;
      height: 300px;
      border: 2px dashed #3d5be2;
      border-radius: 10px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #f0f9ff, #cfeefc); /* 背景渐变 */
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1), 0 6px 20px rgba(0, 0, 0, 0.1); /* 添加阴影 */
      transition: transform 0.3s ease; /* 添加点击或悬停时的动画效果 */
      flex-direction: column; /* 使图片和文字垂直排列 */
    text-align: center; /* 使文字居中 */
  }
  .upload-container {
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh; /* 使其充满整个页面的高度 */
    flex-direction: column;
  }
  .shangchuan {
    background-color: #4caf50;
    color: white;
    border: none;
    padding: 10px 20px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 16px;
    margin: 4px 2px;
    cursor: pointer;
    border-radius: 5px;
  }
  button:hover {
      background-color: #0056b3;
  }
  </style>
  