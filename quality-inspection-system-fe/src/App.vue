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
  Cpu,
  Menu,
  Close,
  DocumentChecked
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus';
import { getUserInfo, removeUserInfo, setUserInfo } from '@Setup/storage/user.js'
import { logout } from '@Setup/request/index.ts';
import AssistantWidget from '@/components/AssistantWidget.vue'

const router = useRouter()
const route = useRoute()
const navOpen = ref(false)
const isStandalone = computed(() => ['/login', '/email-verification'].includes(route.path))
const pageName = computed(() => ({
  '/knowledge_promotion': '首页',
  '/contract-draft': '合同起草',
  '/contract-review': '合同审查',
  '/multi-agent': '深度审查',
  '/intelligent_Q_A': '法务助手',
  '/result_analysis': '合同分析',
  '/quality_inspection': '合同模板',
  '/editword': '文档编辑',
  '/login': '账号登录',
  '/email-verification': '邮箱验证'
}[route.path] || '工作台'))

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
  navOpen.value = false
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
  <div class="app-shell" @keydown.esc="navOpen = false" :class="{ 'app-home': isHome, 'app-workspace': !isHome && !isStandalone }">
    <div class="common-layout" >
      <el-container>
        <el-header height="72px" class="app-topbar">
          <div class="header-left">
            <button v-if="!isHome && !isStandalone" class="nav-toggle" :aria-expanded="navOpen" aria-controls="workspace-navigation" aria-label="打开或关闭功能菜单" @click="navOpen = !navOpen">
              <el-icon><Close v-if="navOpen" /><Menu v-else /></el-icon>
            </button>
            <router-link to="/knowledge_promotion" class="brand" aria-label="约法三章 首页">
              <span class="brand-mark"><el-icon><DocumentChecked /></el-icon></span>
              <span class="brand-copy"><strong>约法三章</strong><small>多智驱动合同助手</small></span>
            </router-link>
            <span class="header-divider"></span>
            <span class="current-page">{{ pageName }}</span>
          </div>
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
              <el-link v-if="!data.isLogin" @click="goToLogin" :underline="false" >登录</el-link>
              <el-text v-else class="logout" @click="logoutHandler" >退出</el-text>
            </div>
          </div>
        </el-header>
        <el-container class="workspace-body">
          <button v-if="navOpen && !isHome && !isStandalone" class="nav-backdrop" aria-label="关闭功能菜单" @click="navOpen = false"></button>
          <el-aside id="workspace-navigation" width="224px" v-show="!isHome && !isStandalone" :class="{ 'is-open': navOpen }">
            <div class="nav-caption">合同工作台</div>
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
            <div class="nav-footer"><span class="nav-footer-dot"></span><span>{{ data.isLogin ? '从起草到审查，一站完成' : '登录后使用完整功能' }}</span></div>
          </el-aside>
          <el-main>
            <el-scrollbar>
              <div class="page-zoom" :style="{ zoom: fontScale, '--content-scale': fontScale }">
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
    <AssistantWidget />
  </div>

  
</template>

<style scoped>
.common-layout { width: 100%; height: 100dvh; overflow: hidden; background: #f4f7fb; }
.common-layout > .el-container { height: 100%; }
.app-topbar { position: relative; z-index: 30; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; padding: 0 28px; background: #fff; border-bottom: 1px solid #e3e9f1; }
.header-left, .header-right, .brand, .user-info { display: flex; align-items: center; }
.header-left { gap: 24px; min-width: 0; }
.brand { gap: 11px; color: #17355b; flex-shrink: 0; }
.brand-mark { width: 40px; height: 42px; border-radius: 12px; display: grid; place-items: center; font-size: 24px; color: #fff; background: #164c70; }
.brand-copy { display: flex; flex-direction: column; gap: 2px; }
.brand-copy strong { font-size: 20px; letter-spacing: 2px; line-height: 1.3; }
.brand-copy small { font-size: 11px; font-weight: 400; color: #718196; letter-spacing: 1px; }
.header-divider { height: 24px; width: 1px; background: #e1e7ef; }
.current-page { font-size: 14px; color: #64748b; white-space: nowrap; }
.header-right { gap: 24px; flex-shrink: 0; }
.user-info { gap: 10px; font-size: 14px; }
.user-info img { width: 34px; height: 34px; border-radius: 50%; }
.user-info .el-link, .logout { color: #244866; font-weight: 600; cursor: pointer; }
.font-ctrl { display: flex; gap: 2px; padding: 3px; border: 1px solid #e3e9f1; border-radius: 9px; background: #f8fafc; }
.font-btn { background: transparent; color: #5b6b80; border-radius: 6px; padding: 5px 9px; font-size: 13px; line-height: 1.4; }
.font-btn:hover { background: #e6edf5; color: #163d63; }
.font-btn-reset { font-weight: 700; }
.workspace-body { min-height: 0; min-width: 0; flex: 1; position: relative; }
.el-aside { display: flex; flex-direction: column; background: #102d4b; border-right: 1px solid #183c5d; flex-shrink: 0; }
.nav-caption { padding: 28px 24px 16px; color: #9bb4cb; font-size: 11px; letter-spacing: 2px; }
.el-menu { background: transparent; border: 0; padding: 0 12px; flex: 1; overflow-y: auto; }
.el-menu-item { color: #d1deec; font-size: 14px; font-weight: 500; padding: 0 14px !important; margin: 0 0 6px; height: 52px; border-radius: 9px; border: 1px solid transparent; transition: background .2s; }
.el-menu-item .el-icon { margin-right: 12px; font-size: 19px; }
.el-menu-item:hover:not(.is-disabled) { color: #fff; background: #1b405f; }
.el-menu-item.is-active { background: #1d526e; border-color: #2e6a81; color: #fff; }
.el-menu-item.is-disabled { opacity: .65; color: #b6c6d6; }
.el-menu-item.menu-item--two-line { height: 66px; line-height: 1.4; }
.menu-label { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.menu-label-main { font-size: 14px; white-space: nowrap; }
.menu-sub { font-size: 11px; font-weight: 400; color: #9ebacd; }
.nav-footer { padding: 20px 18px; display: flex; align-items: center; gap: 8px; font-size: 11px; color: #9bb4cb; border-top: 1px solid #24415a; }
.nav-footer-dot { width: 6px; height: 6px; flex-shrink: 0; border-radius: 50%; background: #50c1bb; }
.el-main { min-width: 0; padding: 0; overflow: hidden; }
.el-main > .el-scrollbar { height: 100%; }
.page-zoom { min-height: 100%; }
.nav-toggle { display: none; padding: 9px; border-radius: 8px; background: #edf2f7; color: #244866; font-size: 20px; }
.nav-backdrop { display: none; }
button:focus-visible, .brand:focus-visible { outline: 3px solid #46b4c1; outline-offset: 3px; }
@media (max-width: 760px) {
  .app-topbar { padding: 0 16px; }
  .header-left { gap: 12px; }
  .header-right { gap: 12px; }
  .header-divider, .current-page, .brand-copy small { display: none; }
  .brand-copy strong { font-size: 17px; letter-spacing: 1px; }
  .brand-mark { width: 32px; height: 34px; font-size: 21px; border-radius: 9px; }
  .user-info img { display: none; }
  .nav-toggle { display: flex; }
  .el-aside { position: absolute; inset: 0 auto 0 0; z-index: 25; visibility: hidden; transform: translateX(-100%); transition: transform .2s ease; box-shadow: 8px 0 30px #102d4b22; }
  .el-aside.is-open { visibility: visible; transform: translateX(0); }
  .nav-backdrop { display: block; position: absolute; inset: 0; z-index: 24; background: #102d4b66; }
}
@media (max-width: 440px) {
  .app-topbar { padding: 0 10px; }
  .header-left, .header-right { gap: 8px; }
  .brand { gap: 7px; }
  .font-btn { padding: 4px 6px; }
}
</style>
