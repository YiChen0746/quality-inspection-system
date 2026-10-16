import request from './main';
import { AJAX_CONFIG } from '@Common/url';


interface TRes {}
interface TReq {}

export const logout = async (req: TReq ): Promise<TRes> => {
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

export const loginStatus = async (req: TReq ): Promise<TRes> => {
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