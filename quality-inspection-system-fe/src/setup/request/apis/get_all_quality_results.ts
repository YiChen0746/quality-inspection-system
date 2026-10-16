import request from './main';
import { AJAX_CONFIG } from '@Common/url';

interface TReq {
  page: number;
  pageSize: number;
}
interface TRes {}

export const getAllQualityResult = async (req: TReq ): Promise<TRes> => {
  const res = await request({
    method: 'post',
    url: AJAX_CONFIG.Get_All_Quality_Result,
    data: req
  })
  if (res.status === 200) {
    return res.data
  } else {
    return res
  }
}

export const getHospitalList = async (): Promise<TRes> => {
  const res = await request({
    method: 'get',
    url: AJAX_CONFIG.Hospital_List,
  })
  if (res.status === 200) {
    return res.data
  } else {
    return res
  }
}