<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 报表</p>
        <h1>客户新增汇总表</h1>
        <p class="erp-pagehead-desc">汇总在指定时间范围内新增的客户数量并统计各类业务特征名下的新增客户数量。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="exportCsv">导出 CSV</el-button>
      </div>
    </div>

    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="erp-panelhead"><h2>查询条件</h2><span class="erp-panelhead-note">以客户资料的建交时间为准（不含散户）。默认按年报统计</span></div>
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
            <el-option label="所属城市" value="所属城市" />
            <el-option label="城市商圈" value="城市商圈" />
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
        <el-tab-pane label="数据表格" name="table">
          <div class="erp-table-wrap">
            <el-table :data="tableData" v-loading="loading" stripe show-summary :summary-method="getSummaries" style="width: 100%">
              <el-table-column label="基础">
                <el-table-column prop="period" label="日期时间" width="140" fixed />
                <el-table-column v-if="query.basis !== '无'" prop="basis" :label="query.basis" width="120" />
                <el-table-column prop="count" label="新增客户" width="100" align="right" />
              </el-table-column>
              <el-table-column label="客户类型">
                <el-table-column prop="person" label="个人客户" width="100" align="right" />
                <el-table-column prop="org" label="机构客户" width="100" align="right" />
              </el-table-column>
              <el-table-column label="业务特征">
                <el-table-column prop="credit" label="允许记账" width="100" align="right" />
              </el-table-column>
              <el-table-column label="其他信息">
                <el-table-column prop="contact" label="联络人员" width="100" align="right" />
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="数据图表" name="chart">
          <div class="chart-placeholder">
            <p>柱状图：新增客户 / 个人客户 / 机构客户</p>
            <p class="sub-text">横轴：统计期间；纵轴：数量（个）。</p>
            <div class="chart-bars">
              <div v-for="row in tableData" :key="row.period" class="chart-bar-group">
                <div class="chart-bar count" :style="{ height: barH(row.count) + 'px' }" :title="`新增: ${row.count}`"></div>
                <div class="chart-bar person" :style="{ height: barH(row.person) + 'px' }" :title="`个人: ${row.person}`"></div>
                <div class="chart-bar org" :style="{ height: barH(row.org) + 'px' }" :title="`机构: ${row.org}`"></div>
                <span class="chart-label">{{ row.period }}</span>
              </div>
            </div>
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot count"></span>新增客户</span>
              <span class="legend-item"><span class="legend-dot person"></span>个人客户</span>
              <span class="legend-item"><span class="legend-dot org"></span>机构客户</span>
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

const query = reactive({ mode: 'year', from: '2023-01-01', to: '2026-12-31', basis: '无' });

const barH = (v: number) => Math.min(100, Math.max(4, v * 20));

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  const numCols = ['count', 'person', 'org', 'credit', 'contact'];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (numCols.includes(col.property)) {
      sums[i] = String(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else { sums[i] = ''; }
  });
  return sums;
};

const runQuery = () => {
  loading.value = true;
  setTimeout(() => {
    const modeNames: Record<string, string> = { day: '日报', month: '月报', year: '年报', custom: '自定' };
    tableData.value = [
      { period: '2023', basis: '', count: 3, person: 1, org: 2, credit: 1, contact: 2 },
      { period: '2024', basis: '', count: 5, person: 3, org: 2, credit: 2, contact: 3 },
      { period: '2025', basis: '', count: 4, person: 2, org: 2, credit: 1, contact: 2 },
      { period: '2026', basis: '', count: 2, person: 1, org: 1, credit: 0, contact: 1 },
    ];
    metaText.value = `单位：个（客户数） · 时间范围：${query.from} 至 ${query.to}（${modeNames[query.mode]}） · 数据截至 ${new Date().toLocaleString('zh-CN')}`;
    loading.value = false;
  }, 300);
};

const exportCsv = () => { ElMessage.info('导出客户新增汇总表 CSV'); };

onMounted(() => runQuery());
</script>

<style scoped lang="scss">
.sub-text { font-size: 12px; color: var(--erp-text-soft); }
.chart-placeholder { padding: 24px; text-align: center; p { margin: 0 0 8px; } }
.chart-bars { display: flex; align-items: flex-end; justify-content: center; gap: 24px; height: 120px; padding: 16px 0; }
.chart-bar-group { display: flex; align-items: flex-end; gap: 4px; }
.chart-bar { width: 16px; border-radius: 2px 2px 0 0; transition: height 0.3s; &.count { background: var(--erp-primary); } &.person { background: var(--erp-ink, #333); } &.org { background: var(--erp-text-soft); } }
.chart-label { font-size: 11px; color: var(--erp-text-soft); display: block; text-align: center; margin-top: 4px; }
.chart-legend { display: flex; justify-content: center; gap: 16px; margin-top: 8px; }
.legend-item { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.legend-dot { width: 12px; height: 12px; border-radius: 2px; &.count { background: var(--erp-primary); } &.person { background: var(--erp-ink, #333); } &.org { background: var(--erp-text-soft); } }
</style>
