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
   <div class="file-list" v-if="fileUrl">
    <img
        src="../assets/images/back1.png"
        alt="返回"
        class="back-button"
        @click="goBack"
      />
      <h3>历史文件</h3>
      <br>
      <ul>
        <!-- 遍历文件列表，显示文件名 -->
        <li v-for="file in files" :key="file.fileName" @click="openFile(file.fileUrl)">
          <div class="file-item" style=" display: flex; align-items: center; /* 垂直居中对齐 */">
            <img
              src="../assets/images/word.png"
              alt="文件图标"
              style="width: 20px;height: 20px;"
            />
            <div class="file-details" style="margin-left: 10px; /* 给文字和图片之间留出一点空间 */">
              <p>{{ file.fileName }}</p>
            
            </div>
          </div>
        </li>
      </ul>
    </div>


  <div v-if="fileUrl" class="edit">

    <img
      src="../assets/images/back1.png"
      alt="返回"
      class="back-button"
      @click="goBack"
    />
    
    <div id="div" class="edit"></div>
  </div>
</div>
    

</template>

<script>
import axios from "axios";



export default {
  data() {
    return {
      fileUrl: "", // 存储上传后的文件 URL
      fileName: "", // 存储文件名
      sdkLoaded: false, // 用于标记 SDK 是否已加载
      files: [], // 用来存储从后端获取的文件列表
      docEditor: null, // 编辑器实例
    };
  },
  created() {
    // 获取文件列表
    this.fetchFiles();
  },

  // mounted() {
  //   // 确保页面完全加载后执行操作
  //   this.fetchFiles(); // 获取文件列表
  //   this.loadSpireCloudEditor(); // 加载编辑器
  // },
  methods: {
    
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
    mounted() {
    // 确保页面完全加载后执行操作
    // this.fetchFiles(); // 获取文件列表
    this.loadSpireCloudEditor(); // 加载编辑器
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
      axios.post('http://743c3774.r20.cpolar.top', formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            "Access-Control-Allow-Origin": "*",
          },
        })

        .then((res) => {
          // 返回上传成功后的文件URL
     
          console.log("res.data:", res.data);
          // 去除后端返回的绝对地址前缀，统一走同域相对路径（本地由 Vite 代理，线上由 Nginx 反代）
          this.fileUrl = (res.data.fileUrl || "").replace(/^https?:\/\/[^/]+/, "");
          this.fileName = res.data.fileName;
          
          console.log("fileUrl:", this.fileUrl);  // 检查 fileUrl 是否有效
          
          console.log("fileName:", this.fileName);
          if (this.fileUrl && this.fileName) {
            console.log("开始初始化编辑器");
            this.loadSpireCloudEditor(); // 确保 fileUrl 和 fileName 不为空后再加载 SDK 并初始化编辑器
          } else {
            console.error("fileUrl 或 fileName 为空，请检查上传响应数据");
          }
        })
        .catch((error) => {
          console.error("文件上传失败：", error);
        });

    },

      


    // 动态加载 SpireCloudEditor SDK
    loadSpireCloudEditor() {
      if (this.sdkLoaded) {
        this.initEditor(); // 如果 SDK 已加载，直接初始化编辑器
        console.log("SDK 已加载，直接初始化编辑器111");
        return;
      }

      const script = document.createElement("script");
      script.src = "https://api.e-iceblue.cn/web/editors/spireapi/SpireCloudEditor.js";
      


      // 确保脚本加载完成后执行初始化
      script.onload = () => {
        this.sdkLoaded = true; // 标志 SDK 加载完成
        console.log("SDK 已加载，直接初始化编辑器222");
        this.initEditor(); // 加载完成后初始化编辑器
        console.log("初始化编辑器222完成");
      };

      script.onerror = () => {
        console.error("SpireCloudEditor SDK 加载失败");
      };

      document.head.appendChild(script); // 动态添加 <script> 标签到 <head>
      console.log("动态加载 SpireCloudEditor SDK 完成");
    },


    // 初始化文档编辑器
    initEditor() {
      if (typeof SpireCloudEditor === "undefined") {
          console.error("SpireCloudEditor 未定义，请确保 SDK 已加载");
          return;
      }
    
      // 检查 fileUrl 是否为空
      if (!this.fileUrl) {
          console.error('"sourceUrl" 不能为空！请确保文件上传后有正确的 URL');
          console.log("fileUrl:", this.fileUrl);
          return;
      }

      
    
      const appid = '19ebb40e75eaf1346a26711cfda0cabf';  // 从冰蓝科技获取
      const appkey = 'Ji5TUe8xFrdpwqGEo6kQ8GMNY07UQIwg'; // 从冰蓝科技获取

      // 刷新编辑器容器
      const div = document.getElementById("div");
      div.innerHTML = ""; // 清空容器，确保旧的实例被移除


    

      // 确保 user 属性在 configs 中正确设置
      // 通过定义配置对象（configs）来控制编辑器的行为和文档加载过程
      const configs = {
        //文档的基本信息和用户对该文档的操作权限。
          fileAttrs: {
              fileInfo: {
                  name: this.fileName,
                  ext:  'docx', // 支持 .docx
                  primary: String(new Date().getTime()), // 时间戳
              },
              sourceUrl: this.fileUrl, // 上传后的文件URL
              gyy:console.log("sourceUrl:", this.fileUrl),
              canEdit: true,   //允许编辑文档
              canDownload: true,    //允许下载文档
              canForcesave: true,    //强制保存的权限
          },
          //用户
          user: { 
              primary: "gyy1", // 用户标识
              name: "gyy1",   
              canSave: true,   //当前用户允许保存
          },

          //编辑器的外观和行为，包括语言、尺寸和事件处理等。
          editorAttrs: { 
              editorWidth: "70%",
              editorHeight: "90%",
              platform: "desktop",
              viewLanguage: "zh", // 中文界面
              events: {
                  //编辑器成功加载时触发
                  onReady: function () {
                      // 当编辑器加载完毕后，使用fileUrl下载文件并在编辑器中打开
                      //docEditor 编辑器的实例对象
                      console.log("编辑器成功加载时触发",this.fileUrl);
                      if (this.docEditor && this.fileUrl) {
                        console.log("编辑器加载完成");
                        console.log("fileurl:", this.fileUrl);
                        console.log("文件加载中");

                        //从指定url加载文档
                        this.docEditor.loadDocumentFromUrl(this.fileUrl, {
                          onSuccess: () => {
                            console.log("文件加载成功");
                          },
                          onError: (error) => {
                            console.error("文件加载失败", error);
                          }
                        });
                      } else {
                      console.error("编辑器未初始化或 fileUrl 为空");
                    }
                  },
                  //用户保存文档时触发
                  onSave: function () {
                    console.log("文档已保存");
                  },
                  onError: (error) => {
                    console.log("doceditor:", this.docEditor);
                    console.log("当前时间:", new Date().toISOString());
                    console.log("当前用户配置:", configs.user);
                    console.log("fileurl:", this.fileUrl);
                    console.error("文档加载错误:", error);
                    console.log("错误详细信息:", JSON.stringify(error)); // 将错误信息字符串化，便于查看
                    if (error.data) {
                      console.log("错误数据:", error.data);
                    }
                    if (error.target) {
                      console.log("错误目标:", error.target);
                    }
                    console.log("编辑器加载完成");
                    console.log("fileurl:", this.fileUrl);
                    console.log("文件加载中");
                        
                  },
                },
          },
      };

      // 调试输出，检查 user 对象是否存在
      console.log("当前用户配置:", configs.user);

      // 创建编辑器实例
      console.log("创建编辑器实例1");
      this.docEditor = new SpireCloudEditor.OpenApi("div", configs, appid, appkey);
      console.log("创建编辑器实例2");
      
    },
    saveDocument() {
      if (this.docEditor) {
        this.docEditor.save();
      } else {
        console.error("文档编辑器未初始化");
      }
    },
    getDocumentContent() {
      if (this.docEditor) {
        this.docEditor.getDocumentContent((content) => {
          console.log("文档内容:", content);
        });
      } else {
        console.error("文档编辑器未初始化");
      }
    },
    // 从后端获取文件列表
    fetchFiles() {
      // 1. 使用 axios 发送 POST 请求到指定 URL
      axios.get('')
        .then(response => {
          // 2. 当请求成功时，打印完整的响应数据
          console.log("响应列表:", response);
          
          // 3. 打印响应数据中的文件列表（假设返回的数据中有一个 `files` 字段）
          console.log("文件列表:", response.data.files);
          
          // 4. 将获取到的文件列表存储到 `this.files`，用于页面上的显示或其他操作
          this.files = response.data.files;
        })
        .catch(error => {
          // 5. 捕获请求中的错误信息，并打印错误细节
          if (error.response) {
            // 如果服务器有返回响应，但状态码不是 2xx (成功)
            console.error('获取文件列表失败，状态码:', error.response.status);  // 打印 HTTP 状态码
            console.error('错误信息:', error.response.data);  // 打印响应中的错误消息
          } else {
            // 如果请求没有得到任何响应（例如服务器没有回应或请求发送失败）
            console.error('无法获取文件列表:', error);  // 打印整个错误对象
          }
        });
    }, 



    
    openFile(fileUrl) {
      console.log('打开文件:', fileUrl);
      // 手动清空编辑器区域
      const div = document.getElementById('div');
      if (div) {
        div.innerHTML = "";  // 手动清空容器，移除旧的编辑器实例
      }
      // 重新初始化编辑器，传入新的 fileUrl
      this.initEditor(fileUrl);  // 重新初始化编辑器，并传入新的文档URL
      
      
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



.edit {
  width: 100%;   /* 使编辑器占满容器的宽度 */
  height: 930px; /* 设置高度 */
  background-color:#dff9f8; /* 设置背景颜色 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  margin-right: -190px;
  margin-top: -27px;

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
