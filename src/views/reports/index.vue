<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 报表</p>
        <h1>报表中心</h1>
        <p class="erp-pagehead-desc">选择报表进入查询。报表按查询条件即时汇总；审核时间以工单登记时间代替（原型）。</p>
      </div>
    </div>

    <!-- 提醒卡片 -->
    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="erp-panelhead"><h2>提醒</h2><span class="erp-panelhead-note">按默认阈值计算 · 数据截至 {{ now }}</span></div>
      <div class="report-cards">
        <div class="report-card" @click="router.push('/reports/bizAlert')">
          <h3>业务提醒</h3>
          <p>交付超期工单 {{ alertCounts.overdue }} 单、未结算工单 {{ alertCounts.unsettled }} 单、客户欠款超限 {{ alertCounts.debt }} 个、预存余额不足 {{ alertCounts.low }} 张、未审核单据 {{ alertCounts.unaudited }} 张。</p>
        </div>
      </div>
    </div>

    <!-- 基础报表 -->
    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="erp-panelhead"><h2>基础报表</h2><span class="erp-panelhead-note">3 张报表</span></div>
      <div class="report-cards">
        <div v-for="item in basicReports" :key="item.id" class="report-card" @click="router.push(item.path)">
          <h3>{{ item.title }}</h3>
          <p>{{ item.desc }}</p>
        </div>
      </div>
    </div>

    <!-- 客户类报表 -->
    <div class="erp-panel">
      <div class="erp-panelhead"><h2>客户类报表</h2><span class="erp-panelhead-note">6 张报表</span></div>
      <div class="report-cards">
        <div v-for="item in customerReports" :key="item.id" class="report-card" @click="router.push(item.path)">
          <h3>{{ item.title }}</h3>
          <p>{{ item.desc }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const now = new Date().toLocaleString('zh-CN');

const alertCounts = reactive({ overdue: 2, unsettled: 3, debt: 1, low: 2, unaudited: 5 });

const basicReports = [
  { id: 'incomeExpense', title: '营业收支汇总表', desc: '汇总指定时间内审核的各项财务相关的收入、支出类单据的金额信息。', path: '/reports/incomeExpense' },
  { id: 'orderSettle', title: '工单结算汇总表', desc: '汇总计算工作单的标售、实售、实收及抹零等金额信息，并汇总相应的结算信息。', path: '/reports/orderSettle' },
  { id: 'itemsSummary', title: '经营项目汇总表', desc: '汇总统计在指定时间范围内审核的工作单的制作明细所选定的经营项目信息。', path: '/reports/itemsSummary' },
];

const customerReports = [
  { id: 'custValue', title: '客户价值分析表', desc: '以工单的审核时间为基础，汇总选定客户12个月以来的消费数据，以供进行价格分析。', path: '/reports/custValue' },
  { id: 'custNew', title: '客户新增汇总表', desc: '汇总在指定时间范围内新增的客户数量并统计各类业务特征名下的新增客户数量。', path: '/reports/custNew' },
  { id: 'cardSummary', title: '会员办卡汇总表', desc: '汇总计算客户办理会员卡片的相关数据信息。', path: '/reports/cardSummary' },
  { id: 'custRevenueRank', title: '客户工单实收排行表', desc: '对指定时间内审核的工作单，按照下单客户汇总工单实收金额，并以实收金额排序。', path: '/reports/custRevenueRank' },
  { id: 'custAvgRank', title: '客户工单均价排行表', desc: '对指定时间内审核的工作单，按照下单客户汇总工单数量及实收总额计算出每单均价，并以此均价对比排行。', path: '/reports/custAvgRank' },
  { id: 'custCountRank', title: '客户工单数量排行表', desc: '对指定时间内审核的工作单，按照下单客户汇总工单数量，并以工单数量对比排行。', path: '/reports/custCountRank' },
];
</script>

<style scoped lang="scss">
.report-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding: 16px; }
.report-card {
  padding: var(--erp-space-4);
  border: 1px solid var(--erp-line);
  border-radius: var(--erp-control-radius);
  cursor: pointer;
  transition: all var(--erp-motion-duration);
  &:hover { border-color: var(--erp-primary); box-shadow: 0 2px 8px rgba(212, 25, 32, 0.1); }
  h3 { font-size: var(--erp-section-size); color: var(--erp-ink); margin: 0 0 var(--erp-space-1); }
  p { font-size: var(--erp-caption-size); color: var(--erp-muted); margin: 0; line-height: 1.5; }
}
</style>
