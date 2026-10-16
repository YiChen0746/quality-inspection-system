<template>
 
    <div  class="upload-container" style="background-color:#dff9f8;">
      
       
    <!-- 左侧文件列表 -->
     
    <div class="file-list" v-if="files.length > 0">
      <img
        src="../assets/images/back1.png"
        alt="返回"
        class="back-button"
        @click="goBack"
      />
    <h3>历史文件</h3>
    <br />
    <ul>
        <div>
        <li v-for="file in files" :key="file.fileName" @click="openFile(file.fileUrl, file.fileName)">
        <div class="file-item" style="display: flex; align-items: center;">
        <img src="../assets/images/word.png" alt="文件图标" style="width: 20px; height: 20px;" />
            <div class="file-details" style="margin-left: 10px;">
            <p>{{ file.fileName }}</p>
            </div>
            <button @click="deleteFile(file)" style="background: none; border: none; cursor: pointer; display: inline-block;padding-left: 10px">
                        <img src="../assets/images/del3.png" alt="删除" style="width: 22px; height: 22px;">
                </button>
        </div>
        </li>
        </div>
    </ul>

    </div>

  
  
    <div v-if="isEditorVisible"  ref="editorContainer" class="edit"  id="gyy1">
  
      <img
        src="../assets/images/back1.png"
        alt="返回"
        class="back-button"
        @click="goBack"
      />
      
      <div class="edit" :style="{ display: isEditorVisible ? 'block' : 'none' }"></div>

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
        docEditor: null, // 编辑器实例
        appId: '19ebb40e75eaf1346a26711cfda0cabf',     // 应用 ID
        appKey:'Ji5TUe8xFrdpwqGEo6kQ8GMNY07UQIwg' ,     // 应用密钥
        isEditorVisible: false, // 控制编辑器容器的可见性
      };
    },
    // created() {
    //   // 获取文件列表
    //   this.fetchFiles();
    // },
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
        this.isEditorVisible = true;
        this.$nextTick(() => this.loadSpireCloudEditor(this.$refs.editorContainer));
      }
    },
    mounted() {
      // 确保一开始就初始化编辑器
      if (this.fileUrl && this.fileName) {
        this.isEditorVisible = true;
        this.$nextTick(() => this.loadSpireCloudEditor(this.$refs.editorContainer));
      }
    },
  

    methods: {
      
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
    


  
      // 动态加载 SpireCloudEditor SDK

      // loadSpireCloudEditor(editorContainer) {
      //     if (this.sdkLoaded) {
      //       // editorContainer.style.width = "1000px"; // 设置宽度为 800px
      //       // editorContainer.style.height = "700px"; // 设置高度为 600px
      //       // editorContainer.style.display = "block"; // 强制显示
      //       // console.log("目标元素宽度:", editorContainer.offsetWidth);
      //       // console.log("目标元素高度:", editorContainer.offsetHeight);
      //       // console.log("元素 display 属性：", window.getComputedStyle(editorContainer).display);
            
      //       // if (editorContainer && editorContainer.offsetWidth > 0 && editorContainer.offsetHeight > 0) {
      //       //     console.log("SDK 已加载");
      //       //     this.initEditor(editorContainer);
      //       // } else {
      //       //     console.error("目标元素宽高为 0 或不存在，无法初始化编辑器");
      //       //     return;
      //       // }
      //       console.log("SDK 已加载，直接初始化编辑器333");
      //       this.initEditor(editorContainer); // SDK 已加载，直接初始化编辑器
      //     } else {
      //       // 动态加载 SDK 脚本
      //       const script = document.createElement("script");
      //       script.src = "https://api.e-iceblue.cn/web/editors/spireapi/SpireCloudEditor.js";

      //       script.onload = () => {
      //         if (typeof SpireCloudEditor === 'undefined') {
      //           console.error('SDK 加载失败，SpireCloudEditor 未定义');
      //         } else {
      //           this.sdkLoaded = true;
      //           console.log("SDK 加载成功，初始化编辑器");
      //           console.log("目标元素宽度:", editorContainer.offsetWidth);
      //           console.log("目标元素高度:", editorContainer.offsetHeight);
      //           if (editorContainer && editorContainer.offsetWidth > 0 && editorContainer.offsetHeight > 0) {
      //               this.initEditor(editorContainer);  // 加载完成后再初始化
      //           } else {
      //               console.error("目标元素宽高为 0 或不存在，无法初始化编辑器");
      //           }
      //           //this.initEditor(editorContainer); // 加载完成后再初始化
      //         }
      //       };

      //       script.onerror = () => {
      //         console.error("SpireCloudEditor SDK 加载失败");
      //       };

      //       document.head.appendChild(script); // 动态添加 <script> 标签到 <head>
      //     }
      //   },
      loadSpireCloudEditor(editorContainer) {
        // 如果 SDK 已经加载且没有创建编辑器实例
        // 清除容器中的任何子元素
        while (editorContainer.firstChild) {
            editorContainer.removeChild(editorContainer.firstChild);
        }
       
        console.log("编辑器初始化：",editorContainer);
        if (this.sdkLoaded) {
          console.log("SDK 已经加载且没有创建编辑器实例");
          editorContainer.style.width = "1000px";
          editorContainer.style.height = "700px";
          console.log("目标元素宽度:", editorContainer.offsetWidth);
          console.log("目标元素高度:", editorContainer.offsetHeight);
          console.log("初始化编辑器实例");
          
          const configs = {
            fileAttrs: {
              fileInfo: {
                name: this.fileName,
                ext: 'docx',
                primary: String(new Date().getTime()),
              },
              sourceUrl: this.fileUrl,
              canEdit: true,
              canDownload: true,
              canForcesave: true,
            },
            user: {
              primary: "gyy1",
              name: "gyy1",
              canSave: true,
              id:gyy1,
            },
            editorAttrs: {
              editorWidth: "70%",
              editorHeight: "90%",
              platform: "desktop",
              viewLanguage: "zh",
              events: {
                onReady: () => {
                  console.log("编辑器已初始化，加载第一个文件");
                  this.docEditor.loadDocumentFromUrl(this.fileUrl, {
                    onSuccess: () => console.log("文件加载成功"),
                    onError: (error) => console.error("文件加载失败", error),
                  });
                },
                onSave: () => {
                  console.log("文档已保存");
                },
                onError: (error) => {
                  console.error("编辑器错误:", error);
                },
              },
            },
          };

          // 创建编辑器实例，并保存到 this.docEditor
          try {
            this.docEditor = new SpireCloudEditor.OpenApi("gyy1", configs, this.appId, this.appKey);
            console.log("编辑器实例已创建:", this.docEditor);
          } catch (error) {
            console.error("初始化编辑器时发生错误:", error);
          }
        } else if (!this.sdkLoaded) {
          // 如果 SDK 尚未加载，动态加载 SDK 并初始化
          console.log("动态加载 SpireCloudEditor SDK");

          const script = document.createElement("script");
          script.src = "https://api.e-iceblue.cn/web/editors/spireapi/SpireCloudEditor.js";

          script.onload = () => {
            console.log("SDK 加载成功");
            this.sdkLoaded = true;

            // 初始化编辑器
            this.loadSpireCloudEditor(editorContainer);
          };

          script.onerror = () => {
            console.error("SpireCloudEditor SDK 加载失败");
          };

          document.head.appendChild(script);
        }
      },


     


      saveDocument() {
        if (this.docEditor) {
          this.docEditor.save();
        } else {
          console.error("文档编辑器未初始化");
        }
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


  

  .edit {
  width: 100%;   /* 使编辑器占满容器的宽度 */
  height: 900px; /* 设置高度 */
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
  .back-button {
  position: absolute;
  top: 10px;  /* 距离页面顶部 20px */
  left: 20px;    /* 将按钮放在页面最左侧 */
  width:25px;
  height: 25px;
  cursor: pointer;
}

  </style>
  