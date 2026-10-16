// 全局 axios 拦截器：登录态注入与过期处理
// 1) 请求拦截：自动携带 Authorization: Bearer <token>（token 在登录成功后随用户信息一起存入 localStorage）
// 2) 响应拦截：401 时清除本地登录信息并跳回登录页
import axios from 'axios';
import { getUserInfo, removeUserInfo } from '@Setup/storage/user.js';

axios.interceptors.request.use((config) => {
  const token = getUserInfo()?.token;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
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

export {};
