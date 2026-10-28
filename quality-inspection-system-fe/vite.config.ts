import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 本地开发/预览时，把后端接口与静态资源转发到本机 Node 服务。
// 线上不需要这段配置：Nginx 会把同样的路径反代到后端，前端代码统一走相对路径。
const backendProxy = {
  '/api': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
  },
  '/public': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  server: {
    // 监听所有网卡：答辩现场用手机或同网段电脑访问 http://<本机IP>:5173
    host: true,
    proxy: backendProxy,
  },
  preview: {
    host: true,
    proxy: backendProxy,
  },
  build: {
    rollupOptions: {
      output: {
        // 把体积最大的公共依赖拆成独立 chunk，避免首屏加载单个 2MB 文件
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-ui': ['element-plus', '@element-plus/icons-vue'],
          'vendor-charts': ['echarts'],
          'vendor-doc': ['docx-preview', 'docxtemplater']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@Common': fileURLToPath(new URL('./src/common', import.meta.url)),
      '@Components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@Router': fileURLToPath(new URL('./src/router', import.meta.url)),
      '@Setup': fileURLToPath(new URL('./src/setup', import.meta.url)),
      '@Stores': fileURLToPath(new URL('./src/stores', import.meta.url)),
      '@Views': fileURLToPath(new URL('./src/views', import.meta.url)),
    }
  }
})
