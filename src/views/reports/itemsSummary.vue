<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 报表</p>
        <h1>经营项目汇总表</h1>
        <p class="erp-pagehead-desc">汇总统计在指定时间范围内审核的工作单的制作明细所选定的经营项目信息。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="exportCsv">导出 CSV</el-button>
      </div>
    </div>

    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="erp-panelhead"><h2>查询条件</h2><span class="erp-panelhead-note">按工作单明细汇总；审核时间以工单登记时间代替（原型）</span></div>
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
            <el-option label="客户分组" value="客户分组" />
            <el-option label="委托客户" value="委托客户" />
            <el-option label="工单类型" value="工单类型" />
            <el-option label="经手人员" value="经手人员" />
          </el-select>
        </div>
        <div class="erp-toolbar-item">
          <label>项目过滤</label>
          <el-input v-model="query.q" placeholder="项目编号或名称" clearable style="width: 180px" />
        </div>
        <div class="erp-toolbar-item">
          <label>项目名称</label>
          <el-radio-group v-model="query.imode">
            <el-radio value="cat">主项名称</el-radio>
            <el-radio value="sub">主项名称 > 子项名称</el-radio>
          </el-radio-group>
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
          <div class="erp-table-wrap">
            <el-table :data="tableData" v-loading="loading" stripe show-summary :summary-method="getSummaries" style="width: 100%">
              <el-table-column label="基础">
                <el-table-column prop="period" label="日期时间" width="140" fixed />
                <el-table-column v-if="query.basis !== '无'" prop="basis" :label="query.basis" width="120" />
                <el-table-column prop="item" label="项目名称" min-width="180" />
                <el-table-column prop="qty" label="项目数量" width="100" align="right" />
              </el-table-column>
              <el-table-column label="金额">
                <el-table-column prop="list" label="标售金额（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.list) }}</span></template></el-table-column>
                <el-table-column prop="sale" label="实售金额（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.sale) }}</span></template></el-table-column>
                <el-table-column prop="avg" label="实售均价（元）" width="130" align="right"><template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.avg) }}</span></template></el-table-column>
                <el-table-column prop="disc" label="实售折扣（折）" width="120" align="right"><template #default="{ row }">{{ row.disc.toFixed(2) }}</template></el-table-column>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="数据图表" name="chart">
          <div class="chart-placeholder">
            <p>柱状图：按项目汇总实售金额（前 12 项）</p>
            <p class="sub-text">项目名称过长时截取前 8 个字，完整名称见"数据表格"。</p>
            <div class="chart-bars">
              <div v-for="row in chartData" :key="row.item" class="chart-bar-group">
                <div class="chart-bar" :style="{ height: barH(row.sale) + 'px' }" :title="`${row.item}: ${fmtMoney(row.sale)}`"></div>
                <span class="chart-label">{{ row.item.slice(0, 8) }}</span>
              </div>
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
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const loading = ref(false);
const activeTab = ref('table');
const tableData = ref<any[]>([]);
const metaText = ref('尚未统计');

const query = reactive({ mode: 'day', from: '2026-08-01', to: '2026-10-31', basis: '无', otype: '', audited: false, imode: 'cat', q: '' });

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const barH = (v: number) => Math.min(120, Math.max(4, v / 50));

const chartData = computed(() => [...tableData.value].sort((a, b) => b.sale - a.sale).slice(0, 12));

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  const moneyCols = ['list', 'sale', 'avg'];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (moneyCols.includes(col.property)) {
      if (col.property === 'avg') {
        const totalSale = data.reduce((s: number, r: any) => s + Number(r.sale || 0), 0);
        const totalQty = data.reduce((s: number, r: any) => s + Number(r.qty || 0), 0);
        sums[i] = totalQty ? fmtMoney(totalSale / totalQty) : '—';
      } else {
        sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
      }
    } else if (col.property === 'qty') {
      sums[i] = String(data.reduce((s: number, r: any) => s + Number(r.qty || 0), 0));
    } else if (col.property === 'disc') {
      const totalSale = data.reduce((s: number, r: any) => s + Number(r.sale || 0), 0);
      const totalList = data.reduce((s: number, r: any) => s + Number(r.list || 0), 0);
      sums[i] = totalList ? (totalSale / totalList * 10).toFixed(2) : '—';
    } else { sums[i] = ''; }
  });
  return sums;
};

const runQuery = () => {
  loading.value = true;
  setTimeout(() => {
    const modeNames: Record<string, string> = { day: '日报', month: '月报', year: '年报', custom: '自定' };
    tableData.value = [
      { period: '2026-10-20', basis: '', item: query.imode === 'sub' ? '广告喷绘 > 车贴（反光膜）' : '广告喷绘', qty: 20, list: 1300, sale: 1100, avg: 55, disc: 8.46 },
      { period: '2026-10-20', basis: '', item: query.imode === 'sub' ? '标识标牌 > 不锈钢腐蚀牌' : '标识标牌', qty: 8, list: 1440, sale: 1200, avg: 150, disc: 8.33 },
      { period: '2026-10-19', basis: '', item: query.imode === 'sub' ? '文创产品 > 帆布袋印刷' : '文创产品', qty: 50, list: 900, sale: 750, avg: 15, disc: 8.33 },
      { period: '2026-10-19', basis: '', item: query.imode === 'sub' ? '标准产品 > 铜版纸打印' : '标准产品', qty: 100, list: 200, sale: 150, avg: 1.5, disc: 7.5 },
      { period: '2026-10-18', basis: '', item: query.imode === 'sub' ? '装裱服务 > 冷裱覆膜' : '装裱服务', qty: 30, list: 600, sale: 500, avg: 16.67, disc: 8.33 },
    ];
    metaText.value = `单位：元 · 时间范围：${query.from} 至 ${query.to}（${modeNames[query.mode]}） · 数据截至 ${new Date().toLocaleString('zh-CN')}`;
    loading.value = false;
  }, 300);
};

const exportCsv = () => { ElMessage.info('导出经营项目汇总表 CSV'); };

onMounted(() => runQuery());
</script>

<style scoped lang="scss">
.mono-cell { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.sub-text { font-size: 12px; color: var(--erp-text-soft); }
.chart-placeholder { padding: 24px; text-align: center; p { margin: 0 0 8px; } }
.chart-bars { display: flex; align-items: flex-end; justify-content: center; gap: 16px; height: 160px; padding: 16px 0; }
.chart-bar-group { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.chart-bar { width: 32px; border-radius: 2px 2px 0 0; background: var(--erp-primary); transition: height 0.3s; }
.chart-label { font-size: 11px; color: var(--erp-text-soft); max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
