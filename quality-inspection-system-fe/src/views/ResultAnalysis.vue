<script setup lang="ts">
import { reactive , onMounted, onActivated} from 'vue';
import { ElMessage, ElLoading } from 'element-plus';
import Echarts from '@/components/ReEcharts/index.vue';
import { getUserInfo } from '@Setup/storage/user.js'
import { getAnalysisReport, getHospitalList, getAnalysisByType, EAnalysisType } from '@Setup/request/index.ts';
import { ExportBriefDataDocx , getBase64Sync} from '@Common/outword.js'
import html2canvas from "html2canvas"
const data = reactive({
  hospitalList: [],
  default: '',
  isMaster: true,
})

const optionRegion = reactive({
  isLoading: true,
  data: {
    title: {
      text: '根据不同地区的分析',
      subtext: '2020~2024 年',
      left: 'center'
    },
    tooltip: {
      trigger: 'item'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '地区',
        type: 'pie',
        radius: '50%',
        data: [],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }
});

const optionCareer = reactive(
  {
    isLoading: true,
    data: {
      title: {
        text: '根据职业的分析',
        subtext: '2020~2024 年',
        left: 'center'
      },
      tooltip: {
        trigger: 'item'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: '职业',
          type: 'pie',
          radius: '50%',
          data: [],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    }
  }
  );

const optionAge = reactive({
  isLoading: true,
  data: {
    title: {
      text: '根据不同年龄的分析',
      subtext: '2020~2024 年',
      left: 'center'
    },
    tooltip: {
      trigger: 'item'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '年龄区间',
        type: 'pie',
        radius: '50%',
        data: [],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }
});

const optionFamily = reactive({
  isLoading: true,
  data: {
    title: {
      text: '根据家族病史的分析',
      subtext: '2020~2024 年',
      left: 'center'
    },
    tooltip: {
      trigger: 'item'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '年龄区间',
        type: 'pie',
        radius: '50%',
        data: [],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }
});

const optionUnderlyingDisease = reactive({
  isLoading: true,
  data: {
    title: {
      text: '生活习惯分析',
      subtext: '2020~2024 年',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: [],
      axisTick: {
        alignWithLabel: true
      }
    },
    axisLabel: {
      margin: 8,
      formatter: function (params) {
          var val = "";
          if (params.length > 4) {
              val = params.substr(0, 4) + '...';
              return val;
          } else {
              return params;
          }
      }
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '既往病史',
        type: 'bar',
        barWidth: '60%',
        data: [],
        label: {
          show: true
        }
      }
    ],
  }
})

const optionSymptom = reactive({
  isLoading: true,
  data: {
    title: {
      text: '现病史症状分析',
      subtext: '2020~2024 年',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: [],
      axisTick: {
        alignWithLabel: true
      }
    },
    axisLabel: {
        margin: 8,
        formatter: function (params) {
            var val = "";
            if (params.length > 4) {
                val = params.substr(0, 4) + '...';
                return val;
            } else {
                return params;
            }
        }
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '既往病史',
        type: 'bar',
        barWidth: '60%',
        data: [],
        label: {
          show: true
        }
      }
    ],
  }
})

const optionHabit = reactive({
  isLoading: true,
  data: {
    title: {
      text: '生活习惯分析',
      left: 'left'
    },
    legend: {
      selectedMode: false
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '0%',
      containLabel: true
    },
    yAxis: {
      type: 'value'
    },
    xAxis: {
      type: 'category',
      data: []
    },
    series: []
  }
})

const optionPersonalHistory = reactive({
  isLoading: true,
  data: {
    title: {
      text: '个人史情况分析',
      left: 'left'
    },
    legend: {
      selectedMode: false
    },
    grid: {
      left: '0%',
      right: '0%',
      bottom: '0%',
      containLabel: true
    },
    yAxis: {
      type: 'value'
    },
    xAxis: {
      type: 'category',
      data: []
    },
    series: [],
    axisLabel: {
      margin: 8,
      formatter: function (params) {
          var val = "";
          if (params.length > 4) {
              val = params.substr(0, 4) + '...';
              return val;
          } else {
              return params;
          }
      }
    }
  }
})

const setDefaultHospitalList = async () => {
  const user = getUserInfo();
  if(user.nickname === 'master'){
    data.isMaster = true
    const result = await getHospitalList(user.nickname);
    if(result.data && result?.err_code === 0 ){
      data.hospitalList = result.data?.list?.filter(item => item !== 'master')
    }else{
      ElMessage.error('网络出错啦！请稍后再试 ~')
    }
  }else{
    data.default = user.nickname
    data.isMaster = false
  }
}

const setRegionData = async () => {
  const user = getUserInfo();
  const hospital = user.nickname === 'master' ? '' : user.nickname;
  const regionDataRes = await getAnalysisByType({ type: EAnalysisType.Region, hospital })
  const { regionData } = regionDataRes.data || {};
  if (regionData?.length) {
    optionRegion.isLoading = false
    optionRegion.data.series[0].data = regionData
  }
}

const setCareerData = async () => {
  const user = getUserInfo();
  const hospital = user.nickname === 'master' ? '' : user.nickname;
  const res = await getAnalysisByType({ type: EAnalysisType.Career, hospital })
  const { careerData } = res.data || {};
  if (careerData?.length) {
    optionCareer.isLoading = false
    optionCareer.data.series[0].data = careerData
  }
}

const setAgeData = async () => {
  const user = getUserInfo();
  const hospital = user.nickname === 'master' ? '' : user.nickname;
  const res = await getAnalysisByType({ type: EAnalysisType.Age, hospital })
  const { ageData } = res.data || {};
  if (ageData?.length) {
    optionAge.isLoading = false
    optionAge.data.series[0].data = ageData
  }
}

const setFamilyData = async () => {
  const user = getUserInfo();
  const hospital = user.nickname === 'master' ? '' : user.nickname;
  const res = await getAnalysisByType({ type: EAnalysisType.Family, hospital })
  const { familyData } = res.data || {};
  if (familyData?.length) {
    optionFamily.isLoading = false
    optionFamily.data.series[0].data = familyData
  }
}

const setUnderlyingDiseaseData = async () => {
  const user = getUserInfo();
  const hospital = user.nickname === 'master' ? '' : user.nickname;
  const res = await getAnalysisByType({ type: EAnalysisType.UnderlyingDisease, hospital })
  const { underlyingDiseaseData } = res.data || {};
  const { data, nameList} = underlyingDiseaseData || {};
  if (data?.length && nameList?.length) {
    optionUnderlyingDisease.isLoading = false
    optionUnderlyingDisease.data.xAxis.data = nameList
    optionUnderlyingDisease.data.series[0].data = data
  }
}

const setSymptomData = async () => {
  const user = getUserInfo();
  const hospital = user.nickname === 'master' ? '' : user.nickname;
  const res = await getAnalysisByType({ type: EAnalysisType.Symptom, hospital })
  const { symptomData } = res.data || {};
  const { data, nameList} = symptomData || {};
  if (data?.length && nameList?.length) {
    optionSymptom.isLoading = false
    optionSymptom.data.xAxis.data = nameList
    optionSymptom.data.series[0].data = data
  }
}

const setHabitData = async () => {
  const user = getUserInfo();
  const hospital = user.nickname === 'master' ? '' : user.nickname;
  const res = await getAnalysisByType({ type: EAnalysisType.Habit, hospital })
  const { habitData } = res.data || {};
  const { data, nameList} = habitData || {};
  if (data?.length && nameList?.length) {
    optionHabit.isLoading = false
    optionHabit.data.xAxis.data = nameList
    optionHabit.data.series = data.map(rawData => {
      return {
        type: 'bar',
        stack: 'total',
        barWidth: '60%',
        label: {
          show: true,
          formatter: (params) => params.value + '%'
        },
        ...rawData
      }
    })
  }
}

const setPersonalHistoryData = async () => {
  const user = getUserInfo();
  const hospital = user.nickname === 'master' ? '' : user.nickname;
  const res = await getAnalysisByType({ type: EAnalysisType.PersonalHistory, hospital })
  const { personalHistoryData } = res.data || {};
  const { data, nameList} = personalHistoryData || {};
  if (data?.length && nameList?.length) {
    optionPersonalHistory.isLoading = false
    optionPersonalHistory.data.xAxis.data = nameList
    optionPersonalHistory.data.series = data.map(rawData => {
      return {
        type: 'bar',
        stack: 'total',
        barWidth: '60%',
        label: {
          show: true,
          formatter: (params) => params.value + '%'
        },
        ...rawData
      }
    })
  }
}

onMounted(async () => {
  console.log('debug onMounted')
})

onActivated(() => {
  // 1. 设置默认医院单位
  setDefaultHospitalList()
  // 2. 获取表格数据
  setRegionData()
  setCareerData()
  setAgeData()
  setFamilyData()
  setUnderlyingDiseaseData()
  setSymptomData()
  setHabitData()
  setPersonalHistoryData()
})

const exportAnalystReports = async () => {
  try {
    const loadingInstance = ElLoading.service({
      text: '报告生成中，预计耗时1分钟，请耐心等待 ...'
    })
    const { data: resData } = await getAnalysisReport({
      
    })

    const wordData = {
      listname: '合同质检报告',
      ...resData
    }
    console.log("即将导出 Word 文档，wordData 内容为：", wordData);  
    ExportBriefDataDocx("http://127.0.0.1:3000/public/uploads/report/module2.docx", wordData, `${wordData.listname}.docx`);
    loadingInstance.close()
  } catch (err) {
    console.log(err);
  }
}


</script>

<template>
  <div class="result-overview-container">
    <!-- 筛选 -->
    <div class="query-container">
      <div  class="query-content">
        <span class="query-title" style="margin-left: 30px;">医院单位筛选: </span>
        <el-select size="normal" v-model="data.default" :disabled="!data.isMaster">
          <el-option v-for="item in data.hospitalList" :key="item" :label="item" :value="item" />
        </el-select>
        <el-button v-if="isMaster" type="primary" plain size="normal">查询</el-button>
      </div>
      <el-button type="primary" plain @click="exportAnalystReports" style="margin-right: 40px;">导出分析报告</el-button>
    </div>
    <!-- 表格 -->
    <div id="echarts-container">
      <div class="echarts-container" id="echarts-container-Region" style="left: 50px;">
      <Echarts :option="optionRegion.data" />
      <div v-if="optionRegion.isLoading" class="loading">
        <el-icon size="28px"><Loading /></el-icon>
        <el-text class="mx-1">加载中</el-text>
      </div>
    </div>
    <div class="echarts-container" id="echarts-container-Career" style="right: 50px;">
      <Echarts :option="optionCareer.data" />
      <div v-if="optionCareer.isLoading" class="loading">
        <el-icon size="28px"><Loading /></el-icon>
        <el-text class="mx-1">加载中</el-text>
      </div>
    </div>
    <div class="echarts-container" id="echarts-container-Age" style="left: 50px;">
      <Echarts :option="optionAge.data" />
      <div v-if="optionAge.isLoading" class="loading">
        <el-icon size="28px"><Loading /></el-icon>
        <el-text class="mx-1">加载中</el-text>
      </div>
    </div>
    <div class="echarts-container"  id="echarts-container-Family" style="right: 50px;">
      <Echarts :option="optionFamily.data" />
      <div v-if="optionFamily.isLoading" class="loading">
        <el-icon size="28px"><Loading /></el-icon>
        <el-text class="mx-1">加载中</el-text>
      </div>
    </div>
    <div class="echarts-container"   id="echarts-container-UnderlyingDisease" style="left: 50px;">
      <Echarts :option="optionUnderlyingDisease.data" />
      <div v-if="optionUnderlyingDisease.isLoading" class="loading">
        <el-icon size="28px"><Loading /></el-icon>
        <el-text class="mx-1">加载中</el-text>
      </div>
    </div>
    <div class="echarts-container" id="echarts-container-Symptom" style="right: 50px;">
      <Echarts :option="optionSymptom.data" />
      <div v-if="optionSymptom.isLoading" class="loading">
        <el-icon size="28px"><Loading /></el-icon>
        <el-text class="mx-1">加载中</el-text>
      </div>
    </div>
    <div class="echarts-container" id="echarts-container-Habit" style="left: 50px;">
      <Echarts :option="optionHabit.data" />
      <div v-if="optionHabit.isLoading" class="loading">
        <el-icon size="28px"><Loading /></el-icon>
        <el-text class="mx-1">加载中</el-text>
      </div>
    </div>
    <div class="echarts-container" id="echarts-container-PersonalHistory" style="right: 50px;">
      <Echarts :option="optionPersonalHistory.data" />
      <div v-if="optionPersonalHistory.isLoading" class="loading">
        <el-icon size="28px"><Loading /></el-icon>
        <el-text class="mx-1">加载中</el-text>
      </div>
    </div>
    </div>
    
    
  </div>
</template>

<style  scoped lang="less">
.loading {
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  i {
    animation: rotate 2s linear infinite;
    opacity: 0.8;
    margin-bottom: 4px;
  }
}

@keyframes rotate{
	0%{
		transform: rotateZ(0deg);/*从0度开始*/
	}
	100%{
		transform: rotateZ(360deg);/*360度结束*/
	}
}

.result-overview-container{
  padding-left: 18px;
  padding-right: 26px;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  background: rgba(50, 50, 50, 0.02);
  padding-bottom: 100px;
}

#echarts-container{
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
}

.echarts-container{
  transition: all 0.3s ease-in-out;
  background: #fff;
  cursor: pointer;
  transition: 0.3s ease-in-out;
  padding: 20px;
  width: 500px;
  height: 280px;
  margin-top: 18px;
  border-radius: 5px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow:hidden ;
}

/* 筛选区域 */
.query-container{
  width: calc(100vw - 160px);
  padding-top: 20px;
  height:46px ;
  display: flex;
  justify-content: space-between;
  .query-content{
    width: 320px;
    display: flex;
    flex-direction: row;
    align-items: center;
    .query-title{
      width: 180px;
      font-size: 14px;
    }
  }
}
.el-select{
  margin-left: 5px;
  margin-right: 5px;
}
</style>
