<template>
  <div style="background-color: #dff9f8;width: 100%;height: 100%;position: absolute;">
    <img src="../assets/images/he4.png" 
     style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: -1; opacity: 0.3;">
    <div class="container" style="margin-top: 50px;">
    
      <div class="search-upload-container">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="搜索模板关键词..."
          class="search-input"
          @input="filterContracts"
          style="font-size: 15px;width: 1000px;height: 40px;"
        />

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
          />
        </div>
      </div>

     
      <div class="contract-list">
        <div class="contract-item" v-for="contract in filteredContracts" :key="contract.id">
          <div class="contract-name" style="font-size: 14px">{{ contract.fileName }}</div>
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
export default {
  data() {
    return {
      searchQuery: '',
      contracts: [],
      filteredContracts: [],
      selectedFile: null,
    };
  },
  mounted() {
    this.getContracts();
  },
  methods: {
    getContracts() {
      axios.get('/api/getContracts')
        .then(response => {
          const files = response.data.files;
          if (Array.isArray(files)) {
            this.contracts = files.map(file => ({
              fileName: file.fileName,
              id: file.id

            }));
          } else {
            console.error("获取的数据格式不正确：", files);
          }
          this.filteredContracts = this.contracts;
        })
        .catch(error => {
          console.error("获取合同列表失败：", error);
        });
    },
    handleClick() {
      this.$refs.fileInput.click(); // 点击隐藏的文件输入框
    },
    uploadFiles(event) {
      const files = event.target.files;
      if (!files.length) {
        console.log("没有文件，未选中文件");
        return;
      }

      // 遍历所有选择的文件并上传
      Array.from(files).forEach(file => {
        const formData = new FormData();
        formData.append("file", file);

        axios.post('/api/upload1', formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            "Access-Control-Allow-Origin": "*",
          },
        })
          .then((res) => {
            console.log(`文件 ${file.name} 上传成功`);
            // 上传成功后重新获取合同列表
            this.getContracts();
          })
          .catch((error) => {
            console.error(`文件 ${file.name} 上传失败：`, error);
          });
      });
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
  