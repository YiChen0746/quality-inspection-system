<template>

 
  <div  class="upload-container" style="background-color:#dff9f8;">
  <div
    class="upload-area"
    @dragover.prevent
    @drop.prevent="handleDrop"
    @click="handleClick"
    v-if="!fileUrl"
    accept=".docx"
    
  >
    <!-- 图片和文字都在 upload-area 中 -->
    <img
      src="../assets/images/upload.png"
      alt="上传图标"
      class="upload-icon"
      @click="handleClick"
      accept=".docx"
    />
    <p>拖拽文件或者点击这个区域<br>仅支持 .docx 文件【最大10MB】</p>
  </div>

  <input
    ref="fileInput"
    type="file"
    @change="uploadFile"
    style="display: none"
    accept=".docx"
 
    
  />
  <button @click="handleClick" v-if="!fileUrl" >上传</button>

  
   <!-- 左侧文件列表 -->
   <div class="file-list" v-if="files.length > 0">
      <img
      src="../assets/images/back1.png"
      alt="返回"
      class="back-button"
      @click="goBack"
    />
      <h3>历史文件</h3>
      <br>
      <ul>
          <div>
      <li v-for="file in files" :key="file.fileName" @click="openFile(file.fileUrl, file.fileName)">
      <div class="file-item" style="display: flex; align-items: center;">
      <img src="../assets/images/word.png" alt="文件图标" style="width: 20px; height: 20px;" />
          <div class="file-details" style="margin-left: 10px;">
          <p>{{ file.fileName }}</p>
          </div>
          <button @click.stop="deleteFile1(file)" style="background: none; border: none; cursor: pointer; display: inline-block;padding-right: 60px;padding-left: 10px">
                      <img src="../assets/images/del3.png" alt="删除" style="width: 22px; height: 22px;">
              </button>
      </div>
      </li>
      </div>
      </ul>
    </div>


    <div v-show="isEditorVisible"  ref="editorContainer" class="edit"  id="gyy1">


    <img
      src="../assets/images/back1.png"
      alt="返回"
      class="back-button"
      @click="goBack"
    />
    
  </div>
</div>
    

</template>

<script>
import axios from "axios";




export default {
  data() {
    return {
      editorInitialized: false,
      fileUrl: "", // 存储上传后的文件 URL
      fileName: "", // 存储文件名
      sdkLoaded: false, // 用于标记 SDK 是否已加载
      files: [], // 用来存储从后端获取的文件列表
    };
  },
  created() {
    // 解析 URL 参数
    this.fetchFiles();
    const urlParams = new URLSearchParams(window.location.search);
    const fileUrl = urlParams.get('fileUrl');
    const fileName = urlParams.get('fileName');

    // 如果存在 fileUrl 和 fileName，加载编辑器并打开文件
    if (fileUrl && fileName) {
      this.fileUrl = fileUrl;
      this.fileName = fileName;
    }
  },
 
  methods: {
  //   deleteFile(file) {
  //         console.log(file.fileName);
  //         console.log(file.fileUrl);
  //         if (confirm(`确定要删除文件 ${file.fileName} 吗？`)) {
  //             axios.post('/api/delete', {
  //                 fileName: file.fileName, // 发送文件名到后端
  //                 fileUrl: file.fileUrl, // 发送文件路径到后端
  //             })
  //             .then(response => {
  //                 console.log('文件删除成功:', response.data);
  //                 this.fetchFiles(); // 刷新文件列表
  //             },{
  //                 timeout: 10000 // 设置超时时间为 10 秒
  //             })
  //             .catch(error => {
  //                 console.error('文件删除失败1111:', error);
  //             });
  //         }
  //     },


  deleteFile1(file) {
    if (!file.fileName) {
      console.error('fileName 不存在，无法删除文件');
      return;
    }

    axios.delete(`/api/delete`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        fileName: file.fileName // 传递文件名到后端
      }
    })
      .then(() => {
        console.log(`文件 ${file.fileName} 删除成功`);
        // 删除成功后重新获取合同列表
        this.fetchFiles(); // 刷新文件列表
      })
      .catch(error => {
        console.error(`文件 ${file.fileName} 删除失败：`, error);
      });
  },


    goBack() {
      // 使用 window.location.href 返回指定地址
      window.location.href = "/upload";  
    },
    handleClick() {
      this.$refs.fileInput.click();
    },
    handleFileChange(event) {
      const file = event.target.files[0];
      this.uploadFile(file);
    },
     handleDrop(event) {
      const file = event.dataTransfer.files[0];
      this.uploadFile(file);
    },
    fetchFiles() {
      axios.get('/api/files')
          .then(response => {
          this.files = response.data.files;
          })
          .catch(error => {
          console.error("获取文件列表失败：", error);
          });
  },


    openFile(fileUrl, fileName) {

      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('fileUrl', fileUrl);
      currentUrl.searchParams.set('fileName', fileName);
      window.location.href = currentUrl.toString();
    },


    
    // 上传文件
    uploadFile(event) {
      //files[0] 表示用户选择的第一个文件（因为用户可能一次选择多个文件，files 是一个数组）。
      const file = event.target.files[0];
      if (!file){
        console.log("没有文件，未选中文件");
        return;
      }
      const formData = new FormData();
      //将文件添加到formData对象中
      formData.append("file", file);

      // 上传到后端
      //通过 axios 将前端的文件发送到后端的 /api/upload 路由
      // /api/upload 是后端文件上传的 API 地址，这个 API 用来接收文件并处理文件上传的逻辑。、
      //formData是要上传的数据
      console.log("开始post请求");
      axios.post('/api/upload', formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            "Access-Control-Allow-Origin": "*",
          },
        })

        .then((res) => {
          // 返回上传成功后的文件URL
     
          console.log("res.data:", res.data);
          this.fileUrl = res.data.fileUrl;
          this.fileName = res.data.fileName;
          
          console.log("fileUrl:", this.fileUrl);  // 检查 fileUrl 是否有效
          
          console.log("fileName:", this.fileName);
           // 上传成功后，刷新文件列表
          this.fetchFiles();
  
        })
        .catch((error) => {
          console.error("文件上传失败：", error);
        });

    },

   
  },
};



</script>



<style scoped>
.file-list {
  width: 280px;
  height: 100vh;
  padding: 20px;
  border-right: 1px solid #ddd;
  position: absolute; /* 绝对定位 */
  left: 0; /* 固定在页面左侧 */
  top: 0; /* 固定在页面顶部 */
  height: 880px; /* 设置高度为视口高度，确保列表贯穿整个页面 */
  overflow-y: auto; /* 启用垂直滚动条 */
  box-sizing: border-box; /* 确保 padding 不会影响元素高度 */
  
}

.file-list ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.file-list li {
  cursor: pointer;
  padding: 10px;
  border: 1px solid #ddd;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  border-radius: 5px;
  transition: background-color 0.2s;
  box-sizing: border-box; /* 确保 padding 和 border 不会导致超出父容器的尺寸 */

}

.file-list li:hover {
  background-color: #f0f0f0;
}

.file-icon {
  margin-right: 10px;
  font-size: 20px;
}

.file-details {
  display: flex;
  flex-direction: column;
}
.back-button {
  position: absolute;
  top: 10px;  /* 距离页面顶部 20px */
  left: 20px;    /* 将按钮放在页面最左侧 */
  width:25px;
  height: 25px;
  cursor: pointer;
}




.container {
  padding: 20px;
  position: relative; /* 确保父容器相对定位 */
}

.upload-container {
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh; /* 使其充满整个页面的高度 */
  flex-direction: column;
}
.id-company-url {
  display: none;
  width: 10px;
  height: 10px;
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

button {
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
.upload-area:hover {
    transform: scale(1.05); /* 鼠标悬停时放大效果 */
    border-color: #64967d; /* 悬停时改变边框颜色 */
}
p {
    margin: 5px 0; /* 调整段落之间的间距 */
    font-family: Arial, sans-serif; /* 设置字体 */
    font-size: 14px; /* 设置字体大小 */
    color: #333; /* 设置文字颜色 */
}
#div {
  resize: both; /* 允许水平和垂直方向调整大小 */
  overflow: auto; /* 防止内容溢出 */
  border: 2px solid #ccc; /* 给编辑器加一个边框方便用户操作 */
  padding: 10px;
  width: 100%;
  height: 900px;
  max-width: 100%;  /* 防止超出屏幕宽度 */
  max-height: 100vh;  /* 防止超出屏幕高度 */
}
</style>
