<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { UploadProps } from 'element-plus';
import { provinces ,careerList, educationList, hospitalList} from '@/assets/data/list-data.ts';
import { getQualityResult, getQualityListResult } from '@Setup/request/index.ts';
import { getUserInfo } from '@Setup/storage/user.js'
const userInfo = getUserInfo();
const hospital = userInfo?.nickname || '医院A';

// 整体表单
const form = reactive({
  hospital: hospital,
  name: '',
  age: 0,
  gender: '0',
  family: null,
  region_birth: null,
  region_live: null,
  career: null,
  education: null,
  toxic_chemicals: null,
  radioactive_chemicals: null,
  occupational_exposure: null,
  drug: null,
  smoke: null,
  drink: null,
  symptom: [],
  start_date: '',
  visit_date:  '',
  diet: null,
  sleep: null,
  defecation: null,
  weight: null,
  underlying_disease: [],
  fileList: [], // 用于X光图片的上传
  wordFileList: [] // 用于扫描版纸质问卷的上传
})

const rules = reactive({
  name: [
    {
      required: true,
      message: '请输入名字',
      trigger: 'change',
    },
  ],
  age: [
    {
      required: true,
      message: '请输入年龄',
      trigger: 'change',
    },
  ],
  gender: [
    {
      required: true,
      message: '请选择性别',
      trigger: 'change',
    },
  ],
})

const setFormDefault = () => {
  form.hospital = hospital;
  form.name = '';
  form.age = 0;
  form.gender = '0';
  form.family = null;
  form.region_birth = null;
  form.region_live = null;
  form.career = null;
  form.education = null;
  form.toxic_chemicals = null;
  form.radioactive_chemicals = null;
  form.occupational_exposure = null;
  form.drug = null;
  form.smoke = null;
  form.drink = null;
  form.symptom = [];
  form.start_date = '';
  form.visit_date = '';
  form.diet = null;
  form.sleep = null;
  form.defecation = null;
  form.weight = null;
  form.underlying_disease = [];
  form.fileList = [];
}

// 图片上传
const dialogImageUrl = ref('')
const imgPreviewDialogVisible = ref(false)
const handlePictureCardPreview: UploadProps['onPreview'] = (uploadFile) => {
  dialogImageUrl.value = uploadFile.url!
  imgPreviewDialogVisible.value = true
}
const handleSuccess: UploadProps['onSuccess'] = (res) => {
  form.fileList.pop();
  if (res.err_code === 0) {
    form.fileList.push(res.data)
  }
}

// 提交病历 + 反馈弹窗
const resultDialogVisible = ref(false)
let result = reactive({
  data: {
    point: 0,
    unit: '分',
    result_rate: 0,
    bad_list: []
  },
  subtitle: '存在的问题：'
})

function pad(timeEl, total = 2, str = '0') {
    return timeEl.toString().padStart(total, str)
}
const formatTime = timer => {
  const year = timer.getFullYear()
  const month = timer.getMonth() + 1 // 由于月份从0开始，因此需加1
  const day = timer.getDate()
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}}`
}

const formatForm = from => {
  const map = ['正常', '增多', '减少']
  return {
    hospital: from.hospital,
    name: from.name,
    age: from.age ? from.age : -1,
    gender: from.gender === '0' ? '女' : '男',
    family: from.family === true ? '是': from.family === false ?  '否': '不明',
    region_birth: from.region_birth ? from.region_birth : '不明',
    region_live: from.region_live ? from.region_live : '不明',
    career: from.career ? from.career : '不明',
    education: from.education ? from.education : '不明',
    toxic_chemicals: from.toxic_chemicals === true ? '是': from.toxic_chemicals === false ?  '否': '不明',
    radioactive_chemicals: from.radioactive_chemicals === true ? '是': from.radioactive_chemicals === false ?  '否': '不明',
    occupational_exposure: from.occupational_exposure === true ? '是': from.occupational_exposure === false ?  '否': '不明',
    drug: from.drug === true ? '是': from.drug === false ?  '否': '不明',
    smoke: from.smoke === true ? '是': from.smoke === false ?  '否': '不明',
    drink: from.drink === true ? '是': from.drink === false ?  '否': '不明',
    symptom: from.symptom,
    start_date: from.start_date ? formatTime(from.start_date): '不明',
    visit_date: from.visit_date ? formatTime(from.visit_date): '不明',
    diet: from.diet !== null ? map[Number(from.diet)] : '不明',
    sleep: from.sleep !== null ? map[Number(from.sleep)] : '不明',
    defecation: from.defecation !== null ? map[Number(from.defecation)] : '不明',
    weight: from.weight !== null ? map[Number(from.weight)] : '不明',
    underlying_disease: from.underlying_disease,
    fileList: from.fileList,
  }
}

const onSubmit = async () => {
  if (!form.name) {
    ElMessage({
      message: '患者姓名为必填选项！！！',
      type: 'warning',
    })
    return
  }
  const qualityResultRes = await getQualityResult(formatForm(form))
  if (qualityResultRes.data && qualityResultRes?.err_code === 0) {
    ElMessage({
      message: '检查成功！',
      type: 'success',
    })
    result.data = qualityResultRes.data
    if( qualityResultRes.data?.point === 100){
      result.subtitle = '各项信息都很完整！再接再厉 ~'
    } else {
      result.subtitle = '存在的问题：'
    }
    resultDialogVisible.value = true
    // setFormDefault()
  } else {
    ElMessage.error('网络出错啦！请稍后再试 ~')
  }
}

const onResultSure = () => {
  resultDialogVisible.value = false
}

// excel上传解析
import type { UploadInstance } from 'element-plus'
const uploadExcelRef = ref<UploadInstance>()

const getFileType = (name) => {
  const list = name.split('.');
  return list[list.length - 1]
}

const uploadExcelHandler = async (uploadFile) => {
  // 1. 校验格式
  // 2. 提交文件
  const type = getFileType(uploadFile.name)
  if (type !== 'xlsx') {
    ElMessage.error('请选择xlsx格式的文件！')
    uploadFiles.pop()
  } else {
    uploadExcelRef.value!.submit()
  }
}

const uploadExcelSuccessHandler: UploadProps['onSuccess'] = (res) => {
  // 3. 处理响应
  //  message提示 自动下载结果excel
  
  const { qualityResultList, filePath } = res?.data || {};
  
  if (qualityResultList?.length > 0 && filePath) {
    console.log(filePath)
    ElMessage({
      message: '检查成功！已为您自动下载检查结果表格 ~',
      type: 'success',
    })
    let a = document.createElement('a')
    a.download = '汇总病例质检_质检结果.xlsx'
    a.style.display = 'none'
    a.href = filePath
    // 将创建的标签插入dom
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}



//word、pdf上传解析




// 获取 el-upload 组件的引用
const uploadJpgRef = ref<UploadInstance>()

// 获取文件名后缀
const getFileType1 = (name) => {
  const list = name.split('.')
  console.log(list.length - 1)
  return list[list.length - 1].toLowerCase()

}

// 在上传前检查文件格式
const beforeUploadJpgHandler = (file) => {
  const type = getFileType1(file.name)
  if (type !== 'doc' && type !== 'docx' && type !== 'pdf'){
    ElMessage.error('请选择 word或者pdf 格式的文件！')
    console.log('已经检查完', file.type);
    return false
  }
  return true
}

// 提交上传
const submitUpload = async () => {
  if (!uploadJpgRef.value) {
    ElMessage.error('无法获取上传组件实例！');
    return;
  }

  // 获取已选择的文件列表
  const files = form.wordFileList || [];  // 使用 wordFileList
  if (files.length === 0) {
    ElMessage.error('请先选择文件！');
    return;
  }

  if (files.length > 20) {
    ElMessage.error('请上传小于20的文件数！');
    return;
  }

  console.log('Selected files:', files);

  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file.raw); // 注意使用 file.raw 获取原始文件对象
  });

  try {
    const response = await fetch('http://127.0.0.1:3000/get_quality_jpg_result', {
      method: 'POST',
      body: formData,
    });
    const res = await response.json();

    if (response.ok && res?.data?.qualityResultList1) {
      ElMessage({
        message: '检查成功！已为您自动下载检查结果表格 ~',
        type: 'success',
      });
      const { filePath5 } = res.data;
      let a = document.createElement('a');
      a.download = '扫描版纸质问卷质检_质检结果.xlsx';
      a.style.display = 'none';
      a.href = filePath5;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      ElMessage.error('检查失败，请重试！');
    }
  } catch (error) {
    ElMessage.error('上传过程中发生错误，请重试！');
    console.error('Upload error:', error);
  }
}






</script>

<template >
  <div class="container"></div>
  <div class="box box-one">
    <h1>1. 汇总病历质检</h1>
    <el-upload
      ref="uploadExcelRef"
      class="upload-demo"
      action="http://127.0.0.1:3000/get_quality_list_result"
      :auto-upload="false"
      :on-change="uploadExcelHandler"
      :on-success="uploadExcelSuccessHandler"
      :limit="1"
    >
      <template #trigger>
        <el-button type="success" plain>选择文件并质检</el-button>
      </template>
      <template #tip>
        <div class="el-upload__tip">
          备注：请选择格式为 xlsx 的文件！
          <a href="../../汇总病例模板.xlsx" download="汇总病例模板">(点击下载excel模板)</a>
        </div>
      </template>
    </el-upload>
  </div>

  <div class="box box-two" style="margin-bottom: 1rem">
    <h1>2. 单个病历质检</h1>
    <el-form :rules="rules" :model="form" label-width="120px">
      <el-divider content-position="left" border-style="dashed">1. 个人史（个人一般情况）</el-divider>
      <el-form-item label="姓名" prop="name">
        <el-col :span="4">
          <el-input v-model="form.name" />
        </el-col>
        <el-col :span="2"></el-col>
        <el-col :span="2" class="text-label">
          <span class="text-gray-500">就诊医院</span>
        </el-col>
        <el-col :span="3">
          <el-select v-model="form.hospital" disabled>
            <el-option v-for="item in hospitalList" :key="item" :label="item" :value="item" />
          </el-select>
        </el-col>
        <el-col :span="1"></el-col>
        <el-col :span="2" class="text-label">
          <span class="text-gray-500">年龄</span>
        </el-col>
        <el-col :span="6">
          <el-input-number v-model="form.age" :min="0" :max="200" />
        </el-col>
      </el-form-item>
      <el-form-item label="性别" prop="gender">
        <el-col :span="4">
          <el-radio-group v-model="form.gender">
            <el-radio  label="1" >男</el-radio>
            <el-radio  label="0" >女</el-radio>
          </el-radio-group>
        </el-col>
        <el-col :span="1"></el-col>
        <el-col :span="3" class="text-label">
          <span class="text-gray-500">家族是否有病史</span>
        </el-col>
        <el-col :span="6">
          <el-radio-group v-model="form.family">
            <el-radio  :label="true" >是</el-radio>
            <el-radio  :label="false" >否</el-radio>
          </el-radio-group>
        </el-col>
      </el-form-item>
      <el-form-item label="出生地">
        <el-col :span="4">
          <el-select v-model="form.region_birth" placeholder="请选择您出生的地区">
            <el-option v-for="item in provinces" :key="item" :label="item" :value="item" />
          </el-select>
        </el-col>
        <el-col :span="1"></el-col>
        <el-col :span="2" class="text-label">
          <span class="text-gray-500">居住地</span>
        </el-col>
        <el-col :span="4">
          <el-select v-model="form.region_live" placeholder="请选择您居住的地区">
            <el-option v-for="item in provinces" :key="item" :label="item" :value="item" />
          </el-select>
        </el-col>
      </el-form-item>
      <el-form-item label="职业类别">
        <el-col :span="4">
          <el-select v-model="form.career" placeholder="请选择您的职业类别">
            <el-option v-for="item in careerList" :key="item" :label="item" :value="item" />
          </el-select>
        </el-col>
        <el-col :span="1"></el-col>
        <el-col :span="2" class="text-label">
          <span class="text-gray-500">教育程度</span>
        </el-col>
        <el-col :span="4">
          <el-select v-model="form.education" placeholder="请选择您的受教育程度">
            <el-option v-for="item in educationList" :key="item" :label="item" :value="item" />
          </el-select>
        </el-col>
      </el-form-item>
      <el-form-item label="有毒化学品接触史">
        <el-col :span="4">
          <el-radio-group v-model="form.toxic_chemicals">
            <el-radio  :label="true" >有</el-radio>
            <el-radio  :label="false" >无</el-radio>
          </el-radio-group>
        </el-col>
        <el-col :span="1"></el-col>
        <el-col :span="3" class="text-label">
          <span class="text-gray-500">放射性物品接触史</span>
        </el-col>
        <el-col :span="4">
          <el-radio-group v-model="form.radioactive_chemicals">
            <el-radio  :label="true" >有</el-radio>
            <el-radio  :label="false" >无</el-radio>
          </el-radio-group>
        </el-col>
        <el-col :span="3" class="text-label">
          <span class="text-gray-500">职业暴露</span>
        </el-col>
        <el-col :span="4">
          <el-radio-group v-model="form.occupational_exposure">
            <el-radio  :label="true" >有</el-radio>
            <el-radio  :label="false" >无</el-radio>
          </el-radio-group>
        </el-col>
      </el-form-item>
      <el-form-item label="吸毒史">
        <el-col :span="4">
          <el-radio-group v-model="form.drug">
            <el-radio  :label="true" >有</el-radio>
            <el-radio  :label="false" >无</el-radio>
          </el-radio-group>
        </el-col>
        <el-col :span="1"></el-col>
        <el-col :span="3" class="text-label">
          <span class="text-gray-500">吸烟史</span>
        </el-col>
        <el-col :span="4">
          <el-radio-group v-model="form.smoke">
            <el-radio  :label="true" >有</el-radio>
            <el-radio  :label="false" >无</el-radio>
          </el-radio-group>
        </el-col>
        <el-col :span="3" class="text-label">
          <span class="text-gray-500">喝酒史</span>
        </el-col>
        <el-col :span="4">
          <el-radio-group v-model="form.drink">
            <el-radio  :label="true" >有</el-radio>
            <el-radio  :label="false" >无</el-radio>
          </el-radio-group>
        </el-col>
      </el-form-item>
      <el-divider content-position="left" border-style="dashed">2. 现病史（本次发病情况）</el-divider>
      <el-form-item label="症状">
        <el-checkbox-group v-model="form.symptom">
          <el-checkbox label="无痛性肿块" name="symptom" />
          <el-checkbox label="乳头异常" name="symptom" />
          <el-checkbox label="肌肉和皮肤改变" name="symptom" />
          <el-checkbox label="淋巴结肿大" name="symptom" />
          <el-checkbox label="乳头溢液、泌乳、血性液体" name="symptom" />
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="症状开始时间">
        <el-col :span="5">
          <el-date-picker
            v-model="form.start_date"
            type="date"
            placeholder="点击选择症状开始时间"
            style="width: 100%"
          />
        </el-col>
        <el-col :span="3"></el-col>
        <el-col :span="3" class="text-label">
          <span class="text-gray-500">就诊时间</span>
        </el-col>
        <el-col :span="5">
          <el-date-picker
            v-model="form.visit_date"
            type="date"
            placeholder="点击选择就诊时间"
            style="width: 100%"
          />
        </el-col>
      </el-form-item>
      <el-form-item label="饮食">
        <el-col :span="8">
          <el-radio-group v-model="form.diet">
            <el-radio  :label="0" >正常</el-radio>
            <el-radio  :label="1" >暴饮暴食</el-radio>
            <el-radio  :label="2" >难以进食</el-radio>
          </el-radio-group>
        </el-col>
        <el-col :span="1"></el-col>
        <el-col :span="2" class="text-label">
          <span class="text-gray-500">睡眠</span>
        </el-col>
        <el-col :span="7">
          <el-radio-group v-model="form.sleep">
            <el-radio  :label="0" >正常</el-radio>
            <el-radio  :label="1" >贪睡</el-radio>
            <el-radio  :label="2" >失眠</el-radio>
          </el-radio-group>
        </el-col>
      </el-form-item>
      <el-form-item label="大小便">
        <el-col :span="8">
          <el-radio-group v-model="form.defecation">
            <el-radio  :label="0" >正常</el-radio>
            <el-radio  :label="1" >增多</el-radio>
            <el-radio  :label="2" >减少</el-radio>
          </el-radio-group>
        </el-col>
        <el-col :span="1"></el-col>
        <el-col :span="2" class="text-label">
          <span class="text-gray-500">体重变化</span>
        </el-col>
        <el-col :span="7">
          <el-radio-group v-model="form.weight">
            <el-radio  :label="0" >正常</el-radio>
            <el-radio  :label="1" >急增</el-radio>
            <el-radio  :label="2" >骤减</el-radio>
          </el-radio-group>
        </el-col>
      </el-form-item>
      <el-divider content-position="left" border-style="dashed">3. 既往史（以前健康状况）</el-divider>
      <el-form-item label="常见基础病">
        <el-checkbox-group v-model="form.underlying_disease">
          <el-checkbox label="无" name="underlying_disease" />
          <el-checkbox label="高血压" name="underlying_disease" />
          <el-checkbox label="糖尿病" name="underlying_disease" />
          <el-checkbox label="冠心病" name="type" />
          <el-checkbox label="高脂血症" name="type" />
          <el-checkbox label="脑血管病" name="type" />
          <el-checkbox label="其他" name="type" />
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="x光图片">
        <el-upload
          v-model:file-list="form.fileList"
          action="http://127.0.0.1:3000/upload_XImages"
          list-type="picture-card"
          :on-preview="handlePictureCardPreview"
          :on-success="handleSuccess"
        >
          <el-icon><Plus /></el-icon>
        </el-upload>
        <!-- 图片预览弹窗 -->
        <el-dialog v-model="imgPreviewDialogVisible">
          <img :src="dialogImageUrl"/>
        </el-dialog>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSubmit">确认质检</el-button>
        <el-button type="danger" @click="setFormDefault" plain>全部清空</el-button>
      </el-form-item>
    </el-form>
  </div>


  <div class="box box-three" style="margin-bottom: 5rem;">
    <h1>3. 扫描版纸质问卷质检</h1>
    <el-upload
  ref="uploadJpgRef"
  v-model:file-list="form.wordFileList"
  class="upload-demo"
  :action="null"  
  :auto-upload="false"
  :before-upload="beforeUploadJpgHandler"
  multiple
  list-type="text"
  accept=".doc,.docx,.pdf"
>
<template #trigger>
    <el-button type="success" plain>选择文件扫描并质检</el-button>
  </template>
  <template #tip>
    <div class="el-upload__tip" style="padding-left: 60px;">
      备注：请选择格式为 word，pdf 的文件！【最多允许同时上传20个文件】
      <a href="../../乳腺筛查问卷.docx" download="乳腺筛查问卷模板">&nbsp;&nbsp;&nbsp;(点击下载问卷模板)</a>
    </div>
  </template>
</el-upload>
    <el-button type="primary" @click="submitUpload">上传并质检</el-button>
  </div>



  <div class="docWrap">
    <div ref="wordFile"></div>
</div>


  <!-- 结果弹窗 -->
  <el-dialog v-model="resultDialogVisible" title="检查结果" width="500" center class="result-dialog">
    <div class="result-dialog-content">
      <div class="point-container">
        <span class="point-number">{{ result?.data?.point }}</span>
        <span class="point-unit">{{ result?.data?.unit }}</span>
      </div>
      <div>
        <el-rate
          v-model="result.data.result_rate"
          disabled
          show-score
          size="large"
          text-color="#ff9900"
          score-template=""
        />
      </div>
      <div class="result-bad-list">
        <span class="list-title">{{  result.subtitle }}</span>
        <ul class="list">
          <li v-for="(item, index) in result.data.bad_list" :key="index">
              {{`${index+1}. ${item}`}}
          </li>
        </ul>
      </div>
      <el-button size="large" type="primary" @click="onResultSure">确定</el-button>
    </div>
  </el-dialog>
</template>

<style  scoped lang="less">
.container{
 background-color:#dff9f8;
}
.box{
  border-radius: 5px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);
  padding: 1.5rem;
  margin: 1rem;
  border-radius: var(--el-border-radius-base);
  background-color: #ffffff;
  .upload-demo{
    margin-left: 20px;
    display: flex;
    // flex-direction: column;
    align-items: center;
    // justify-content: start;
    height: 70px
  }
  &-one{
    .el-upload__tip{
      margin-left: 50px;
    }
  }
  &-two{
    margin-bottom: 5rem;
    .el-button{
      width: 100px;
    }
    .el-form{
      margin-top: 16px;
      margin-left: 16px;
    }
  }
}

.result-dialog-content{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  .result-bad-list{
    padding: 16px 20px;
    margin-bottom: 30px;
  }
  .list-title{
    font-size: 16px;
    
  }
  .list{
    margin-top: 16px;
  }
  li{
    margin-top: 4px;
    font-size: 14px;
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    word-break: break-all;
  }
}
.point-container{
  display: flex;
  justify-content: center;
  align-items: center;
  .point-number{
    font-size: 56px;
    font-weight: 600;
    color: gold;
    margin-right: 8px;
  }
  .point-unit{
    margin-top: 16px;
    font-size: 26px;
    font-weight: 600;
    color: gold;
  }
}

.text-label{
  display: flex;
  justify-content: end;
  padding-right: 12px;
}
.el-divider{
  width: 70%;
  margin: 30px 80px;
}
/deep/ .el-upload-list__item{
  width: 120px;
  height: 30px;
}
/deep/ .el-upload{
  width: 80px;
  height: 80px;
}

.el-overlay{
  width: 100vw;
  height: 100vh;
  
}
/deep/ .el-overlay-dialog{
  display:flex;
  justify-content: center;
  align-items: center;
}
/deep/ .el-dialog{
  width: 60vw;
  height: 40vw;
  padding: 0;
  margin: 0;
  .el-dialog__header {
    padding: 0;
    button{
      background: rgba(0, 0, 0, 0.2);
      margin: 5px;
      border-radius: 8px;
    }
    button:hover{
      background: rgba(0, 0, 0, 0.4);
    }
  }
  .el-dialog__body{
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    .img-outer{
      width: 100%;
      height: 100%;
      background-repeat: no-repeat;
      background-size: 100% auto;
    }
    img{
      width: 100%;
      height: auto;
    }
  }
  
}


</style>
