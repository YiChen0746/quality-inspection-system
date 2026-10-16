import axios from 'axios';
import { getUserInfo, removeUserInfo } from '@Setup/storage/user.js';

// 后端接口地址：
// 默认空串表示使用相对路径——本地开发由 Vite 的 server.proxy 转发，
// 线上由 Nginx 将 /api 反向代理到 Node 服务，因此无需再写死 IP。
const baseURL = import.meta.env.VITE_API_BASE || '';

const request = axios.create({
  baseURL, // 设置基础 URL
  // 其他配置...
});

// 与全局拦截器（auth-interceptor.ts）保持一致：自动携带 token、401 跳登录
request.interceptors.request.use((config) => {
  const token = getUserInfo()?.token;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      removeUserInfo();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default request;