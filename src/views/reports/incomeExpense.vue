<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 报表</p>
        <h1>营业收支汇总表</h1>
        <p class="erp-pagehead-desc">汇总指定时间内审核的各项财务相关的收入、支出类单据的金额信息。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="exportCsv">导出 CSV</el-button>
      </div>
    </div>

    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="erp-panelhead"><h2>查询条件</h2><span class="erp-panelhead-note">修改条件后点"统计"重新汇总</span></div>
      <div class="erp-toolbar">
        <div class="erp-toolbar-item">
          <label>统计周期</label>
          <el-select v-model="query.mode" style="width: 100px">
            <el-option label="日报" value="day" />
            <el-option label="月报" value="month" />
            <el-option label="年报" value="year" />
            <el-option label="自定" value="custom" />
          </el-select>
        </div>
        <div class="erp-toolbar-item">
          <label>开始日期</label>
          <el-date-picker v-model="query.from" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 150px" />
        </div>
        <div class="erp-toolbar-item">
          <label>结束日期</label>
          <el-date-picker v-model="query.to" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 150px" />
        </div>
        <div class="erp-toolbar-actions">
          <el-button type="primary" @click="runQuery">统计</el-button>
        </div>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead">
        <h2>统计结果</h2>
        <span class="erp-panelhead-note">{{ metaText }}</span>
      </div>
      <el-tabs v-model="activeTab" style="padding: 0 16px">
        <el-tab-pane label="数据表格" name="table">
          <div class="erp-table-wrap">
            <el-table :data="tableData" v-loading="loading" stripe show-summary :summary-method="getSummaries" style="width: 100%">
              <el-table-column prop="period" label="日期时间" width="140" fixed />
              <el-table-column label="基础">
                <el-table-column prop="income" label="收入小计（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.income) }}</span></template></el-table-column>
                <el-table-column prop="expense" label="支出小计（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.expense) }}</span></template></el-table-column>
              </el-table-column>
              <el-table-column label="收入">
                <el-table-column prop="misc" label="小额零收（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.misc) }}</span></template></el-table-column>
                <el-table-column prop="cash" label="现收结算（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.cash) }}</span></template></el-table-column>
                <el-table-column prop="credit" label="记账结算（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.credit) }}</span></template></el-table-column>
                <el-table-column prop="prestore" label="扣预结算（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.prestore) }}</span></template></el-table-column>
                <el-table-column prop="scan" label="扫码结算（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.scan) }}</span></template></el-table-column>
                <el-table-column prop="cloud" label="云端结算（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.cloud) }}</span></template></el-table-column>
                <el-table-column prop="genIn" label="一般收入（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.genIn) }}</span></template></el-table-column>
              </el-table-column>
              <el-table-column label="支出">
                <el-table-column prop="genOut" label="一般支出（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.genOut) }}</span></template></el-table-column>
              </el-table-column>
              <el-table-column label="利润">
                <el-table-column prop="profit" label="利润小计（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell" :class="{ 'text-danger': row.profit < 0 }">{{ fmtMoney(row.profit) }}</span></template></el-table-column>
                <el-table-column prop="perCap" label="人均收入（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.perCap) }}</span></template></el-table-column>
                <el-table-column prop="rate" label="利润率" width="100" align="right"><template #default="{ row }">{{ row.rate }}</template></el-table-column>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="数据图表" name="chart">
          <div class="chart-placeholder">
            <p>折线图：收入小计 vs 支出小计</p>
            <p class="sub-text">横轴：统计期间；纵轴：金额（元）。精确数值见"数据表格"。</p>
            <div class="chart-bars">
              <div v-for="row in tableData" :key="row.period" class="chart-bar-group">
                <div class="chart-bar income" :style="{ height: barHeight(row.income) + 'px' }" :title="`收入: ${fmtMoney(row.income)}`"></div>
                <div class="chart-bar expense" :style="{ height: barHeight(row.expense) + 'px' }" :title="`支出: ${fmtMoney(row.expense)}`"></div>
                <span class="chart-label">{{ row.period }}</span>
              </div>
            </div>
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot income"></span>收入小计</span>
              <span class="legend-item"><span class="legend-dot expense"></span>支出小计</span>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ tableData.length }} 行</span>
      </div>
    </div>

    <!-- 收支核算规则 -->
    <div class="erp-panel" style="margin-top: 16px">
      <div class="erp-panelhead"><h2>收支核算规则</h2><span class="erp-panelhead-note">各类单据计入哪个栏目</span></div>
      <div class="erp-table-wrap">
        <el-table :data="rulesData" stripe size="small" style="width: 100%">
          <el-table-column prop="src" label="单据来源" width="200" />
          <el-table-column prop="cond" label="条件" min-width="300" />
          <el-table-column prop="col" label="计入栏目" width="200" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const loading = ref(false);
const activeTab = ref('table');
const tableData = ref<any[]>([]);
const metaText = ref('尚未统计');

const query = reactive({ mode: 'day', from: '2026-08-01', to: '2026-10-31' });

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const rulesData = [
  { src: '小额零收', cond: '全部', col: '小额零收' },
  { src: '结算单（已审核）', cond: '结算方式 = 现金', col: '现收结算' },
  { src: '结算单（已审核）', cond: '结算方式 = 刷卡', col: '现收结算' },
  { src: '结算单（已审核）', cond: '结算方式 = 转账', col: '现收结算' },
  { src: '结算单（已审核）', cond: '结算方式 = 记账', col: '记账结算' },
  { src: '结算单（已审核）', cond: '结算方式 = 预存', col: '扣预结算' },
  { src: '结算单（已审核）', cond: '结算方式 = 微信', col: '扫码结算' },
  { src: '结算单（已审核）', cond: '结算方式 = 支付宝', col: '扫码结算' },
  { src: '结算单（已审核）', cond: '云端订单的在线付款（优先于结算方式）', col: '云端结算' },
  { src: '一般收支（已审核）', cond: '一般收入', col: '一般收入' },
  { src: '一般收支（已审核）', cond: '一般支出', col: '一般支出（计入支出小计）' },
  { src: '—', cond: '人均收入 = 利润小计 ÷ 在职员工数', col: '利润' },
];

const barHeight = (v: number) => Math.min(120, Math.max(4, v / 50));

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  const moneyCols = ['income', 'expense', 'misc', 'cash', 'credit', 'prestore', 'scan', 'cloud', 'genIn', 'genOut', 'profit', 'perCap'];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (moneyCols.includes(col.property)) {
      sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else if (col.property === 'rate') {
      const income = data.reduce((s: number, r: any) => s + Number(r.income || 0), 0);
      const profit = data.reduce((s: number, r: any) => s + Number(r.profit || 0), 0);
      sums[i] = income ? (profit / income * 100).toFixed(1) + '%' : '—';
    } else { sums[i] = ''; }
  });
  return sums;
};

const runQuery = () => {
  loading.value = true;
  setTimeout(() => {
    const modeNames: Record<string, string> = { day: '日报', month: '月报', year: '年报', custom: '自定' };
    tableData.value = [
      { period: '2026-10-20', income: 12580, expense: 3200, misc: 350, cash: 5800, credit: 2400, prestore: 1800, scan: 2230, cloud: 0, genIn: 0, genOut: 3200, profit: 9380, perCap: 1563.33, rate: '74.6%' },
      { period: '2026-10-19', income: 8960, expense: 2100, misc: 180, cash: 3200, credit: 1800, prestore: 1500, scan: 2280, cloud: 0, genIn: 0, genOut: 2100, profit: 6860, perCap: 1143.33, rate: '76.6%' },
      { period: '2026-10-18', income: 15200, expense: 4500, misc: 520, cash: 6800, credit: 3200, prestore: 2400, scan: 2280, cloud: 0, genIn: 0, genOut: 4500, profit: 10700, perCap: 1783.33, rate: '70.4%' },
      { period: '2026-10-17', income: 6340, expense: 1800, misc: 140, cash: 2400, credit: 1200, prestore: 800, scan: 1800, cloud: 0, genIn: 0, genOut: 1800, profit: 4540, perCap: 756.67, rate: '71.6%' },
      { period: '2026-10-16', income: 9870, expense: 2800, misc: 270, cash: 4200, credit: 2100, prestore: 1500, scan: 1800, cloud: 0, genIn: 0, genOut: 2800, profit: 7070, perCap: 1178.33, rate: '71.6%' },
    ];
    metaText.value = `单位：元（数量、比例列除外） · 时间范围：${query.from} 至 ${query.to}（${modeNames[query.mode]}） · 数据截至 ${new Date().toLocaleString('zh-CN')}`;
    loading.value = false;
  }, 300);
};

const exportCsv = () => { ElMessage.info('导出营业收支汇总表 CSV'); };

onMounted(() => runQuery());
</script>

<style scoped lang="scss">
.mono-cell { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.text-danger { color: var(--erp-danger, #f56c6c); }
.sub-text { font-size: 12px; color: var(--erp-text-soft); }
.chart-placeholder { padding: 24px; text-align: center; p { margin: 0 0 8px; } }
.chart-bars { display: flex; align-items: flex-end; justify-content: center; gap: 24px; height: 140px; padding: 16px 0; }
.chart-bar-group { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.chart-bar { width: 24px; border-radius: 2px 2px 0 0; transition: height 0.3s; &.income { background: var(--erp-primary); } &.expense { background: var(--erp-text-soft); } }
.chart-label { font-size: 11px; color: var(--erp-text-soft); }
.chart-legend { display: flex; justify-content: center; gap: 16px; margin-top: 8px; }
.legend-item { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.legend-dot { width: 12px; height: 12px; border-radius: 2px; &.income { background: var(--erp-primary); } &.expense { background: var(--erp-text-soft); } }
</style>
