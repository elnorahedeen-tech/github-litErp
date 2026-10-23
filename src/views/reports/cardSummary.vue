<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 报表</p>
        <h1>会员办卡汇总表</h1>
        <p class="erp-pagehead-desc">汇总计算客户办理会员卡片的相关数据信息。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="exportCsv">导出 CSV</el-button>
      </div>
    </div>

    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="erp-panelhead"><h2>查询条件</h2><span class="erp-panelhead-note">以会员卡发行时间为准。默认按年报统计</span></div>
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
            <el-option label="发卡员工" value="发卡员工" />
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
                <el-table-column prop="group" label="卡片分组" width="120" />
              </el-table-column>
              <el-table-column label="汇总">
                <el-table-column prop="count" label="卡片数量" width="100" align="right" />
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="数据图表" name="chart">
          <div class="chart-placeholder">
            <p>柱状图：卡片数量</p>
            <p class="sub-text">横轴：统计期间；纵轴：数量（张）。</p>
            <div class="chart-bars">
              <div v-for="row in tableData" :key="row.period + row.group" class="chart-bar-group">
                <div class="chart-bar" :style="{ height: barH(row.count) + 'px' }" :title="`${row.period}: ${row.count} 张`"></div>
                <span class="chart-label">{{ row.period }}</span>
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
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const loading = ref(false);
const activeTab = ref('table');
const tableData = ref<any[]>([]);
const metaText = ref('尚未统计');

const query = reactive({ mode: 'year', from: '2023-01-01', to: '2026-12-31', basis: '无' });

const barH = (v: number) => Math.min(100, Math.max(4, v * 15));

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (col.property === 'count') {
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
      { period: '2023', basis: '', group: '普通卡', count: 4 },
      { period: '2024', basis: '', group: '普通卡', count: 6 },
      { period: '2024', basis: '', group: '金卡', count: 2 },
      { period: '2025', basis: '', group: '普通卡', count: 5 },
      { period: '2025', basis: '', group: '金卡', count: 3 },
      { period: '2026', basis: '', group: '普通卡', count: 2 },
      { period: '2026', basis: '', group: '金卡', count: 1 },
    ];
    metaText.value = `单位：张（卡片数） · 时间范围：${query.from} 至 ${query.to}（${modeNames[query.mode]}） · 数据截至 ${new Date().toLocaleString('zh-CN')}`;
    loading.value = false;
  }, 300);
};

const exportCsv = () => { ElMessage.info('导出会员办卡汇总表 CSV'); };

onMounted(() => runQuery());
</script>

<style scoped lang="scss">
.sub-text { font-size: 12px; color: var(--erp-text-soft); }
.chart-placeholder { padding: 24px; text-align: center; p { margin: 0 0 8px; } }
.chart-bars { display: flex; align-items: flex-end; justify-content: center; gap: 16px; height: 120px; padding: 16px 0; }
.chart-bar-group { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.chart-bar { width: 32px; border-radius: 2px 2px 0 0; background: var(--erp-primary); transition: height 0.3s; }
.chart-label { font-size: 11px; color: var(--erp-text-soft); }
</style>
