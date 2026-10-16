<script setup lang="ts">
import { RouterView, useRouter, useRoute } from 'vue-router';
import { onMounted, reactive, watch } from 'vue';
import { 
  UserFilled, 
  House, 
  Edit, 
  PieChart, 
  ChatDotRound, 
  View 
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus';
import { getUserInfo, removeUserInfo, setUserInfo } from '@Setup/storage/user.js'
import { logout } from '@Setup/request/index.ts';

const router = useRouter()
const route = useRoute()

const data = reactive({
  currentPathName: '/knowledge_promotion',
  isLogin: false,
  isMaster: false,
})

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
          <div class="user-info">
            <!-- <el-avatar :icon="UserFilled" /> -->
             <img src="./assets/images/tou.png" height="40px;" width="40px">
            <el-link v-if="!data.isLogin" @click="goToLogin" :underline="false" style="color:white;">登录</el-link>
            <el-text v-else class="logout" @click="logoutHandler" style="color:white;">退出</el-text>
          </div>
        </el-header>
        <el-container>
          <el-aside width="160px" >
            <el-menu
            router="true"
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
              <el-menu-item :disabled="!data.isLogin" index="/result_analysis" >
                <el-icon><PieChart /></el-icon>
                <span>合同分析</span>
              </el-menu-item>
              <!-- <el-menu-item :disabled="!data.isLogin || data.isMaster" index="/quality_inspection" >
                <el-icon><document/></el-icon>
                <span>合同模板</span>
              </el-menu-item> -->
              <el-menu-item :disabled="!data.isLogin"  index="/intelligent_Q_A" >
                <el-icon><ChatDotRound /></el-icon>
                <span>法务助手</span>
              </el-menu-item>
              <el-menu-item  :disabled="!data.isLogin"    index="/contract-review" >
                <el-icon><View /></el-icon>
                <span>合同审查</span>
              </el-menu-item>

              <!-- <el-menu-item   :disabled="!data.isLogin"      index="/editword" >
                <el-icon><ChatDotRound /></el-icon>
                <span>在线预览与编辑</span>
              </el-menu-item> -->
            </el-menu>
          </el-aside>
          <el-main>
            <el-scrollbar>
              <router-view v-slot="{ Component }">
                <keep-alive>
                  <component :is="Component" />
                </keep-alive>
              </router-view>
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
    background-image: url("header3.png");
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
  }

  .user-info{
    height: 60px;
    width: 80px;
    /* background-color: #fff; */
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: absolute;
    right: 40px;
    top: 0cap;
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
  /* 侧边栏整体样式 */
.el-aside {
  background-color: #003878ff;
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
}
.el-menu-item.is-active {
  background-color: #004266ff !important;
  color: #fff !important;
  border-left: 3px solid #40b8e8;
}
.el-menu-item:hover:not(.is-disabled) {
  background-color: #004b66;
  color: #fff;
}
.el-menu-item.is-disabled {
  color: #888 !important;
  cursor: not-allowed;
}

.side-nav {
  width: 200px;
  background: #4fc3f7;
  box-shadow: 2px 0 12px rgba(59,130,246,0.06);
  border-right: 1.5px solid #e3e8ee;
  padding-top: 24px;
  z-index: 2;
}
.el-menu-item {
  font-size: 17px;
  color: #17436a;
  font-weight: 700;
  padding: 14px 32px;
  border-radius: 8px 0 0 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(.4,0,.2,1);
  background: transparent;
  letter-spacing: 1px;
}
.el-menu-item:hover, .el-menu-item.is-active {
  background: linear-gradient(90deg, #b3e0fa 0%, #eaf6fd 100%);
  color: #2563eb !important;
  box-shadow: 2px 4px 16px rgba(59,130,246,0.08);
  transform: translateX(4px) scale(1.035);
}
.el-menu-item.is-active {
  font-weight: 800;
  border-left: 4px solid #2563eb;
}
</style>

       