<template>
  <div class="login-page">
    <div class="main">
      <div class="container a-container" id="a-container">
        <form class="form" id="login_form" @submit.prevent="handleLogin">
          <h2 class="form_title title">登录</h2>
          <input 
            class="form__input" 
            type="text" 
            placeholder="邮箱" 
            name="email" 
            id="login_email" 
            v-model="loginForm.email"
          >
          <input 
            class="form__input" 
            type="password" 
            placeholder="密码" 
            name="password" 
            id="login_password" 
            v-model="loginForm.password"
          >
          <div class="col-sm-offset-2 col-sm-10" style="cursor: pointer;"></div>
          <a class="description forget_text" href="#" @click.prevent>忘记密码? 点我找回~</a>
          <button class="form__button button submit" type="submit" :disabled="loading">
            {{ loading ? '登录中...' : '确定' }}
          </button>
        </form>
      </div>
      
      <div class="container b-container" id="b-container">
        <form class="form" id="register_form" @submit.prevent="handleRegister">
          <h2 class="form_title title">创建账号</h2>
          <input 
            class="form__input" 
            type="text" 
            placeholder="邮箱" 
            name="email" 
            id="register_email"
            v-model="registerForm.email"
          >
          <input 
            class="form__input" 
            type="text" 
            placeholder="单位昵称" 
            name="nickname" 
            id="register_nickname"
            v-model="registerForm.nickname"
          >
          <input 
            class="form__input" 
            type="password" 
            placeholder="密码" 
            name="password" 
            id="register_password"
            v-model="registerForm.password"
          >
          <button class="form__button button submit" type="submit" :disabled="registerLoading">
            {{ registerLoading ? '注册中...' : '确认' }}
          </button>
        </form>
      </div>
      
      <div class="switch" id="switch-cnt" style="background-image: url(/public/img/login2.png);">
        <div class="switch__container" id="switch-c1" :class="{ 'is-hidden': isRegisterMode }" style="color: black;">
          <h2 class="switch__title title">系统介绍</h2>
          <p class="switch__description description">
            "合同文书智能审核系统系统"，一款基于人工智能的法务大模型工具，支持合同审查、起草、纠纷解答等功能，帮助您更快速、更高效地理解和处理各种合同。
          </p>
          <p class="switch__description description" style="color:#00688B;">没有账号？快来注册 ~</p>
          <button class="switch__button button switch-btn" @click="switchToRegister">注册</button>
        </div>
        
        <div class="switch__container" id="switch-c2" :class="{ 'is-hidden': !isRegisterMode }">
          <h2 class="switch__title title">欢迎回来 !</h2>
          <p class="switch__description description">已有账号？切换登录 ~</p>
          <button class="switch__button button switch-btn" @click="switchToLogin">登录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { setUserInfo } from '../setup/storage/user.js'

const router = useRouter()
const loading = ref(false)
const registerLoading = ref(false)
const isRegisterMode = ref(false)

const loginForm = reactive({
  email: '',
  password: ''
})

const registerForm = reactive({
  email: '',
  nickname: '',
  password: ''
})

const handleLogin = async () => {
  if (!loginForm.email || !loginForm.password) {
    ElMessage.warning('请注意信息填写完整！')
    return
  }
  
  loading.value = true
  try {
    const response = await axios.post('http://127.0.0.1:3000/api/login', {
      email: loginForm.email,
      password: loginForm.password
    })
    
    const err_code = response.data.err_code
    if (err_code === 0) {
      ElMessage.success('登录成功，为您跳转主页！')
      setUserInfo(response.data.data)
      // 使用 window.location.href 强制刷新页面状态
      window.location.href = '/knowledge_promotion'
    } else if (err_code === 1) {
      ElMessage.error('密码或者邮箱有误！')
    } else if (err_code === 500) {
      ElMessage.error('服务器忙，请稍后重试！')
    }
  } catch (error) {
    console.error('登录请求失败:', error)
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (!registerForm.email || !registerForm.nickname || !registerForm.password) {
    ElMessage.warning('请注意信息填写完整！')
    return
  }
  
  registerLoading.value = true
  try {
    const response = await axios.post('http://127.0.0.1:3000/api/register', {
      email: registerForm.email,
      nickname: registerForm.nickname,
      password: registerForm.password
    })
    
    const err_code = response.data.err_code
    if (err_code === 0) {
      // 注册成功，跳转到邮箱验证页面
      router.push({
        path: '/email-verification',
        query: { email: response.data.message }
      })
    } else if (err_code === 1) {
      ElMessage.error('邮箱已注册！')
    } else if (err_code === 500) {
      ElMessage.error('服务器忙，请稍后重试！')
    }
  } catch (error) {
    console.error('注册请求失败:', error)
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    registerLoading.value = false
  }
}

const switchToRegister = () => {
  isRegisterMode.value = true
  const aContainer = document.getElementById('a-container')
  const bContainer = document.getElementById('b-container')
  const switchCnt = document.getElementById('switch-cnt')
  
  if (aContainer && bContainer && switchCnt) {
    aContainer.classList.add('is-txl')
    bContainer.classList.add('is-txl')
    bContainer.classList.add('is-z200')
    switchCnt.classList.add('is-txr')
    switchCnt.classList.add('is-gx')
  }
}

const switchToLogin = () => {
  isRegisterMode.value = false
  const aContainer = document.getElementById('a-container')
  const bContainer = document.getElementById('b-container')
  const switchCnt = document.getElementById('switch-cnt')
  
  if (aContainer && bContainer && switchCnt) {
    aContainer.classList.remove('is-txl')
    bContainer.classList.remove('is-txl')
    bContainer.classList.remove('is-z200')
    switchCnt.classList.remove('is-txr')
    switchCnt.classList.remove('is-gx')
  }
}
</script>

<style scoped>
.login-page {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: "Montserrat", sans-serif;
  font-size: 12px;
  background-color: #ecf0f3;
  color: #a0a5a8;
}

*, *::after, *::before {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  user-select: none;
}

.main {
  position: relative;
  width: 1000px;
  min-width: 1000px;
  min-height: 600px;
  height: 600px;
  padding: 25px;
  background-color: #ecf0f3;
  box-shadow: 10px 10px 10px #d1d9e6, -10px -10px 10px #f9f9f9;
  border-radius: 12px;
  overflow: hidden;
}

@media (max-width: 1200px) {
  .main {
    transform: scale(0.7);
  }
}
@media (max-width: 1000px) {
  .main {
    transform: scale(0.6);
  }
}
@media (max-width: 800px) {
  .main {
    transform: scale(0.5);
  }
}
@media (max-width: 600px) {
  .main {
    transform: scale(0.4);
  }
}

.container {
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 0;
  width: 600px;
  height: 100%;
  padding: 25px;
  background-color: #ecf0f3;
  transition: 1.25s;
}

.form {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.form__input {
  width: 350px;
  height: 40px;
  margin: 4px 0;
  padding-left: 25px;
  font-size: 13px;
  letter-spacing: 0.15px;
  border: none;
  outline: none;
  font-family: "Montserrat", sans-serif;
  background-color: #ecf0f3;
  transition: 0.25s ease;
  border-radius: 8px;
  box-shadow: inset 2px 2px 4px #d1d9e6, inset -2px -2px 4px #f9f9f9;
}

.form__input:focus {
  box-shadow: inset 4px 4px 4px #d1d9e6, inset -4px -4px 4px #f9f9f9;
}

.title {
  font-size: 34px;
  font-weight: 700;
  line-height: 3;
  color: #181818;
  margin-bottom: 10%;
}

.description {
  font-size: 14px;
  letter-spacing: 0.25px;
  text-align: center;
  line-height: 1.6;
}

.button {
  width: 180px;
  height: 50px;
  border-radius: 25px;
  margin-top: 50px;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 1.15px;
  background-color: #4B70E2;
  color: #f9f9f9;
  box-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #f9f9f9;
  border: none;
  outline: none;
  cursor: pointer;
}

.button:hover {
  box-shadow: 6px 6px 10px #d1d9e6, -6px -6px 10px #f9f9f9;
  transform: scale(0.985);
  transition: 0.25s;
}

.button:active, .button:focus {
  box-shadow: 2px 2px 6px #d1d9e6, -2px -2px 6px #f9f9f9;
  transform: scale(0.97);
  transition: 0.25s;
}

.a-container {
  z-index: 100;
  left: calc(100% - 600px);
}

.b-container {
  left: calc(100% - 600px);
  z-index: 0;
}

.switch {
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 400px;
  padding: 50px;
  z-index: 200;
  transition: 1.25s;
  background-color: #ecf0f3;
  overflow: hidden;
  box-shadow: 4px 4px 10px #d1d9e6, -4px -4px 10px #f9f9f9;
}

.switch__container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  position: absolute;
  width: 400px;
  padding: 50px 55px;
  transition: 1.25s;
  color: black;
}

.switch__button {
  cursor: pointer;
}

.switch__button:hover {
  box-shadow: 6px 6px 10px #d1d9e6, -6px -6px 10px #f9f9f9;
  transform: scale(0.985);
  transition: 0.25s;
}

.switch__button:active, .switch__button:focus {
  box-shadow: 2px 2px 6px #d1d9e6, -2px -2px 6px #f9f9f9;
  transform: scale(0.97);
  transition: 0.25s;
}

.is-txr {
  left: calc(100% - 400px);
  transition: 1.25s;
  transform-origin: left;
}

.is-txl {
  left: 0;
  transition: 1.25s;
  transform-origin: right;
}

.is-z200 {
  z-index: 200;
  transition: 1.25s;
}

.is-hidden {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  transition: 1.25s;
}

.is-gx {
  animation: is-gx 1.25s;
}

@keyframes is-gx {
  0%, 10%, 100% {
    width: 400px;
  }
  30%, 50% {
    width: 500px;
  }
}

.forget_text {
  color: #999999;
  font-style: inherit;
  margin-top: 20px;
  text-decoration: none;
}

.forget_text:hover {
  text-decoration: underline;
}
</style>