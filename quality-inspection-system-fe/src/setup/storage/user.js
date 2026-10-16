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

