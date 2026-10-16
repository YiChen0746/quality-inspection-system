<template>
  <div class="upload-container" style="background-color:#dff9f8;overflow-y: auto">
    <!-- Position Selection Popup -->
    <div v-if="showPositionPopup" class="position-popup">
      <div class="popup-content">
        <!-- Back Button in Popup -->
        <img
          src="../assets/images/back1.png"
          alt="返回"
          class="popup-back-button"
          @click="closePositionPopup"
        />
        <h3>请选择分析立场</h3>
        <button @click="selectPosition('甲方')">甲方</button>
        <button @click="selectPosition('乙方')">乙方</button>
        <button @click="selectPosition('第三方')">第三方</button>
      </div>
    </div>

    <div
      class="upload-area"
      @dragover.prevent
      @drop.prevent="handleDrop"
      @click="handleClick"
      v-if="!fileUrl"
      accept=".docx,.doc"
    >
      <!-- 图片和文字都在 upload-area 中 -->
      <img
        src="../assets/images/upload.png"
        alt="上传图标"
        class="upload-icon"
        @click="handleClick"
        accept=".docx,.doc"
      />
      <p>拖拽文件或者点击这个区域<br>仅支持 .docx、.doc 文件【最大10MB】</p>
    </div>

    <input
      ref="fileInput"
      type="file"
      @change="handleFileChange"
      style="display: none"
      accept=".docx,.doc"
    />
    <button @click="handleClick" v-if="!fileUrl">上传</button>

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
          <li
            v-for="file in files"
            :key="file.fileName"
            @click="openFile(file.fileUrl, file.fileName)"
          >
            <div class="file-item" style="display: flex; align-items: center;">
              <img
                src="../assets/images/word.png"
                alt="文件图标"
                style="width: 20px; height: 20px;"
              />
              <div class="file-details" style="margin-left: 10px;">
                <p>{{ file.fileName }}</p>
              </div>
              <button
                @click.stop="deleteFile1(file)"
                style="background: none; border: none; cursor: pointer; display: inline-block;padding-right: 60px;padding-left: 10px"
              >
                <img
                  src="../assets/images/del3.png"
                  alt="删除"
                  style="width: 22px; height: 22px;"
                />
              </button>
            </div>
          </li>
        </div>
      </ul>
    </div>

    <div v-show="isEditorVisible" ref="editorContainer" class="edit" id="gyy1" style="margin-left: 200px;">
      <img
        src="../assets/images/back1.png"
        alt="返回"
        class="back-button"
        @click="goBack"
      />
      <div class="editor-and-buttons">
        <textarea id="editor" style="width: 600px;height: 900px;padding-left: 10px;"></textarea>
        <div class="buttons-container">
          <button @click="exportEditedFile" class="export-button" style="margin-left: 20px;background-color: black;color: white;font-size: 13px;width: 130px;height: 40px;">导出分析报告</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 引入 TinyMCE 的 CDN
const tinymceScript = document.createElement('script');
tinymceScript.src = 'https://cdn.tiny.cloud/1/ds2dz33ze2crhi8f98m57skvr0zgg62m8ir8pyp5tewwpod5/tinymce/7/tinymce.min.js';
tinymceScript.src ="https://cdnjs.cloudflare.com/ajax/libs/tinymce/5.10.2/tinymce.min.js"
tinymceScript.referrerPolicy = 'origin';
document.head.appendChild(tinymceScript);
import axios from "axios";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import mammoth from "mammoth";
import { ElLoading } from 'element-plus';
import { ExportBriefDataDocx , getBase64Sync} from '@Common/outword.js'
import { errorMessages } from "vue/compiler-sfc";


export default {
  data() {
    return {
      editorInitialized: false,
      fileUrl: "", // 存储上传后的文件 URL
      fileName: "", // 存储文件名
      sdkLoaded: false, // 用于标记 SDK 是否已加载
      files: [], // 用来存储从后端获取的文件列表
      isEditorVisible: false, // 控制编辑器的显示与隐藏
      editorContent: "", // 富文本编辑器的内容
      analysisPosition: '', // 存储选择的分析立场
      showPositionPopup: false, // 控制分析立场选择弹窗的显示
    };
  },
  mounted() {
   
    // 在组件挂载时检查并打开最后一个文件
    const lastFile = localStorage.getItem('lastFile');
    if (lastFile) {
        const file = JSON.parse(lastFile);
        this.openFile(file); // 调用打开文件的函数
    }

     // 加载 TinyMCE
  this.loadTinyMCE().then(() => {
    // TinyMCE 加载完成
  }).catch(error => {
    console.error("加载 TinyMCE 时发生错误：", error);
  });
},
  created() {
    // 解析 URL 参数
    this.fetchFiles();
    const urlParams = new URLSearchParams(window.location.search);
    const fileUrl = urlParams.get("fileUrl");
    const fileName = urlParams.get("fileName");

    // 如果存在 fileUrl 和 fileName，加载编辑器并打开文件
    if (fileUrl && fileName) {
      this.fileUrl = fileUrl;
      this.fileName = fileName;
      this.isEditorVisible = true;
      this.$nextTick(() => {
        this.initializeEditor();
      });
    }
  },
  externals: {
    tinymce: 'tinymce'
},
loadTinyMCE() {
    return new Promise((resolve, reject) => {
        // 检查 tinymce 是否已经定义
        if (typeof tinymce !== 'undefined') {
            resolve(); // 已经加载
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdn.tiny.cloud/1/ds2dz33ze2crhi8f98m57skvr0zgg62m8ir8pyp5tewwpod5/tinymce/7/tinymce.min.js';
            script.onload = () => resolve(); // 加载完成
            script.onerror = () => reject(new Error('Failed to load TinyMCE')); // 加载失败
            document.head.appendChild(script);
        }
    });
},

  methods: {
   
    loadTinyMCE() {
    return new Promise((resolve, reject) => {
      if (typeof tinymce !== 'undefined') {
        resolve(); // 已经加载
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdn.tiny.cloud/1/ds2dz33ze2crhi8f98m57skvr0zgg62m8ir8pyp5tewwpod5/tinymce/5/tinymce.min.js';
        script.onload = () => resolve(); // 加载完成
        script.onerror = () => reject(new Error('Failed to load TinyMCE')); // 加载失败
        document.head.appendChild(script);
      }
    });
},
    
    deleteFile1(file) {
      if (!file.fileName) {
        console.error("fileName 不存在，无法删除文件");
        return;
      }

      axios
        .delete(`/api/delete`, {
          headers: {
            "Content-Type": "application/json",
          },
          data: {
            fileName: file.fileName, // 传递文件名到后端
          },
        })
        .then(() => {
          console.log(`文件 ${file.fileName} 删除成功`);
          this.fetchFiles(); // 刷新文件列表
        })
        .catch((error) => {
          console.error(`文件 ${file.fileName} 删除失败：`, error);
        });
    },
    goBack() {
    this.isEditorVisible = false; // 隐藏编辑器
    this.fileUrl = ''; // 清除当前文件的 URL
    this.fileName = ''; // 清除当前文件的名称
    this.fetchFiles(); // 刷新文件列表
  },
    handleClick() {
      this.showPositionPopup = true; // 显示分析立场选择弹窗
    },
    closePositionPopup() {
      this.showPositionPopup = false; // 关闭分析立场选择弹窗
    },
    selectPosition(position) {
      this.analysisPosition = position;
      this.showPositionPopup = false;
      this.$refs.fileInput.click();
      console.log("分析立场",this.analysisPosition)
      // this.processAnalysisReport();
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
      axios
        .get("/api/files")
        .then((response) => {
          this.files = response.data.files;
          console.log("获取文件列表成功：", this.files);
        })
        .catch((error) => {
          console.error("获取文件列表失败：", error);
        });
    },
    openFile(fileUrl, fileName) {
      this.fileUrl = fileUrl;
      this.fileName = fileName;
      this.isEditorVisible = true;
      this.$nextTick(() => {
        this.initializeEditor();
      });
    },
uploadFile(file) {
    if (!file) {
        console.log("没有文件，未选中文件");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("analysisPosition", this.analysisPosition);

    const loadingInstance = ElLoading.service({
        text: '报告生成中，预计耗时1分钟，请耐心等待 ...'
    });

    axios.post("/api/upload", formData, {
        headers: {
            "Access-Control-Allow-Origin": "*",
        },
    })
    .then((res) => {
        console.log("上传成功，文件路径为：", res.data.data.filePath);
        
        const wordData = {
            lichang: this.analysisPosition,
            listname: '合同质检报告',
            ...res.data.data
        };

        return ExportBriefDataDocx("/public/uploads/report/module3.docx", wordData);
    })
    .then(() => {
        return this.fetchFiles(); // 更新文件列表
    })
    
   
    .then(() => {
     
        loadingInstance.close(); // 关闭加载动画

        // 这里可以添加判断条件，确保文件成功保存
        console.log("文件保存成功，准备刷新页面...");

        
        // 获取文件列表中的最后一个文件
        if (this.files.length > 0) {
            const lastFile = this.files[this.files.length - 1];
            
            // 将最后一个文件存储在 localStorage 中
            localStorage.setItem('lastFile', JSON.stringify(lastFile));

            // 打开最后一个文件
            this.openFile(lastFile.fileUrl, lastFile.fileName);
        }
        location.reload(); // 刷新页面
        
    })
 
   
    
    .catch((error) => {
        console.error("处理过程中发生错误：", error);
        loadingInstance.close();
    });
},


openFileInEditor(filePath) {
    axios.get(filePath, { responseType: "arraybuffer" })
        .then(docResponse => {
            return mammoth.convertToHtml({ arrayBuffer: docResponse.data });
        })
        .then(result => {
            const editor = tinymce.get("editor");
            if (editor) {
                editor.setContent(result.value);
                this.isEditorVisible = true;
            } else {
                console.error("TinyMCE 编辑器未初始化，无法设置内容。");
            }
        })
        .catch(error => {
            console.error("打开文件时发生错误：", error);
        });
},

initializeEditor() {
  return this.loadTinyMCE().then(() => {
    return new Promise((resolve, reject) => {
      if (tinymce.get("editor")) {
        tinymce.get("editor").remove();
      }
      tinymce.init({
        selector: "#editor",
        height: 700,
        width: 800,
        plugins: [
          "advlist autolink lists link image charmap print preview anchor",
          "searchreplace visualblocks code fullscreen",
          "insertdatetime media table paste code help wordcount",
        ],
        toolbar:
          "undo redo | formatselect | bold italic backcolor | " +
          "alignleft aligncenter alignright alignjustify | " +
          "bullist numlist outdent indent | removeformat | help",
        setup: (editor) => {
          editor.on("init", () => {
            this.loadFileContent(); // 确保在编辑器初始化后加载内容
            resolve(); // 编辑器初始化完成
          });
        },
      });
    });
  }).catch((error) => {
    console.error("加载 TinyMCE 时发生错误：", error);
  });
},

 
    initializeEditor1() {
      this.loadTinyMCE();
      
    return new Promise((resolve, reject) => {
        if (tinymce.get("editor")) {
            tinymce.get("editor").remove();
        }
        tinymce.init({
            selector: "#editor",
            height: 800,
            width: 1200,
            plugins: [
                "advlist autolink lists link image charmap print preview anchor",
                "searchreplace visualblocks code fullscreen",
                "insertdatetime media table paste code help wordcount",
            ],
            toolbar:
                "undo redo | formatselect | bold italic backcolor | " +
                "alignleft aligncenter alignright alignjustify | " +
                "bullist numlist outdent indent | removeformat | help",
            setup: (editor) => {
                editor.on("init", () => {
                    resolve(); // 编辑器初始化完成
                });
            },
        });
    });
  },
    loadFileContent() {
      axios
        .get(this.fileUrl, { responseType: "arraybuffer" })
        .then((response) => {
        mammoth
            .convertToHtml({ arrayBuffer: response.data })
            .then((result) => {
              tinymce.get("editor").setContent(result.value);
            })
            .catch((error) => {
              console.error("文件转换失败：", error);
            });
        })
        .catch((error) => {
          console.error("加载文件失败：", error);
        });
    },

    exportEditedFile() {
      const editorContent = tinymce.get("editor").getContent();
      const templatePath = "blank.docx";

      axios
        .get(templatePath, { responseType: "arraybuffer" })
        .then((response) => {
          const zip = new PizZip(response.data);
          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
          });

          // 将 HTML 内容转换为纯文本
          const plainTextContent = editorContent.replace(/<[^>]+>/g, '');

          // 更新 Word 文档内容 - 将纯文本内容插入到模板中
          doc.setData({ content: plainTextContent });

          try {
            doc.render();
          } catch (error) {
            console.error("导出文件失败：", error);
            return;
          }

          const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(out);
          link.download = `${this.fileName}_edited.docx`;
          link.click();
        })
        .catch((error) => {
          console.error("加载模板文件失败：", error);
        });
    },
  },
};
</script>

<style scoped>
/* 新增弹窗样式 */
.position-popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5); /* 半透明背景 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999; /* 确保弹窗在最上层 */
}

.popup-content {
  background-color: white;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  position: relative; /* 相对定位，以便放置返回按钮 */
}

/* Back Button in Popup */
.popup-back-button {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 25px;
  height: 25px;
  cursor: pointer;
}

.popup-content button {
  margin: 10px;
  padding: 10px 20px;
  cursor: pointer;
}

.popup-content h3 {
  margin-bottom: 20px;
}

.editor-and-buttons {
  display: flex; /* 使编辑器和按钮容器并排显示 */
  align-items: flex-start; /* 使按钮和编辑器顶部对齐 */
}

#editor {
  width: 800px; /* 设置编辑器宽度 */
  height: 600px; /* 设置编辑器高度 */
  margin-right: 20px; /* 编辑器和按钮之间留出一些空隙 */
}

.buttons-container {
  display: flex;
  flex-direction: column; /* 按钮垂直排列 */
  gap: 10px; /* 按钮之间的间隙 */
}

.export-button,
.save-button {
  width: 100px; /* 按钮宽度 */
  padding: 10px; /* 按钮内边距 */
  cursor: pointer;
}

.export-button:hover {
  background-color: #0056b3;
}
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
  top: 10px;  /* 距离页面顶部 10px */
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
    flex-direction: column;
    min-height: 100vh; /* 使用 min-height 而不是 height，确保内容超过视口时不会被限制 */
    overflow-y: auto; /* 当内容超出容器时，允许垂直滚动 */
    padding-bottom: 20px; /* 为按钮留出足够空间 */
}

.id-company-url {
  display: none;
  width: 10px;
  height: 10px;
}

.upload-area {
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
