<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 报表</p>
        <h1>工单结算汇总表</h1>
        <p class="erp-pagehead-desc">汇总计算工作单的标售、实售、实收及抹零等金额信息，并汇总相应的结算信息。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="exportCsv">导出 CSV</el-button>
      </div>
    </div>

    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="erp-panelhead"><h2>查询条件</h2><span class="erp-panelhead-note">审核时间以工单登记时间代替（原型）。生产成本为估算值（实售 × 42%）</span></div>
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
          <el-date-picker v-model="query.from" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </div>
        <div class="erp-toolbar-item">
          <label>结束日期</label>
          <el-date-picker v-model="query.to" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </div>
        <div class="erp-toolbar-item">
          <label>汇总依据</label>
          <el-select v-model="query.basis" style="width: 120px">
            <el-option label="无" value="无" />
            <el-option label="委托客户" value="委托客户" />
            <el-option label="客户分组" value="客户分组" />
            <el-option label="工单类型" value="工单类型" />
            <el-option label="经手人员" value="经手人员" />
          </el-select>
        </div>
        <div class="erp-toolbar-item">
          <label>工单类型</label>
          <el-select v-model="query.otype" clearable placeholder="全部类型" style="width: 120px">
            <el-option label="普通工单" value="普通工单" />
            <el-option label="加急工单" value="加急工单" />
            <el-option label="返工工单" value="返工工单" />
          </el-select>
        </div>
        <div class="erp-toolbar-item">
          <el-checkbox v-model="query.audited">仅统计已审核的工作单</el-checkbox>
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
          <div class="erp-table-wrap" style="overflow-x: auto">
            <el-table :data="tableData" v-loading="loading" stripe show-summary :summary-method="getSummaries" style="width: 100%">
              <el-table-column label="基础">
                <el-table-column prop="period" label="日期时间" width="140" fixed />
                <el-table-column v-if="query.basis !== '无'" prop="basis" :label="query.basis" width="120" />
                <el-table-column prop="count" label="工单数量" width="100" align="right" />
              </el-table-column>
              <el-table-column label="金额">
                <el-table-column prop="list" label="标售金额（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.list) }}</span></template></el-table-column>
                <el-table-column prop="sale" label="实售金额（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.sale) }}</span></template></el-table-column>
                <el-table-column prop="wipe" label="抹零金额（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.wipe) }}</span></template></el-table-column>
                <el-table-column prop="net" label="实收金额（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.net) }}</span></template></el-table-column>
                <el-table-column prop="paid" label="回款金额（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.paid) }}</span></template></el-table-column>
              </el-table-column>
              <el-table-column label="结算">
                <el-table-column prop="cash" label="现金结算（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.cash) }}</span></template></el-table-column>
                <el-table-column prop="credit" label="记账结算（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.credit) }}</span></template></el-table-column>
                <el-table-column prop="prestore" label="扣预结算（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.prestore) }}</span></template></el-table-column>
              </el-table-column>
              <el-table-column label="发票">
                <el-table-column prop="invAmt" label="发票金额（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.invAmt) }}</span></template></el-table-column>
                <el-table-column prop="invCnt" label="发票数量" width="100" align="right" />
              </el-table-column>
              <el-table-column label="统计">
                <el-table-column prop="avg" label="实收均价（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.avg) }}</span></template></el-table-column>
                <el-table-column prop="disc" label="实收折扣（折）" width="120" align="right"><template #default="{ row }">{{ row.disc.toFixed(2) }}</template></el-table-column>
                <el-table-column prop="perCap" label="人均产值（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.perCap) }}</span></template></el-table-column>
                <el-table-column prop="payRate" label="回款比例" width="100" align="right"><template #default="{ row }">{{ row.payRate }}</template></el-table-column>
              </el-table-column>
              <el-table-column label="成本">
                <el-table-column prop="cost" label="生产成本（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.cost) }}</span></template></el-table-column>
                <el-table-column prop="margin" label="毛利金额（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.margin) }}</span></template></el-table-column>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="数据图表" name="chart">
          <div class="chart-placeholder">
            <p>柱状图：标售金额 / 实收金额 / 回款金额</p>
            <p class="sub-text">横轴：统计期间；纵轴：金额（元）。精确数值见"数据表格"。</p>
            <div class="chart-bars">
              <div v-for="row in tableData" :key="row.period" class="chart-bar-group">
                <div class="chart-bar list" :style="{ height: barH(row.list) + 'px' }" :title="`标售: ${fmtMoney(row.list)}`"></div>
                <div class="chart-bar net" :style="{ height: barH(row.net) + 'px' }" :title="`实收: ${fmtMoney(row.net)}`"></div>
                <div class="chart-bar paid" :style="{ height: barH(row.paid) + 'px' }" :title="`回款: ${fmtMoney(row.paid)}`"></div>
                <span class="chart-label">{{ row.period }}</span>
              </div>
            </div>
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot list"></span>标售金额</span>
              <span class="legend-item"><span class="legend-dot net"></span>实收金额</span>
              <span class="legend-item"><span class="legend-dot paid"></span>回款金额</span>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ tableData.length }} 行</span>
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

const query = reactive({ mode: 'day', from: '2026-08-01', to: '2026-10-31', basis: '无', otype: '', audited: false });

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const barH = (v: number) => Math.min(120, Math.max(4, v / 80));

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  const moneyCols = ['list', 'sale', 'wipe', 'net', 'paid', 'cash', 'credit', 'prestore', 'invAmt', 'avg', 'perCap', 'cost', 'margin'];
  const numCols = ['count', 'invCnt'];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (moneyCols.includes(col.property)) {
      sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else if (numCols.includes(col.property)) {
      sums[i] = String(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else if (col.property === 'disc') {
      const net = data.reduce((s: number, r: any) => s + Number(r.net || 0), 0);
      const list = data.reduce((s: number, r: any) => s + Number(r.list || 0), 0);
      sums[i] = list ? (net / list * 10).toFixed(2) : '—';
    } else if (col.property === 'payRate') {
      const net = data.reduce((s: number, r: any) => s + Number(r.net || 0), 0);
      const paid = data.reduce((s: number, r: any) => s + Number(r.paid || 0), 0);
      sums[i] = net ? (paid / net * 100).toFixed(1) + '%' : '—';
    } else { sums[i] = ''; }
  });
  return sums;
};

const runQuery = () => {
  loading.value = true;
  setTimeout(() => {
    const modeNames: Record<string, string> = { day: '日报', month: '月报', year: '年报', custom: '自定' };
    const empCount = 6;
    tableData.value = [
      { period: '2026-10-20', basis: '', count: 5, list: 2800, sale: 2500, wipe: 2, net: 2498, paid: 2498, cash: 1200, credit: 800, prestore: 498, invAmt: 2498, invCnt: 3, avg: 499.6, disc: 8.93, perCap: 416.33, payRate: '100.0%', cost: 1050, margin: 1450 },
      { period: '2026-10-19', basis: '', count: 3, list: 1500, sale: 1350, wipe: 1, net: 1349, paid: 1000, cash: 600, credit: 400, prestore: 349, invAmt: 1349, invCnt: 2, avg: 449.67, disc: 9.0, perCap: 224.83, payRate: '74.1%', cost: 567, margin: 783 },
      { period: '2026-10-18', basis: '', count: 4, list: 3200, sale: 2800, wipe: 3, net: 2797, paid: 2797, cash: 1500, credit: 800, prestore: 497, invAmt: 2797, invCnt: 4, avg: 699.25, disc: 8.74, perCap: 466.17, payRate: '100.0%', cost: 1176, margin: 1624 },
    ];
    metaText.value = `单位：元 · 时间范围：${query.from} 至 ${query.to}（${modeNames[query.mode]}） · 数据截至 ${new Date().toLocaleString('zh-CN')}`;
    loading.value = false;
  }, 300);
};

const exportCsv = () => { ElMessage.info('导出工单结算汇总表 CSV'); };

onMounted(() => runQuery());
</script>

<style scoped lang="scss">
.mono-cell { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.sub-text { font-size: 12px; color: var(--erp-text-soft); }
.chart-placeholder { padding: 24px; text-align: center; p { margin: 0 0 8px; } }
.chart-bars { display: flex; align-items: flex-end; justify-content: center; gap: 24px; height: 140px; padding: 16px 0; }
.chart-bar-group { display: flex; align-items: flex-end; gap: 4px; }
.chart-bar { width: 16px; border-radius: 2px 2px 0 0; transition: height 0.3s; &.list { background: var(--erp-primary); } &.net { background: var(--erp-ink, #333); } &.paid { background: var(--erp-text-soft); } }
.chart-label { font-size: 11px; color: var(--erp-text-soft); display: block; text-align: center; margin-top: 4px; }
.chart-legend { display: flex; justify-content: center; gap: 16px; margin-top: 8px; }
.legend-item { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.legend-dot { width: 12px; height: 12px; border-radius: 2px; &.list { background: var(--erp-primary); } &.net { background: var(--erp-ink, #333); } &.paid { background: var(--erp-text-soft); } }
</style>
