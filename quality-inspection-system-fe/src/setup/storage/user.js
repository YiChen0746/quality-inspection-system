import { CacheKey } from "@Common/cache.ts"

export const getUserInfo = () => {
  const userInfo = localStorage.getItem(CacheKey.UserInfo)
  if(!userInfo) return ''
  return JSON.parse(userInfo)
}

export const setUserInfo = (user) => {
  localStorage.setItem(CacheKey.UserInfo, JSON.stringify(user))
}

export const removeUserInfo = () => {
  return localStorage.removeItem(CacheKey.UserInfo)
}

// 获取携带 JWT 的请求头：原生 fetch 调后端接口时使用
// （axios 链路走全局拦截器自动带 token，无需使用本方法）
export const getAuthHeaders = () => {
  const token = getUserInfo()?.token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

