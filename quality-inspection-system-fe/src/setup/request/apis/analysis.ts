import request from './main';
import { AJAX_CONFIG } from '@Common/url';

interface TReq {
  page: number;
  pageSize: number;
}
interface TRes { }

export const EAnalysisType  = {
  // 根据地区分析
  Region: 'region',
  // 根据职业分析
  Career: 'career',
  // 根据年龄段分析
  Age: 'age',
  // 根据家族病史分析
  Family : 'family',
  // 根据既往病史分析
  UnderlyingDisease: 'underlying_disease',
  // 根据现病史症状分析
  Symptom: 'symptom',
  // 根据生活习惯变化分析
  Habit: 'Habit',
  // 根据个人史情况分析
  PersonalHistory: 'PersonalHistory',
}

export const getAnalysisByType = async (req: TReq ): Promise<TRes> => {
  const res = await request({
    method: 'post',
    url: AJAX_CONFIG.Analysis_By_Type,
    data: req
  })
  if (res.status === 200) {
    return res.data
  } else {
    return res
  }
}