import request from './main';
import { AJAX_CONFIG } from '@Common/url';

interface TReq {}
interface TRes { }

export const getAnalysisReport = async (req: TReq ): Promise<TRes> => {
  const res = await request({
    method: 'post',
    url: AJAX_CONFIG.Report,
    data: req
  })
  if (res.status === 200) {
    return res.data
  } else {
    return res
  }
}