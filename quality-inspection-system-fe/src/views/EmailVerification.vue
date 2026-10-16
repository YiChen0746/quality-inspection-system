<template>
  <div class="email-verification-page">
    <div class="container">
      <h1>邮箱验证</h1>
      <p class="description">
        请输入您收到的验证码以完成注册。验证码已发送至您的邮箱，有效期为10分钟。
      </p>
      
      <div class="form-group">
        <label for="email">邮箱地址</label>
        <input type="email" id="email" v-model="email" readonly>
      </div>
      
      <div class="form-group">
        <label for="verification-code">验证码</label>
        <input type="text" id="verification-code" v-model="code" placeholder="请输入6位验证码">
        <div class="error-text" v-if="codeError">{{ codeError }}</div>
      </div>
      
      <div class="button-group">
        <button id="send-code-btn" @click="sendVerificationCode" :disabled="isCountingDown || sendLoading">
          {{ sendLoading ? '发送中...' : (isCountingDown ? `${countdown}秒后可重发` : '发送验证码') }}
        </button>
        <button id="verify-code-btn" @click="verifyCode" :disabled="verifyLoading">
          {{ verifyLoading ? '验证中...' : '验证' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import axios from 'axios';

const route = useRoute();
const router = useRouter();

const email = ref('');
const code = ref('');
const codeError = ref('');
const countdown = ref(0);
const timer = ref<number | null>(null);
const isCountingDown = ref(false);
const sendLoading = ref(false);
const verifyLoading = ref(false);

// 获取URL参数中的邮箱
onMounted(() => {
  const emailParam = route.query.email as string;
  
  if (emailParam) {
    email.value = emailParam;
    // 自动发送验证码
    sendVerificationCode();
  } else {
    ElMessage.error('缺少邮箱参数');
    router.push('/login');
  }
});

// 开始倒计时
const startCountdown = () => {
  countdown.value = 60;
  isCountingDown.value = true;
  
  timer.value = window.setInterval(() => {
    countdown.value--;
    
    if (countdown.value <= 0) {
      if (timer.value) {
        clearInterval(timer.value);
      }
      isCountingDown.value = false;
    }
  }, 1000);
};

// 发送验证码
const sendVerificationCode = () => {
  if (!email.value) {
    ElMessage.error('缺少邮箱参数');
    return;
  }
  
  sendLoading.value = true;
  
  axios.post('http://127.0.0.1:3000/api/sendCode', { email: email.value })
    .then(response => {
      sendLoading.value = false;
      
      if (response.data.err_code === 0) {
        ElMessage.success('验证码已发送，请查收邮件');
        startCountdown();
      } else {
        ElMessage.error(response.data.message || '发送验证码失败');
      }
    })
    .catch(error => {
      sendLoading.value = false;
      console.error('发送验证码请求失败:', error);
      ElMessage.error('网络错误，请稍后重试');
    });
};

// 验证验证码
const verifyCode = () => {
  if (!code.value) {
    codeError.value = '请输入验证码';
    return;
  } else if (code.value.length !== 6) {
    codeError.value = '请输入6位验证码';
    return;
  } else {
    codeError.value = '';
  }
  
  verifyLoading.value = true;
  
  axios.post('http://127.0.0.1:3000/api/sureCode', {
    email: email.value,
    code: code.value
  })
    .then(response => {
      verifyLoading.value = false;
      
      if (response.data.err_code === 0) {
        ElMessage.success('邮箱验证成功');
        router.push('/login');
      } else if (response.data.err_code === 1) {
        codeError.value = response.data.message || '验证码错误';
      } else {
        ElMessage.error(response.data.message || '验证失败');
      }
    })
    .catch(error => {
      verifyLoading.value = false;
      console.error('验证请求失败:', error);
      ElMessage.error('网络错误，请稍后重试');
    });
};

// 清除定时器
onBeforeUnmount(() => {
  if (timer.value) {
    clearInterval(timer.value);
  }
});
</script>

<style scoped>
.email-verification-page {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  background-color: #ecf0f3;
}

.container {
  width: 500px;
  padding: 40px;
  background-color: #ecf0f3;
  border-radius: 12px;
  box-shadow: 10px 10px 10px #d1d9e6, -10px -10px 10px #f9f9f9;
}

h1 {
  font-size: 28px;
  margin-bottom: 20px;
  color: #181818;
  text-align: center;
}

.description {
  margin-bottom: 30px;
  font-size: 16px;
  line-height: 1.6;
  text-align: center;
  color: #555;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-size: 16px;
  color: #333;
}

input {
  width: 100%;
  height: 40px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background-color: #ecf0f3;
  box-shadow: inset 2px 2px 4px #d1d9e6, inset -2px -2px 4px #f9f9f9;
  font-size: 16px;
  outline: none;
}

input:focus {
  box-shadow: inset 4px 4px 4px #d1d9e6, inset -4px -4px 4px #f9f9f9;
}

.button-group {
  display: flex;
  justify-content: space-between;
}

button {
  flex: 1;
  height: 50px;
  border-radius: 25px;
  margin-top: 10px;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 1px;
  background-color: #4B70E2;
  color: #f9f9f9;
  box-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #f9f9f9;
  border: none;
  outline: none;
  cursor: pointer;
}

button:hover {
  box-shadow: 6px 6px 10px #d1d9e6, -6px -6px 10px #f9f9f9;
  transform: scale(0.985);
  transition: 0.25s;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

#send-code-btn {
  margin-right: 10px;
}

#verify-code-btn {
  margin-left: 10px;
}

.error-text {
  color: #F56C6C;
  font-size: 12px;
  margin-top: 5px;
}
</style> 