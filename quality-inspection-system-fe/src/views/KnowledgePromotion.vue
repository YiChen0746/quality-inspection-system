<script setup lang="ts">
// import CarouselChart from '@/components/CarouselChart/index.vue'
// import biking from '@/assets/images/biking.svg'
// import camping from '@/assets/images/camping.svg'
// import couple from '@/assets/images/couple.svg'
// import jiangdi from '@/assets/images/hetong1.jpg'

// import Zhengzhuang01 from '@/assets/images/zhengzhuang/1.png'
// import Zhengzhuang02 from '@/assets/images/zhengzhuang/2.png'
// import Zhengzhuang03 from '@/assets/images/zhengzhuang/3.png'
// import Zhengzhuang04 from '@/assets/images/zhengzhuang/4.png'
// import Zhengzhuang05 from '@/assets/images/zhengzhuang/5.png'
// import Zhengzhuang06 from '@/assets/images/zhengzhuang/6.png'
// import Zhengzhuang07 from '@/assets/images/zhengzhuang/7.png'
// import Zhengzhuang08 from '@/assets/images/zhengzhuang/8.png'
// import Zhengzhuang09 from '@/assets/images/zhengzhuang/9.png'
// import Zhengzhuang10 from '@/assets/images/zhengzhuang/10.png'
// import Zhengzhuang11 from '@/assets/images/zhengzhuang/11.png'
// import Zhengzhuang12 from '@/assets/images/zhengzhuang/12.png'
// import Zhengzhuang13 from '@/assets/images/zhengzhuang/13.png'
// import Zhengzhuang14 from '@/assets/images/zhengzhuang/14.png'
// import Zhengzhuang15 from '@/assets/images/zhengzhuang/15.png'
// import Zhengzhuang16 from '@/assets/images/zhengzhuang/16.png'
// import Zhengzhuang17 from '@/assets/images/zhengzhuang/17.png'
// import Zhengzhuang18 from '@/assets/images/zhengzhuang/18.png'
// import Zhengzhuang19 from '@/assets/images/zhengzhuang/19.png'
// import Zhengzhuang20 from '@/assets/images/zhengzhuang/20.png'
// import KangFU1 from '@/assets/images/kangfu/biao1.png'
// import KangFU2 from '@/assets/images/kangfu/qian.png'
// import KangFU3 from '@/assets/images/kangfu/ding.png'
// import KangFU4 from '@/assets/images/kangfu/zhuti.png'
// import KangFU5 from '@/assets/images/kangfu/biao.png'
// import KangFU6 from '@/assets/images/kangfu/quan.png'
// import KangFU7 from '@/assets/images/kangfu/money1.png'
// import KangFU8 from '@/assets/images/kangfu/lv.png'
// import KangFU9 from '@/assets/images/kangfu/wei.png'
// import KangFU10 from '@/assets/images/kangfu/bu.png'
// import KangFU11 from '@/assets/images/kangfu/zheng.png'
// import KangFU12 from '@/assets/images/kangfu/qixian.png'
// import KangFU13 from '@/assets/images/kangfu/bian.png'
// import KangFU14 from '@/assets/images/kangfu/bao.png'
// import KangFU15 from '@/assets/images/kangfu/qianshu.png'
// import KangFU16 from '@/assets/images/kangfu/fu.png'

const knowledgeLists = []
</script>

<template>
  <!-- <div class="knowledge-container">
    <h1 class="main-title">合同宣传｜这些有关合同的知识 你必须知道</h1> -->
  <!-- 轮播图 -->
  <!-- <CarouselChart /> -->
  <!-- 标题 -->
  <!-- <br />
    <br />
    <p class="knowledge-title" style="font-size: 20px">一、合同审查的方法</p>
    <div class="owl-stage" style="">
      <div
        class="owl-item cloned"
        style="
          flex: 1 1 calc(25% - 20px); /* 每个子元素占一行的25%，考虑空隙 */
          box-sizing: border-box; -->
  <!-- "
      > -->
  <!-- <div class="single-deal" style="margin-right: 30px; margin-left: 45px">
          <div class="deal-image">
            <img :src="Zhengzhuang17" alt="" style="height: 290px" />
          </div>
          <div class="deal-content">
            <h4>合同条款审查</h4>
            <div class="deal_meta">
              <div class="sdmeta">
                基本的步骤和方法就是合同条款的审查.全面细致地对合同条款逐一审查,但审查应该有重点。有三方面内容必须审查:一看合同的主体,二看合同的标的,三看合同的数量条款。无此三者则合同不能成立。
              </div>
            </div>
          </div>
        </div>
        <div class="single-deal" style="margin-right: 30px">
          <div class="deal-image">
            <img :src="Zhengzhuang18" alt="" style="height: 290px" />
          </div>
          <div class="deal-content">
            <h4>合法性审查</h4>
            <div class="deal_meta">
              <div class="sdmeta">
                合法性审查是合同审查中关键的一步，主要确保合同的主体资格、内容、形式及签约过程符合法律规定。具体包括审查合同双方的合法身份、合同条款是否违反法律强制性规定，合同形式是否符合要求，签约过程是否公正透明，确保合同目的和条款不损害社会公共利益或他人权益。
              </div>
            </div>
          </div>
        </div>
        <div class="single-deal" style="margin-right: 30px">
          <div class="deal-image">
            <img :src="Zhengzhuang19" alt="" style="height: 290px" />
          </div>
          <div class="deal-content">
            <h4>涉他权力审查</h4>
            <div class="deal_meta">
              <div class="sdmeta">
                涉他权利审查主要是确保合同的标的物或履行内容不会侵犯第三方的合法权益。重点审查合同标的是否涉及第三方的权利，如产权、知识产权、担保物权等，防止合同双方因忽视第三方权利而导致合同无效、无法履行或引发法律纠纷。
              </div>
            </div>
          </div>
        </div>
        <div class="single-deal" style="margin-right: 30px">
          <div class="deal-image">
            <img :src="Zhengzhuang20" alt="" style="height: 290px" />
          </div>
          <div class="deal-content">
            <h4>清洁条款审查</h4>
            <div class="deal_meta">
              <div class="sdmeta">
                清洁条款审查是指对合同条款进行全面细致的审查，确保其中没有模糊、歧义或不合理的内容，特别是在权利义务、违约责任和履行条件等方面。重点是保证合同条款明确、合法，并避免潜在的法律风险和合同漏洞。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="about">
      <div class="about-left">
        <h2 class="knowledge-title" style="font-size: 20px">二、常见的合同陷阱</h2>

        <div class="afeature pt15">
          <div class="row">
            <div class="col-md-6">
              <div class="single_afeature" style="width: 700px; margin-left: -50px">
                <img :src="KangFU3" alt="tent campaing" />
                <h4>使用不明确的词语，导致双方理解不同。确保条款具体、清晰，减少争议。</h4>
              </div>
            </div>
            <br />

            <div class="col-md-6">
              <div class="single_afeature" style="width: 700px; margin-left: -50px">
                <img :src="KangFU7" alt="tent campaing" />
                <h4>合同中暗藏附加费用，导致超出预算。仔细核查，明确所有费用构成。</h4>
              </div>
            </div>
            <br />

            <div class="col-md-6">
              <div class="single_afeature" style="width: 700px; margin-left: -50px">
                <img :src="KangFU13" alt="Wild Campaign" />
                <h4>单方设定高额违约赔偿，责任不对等。确保违约条款公平，避免不合理责任。</h4>
              </div>
            </div>
            <br />

            <div class="col-md-6">
              <div class="single_afeature" style="width: 700px; margin-left: -50px">
                <img :src="KangFU15" alt="Couple Campaign" />
                <h4>免责条款过多，将风险转嫁给另一方。审查并删除不合理的免责条款，保护权益。</h4>
              </div>
            </div>
            <br />

            <div class="col-md-6">
              <div class="single_afeature" style="width: 700px; margin-left: -50px">
                <img :src="KangFU8" alt="Couple Campaign" />
                <h4>规定在对方所在地解决争议，增加成本。争议解决地应对己方有利，便于维权。</h4>
              </div>
            </div>
            <br />
          </div>
        </div>
      </div> -->
  <!-- END COL -->

  <!-- <div class="about-right">
        <div class="about_img">
          <img
            :src="jiangdi"
            alt="Image"
            style="padding-right: 100px; margin-top: 100px; width: 500px"
          />
        </div>
      </div> -->
  <!-- END COL -->
  <!-- </div> -->
  <!-- END CONTAINER -->

  <!-- <p class="knowledge-title" style="font-size: 20px">三、合同审查的注意点</p>
    <div class="zhengduan">
      <div class="service">
        <div class="icon">
          <img :src="KangFU4" alt="img" style="width: 50px; height: 55px" />
        </div>
        <div class="ser_text">
          <h4>合同主体的确认</h4>
          <p>
            核实合同各方的真实身份和签署权限，确保签约方合法且具备履行合同的能力，避免因主体不合规导致合同无效或履约困难。
          </p>
        </div>
      </div> -->
  <!-- END COL -->

  <!-- <div class="service">
        <div class="icon">
          <img :src="KangFU6" alt="img" style="width: 50px; height: 55px" />
        </div>
        <div class="ser_text">
          <h4>权力与义务的明确</h4>
          <p>
            合同应明确规定双方的责任、义务和履行条件，避免含糊的条款，确保双方对各自的任务和时间节点有清晰的理解，以减少后续争议的可能性。
          </p>
        </div>
      </div>

      <div class="service">
        <div class="icon">
          <img :src="KangFU9" alt="img" style="width: 50px; height: 55px" />
        </div>
        <div class="ser_text">
          <h4>违约责任与救济措施</h4>
          <p>
            设定明确的违约责任和赔偿条款，包括违约金或损害赔偿等，保障合同的强制执行力，确保在出现违约情况时有足够的补救措施。
          </p>
        </div>
      </div>

      <div class="service">
        <div class="icon">
          <img :src="KangFU11" alt="img" style="width: 50px; height: 55px" />
        </div>
        <div class="ser_text">
          <h4>争议解决条款</h4>
          <p>
            约定合同争议的解决方式和管辖地，如仲裁或诉讼，指定管辖法院或仲裁机构，保障在发生纠纷时能快速、高效地解决，避免跨区域法律适用问题。
          </p>
        </div>
      </div>
    </div> -->

  <!-- 知识科普
    <div v-for="knowledge in knowledgeLists" :key="knowledge.title">
      <p class="knowledge-title">{{ knowledge.title }}</p>
      <p class="knowledge-content" v-for="(content, index) in knowledge.content" :key="content">
        {{ knowledge.content[index] }}
      </p>
    </div>

    <div class="draft">
      <p class="draft_title">合同质检系统</p>
      <br />
      <p class="draft_title2">智能起草合同，智能质检合同</p>
    </div> -->
  <div class="hero-wrapper">
    <section class="hero">
      <div class="container1">
        <div class="hero-content">
          <h1>智能<span class="highlight">合同质检系统</span>，规避法律风险</h1>
          <p>
            基于AI技术的专业合同审查平台，快速识别合同风险点，提升合同合规性，降低法律纠纷概率。
          </p>
          <!-- 修改 btn-group 中的“立即体验”按钮 -->
          <div class="btn-group">
            <router-link to="/contract-review" class="btn btn-primary">立即体验</router-link>
          </div>
        </div>
        <img
          src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20flat%20vector%20illustration%20of%20an%20AI%20powered%20legal%20contract%20review%20platform%2C%20deep%20blue%20and%20white%20color%20palette%2C%20a%20large%20contract%20document%20with%20checkmarks%2C%20magnifying%20glass%20scanning%20clauses%2C%20scales%20of%20justice%2C%20professional%20corporate%20style%2C%20clean%20background%2C%20soft%20shadows%2C%20high%20quality&image_size=landscape_16_9"
          alt="AI 合同审查主题插画"
          class="hero-image"
        />
      </div>
    </section>
  </div>

  <!-- 功能导航：点击卡片直达对应功能页 -->
  <section class="nav-section">
    <div class="container2">
      <div class="section-header">
        <h2 class="section-title">功能导航</h2>
        <p class="section-subtitle">四大核心能力，覆盖合同全生命周期</p>
      </div>
      <div class="nav-grid">
        <router-link to="/contract-draft" class="nav-card">
          <div class="nav-icon">
            <el-icon><EditPen /></el-icon>
          </div>
          <h3>合同起草</h3>
          <p>AI 智能生成合同初稿，省时省力</p>
          <span class="nav-arrow">立即进入 →</span>
        </router-link>
        <router-link to="/result_analysis" class="nav-card">
          <div class="nav-icon">
            <el-icon><DataAnalysis /></el-icon>
          </div>
          <h3>合同分析</h3>
          <p>多维度统计合同数据，洞察风险分布</p>
          <span class="nav-arrow">立即进入 →</span>
        </router-link>
        <router-link to="/intelligent_Q_A" class="nav-card">
          <div class="nav-icon">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <h3>法务助手</h3>
          <p>随时提问，AI 法务顾问在线解答</p>
          <span class="nav-arrow">立即进入 →</span>
        </router-link>
        <router-link to="/contract-review" class="nav-card">
          <div class="nav-icon">
            <el-icon><View /></el-icon>
          </div>
          <h3>合同审查</h3>
          <p>上传合同文件，快速识别风险条款</p>
          <span class="nav-arrow">立即进入 →</span>
        </router-link>
      </div>
    </div>
  </section>

  <!-- 特点区域 -->
  <section class="features">
    <div class="container2">
      <div class="section-header">
        <h2 class="section-title">核心功能</h2>
        <p class="section-subtitle">
          我们的智能合同质检系统，为您提供专业、高效的合同风险管理解决方案
        </p>
      </div>
      <div class="features-grid1">
        <div class="feature-card">
          <div class="feature-icon">
            <el-icon><Search /></el-icon>
          </div>
          <h3 class="feature-title">智能起草合同</h3>
          <p class="feature-desc">
            DeepSeek AI模型，可实现起草合同，大幅降低人工起草的时间成本与疏漏风险。
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <el-icon><Select /></el-icon>
          </div>
          <h3 class="feature-title">快速高效审查</h3>
          <p class="feature-desc">
            3分钟内完成一份合同的全面审查，效率比传统人工审查提升10倍以上，大幅缩短业务周期。
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <el-icon><ChatDotSquare /></el-icon>
          </div>
          <h3 class="feature-title">智能法律助手</h3>
          <p class="feature-desc">
            提供精准的专业建议与修改方案，让法律事务处理更高效、合规且易操作。
          </p>
        </div>
      </div>
    </div>
  </section>
  <!-- 使用流程 -->
  <section id="process" class="value-proposition">
    <div class="container3">
      <div class="section-header">
        <h2 class="section-title">使用流程</h2>
        <p class="section-subtitle">简单四步，完成专业合同审查</p>
      </div>

      <div class="features-grid2">
        <div class="feature-card">
          <div class="feature-icon">
            <el-icon><DocumentAdd /></el-icon>
          </div>
          <h3 class="feature-title">上传合同</h3>
          <p class="feature-desc">上传需要审查的合同文件，支持多种格式</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <el-icon><Checked /></el-icon>
          </div>
          <h3 class="feature-title">智能分析</h3>
          <p class="feature-desc">AI系统自动分析合同条款和内容</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <el-icon><Document /></el-icon>
          </div>
          <h3 class="feature-title">获取报告</h3>
          <p class="feature-desc">生成详细的风险分析报告和建议</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <el-icon><Select /></el-icon>
          </div>
          <h3 class="feature-title">完成审查</h3>
          <p class="feature-desc">下载审查报告或导出修改后的合同</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="less">
/* 主视觉区域 */
.container1 {
  /* 让子元素垂直排列 */
  display: flex;
  flex-direction: column;
  align-items: center; /* 水平居中 */
  gap: 40px; /* 内容与图片的间距 */
  width: 100%;
  max-width: 1200px; /* 限制容器最大宽度 */
  padding: 0 20px;
}

.hero-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(120deg, #f5f8fd 0%, #e8f0fa 100%);
}
.hero {
  height: 100vh;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
  padding-top: 0;
  background: transparent;
}

.hero-content {
  max-width: 950px;
  animation: fadeInUp 1s ease-out;
  padding: 30px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
  text-align: center;
  white-space: nowrap; /* 禁止自动换行 */
  overflow-wrap: break-word; /* 溢出时强制换行 */
}

.hero h1 {
  font-size: 30px;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 20px;
  color: var(--brand-text-dark);
}

.hero p {
  font-size: 1.2rem;
  margin-bottom: 35px;
  color: var(--brand-text-grey);
  max-width: 85%;
  text-align: center; /* 段落居中 */
  white-space: inherit;
  overflow-wrap: inherit;
}
.hero-image {
  position: static;
  transform: translateY(-50%);
  width: 50%;
  max-width: 800px;
  opacity: 0.9;
  animation: float 8s ease-in-out infinite;
  margin-top: 150px;
  border-radius: 12px;
  height: 300px;
  width: 600px;
}
.highlight {
  color: var(--brand-primary);
  position: relative;
}

.highlight::after {
  content: '';
  position: absolute;
  bottom: 5px;
  left: 0;
  width: 100%;
  height: 10px;
  background-color: rgba(27, 75, 143, 0.12);
  z-index: -1;
}

.btn-group {
  display: flex;
  gap: 15px;
  margin-top: 30px;
  justify-content: center;
}

.btn {
  padding: 14px 32px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-block;
}

.btn-primary {
  background: var(--brand-primary);
  color: white;
  border: 2px solid var(--brand-primary);
  box-shadow: 0 4px 6px rgba(27, 75, 143, 0.3);
}

.btn-primary:hover {
  background: var(--brand-primary-dark);
  transform: translateY(-3px);
  box-shadow: 0 6px 12px rgba(27, 75, 143, 0.4);
}

.btn-outline {
  background: transparent;
  color: var(--brand-primary);
  border: 2px solid var(--brand-primary);
}

.btn-outline:hover {
  background: rgba(27, 75, 143, 0.08);
  transform: translateY(-3px);
}
/* 特点区域 */
.container3 {
  max-width: 100%;
  margin: 80px auto 70px; 
  padding: 0 20px;
}
@media (max-width: 1200px) {
  .features-grid {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    overflow-x: hidden;
  }
}
.features {
  padding: 30px 0;
  background-color: #fff;
}

.section-header {
  text-align: center;
  margin: 80px auto 70px; 
}

.section-title {
  font-size: 2.3rem;
  font-weight: 700;
  margin-bottom: 15px;
  color: var(--brand-text-dark);
  position: relative;
  display: inline-block;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 4px;
  background: var(--brand-primary);
  border-radius: 2px;
}

.section-subtitle {
  font-size: 1.1rem;
  color: var(--brand-text-grey);
  max-width: 700px;
  margin: 20px auto 0;
  line-height: 1.7;
}

.features-grid1 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
}
.features-grid2 {
  display: grid;
   grid-template-columns: repeat(4, 1fr); 
  gap: 30px;
}


.feature-card {
  background: #fff;
  border-radius: var(--card-radius);
  padding: 35px 30px;
  text-align: center;
  box-shadow: var(--card-shadow);
  transition:
    transform 0.3s,
    box-shadow 0.3s;
  border: 1px solid #f1f5f9;
}

.feature-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--card-shadow-hover);
}

.feature-icon {
  width: 70px;
  height: 70px;
  background: var(--brand-primary-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 25px;
  color: var(--brand-primary);
  font-size: 28px;
}

.feature-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 15px;
  color: var(--brand-text-dark);
}

.feature-desc {
  color: var(--brand-text-grey);
  font-size: 1rem;
  line-height: 1.7;
}

/* 功能导航卡片 */
.nav-section {
  padding: 30px 0;
  background-color: #f7fafd;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 30px;
}

.nav-card {
  display: block;
  background: #fff;
  border-radius: var(--card-radius);
  padding: 32px 24px;
  text-align: center;
  box-shadow: var(--card-shadow);
  border: 1px solid #eef2f7;
  text-decoration: none;
  color: inherit;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease,
    border-color 0.3s ease;
}

.nav-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--card-shadow-hover);
  border-color: var(--brand-primary);
}

.nav-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--brand-primary-light);
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  margin: 0 auto 18px;
}

.nav-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--brand-text-dark);
  margin-bottom: 10px;
}

.nav-card p {
  color: var(--brand-text-grey);
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 14px;
}

.nav-arrow {
  color: var(--brand-primary);
  font-weight: 600;
  font-size: 0.95rem;
}

</style>
