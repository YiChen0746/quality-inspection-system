<script setup lang="ts">
import { RouterView, useRouter, useRoute } from 'vue-router';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { 
  UserFilled, 
  House, 
  Edit, 
  PieChart, 
  ChatDotRound, 
  View,
  Cpu
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus';
import { getUserInfo, removeUserInfo, setUserInfo } from '@Setup/storage/user.js'
import { logout } from '@Setup/request/index.ts';

const router = useRouter()
const route = useRoute()

// 页面文字大小调节：通过 zoom 缩放主内容区，偏好持久化到 localStorage
const FONT_SCALE_KEY = 'qis-font-scale'
const fontScale = ref(1)
const applyFontScale = (value: number) => {
  // 限制在 0.85 ~ 1.3 之间，避免缩放过界影响阅读
  const v = Math.min(1.3, Math.max(0.85, Math.round(value * 100) / 100))
  fontScale.value = v
  localStorage.setItem(FONT_SCALE_KEY, String(v))
}
const changeFontScale = (delta: number) => applyFontScale(fontScale.value + delta)
const resetFontScale = () => applyFontScale(1)

const data = reactive({
  currentPathName: '/knowledge_promotion',
  isLogin: false,
  isMaster: false,
})

// 首页为门面展示页：隐藏左侧功能菜单，点击"立即体验"进入内页后再显示
const isHome = computed(() => data.currentPathName === '/knowledge_promotion')

// 监听路由变化，更新菜单激活状态
watch(() => route.path, (newPath) => {
  data.currentPathName = newPath
}, { immediate: true })

onMounted(async () => {
  const pathname = window.location.pathname      //window.location.pathname 获取当前页面的路径名，并将其存储在 data.currentPathName 中
  if (pathname) {          
    data.currentPathName = pathname
  }
  
  const userInfo = getUserInfo()
  console.log('debug userInfo', userInfo)
  console.log('data.isLogin', data.isLogin)    //false
  if(userInfo){
    data.isLogin = true
    data.isMaster = userInfo.nickname === 'master'
  }
  console.log('debug onMounted', data.isMaster)

  // 恢复用户上次设置的文字大小
  const savedScale = parseFloat(localStorage.getItem(FONT_SCALE_KEY) || '1')
  applyFontScale(Number.isNaN(savedScale) ? 1 : savedScale)
})

const goToLogin = () => {
  router.push('/login')
}

const logoutHandler = async () => {
  console.log('准备退出了');
  try {
    const result = await logout();
    console.log('await logout', result);
    
    if (result?.err_code === 0) {
      removeUserInfo();
      data.isLogin = false;
      ElMessage({ message: '退出成功！', type: 'success' });
      // 退出后回到首页，避免停留在需要登录的页面
      router.push('/knowledge_promotion');
    } else {
      ElMessage.error('网络出错啦！请稍后再试 ~');
    }
  } catch (error) {
    console.error('Logout 请求失败:', error);
    ElMessage.error('网络出错啦！请稍后再试 ~');
  }
}

</script>

<template>
  <header >
    <div class="common-layout" >
      <el-container>
        <el-header height="60px" >
          <!-- <h1 class="main-title">乳腺癌筛查的质检系统</h1> -->
          <div class="header-right">
            <!-- 文字大小调节 -->
            <div class="font-ctrl">
              <button class="font-btn" @click="changeFontScale(-0.05)" title="减小字号">A⁻</button>
              <button class="font-btn font-btn-reset" @click="resetFontScale" title="恢复默认字号">A</button>
              <button class="font-btn" @click="changeFontScale(0.05)" title="增大字号">A⁺</button>
            </div>
            <div class="user-info">
              <!-- <el-avatar :icon="UserFilled" /> -->
               <img src="./assets/images/tou.png" height="40px;" width="40px">
              <el-link v-if="!data.isLogin" @click="goToLogin" :underline="false" style="color:white;">登录</el-link>
              <el-text v-else class="logout" @click="logoutHandler" style="color:white;">退出</el-text>
            </div>
          </div>
        </el-header>
        <el-container>
          <el-aside width="160px" v-show="!isHome" >
            <el-menu
            :router="true"
            :default-active="data.currentPathName"
            class="el-menu"
            
            >
              <el-menu-item index="/knowledge_promotion" >
                <el-icon><House /></el-icon>
                <span >首页</span>
              </el-menu-item>
              <el-menu-item :disabled="!data.isLogin" index="/contract-draft">
                <el-icon><Edit /></el-icon>
                <span>合同起草</span>
              </el-menu-item>
              <!-- <el-menu-item :disabled="!data.isLogin || data.isMaster" index="/quality_inspection" >
                <el-icon><document/></el-icon>
                <span>合同模板</span>
              </el-menu-item> -->
              <el-menu-item :disabled="!data.isLogin"  index="/intelligent_Q_A" >
                <el-icon><ChatDotRound /></el-icon>
                <span>法务助手</span>
              </el-menu-item>
              <el-menu-item  :disabled="!data.isLogin"    index="/contract-review" class="menu-item--two-line" >
                <el-icon><View /></el-icon>
                <span class="menu-label">
                  <span class="menu-label-main">合同审查</span>
                  <span class="menu-sub">快速初筛</span>
                </span>
              </el-menu-item>
              <el-menu-item  :disabled="!data.isLogin"    index="/multi-agent" class="menu-item--two-line" >
                <el-icon><Cpu /></el-icon>
                <span class="menu-label">
                  <span class="menu-label-main">多智能体审查</span>
                  <span class="menu-sub">深度审查</span>
                </span>
              </el-menu-item>
              <el-menu-item :disabled="!data.isLogin" index="/result_analysis" >
                <el-icon><PieChart /></el-icon>
                <span>合同分析</span>
              </el-menu-item>

              <!-- <el-menu-item   :disabled="!data.isLogin"      index="/editword" >
                <el-icon><ChatDotRound /></el-icon>
                <span>在线预览与编辑</span>
              </el-menu-item> -->
            </el-menu>
          </el-aside>
          <el-main>
            <el-scrollbar>
              <div class="page-zoom" :style="{ zoom: fontScale }">
                <router-view v-slot="{ Component }">
                  <keep-alive>
                    <component :is="Component" />
                  </keep-alive>
                </router-view>
              </div>
            </el-scrollbar>
          </el-main>
        </el-container>
      </el-container>
    </div>
  </header>

  
</template>

<style scoped>
  .common-layout{
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .el-header{
    padding: 0;
    font-size: 30px;
    font-weight: 700;
    text-align: center;
    line-height: 60px;
    /* background-image: url("./assets/images/header-bg.jpg"); */
    background-image: url("@/assets/header3.png");
    background-size: 100% 700%;
  }

  .el-container{
    width: 100%;
    height: 100%;
  }

  .el-menu{
    height: 100%;
    padding-top: 20%;
  }

  .el-main{
    padding: 0;
    /* 明确高度，保证内部 el-scrollbar 总能正确计算滚动区域 */
    height: calc(100vh - 60px);
    overflow: hidden;
  }

  .header-right{
    position: absolute;
    right: 40px;
    top: 0;
    height: 60px;
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .user-info{
    height: 60px;
    width: 80px;
    /* background-color: #fff; */
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .font-ctrl{
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .font-btn{
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.45);
    border-radius: 6px;
    padding: 3px 9px;
    font-size: 14px;
    line-height: 1.4;
    cursor: pointer;
    transition: background 0.2s ease;
  }
  .font-btn:hover{
    background: rgba(255, 255, 255, 0.32);
  }
  .font-btn-reset{
    font-weight: 700;
  }
  .page-zoom{
    min-height: 100%;
  }
  .main-title{
    margin: 16px 0;
    word-wrap: break-word;
    font-size: 24px;
    line-height: 1.22;
    color: #000000;
  }
  .logout:hover{
    cursor: pointer;
  }
  /* 侧边栏整体样式（统一深蓝主色系） */
.el-aside {
  background-color: var(--brand-primary);
  box-shadow: 2px 0 8px rgba(14, 43, 87, 0.25);
}
.el-menu {
  background-color: transparent;
  border-right: none;
}
.el-menu-item {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
  padding: 14px 28px;
  border-radius: 8px 0 0 8px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.22s ease;
  letter-spacing: 1px;
}
.el-menu-item:hover:not(.is-disabled) {
  background-color: var(--brand-primary-dark);
  color: #fff;
}
.el-menu-item.is-active {
  background-color: var(--brand-primary-dark) !important;
  color: #fff !important;
  border-left: 4px solid var(--brand-accent);
  font-weight: 700;
}
.el-menu-item.is-disabled {
  color: rgba(255, 255, 255, 0.35) !important;
  cursor: not-allowed;
}
/* 两行菜单：主标题 + 副标题，避免侧边栏宽度不足导致文字被截断 */
.el-menu-item.menu-item--two-line {
  height: auto;
  min-height: 62px;
  line-height: 1.35;
  padding-top: 9px;
  padding-bottom: 9px;
}
.menu-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.menu-label-main {
  font-size: 15px;
  letter-spacing: 0;
  white-space: nowrap;
}
.menu-sub {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.62);
}
</style>

       