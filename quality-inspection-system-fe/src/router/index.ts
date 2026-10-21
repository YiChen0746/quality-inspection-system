import { createRouter, createWebHistory } from 'vue-router';
import { defineComponent } from 'vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/knowledge_promotion'
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/email-verification',
      name: 'EmailVerification',
      component: () => import('../views/EmailVerification.vue')
    },
    {
      path: '/knowledge_promotion',
      name: 'KnowledgePromotion',
      component: () => import('../views/KnowledgePromotion.vue')
    },
    {
      path: '/result_analysis',
      name: 'ResultAnalysis',
      component: () => import('../views/ResultAnalysis2.vue')
    },
  
    {
      path: '/quality_inspection',
      name: 'QualityInspection',
      component: () => import('../views/QualityInspection1.vue')
    },
    {
      path: '/intelligent_Q_A',
      name: 'IntelligentQA',
      component: () => import('../views/IntelligentQA.vue')
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('../views/upload1.vue')
    },
    {
      path: '/editword',
      name: 'editword',
      component: () => import('../views/editword.vue'),
    },
    {
      path: '/contract-review',
      name: 'ContractReview',
      component: () => import('../views/ContractReview.vue')
    },
    {
      path: '/contract-draft',
      name: 'ContractDraft',
      component: () => import('../views/ContractDraft.vue')
    },
    {
      path: '/multi-agent',
      name: 'MultiAgentReview',
      component: () => import('../views/MultiAgentReview.vue')
    }

  ]
})

export default router
