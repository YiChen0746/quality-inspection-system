<script setup lang="ts">
import { onMounted, reactive, onActivated } from 'vue'
import { getAllQualityResult } from '@Setup/request/index.ts';
import { getUserInfo } from '@Setup/storage/user.js'

const data = reactive({
  currentPage: 1,
  totalNumber: 1,
  medicalRecordList: []
})

const PageSize = 10

const updateTableDate = async (page = 1, pageSize = PageSize) => {
  const user = getUserInfo();
  const hospital = user.nickname === 'master' ? '' : user.nickname
  const result = await getAllQualityResult({ page, pageSize, hospital })
  if (result.err_code === 0) {
    data.currentPage = result?.data?.currentPage || 1;
    data.totalNumber = result?.data?.totalNumber || 100;
    data.medicalRecordList = result?.data?.medicalRecordList || [];
  }
}

// onMounted(updateTableDate)

onActivated(updateTableDate)

const handleCurrentChange = (page: number) => {
  updateTableDate(page)
}

</script>

<template>
  <div class="result-overview-container">
    <el-table 
    :data="data.medicalRecordList" 
    :default-sort="{ prop: 'start_date', order: 'descending' }"
    border
    style="width: 100%"
    max-height="550"
    >
      <el-table-column fixed="left" prop="hospital" label="就诊医院" width="80" />
      <el-table-column fixed="left" prop="name" label="姓名" width="90" />
      <el-table-column sortable label="质检分数" prop="result"  width="100" :formatter="(row: any, column: any, result: any) => { return result.point}" />
      <el-table-column sortable label="年龄" prop="age" width="80" />
      <el-table-column label="性别" prop="gender" width="80" />
      <el-table-column label="家族病史" prop="family" width="80" />
      <el-table-column label="出生地" prop="region_birth" width="80" />
      <el-table-column label="居住地" prop="region_live" width="80" />
      <el-table-column label="职业类别" prop="career" width="150" />
      <el-table-column label="教育程度" prop="education" width="80" />
      <el-table-column label="有毒化学品接触史" prop="toxic_chemicals" width="80" />
      <el-table-column label="放射性物品接触史" prop="radioactive_chemicals" width="80" />
      <el-table-column label="职业暴露" prop="occupational_exposure" width="80" />
      <el-table-column label="喝酒史" prop="drug" width="80" />
      <el-table-column label="吸烟史" prop="smoke" width="80" />
      <el-table-column label="喝酒史" prop="drink" width="80" />
      <el-table-column label="症状" prop="symptom" width="150" />
      <el-table-column label="症状开始时间" prop="start_date" width="100" />
      <el-table-column label="就诊时间" prop="visit_date" width="100" />
      <el-table-column label="饮食" prop="diet" width="100" />
      <el-table-column label="睡眠" prop="sleep" width="100" />
      <el-table-column label="大小便" prop="defecation" width="100" />
      <el-table-column label="体重变化" prop="weight" width="100" />
      <el-table-column label="常见基础病" prop="underlying_disease" width="150" />
      <!-- <el-table-column fixed="right" label="操作" width="60">
        <template #default>
          <el-button link type="primary" size="small" @click=""
            >编辑</el-button
          >
        </template>
      </el-table-column> -->
    </el-table>
    <!-- 分页区域 -->
    <div class="pagination-outer">
      <el-pagination
      :page-size="PageSize"
      :total="data.totalNumber"
      :current-page="data.currentPage"
      @current-change="handleCurrentChange"
      background 
      layout="prev, pager, next" 
    />
    </div>
  </div>
</template>

<style  scoped>
.el-divider--horizontal {
  margin-bottom: 16px;
}
.el-breadcrumb{
  padding: 16px 16px 0 16px;
}
.el-divider {
  margin-top: 16px;
}
.el-table{
  border-radius: 8px;
  border: 0px #d8d8d8 solid;
}
.result-overview-container{
  margin: 20px 16px 16px 16px;
}

.pagination-outer{
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
  position: absolute;
  bottom: 16px;
  left: calc(50% - 160px);
}
</style>