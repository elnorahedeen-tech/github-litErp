<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 报表</p>
        <h1>客户价值分析表</h1>
        <p class="erp-pagehead-desc">以工单的审核时间为基础，汇总选定客户12个月以来的消费数据，以供进行价格分析。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="exportCsv">导出 CSV</el-button>
      </div>
    </div>

    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="erp-panelhead"><h2>查询条件</h2><span class="erp-panelhead-note">选择客户后点"统计"。审核时间以工单登记时间代替（原型）</span></div>
      <div class="erp-toolbar">
        <div class="erp-toolbar-item" style="flex: 2 1 360px">
          <label>分析客户</label>
          <el-select v-model="query.cust" style="width: 100%">
            <el-option v-for="c in customerOptions" :key="c.code" :label="`${c.code} ${c.name}（${c.groupName}）`" :value="c.code" />
          </el-select>
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
        <el-tab-pane label="销售汇总（月份）" name="monthly">
          <div class="erp-table-wrap">
            <el-table :data="monthlyData" v-loading="loading" stripe show-summary :summary-method="getMonthlySummaries" style="width: 100%">
              <el-table-column label="期间">
                <el-table-column prop="period" label="审核月份" width="120" fixed />
                <el-table-column prop="count" label="单数" width="80" align="right" />
              </el-table-column>
              <el-table-column label="金额">
                <el-table-column prop="list" label="标售（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.list) }}</span></template></el-table-column>
                <el-table-column prop="disc" label="优惠（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.disc) }}</span></template></el-table-column>
                <el-table-column prop="sale" label="实售（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.sale) }}</span></template></el-table-column>
                <el-table-column prop="wipe" label="抹零（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.wipe) }}</span></template></el-table-column>
                <el-table-column prop="net" label="实收（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.net) }}</span></template></el-table-column>
                <el-table-column prop="avg" label="均收（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.avg) }}</span></template></el-table-column>
              </el-table-column>
              <el-table-column label="工时（估算）">
                <el-table-column prop="plan" label="委托工时（小时）" width="130" align="right"><template #default="{ row }">{{ row.plan.toFixed(1) }}</template></el-table-column>
                <el-table-column prop="act" label="实际工时（小时）" width="130" align="right"><template #default="{ row }">{{ row.act.toFixed(1) }}</template></el-table-column>
                <el-table-column prop="cost" label="生产耗时（小时）" width="130" align="right"><template #default="{ row }">{{ row.cost.toFixed(1) }}</template></el-table-column>
              </el-table-column>
            </el-table>
          </div>
          <div class="chart-placeholder">
            <p>折线图：实收 vs 标售（近 12 个月）</p>
            <div class="chart-lines">
              <div v-for="row in monthlyData" :key="row.period" class="chart-point-group">
                <div class="chart-line-net" :style="{ height: barH(row.net) + 'px' }"></div>
                <div class="chart-line-list" :style="{ height: barH(row.list) + 'px' }"></div>
                <span class="chart-label">{{ row.period.slice(5) }}</span>
              </div>
            </div>
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-line solid"></span>实收</span>
              <span class="legend-item"><span class="legend-line dashed"></span>标售</span>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="销售汇总（年度）" name="yearly">
          <div class="erp-table-wrap">
            <el-table :data="yearlyData" stripe show-summary :summary-method="getYearlySummaries" style="width: 100%">
              <el-table-column label="期间">
                <el-table-column prop="period" label="审核年度" width="120" fixed />
                <el-table-column prop="count" label="单数" width="80" align="right" />
              </el-table-column>
              <el-table-column label="金额">
                <el-table-column prop="list" label="标售（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.list) }}</span></template></el-table-column>
                <el-table-column prop="disc" label="优惠（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.disc) }}</span></template></el-table-column>
                <el-table-column prop="sale" label="实售（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.sale) }}</span></template></el-table-column>
                <el-table-column prop="net" label="实收（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.net) }}</span></template></el-table-column>
                <el-table-column prop="avg" label="均收（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.avg) }}</span></template></el-table-column>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="经营项目" name="items">
          <div class="erp-table-wrap">
            <el-table :data="itemsData" stripe show-summary :summary-method="getItemsSummaries" style="width: 100%">
              <el-table-column label="项目">
                <el-table-column prop="cat" label="主项名称" width="120" />
                <el-table-column prop="name" label="子项名称" min-width="160" />
                <el-table-column prop="count" label="单数" width="80" align="right" />
                <el-table-column prop="qty" label="数量" width="80" align="right" />
              </el-table-column>
              <el-table-column label="金额">
                <el-table-column prop="list" label="标售（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.list) }}</span></template></el-table-column>
                <el-table-column prop="disc" label="优惠（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.disc) }}</span></template></el-table-column>
                <el-table-column prop="sale" label="实售（元）" width="120" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.sale) }}</span></template></el-table-column>
                <el-table-column prop="avg" label="实售均价（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.avg) }}</span></template></el-table-column>
                <el-table-column prop="share" label="实售占比" width="100" align="right"><template #default="{ row }">{{ row.share }}</template></el-table-column>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>{{ statusText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const loading = ref(false);
const activeTab = ref('monthly');
const metaText = ref('尚未统计');
const statusText = ref('');

const query = reactive({ cust: '1010' });

const customerOptions = [
  { code: '1010', name: '长沙理工大学', groupName: '设计院' },
  { code: '1020', name: '湖南省测绘院', groupName: '政府单位' },
  { code: '1030', name: '商务局', groupName: '设计院' },
  { code: '2001', name: '张三', groupName: '普通' },
  { code: '2002', name: '李四', groupName: '普通' },
  { code: '2003', name: '王五', groupName: '普通' },
];

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const barH = (v: number) => Math.min(80, Math.max(4, v / 40));

const monthlyData = ref<any[]>([]);
const yearlyData = ref<any[]>([]);
const itemsData = ref<any[]>([]);

const getMonthlySummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['count'].includes(col.property)) { sums[i] = String(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0)); }
    else if (['list', 'disc', 'sale', 'wipe', 'net'].includes(col.property)) { sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0)); }
    else if (col.property === 'avg') { const total = data.reduce((s: number, r: any) => s + Number(r.net || 0), 0); const cnt = data.reduce((s: number, r: any) => s + Number(r.count || 0), 0); sums[i] = cnt ? fmtMoney(total / cnt) : '—'; }
    else if (['plan', 'act', 'cost'].includes(col.property)) { sums[i] = data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0).toFixed(1); }
    else { sums[i] = ''; }
  });
  return sums;
};

const getYearlySummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (col.property === 'count') { sums[i] = String(data.reduce((s: number, r: any) => s + Number(r.count || 0), 0)); }
    else if (['list', 'disc', 'sale', 'net'].includes(col.property)) { sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0)); }
    else if (col.property === 'avg') { const total = data.reduce((s: number, r: any) => s + Number(r.net || 0), 0); const cnt = data.reduce((s: number, r: any) => s + Number(r.count || 0), 0); sums[i] = cnt ? fmtMoney(total / cnt) : '—'; }
    else { sums[i] = ''; }
  });
  return sums;
};

const getItemsSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['count', 'qty'].includes(col.property)) { sums[i] = String(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0)); }
    else if (['list', 'disc', 'sale'].includes(col.property)) { sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0)); }
    else if (col.property === 'avg') { const total = data.reduce((s: number, r: any) => s + Number(r.sale || 0), 0); const qty = data.reduce((s: number, r: any) => s + Number(r.qty || 0), 0); sums[i] = qty ? fmtMoney(total / qty) : '—'; }
    else if (col.property === 'share') { sums[i] = '100.0%'; }
    else { sums[i] = ''; }
  });
  return sums;
};

const runQuery = () => {
  loading.value = true;
  const cust = customerOptions.find(c => c.code === query.cust);
  setTimeout(() => {
    monthlyData.value = [
      { period: '2026-05', count: 0, list: 0, disc: 0, sale: 0, wipe: 0, net: 0, avg: 0, plan: 0, act: 0, cost: 0 },
      { period: '2026-06', count: 1, list: 800, disc: 80, sale: 720, wipe: 0, net: 720, avg: 720, plan: 3, act: 2.7, cost: 3.51 },
      { period: '2026-07', count: 2, list: 1500, disc: 150, sale: 1350, wipe: 1, net: 1349, avg: 674.5, plan: 6, act: 5.4, cost: 7.02 },
      { period: '2026-08', count: 3, list: 2400, disc: 240, sale: 2160, wipe: 2, net: 2158, avg: 719.33, plan: 9, act: 8.1, cost: 10.53 },
      { period: '2026-09', count: 2, list: 1800, disc: 180, sale: 1620, wipe: 1, net: 1619, avg: 809.5, plan: 6, act: 5.4, cost: 7.02 },
      { period: '2026-10', count: 4, list: 3200, disc: 320, sale: 2880, wipe: 3, net: 2877, avg: 719.25, plan: 12, act: 10.8, cost: 14.04 },
    ];
    yearlyData.value = [
      { period: '2025', count: 5, list: 4500, disc: 450, sale: 4050, net: 4047, avg: 809.4 },
      { period: '2026', count: 12, list: 9700, disc: 970, sale: 8730, net: 8723, avg: 726.92 },
    ];
    const totalSale = 720 + 1350 + 2160 + 1620 + 2880;
    itemsData.value = [
      { cat: '广告喷绘', name: '车贴（反光膜）', count: 4, qty: 24, list: 1560, disc: 156, sale: 1404, avg: 58.5, share: (1404 / totalSale * 100).toFixed(1) + '%' },
      { cat: '广告喷绘', name: '相纸写真', count: 3, qty: 12, list: 540, disc: 54, sale: 486, avg: 40.5, share: (486 / totalSale * 100).toFixed(1) + '%' },
      { cat: '标识标牌', name: '不锈钢腐蚀牌', count: 2, qty: 5, list: 900, disc: 90, sale: 810, avg: 162, share: (810 / totalSale * 100).toFixed(1) + '%' },
      { cat: '装裱服务', name: '冷裱覆膜', count: 3, qty: 15, list: 225, disc: 22.5, sale: 202.5, avg: 13.5, share: (202.5 / totalSale * 100).toFixed(1) + '%' },
    ];
    metaText.value = `客户：${cust?.code} ${cust?.name}（${cust?.groupName}） · 单位：元（工时：小时） · 时间范围：近 12 个月 · 数据截至 ${new Date().toLocaleString('zh-CN')}`;
    statusText.value = `${cust?.name}：近 12 个月 12 张工单，实收 ￥8,723.00 元。`;
    loading.value = false;
  }, 300);
};

const exportCsv = () => { ElMessage.info('导出客户价值分析表 CSV'); };

onMounted(() => runQuery());
</script>

<style scoped lang="scss">
.mono-cell { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.chart-placeholder { padding: 24px; text-align: center; p { margin: 0 0 8px; } }
.chart-lines { display: flex; align-items: flex-end; justify-content: center; gap: 16px; height: 100px; padding: 16px 0; }
.chart-point-group { display: flex; align-items: flex-end; gap: 2px; flex-direction: column; }
.chart-line-net { width: 4px; background: var(--erp-primary); border-radius: 2px; }
.chart-line-list { width: 4px; background: var(--erp-text-soft); border-radius: 2px; border-style: dashed; }
.chart-label { font-size: 11px; color: var(--erp-text-soft); }
.chart-legend { display: flex; justify-content: center; gap: 16px; margin-top: 8px; }
.legend-item { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.legend-line { width: 20px; height: 2px; &.solid { background: var(--erp-primary); } &.dashed { border-top: 2px dashed var(--erp-text-soft); height: 0; } }
</style>
