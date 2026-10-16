
<script setup lang="ts">
import img1 from './images/zhizao.png';
import img2 from './images/house.png';
import img3 from './images/jian.png';
import img4 from './images/money.png';
import img5 from './images/dianzi.png';
import img6 from './images/yi.png';
import img7 from './images/law.png';
import img8 from './images/retail.png';


const carouselList = [
  {path: img1, desc: '制造业'},
  {path: img2, desc: '房地产行业'},
  {path: img3, desc: '建筑行业'},
  {path: img4, desc: '金融行业'},
  {path: img5, desc: '电子商务行业'},
  {path: img6, desc: '医疗行业'},
  {path: img7, desc: '法律行业'},
  {path: img8, desc: '零售行业'},
]

</script>

<template>
  <!-- 轮播图 -->
  <el-carousel :autoplay="true" height="260px" type="card">
    <el-carousel-item v-for="carousel in carouselList" :key="carousel">
      <img class="carousel-img" :src="carousel.path"/>
    </el-carousel-item>
  </el-carousel>
</template>

<style  scoped lang="less">
.el-carousel{
  .carousel-img{
  width: 100%;
  height: 100%
  }
  .demonstration {
    color: var(--el-text-color-secondary);
  }
  .el-carousel__item{
    padding: 2px;
    border-radius: 4px;
  }
  .el-carousel__item:nth-child(2n) {
    background-color: #ecbcda;
  }
  .el-carousel__item:nth-child(2n + 1) {
    background-color: rgb(238, 216, 233);
  }
}

</style>
