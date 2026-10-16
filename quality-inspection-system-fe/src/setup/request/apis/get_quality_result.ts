import request from './main';
import { AJAX_CONFIG } from '@Common/url';

interface TRes {}
interface TReq {}

export const getQualityResult = async (req: TReq ): Promise<TRes> => {
  const res = await request({
    method: 'post',
    url: AJAX_CONFIG.Get_Quality_Result,
    data: req
  })
  if (res.status === 200) {
    return res.data
  } else {
    return res
  }
}

export const getQualityListResult = async (req: TReq ): Promise<TRes> => {
  const res = await request({
    method: 'post',
    url: AJAX_CONFIG.Get_Quality_List_Result,
    data: req
  })
  if (res.status === 200) {
    return res.data
  } else {
    return res
  }
}
export const getQualityjpgResult = async (req: TReq ): Promise<TRes> => {
  const res = await request({
    method: 'post',
    url: AJAX_CONFIG.Get_Quality_jpg_Result,
    data: req
  })
  if (res.status === 200) {
    return res.data
  } else {
    return res
  }
}

