import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    replace: true,
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: Layout,
    redirect: '/frontdesk',
    children: [
      // 前台模块子页面
      {
        path: 'frontdesk',
        component: () => import('@/views/frontdesk/index.vue'),
        meta: { title: '前台业务中心', module: 'front' },
      },
      {
        path: 'frontdesk/newOrder',
        component: () => import('@/views/frontdesk/newOrder.vue'),
        meta: { title: '新建工单', module: 'front' },
      },
      {
        path: 'frontdesk/orderRecords',
        component: () => import('@/views/frontdesk/orderRecords.vue'),
        meta: { title: '工单记录', module: 'front' },
      },
      {
        path: 'frontdesk/orderDetail',
        component: () => import('@/views/frontdesk/orderDetail.vue'),
        meta: { title: '工单详情', module: 'front' },
      },
      {
        path: 'frontdesk/cloudCenter',
        component: () => import('@/views/frontdesk/cloudCenter.vue'),
        meta: { title: '云端业务中心', module: 'front' },
      },
      {
        path: 'frontdesk/settleRecords',
        component: () => import('@/views/frontdesk/settleRecords.vue'),
        meta: { title: '结算记录', module: 'front' },
      },
      {
        path: 'frontdesk/prestore',
        component: () => import('@/views/frontdesk/prestore.vue'),
        meta: { title: '预存储值', module: 'front' },
      },
      {
        path: 'frontdesk/prestoreRecords',
        component: () => import('@/views/frontdesk/prestoreRecords.vue'),
        meta: { title: '预存记录', module: 'front' },
      },
      {
        path: 'frontdesk/cardInfo',
        component: () => import('@/views/frontdesk/cardInfo.vue'),
        meta: { title: '会员卡资料', module: 'front' },
      },
      {
        path: 'frontdesk/dailyReport',
        component: () => import('@/views/frontdesk/dailyReport.vue'),
        meta: { title: '营业日报', module: 'front' },
      },
      {
        path: 'frontdesk/miscIncome',
        component: () => import('@/views/frontdesk/miscIncome.vue'),
        meta: { title: '零收', module: 'front' },
      },
      {
        path: 'frontdesk/miscIncomeRecords',
        component: () => import('@/views/frontdesk/miscIncomeRecords.vue'),
        meta: { title: '零收记录', module: 'front' },
      },
      {
        path: 'production',
        component: () => import('@/views/production/index.vue'),
        meta: { title: '生产业务中心', module: 'prod' },
      },
      {
        path: 'production/prodDetail',
        component: () => import('@/views/production/prodDetail.vue'),
        meta: { title: '制作明细记录', module: 'prod' },
      },
      {
        path: 'finance',
        component: () => import('@/views/finance/index.vue'),
        meta: { title: '财务业务中心', module: 'fin' },
      },
      {
        path: 'finance/smartSettle',
        component: () => import('@/views/finance/smartSettle.vue'),
        meta: { title: '智多结算中心', module: 'fin' },
      },
      {
        path: 'finance/cashBalance',
        component: () => import('@/views/finance/cashBalance.vue'),
        meta: { title: '现金余额', module: 'fin' },
      },
      {
        path: 'finance/bankBalance',
        component: () => import('@/views/finance/bankBalance.vue'),
        meta: { title: '银行余额', module: 'fin' },
      },
      {
        path: 'finance/transferRecords',
        component: () => import('@/views/finance/transferRecords.vue'),
        meta: { title: '转账记录', module: 'fin' },
      },
      {
        path: 'finance/custBalance',
        component: () => import('@/views/finance/custBalance.vue'),
        meta: { title: '客户结余', module: 'fin' },
      },
      {
        path: 'finance/arSummary',
        component: () => import('@/views/finance/arSummary.vue'),
        meta: { title: '应收汇总', module: 'fin' },
      },
      {
        path: 'finance/custStatement',
        component: () => import('@/views/finance/custStatement.vue'),
        meta: { title: '客户对账', module: 'fin' },
      },
      {
        path: 'finance/writeOffRecords',
        component: () => import('@/views/finance/writeOffRecords.vue'),
        meta: { title: '销账记录', module: 'fin' },
      },
      {
        path: 'finance/generalRecords',
        component: () => import('@/views/finance/generalRecords.vue'),
        meta: { title: '收支记录', module: 'fin' },
      },
      {
        path: 'finance/periodClose',
        component: () => import('@/views/finance/periodClose.vue'),
        meta: { title: '期末结账', module: 'fin' },
      },
      {
        path: 'finance/accountCalendar',
        component: () => import('@/views/finance/accountCalendar.vue'),
        meta: { title: '会计日历', module: 'fin' },
      },
      {
        path: 'customer',
        component: () => import('@/views/customer/index.vue'),
        meta: { title: '客户资料', module: 'cust' },
      },
      {
        path: 'customer/detail',
        component: () => import('@/views/customer/customerDetail.vue'),
        meta: { title: '客户详情', module: 'cust' },
      },
      {
        path: 'customer/contacts',
        component: () => import('@/views/customer/contacts.vue'),
        meta: { title: '联络人员', module: 'cust' },
      },
      {
        path: 'customer/groupPrice',
        component: () => import('@/views/customer/groupPrice.vue'),
        meta: { title: '分组价格', module: 'cust' },
      },
      {
        path: 'customer/agreementPrice',
        component: () => import('@/views/customer/agreementPrice.vue'),
        meta: { title: '协议价格', module: 'cust' },
      },
      {
        path: 'customer/custMerge',
        component: () => import('@/views/customer/custMerge.vue'),
        meta: { title: '客户合并', module: 'cust' },
      },
      {
        path: 'reports',
        component: () => import('@/views/reports/index.vue'),
        meta: { title: '报表中心', module: 'rpt' },
      },
      {
        path: 'reports/bizAlert',
        component: () => import('@/views/reports/bizAlert.vue'),
        meta: { title: '业务提醒', module: 'rpt' },
      },
      {
        path: 'reports/incomeExpense',
        component: () => import('@/views/reports/incomeExpense.vue'),
        meta: { title: '营业收支汇总表', module: 'rpt' },
      },
      {
        path: 'reports/orderSettle',
        component: () => import('@/views/reports/orderSettle.vue'),
        meta: { title: '工单结算汇总表', module: 'rpt' },
      },
      {
        path: 'reports/itemsSummary',
        component: () => import('@/views/reports/itemsSummary.vue'),
        meta: { title: '经营项目汇总表', module: 'rpt' },
      },
      {
        path: 'reports/custValue',
        component: () => import('@/views/reports/custValue.vue'),
        meta: { title: '客户价值分析表', module: 'rpt' },
      },
      {
        path: 'reports/custNew',
        component: () => import('@/views/reports/custNew.vue'),
        meta: { title: '客户新增汇总表', module: 'rpt' },
      },
      {
        path: 'reports/cardSummary',
        component: () => import('@/views/reports/cardSummary.vue'),
        meta: { title: '会员办卡汇总表', module: 'rpt' },
      },
      {
        path: 'reports/custRevenueRank',
        component: () => import('@/views/reports/custRevenueRank.vue'),
        meta: { title: '客户工单实收排行表', module: 'rpt' },
      },
      {
        path: 'reports/custAvgRank',
        component: () => import('@/views/reports/custAvgRank.vue'),
        meta: { title: '客户工单均价排行表', module: 'rpt' },
      },
      {
        path: 'reports/custCountRank',
        component: () => import('@/views/reports/custCountRank.vue'),
        meta: { title: '客户工单数量排行表', module: 'rpt' },
      },
      {
        path: 'system',
        component: () => import('@/views/system/index.vue'),
        meta: { title: '员工资料', module: 'sys' },
      },
      {
        path: 'system/bizItems',
        component: () => import('@/views/system/bizItems.vue'),
        meta: { title: '经营项目', module: 'sys' },
      },
      {
        path: 'system/custGroups',
        component: () => import('@/views/system/custGroups.vue'),
        meta: { title: '客户分组', module: 'sys' },
      },
      {
        path: 'system/prodFlow',
        component: () => import('@/views/system/prodFlow.vue'),
        meta: { title: '生产流程', module: 'sys' },
      },
      {
        path: 'system/chartOfAccounts',
        component: () => import('@/views/system/chartOfAccounts.vue'),
        meta: { title: '会计科目', module: 'sys' },
      },
      {
        path: 'system/roles',
        component: () => import('@/views/system/roles.vue'),
        meta: { title: '角色权限', module: 'sys' },
      },
      {
        path: 'system/runParams',
        component: () => import('@/views/system/runParams.vue'),
        meta: { title: '运行参数', module: 'sys' },
      },
      {
        path: 'system/printStyles',
        component: () => import('@/views/system/printStyles.vue'),
        meta: { title: '打印样式', module: 'sys' },
      },
      {
        path: 'system/baseData',
        component: () => import('@/views/system/baseData.vue'),
        meta: { title: '基础数据', module: 'sys' },
      },
      {
        path: 'system/dataImport',
        component: () => import('@/views/system/dataImport.vue'),
        meta: { title: '数据导入', module: 'sys' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  document.title = (to.meta.title as string) || 'LiteERP';

  const pathArr = ['/login'];
  if (pathArr.includes(to.path) || localStorage.getItem('Token')) {
    next();
  } else {
    next('/login');
    localStorage.clear();
  }
});

export default router;
