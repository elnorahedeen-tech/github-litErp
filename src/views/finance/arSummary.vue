<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 财务</p>
        <h1>应收汇总</h1>
        <p class="erp-pagehead-desc">统计指定期间内记账单据的未销金额，以及期间内未审核的销账单。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="router.push('/finance/custBalance')">客户结余</el-button>
        <el-button @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>统计期间</h2></div>
      <div class="erp-panelbody">
        <div class="erp-toolbar" style="padding: 0; border: none;">
          <div class="erp-toolbar-item">
            <label>开始日期</label>
            <el-date-picker v-model="search.from" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width: 160px" />
          </div>
          <div class="erp-toolbar-item">
            <label>结束日期</label>
            <el-date-picker v-model="search.to" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="width: 160px" />
          </div>
          <div class="erp-toolbar-item">
            <el-checkbox v-model="search.showAll">包括没有结余的客户</el-checkbox>
          </div>
          <div class="erp-toolbar-actions">
            <el-button type="primary" @click="loadData">统计</el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索客户</label>
        <el-input v-model="filter.q" placeholder="客户编号 / 名称" clearable style="width: 200px" />
      </div>
      <div class="erp-toolbar-item">
        <label>客户分组</label>
        <el-select v-model="filter.group" clearable placeholder="全部" style="width: 160px">
          <el-option v-for="g in groupOptions" :key="g" :label="g" :value="g" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="loadData">筛选</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe show-summary :summary-method="getSummaries" style="width: 100%">
          <el-table-column prop="code" label="编号" width="100">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="180">
            <template #default="{ row }">
              {{ row.name }}
              <div class="sub-text">{{ row.groupName }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="groupName" label="分组" width="100" />
          <el-table-column prop="open" label="记账未销（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.open) }}</span></template>
          </el-table-column>
          <el-table-column prop="pendingAmt" label="销账未审（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.pendingAmt) }}</span></template>
          </el-table-column>
          <el-table-column prop="bal" label="记账结余（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell" :class="{ 'text-danger': row.bal < 0 }">{{ fmtMoney(row.bal) }}</span></template>
          </el-table-column>
          <el-table-column prop="pn" label="单数" width="70" align="center" />
          <el-table-column prop="preal" label="实结（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.preal) }}</span></template>
          </el-table-column>
          <el-table-column prop="pwipe" label="抹零（元）" width="100" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.pwipe) }}</span></template>
          </el-table-column>
          <el-table-column prop="lastReg" label="最后登记" width="110" />
          <el-table-column prop="lastAudit" label="最后审核" width="110" />
          <el-table-column prop="remark" label="对账备注" min-width="120" :show-overflow-tooltip="true" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="router.push(`/finance/custStatement?cust=${row.code}`)">对账</el-button>
                <el-button v-if="row.open > 0" link type="primary" size="small" @click="router.push(`/finance/writeOffRecords?cust=${row.code}`)">销账</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ tableData.length }} 条记录</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);

const now = new Date();
const search = reactive({
  from: `${now.getFullYear()}-01-01`,
  to: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
  showAll: false,
});

const filter = reactive({ q: '', group: '' });
const groupOptions = ['企业客户', '散户', 'VIP客户'];

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['open', 'pendingAmt', 'bal', 'preal', 'pwipe'].includes(col.property)) {
      sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else if (col.property === 'pn') {
      sums[i] = String(data.reduce((s: number, r: any) => s + Number(r.pn || 0), 0));
    } else { sums[i] = ''; }
  });
  return sums;
};

const resetFilter = () => { filter.q = ''; filter.group = ''; };

const handleExport = () => { ElMessage.info('导出应收汇总 CSV'); };

const loadData = () => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      { code: '100001', name: '世纪出版社', groupName: '企业客户', open: 22000, pendingAmt: 0, bal: 22000, pn: 2, preal: 0, pwipe: 0, lastReg: '2026-10-19', lastAudit: '2026-10-19', remark: '' },
      { code: '100002', name: '新华书店', groupName: '企业客户', open: 8500, pendingAmt: 1200, bal: 9700, pn: 3, preal: 500, pwipe: 50, lastReg: '2026-10-20', lastAudit: '2026-10-21', remark: '月结客户' },
      { code: '100003', name: '万科地产', groupName: 'VIP客户', open: 68000, pendingAmt: 0, bal: 68000, pn: 1, preal: 0, pwipe: 0, lastReg: '2026-10-18', lastAudit: '', remark: '' },
      { code: '100004', name: '华为技术', groupName: 'VIP客户', open: 15000, pendingAmt: 3000, bal: 18000, pn: 4, preal: 2000, pwipe: 100, lastReg: '2026-10-21', lastAudit: '2026-10-21', remark: '' },
      { code: '100005', name: '晨光文具', groupName: '散户', open: 0, pendingAmt: 0, bal: 0, pn: 0, preal: 0, pwipe: 0, lastReg: '', lastAudit: '', remark: '' },
    ];
    if (!search.showAll) {
      tableData.value = tableData.value.filter(r => r.bal > 0);
    }
    loading.value = false;
  }, 200);
};

onMounted(() => loadData());
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
