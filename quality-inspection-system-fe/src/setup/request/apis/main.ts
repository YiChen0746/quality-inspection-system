import axios from 'axios';

const request = axios.create({
  baseURL: 'http://127.0.0.1:3000', // 设置基础 URL
  // 其他配置...
});

export default request;