import '@/assets/css/index.css'

// 全局 axios 拦截器：自动携带登录 token、401 自动跳登录页（需在最早入口加载）
import '@/setup/request/auth-interceptor'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// element 组件注册
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/css/workspace.css'

import App from './App.vue'
import router from './router'

//引入echarts
import * as echarts from 'echarts';


const app = createApp(App)

app.config.globalProperties.$echarts = echarts;

app.use(ElementPlus, { size: 'small', zIndex: 3000 })

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)

app.mount('#app')
