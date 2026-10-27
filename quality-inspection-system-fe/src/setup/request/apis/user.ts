import request from './main';
import { AJAX_CONFIG } from '@Common/url';


interface TRes { err_code?: number; message?: string; data?: any; [key: string]: any }
interface TReq { [key: string]: any }

export const logout = async (req?: TReq ): Promise<TRes> => {
  const res = await request({
    method: 'get',
    url: AJAX_CONFIG.Logout,
  })
  if (res.status === 200) {
    return res.data
  } else {
    return res
  }
}

export const loginStatus = async (req?: TReq ): Promise<TRes> => {
  const res = await request({
    method: 'get',
    url: AJAX_CONFIG.Login_Status,
  })
  if (res.status === 200) {
    return res.data
  } else {
    return res
  }
}