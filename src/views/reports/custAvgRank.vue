<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 报表</p>
        <h1>客户工单均价排行表</h1>
        <p class="erp-pagehead-desc">对指定时间内审核的工作单，按照下单客户汇总工单数量及实收总额计算出每单均价，并以此均价对比排行。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="exportCsv">导出 CSV</el-button>
      </div>
    </div>

    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="erp-panelhead"><h2>查询条件</h2><span class="erp-panelhead-note">按下单客户汇总期间内的工作单；审核时间以工单登记时间代替</span></div>
      <div class="erp-toolbar">
        <div class="erp-toolbar-item">
          <label>开始日期</label>
          <el-date-picker v-model="query.from" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </div>
        <div class="erp-toolbar-item">
          <label>结束日期</label>
          <el-date-picker v-model="query.to" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </div>
        <div class="erp-toolbar-item">
          <label>行数</label>
          <el-input v-model="query.limit" style="width: 80px" />
        </div>
        <div class="erp-toolbar-item">
          <label>建交开始</label>
          <el-date-picker v-model="query.jf" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </div>
        <div class="erp-toolbar-item">
          <label>建交结束</label>
          <el-date-picker v-model="query.jt" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </div>
        <div class="erp-toolbar-item">
          <el-checkbox v-model="query.retail">含散户数据</el-checkbox>
        </div>
        <div class="erp-toolbar-item">
          <label>客户分组</label>
          <el-select v-model="query.groups" multiple collapse-tags style="width: 200px">
            <el-option v-for="g in groupOptions" :key="g" :label="g" :value="g" />
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
                <el-table-column prop="code" label="客户编号" width="100" fixed />
                <el-table-column prop="name" label="客户名称" min-width="160" />
                <el-table-column prop="type" label="客户类型" width="80" />
                <el-table-column prop="groupName" label="客户分组" width="100" />
              </el-table-column>
              <el-table-column label="排行">
                <el-table-column prop="avg" label="实收均价（元）" width="130" align="right">
                  <template #default="{ row }">{{ fmtMoney(row.avg) }}</template>
                </el-table-column>
                <el-table-column prop="net" label="实收总价（元）" width="130" align="right">
                  <template #default="{ row }">{{ fmtMoney(row.net) }}</template>
                </el-table-column>
                <el-table-column prop="count" label="工单数量" width="100" align="right" />
              </el-table-column>
              <el-table-column label="其他">
                <el-table-column prop="value" label="价值" width="80" />
                <el-table-column prop="phone" label="电话" width="130" />
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="数据图表" name="chart">
          <div class="chart-placeholder">
            <p>柱状图：实收均价排行（前 15 名）</p>
            <p class="sub-text">按排行顺序显示前 15 名；客户名称截取前 6 个字，完整名称见"数据表格"。</p>
            <div class="chart-bars">
              <div v-for="row in chartData" :key="row.code" class="chart-bar-group">
                <div class="chart-bar" :style="{ height: barH(row.avg) + 'px' }" :title="`${row.name}: ${fmtMoney(row.avg)} 元/单`"></div>
                <span class="chart-label">{{ row.name.slice(0, 6) }}</span>
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

const groupOptions = ['印刷厂', '广告公司', '设计公司', '个体散户', '政府机关', '教育机构'];
const query = reactive({
  from: '2026-08-01', to: '2026-10-31', limit: '100',
  jf: '', jt: '', retail: true, groups: [...groupOptions],
});

const chartData = computed(() => tableData.value.slice(0, 15));
const maxAvg = computed(() => Math.max(1, ...chartData.value.map(r => r.avg)));
const barH = (v: number) => Math.min(120, Math.max(6, (v / maxAvg.value) * 120));

const fmtMoney = (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (col.property === 'avg') {
      const totalNet = data.reduce((s: number, r: any) => s + Number(r.net || 0), 0);
      const totalCount = data.reduce((s: number, r: any) => s + Number(r.count || 0), 0);
      sums[i] = totalCount ? fmtMoney(totalNet / totalCount) : '—';
    } else if (col.property === 'net') {
      const total = data.reduce((s: number, r: any) => s + Number(r.net || 0), 0);
      sums[i] = fmtMoney(total);
    } else if (col.property === 'count') {
      sums[i] = String(data.reduce((s: number, r: any) => s + Number(r.count || 0), 0));
    } else { sums[i] = ''; }
  });
  return sums;
};

const runQuery = () => {
  loading.value = true;
  setTimeout(() => {
    const mock = [
      { code: 'C10020', name: '珠海市教育服务中心', type: '单位', groupName: '教育机构', avg: 16350.00, net: 65400.00, count: 4, value: 'A', phone: '0756-2233445' },
      { code: 'C10015', name: '惠州市政务文印中心', type: '单位', groupName: '政府机关', avg: 12150.00, net: 48600.00, count: 4, value: 'A', phone: '0752-2888999' },
      { code: 'C10001', name: '深圳市优印印刷有限公司', type: '公司', groupName: '印刷厂', avg: 10708.33, net: 128500.00, count: 12, value: 'A', phone: '0755-88881234' },
      { code: 'C10005', name: '广州创意设计工作室', type: '个体', groupName: '设计公司', avg: 9620.00, net: 96200.00, count: 10, value: 'A', phone: '020-38765432' },
      { code: 'C10012', name: '东莞万达包装制品厂', type: '公司', groupName: '印刷厂', avg: 8735.00, net: 87350.00, count: 10, value: 'B', phone: '0769-22334455' },
      { code: 'C10003', name: '佛山市南海区广告传媒', type: '公司', groupName: '广告公司', avg: 8088.89, net: 72800.00, count: 9, value: 'B', phone: '0757-66778899' },
      { code: 'C10008', name: '中山市快印达图文', type: '个体', groupName: '广告公司', avg: 7742.86, net: 54200.00, count: 7, value: 'B', phone: '0760-88776655' },
      { code: 'C10022', name: '江门市新会区印刷社', type: '个体', groupName: '印刷厂', avg: 7016.67, net: 42100.00, count: 6, value: 'C', phone: '0750-6655443' },
      { code: 'C10030', name: '汕头市金平区设计工作室', type: '个体', groupName: '设计公司', avg: 6416.67, net: 38500.00, count: 6, value: 'C', phone: '0754-88997766' },
      { code: 'C10018', name: '湛江市赤坎区广告部', type: '个体', groupName: '广告公司', avg: 5866.67, net: 35200.00, count: 6, value: 'B', phone: '0759-3344556' },
    ];
    tableData.value = mock;
    metaText.value = `单位：元（数量、比例列除外） · 时间范围：${query.from} 至 ${query.to} · 数据截至 ${new Date().toLocaleString('zh-CN')}`;
    loading.value = false;
  }, 300);
};

const exportCsv = () => { ElMessage.info('导出客户工单均价排行表 CSV'); };

onMounted(() => runQuery());
</script>

<style scoped lang="scss">
.sub-text { font-size: 12px; color: var(--erp-text-soft); }
.chart-placeholder { padding: 24px; text-align: center; p { margin: 0 0 8px; } }
.chart-bars { display: flex; align-items: flex-end; justify-content: center; gap: 12px; height: 160px; padding: 16px 0; overflow-x: auto; }
.chart-bar-group { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 40px; }
.chart-bar { width: 28px; border-radius: 2px 2px 0 0; background: var(--erp-primary); transition: height 0.3s; }
.chart-label { font-size: 11px; color: var(--erp-text-soft); white-space: nowrap; }
</style>
