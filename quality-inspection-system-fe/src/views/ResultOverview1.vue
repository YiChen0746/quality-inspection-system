<template>
  <div class="container" style="background-color: #dff9f8; min-height: 100vh; overflow: auto;display: flex;">
    

    <!-- 左侧历史合同列表 -->
    <div  v-if="generatedContracts.length > 0" class="history-list" style="width: 270px; padding: 10px;  overflow-y: auto;margin-top: -230px;margin-right: 0px;padding-right: 50px;">
        <p style="font-size: 18px;color: black; font-weight: bold; margin-bottom: 5px;">历史记录</p>
        <br>
        <ul>
          <li v-for="(contract, index) in generatedContracts" :key="index" @click="selectContract(index)" class="history-item" style="cursor: pointer; padding: 10px; border: 3px solid rgba(95, 158, 160, 0.5);
; margin-bottom: 10px; border-radius: 5px;font-size: 15px; color: black;font-weight: bold; font-family: 'Times New Roman', Times, serif;">
            起草记录{{ index + 1 }}
          </li>
        </ul>
    </div>


    <div class="contract-detail" style="width: 800px;height: 500px;margin-top: -250px;padding: 20px;">

      <div class="header-section" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0;font-size: 20px;color: black;">合同详情</h2>
        <button @click="showModal = true" class="smart-draft-btn" style="background-color: black;color: white; width: 100px;height: 40px;border-radius: 5px;">
          <img src="../assets/images/pen1.png" alt="智能起草" style="width: 15px; height: 15px; margin-right: 5px;">
          智能起草
        </button>
      </div>

      <br>

      <div class="contract-input-section">
        <div class="button">
          点击智能起草按钮生成合同正文
        </div>
        <br>
        <br>
        <div v-if="generatedContract" class="qicao">
          <div aria-label="header1">
             
              <!-- <div class="flex items-center" >
                <el-button type="primary" class="ml-2" style="margin-left: 710px;background-color: black;height: 40px;width: 40px;" @click="refreshContract">
                  <el-icon style="font-size: 20px;"><refresh /></el-icon>
                </el-button>
              </div> -->
              <div class="flex items-center" style="margin-left: 650px;">
                <el-button type="primary" class="ml-2" style="background-color: black; height: 40px; width: 40px;" @click="refreshContract">
                  <el-icon style="font-size: 24px;"><refresh /></el-icon>                 
                </el-button>

                <el-button type="primary" class="ml-2" style="background-color: black; height: 40px; width: 40px;" @click="exportContract">
                  <el-icon style="font-size: 24px;"><download /></el-icon>
                </el-button>
              </div>

              <br>
              
              <div class="mt-4 text-sm">
                <textarea
                v-model="generatedContract"
                class="auto-resize-textarea"
                @input="adjustTextareaHeight"
                ref="generatedTextarea"
                style="height: 900px;"
              ></textarea>
            </div>
          
        </div>   
        </div>
      </div>

      
        
      
    </div>

    
  
    </div>

      <div v-if="showModal" class="modal">
        <div class="modal-content">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h2>智能起草</h2>
            <button @click="showModal = false" class="close-modal">
              <img src="../assets/images/cha.png" alt="关闭" style="width: 20px; height: 20px;">
            </button>
          </div>


          <p>完成表单内容一键生成合同!</p>
          <form @submit.prevent="validateForm">
            <div>
              <label for="contractName">合同名称</label>
              <input type="text" id="contractName" v-model="contract.contractName" placeholder="填写合同名称">
              <p class="error-message" v-if="errors.contractName">名称至少四个字符</p>
            </div>

            <div>
              <label for="partyA">甲方</label>
              <input type="text" id="partyA" v-model="contract.partyA" placeholder="填写合同甲方名称">
              <p class="error-message" v-if="errors.partyA">名称至少二个字符</p>
            </div>

            <div>
              <label for="partyB">乙方</label>
              <input type="text" id="partyB" v-model="contract.partyB" placeholder="填写合同乙方名称">
              <p class="error-message" v-if="errors.partyB">名称至少二个字符</p>
            </div>

            <div>
              <label for="thirdParty">第三方</label>
              <input type="text" id="thirdParty" v-model="contract.thirdParty" placeholder="填写合同第三方，若无则可以不填">
            </div>

            <div>
              <label for="description">合同描述</label>
              <textarea id="contractDescription" v-model="contract.description" placeholder="请填写合同描述"></textarea>
              <p class="error-message" v-if="errors.description">描述至少十个字符</p>
            </div>

            <div>
              <label for="subject">合同主体</label>
              <select id="contractSubject" v-model="contract.subject">
                <option value="">请选择您的合同主体</option>
                <option value="个人">个人</option>
                <option value="公司">公司</option>
              </select>
              <p class="error-message" v-if="errors.subject">请选择您的合同主体</p>
            </div>
            <div style="padding-left: 270px;">
              <br>
              <button type="submit" style="background-color: black;color: white; width: 90px;height: 30px;border-radius: 5px;font-size: 15px">一键生成</button>
            </div>
          </form>
        </div>
    </div>

</template>

<script>
import { ElMessage } from 'element-plus';

export default {
  data() {
    return {
      showModal: false,
      contract: {
        contractName: '',
        partyA: '',
        partyB: '',
        thirdParty: '',
        description: '',
        subject: ''
      },
      errors: {
        contractName: false,
        partyA: false,
        partyB: false,
        description: false,
        subject: false
      },
      generatedContract: '',
      agreementText: '',
      generatedContracts: [],
    };
  },
  methods: {
    async exportContract() {
      if (!this.generatedContract) {
        ElMessage.warning('当前没有可导出的合同内容！');
        return;
      }

      try {
        const response = await fetch('/api/export_contract_docx', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contractContent: this.generatedContract,
            contractName: this.contract.contractName || '合同文档'
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${this.contract.contractName || '合同文档'}.docx`;
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
    selectContract(index) {
      // 从历史记录中选择合同内容来显示
      this.generatedContract = this.generatedContracts[index];
    },
    refreshContract() {
      // 点击刷新按钮时重新生成合同内容
      this.submitForm();
    },
    adjustTextareaHeight(event) {
      const textarea = event.target;
      textarea.style.height = 'auto'; // 重置高度，防止每次增长
      textarea.style.height = `${textarea.scrollHeight}px`; // 根据内容设置高度

  },
    validateForm() {
      this.errors.contractName = this.contract.contractName.length < 4;
      this.errors.partyA = this.contract.partyA.length < 2;
      this.errors.partyB = this.contract.partyB.length < 2;
      this.errors.description = this.contract.description.length < 10;
      this.errors.subject = this.contract.subject === '';

      const hasErrors = Object.values(this.errors).some(error => error);

      if (!hasErrors) {
        this.submitForm();
      }
    },
    async submitForm() {
      try {
        const response = await fetch('/api/generate_contract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contractName: this.contract.contractName,
            partyA: this.contract.partyA,
            partyB: this.contract.partyB,
            thirdParty: this.contract.thirdParty,
            description: this.contract.description,
            subject: this.contract.subject
          })
        });

        console.log("合同生成请求发送成功");

        if (!response.ok) {
          throw new Error(`HTTP 状态码：${response.status} - ${await response.text()}`);
        }

        const data = await response.json();
        console.log(data);
        
        if (data.err_code === 0) {
          this.generatedContract = data.data.contractContent;
          // 保存生成的合同到历史记录中
          this.generatedContracts.push(data.data.contractContent);
          this.showModal = false;
          ElMessage.success('合同生成成功！');
        } else {
          ElMessage.error(data.message || '合同生成失败');
        }
      } catch (error) {
        console.error('合同生成失败:', error);
        ElMessage.error('网络错误，请稍后重试');
      }
    }
  }
};
</script>

<style scoped>
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  font-family: Arial, sans-serif;
  background-color: #f9f9f9;
  width: 400px;
  margin: 50px auto;
  padding: 20px;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

label {
  display: block;
  margin-top: 10px;
}

input,
textarea,
select {
  width: 100%;
  padding: 10px;
  margin-top: 5px;
  margin-bottom: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-size: 14px;
}

.close-modal {
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.button {
  width: 100%;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  background-color: #f5f5f5;
  font-size: 17px;
  color: #333;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  outline: none;
}

.button:hover {
  background-color: #eaeaea;
}

.error-message {
  color: red;
  font-size: 12px;
}

.agreement-container {
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 20px;
  background-color: #f9f9f9;
}

.agreement-input {
  width: 100%;
  height: 200px;
  border: none;
  resize: none;
  background-color: transparent;
  font-size: 14px;
  line-height: 1.5;
}

</style>
