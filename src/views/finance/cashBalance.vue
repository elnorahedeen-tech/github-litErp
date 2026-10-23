<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 财务</p>
        <h1>现金余额</h1>
        <p class="erp-pagehead-desc">现金科目的期初余额、本期增加、本期减少与当前余额。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="router.push('/finance/transferRecords')">新建转账</el-button>
        <el-button @click="router.push('/finance/transferRecords')">转账记录</el-button>
        <el-button @click="router.push('/finance/generalRecords')">收支记录</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>现金科目余额</h2></div>
      <div class="erp-table-wrap">
        <el-table :data="tableData" stripe show-summary :summary-method="getSummaries" style="width: 100%">
          <el-table-column prop="code" label="科目编号" width="120">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="label" label="科目" min-width="200" />
          <el-table-column prop="opening" label="期初余额（元）" width="140" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.opening) }}</span></template>
          </el-table-column>
          <el-table-column prop="increase" label="本期增加（元）" width="140" align="right">
            <template #default="{ row }"><span class="mono-cell text-success">{{ fmtMoney(row.increase) }}</span></template>
          </el-table-column>
          <el-table-column prop="decrease" label="本期减少（元）" width="140" align="right">
            <template #default="{ row }"><span class="mono-cell text-danger">{{ fmtMoney(row.decrease) }}</span></template>
          </el-table-column>
          <el-table-column prop="balance" label="当前余额（元）" width="140" align="right">
            <template #default="{ row }"><span class="mono-cell" :class="{ 'text-danger': row.balance < 0 }">{{ fmtMoney(row.balance) }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="handleTransfer(row, 'out')">转出</el-button>
                <el-button link type="primary" size="small" @click="handleTransfer(row, 'in')">转入</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

const router = useRouter();
const tableData = ref<any[]>([]);

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['opening', 'increase', 'decrease', 'balance'].includes(col.property)) {
      sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else { sums[i] = ''; }
  });
  return sums;
};

const handleTransfer = (row: any, dir: string) => {
  ElMessage.info(`${dir === 'in' ? '转入' : '转出'}：${row.label}`);
};

onMounted(() => {
  tableData.value = [
    { code: '1001', label: '现金>前台钱箱', opening: 2000, increase: 21500, decrease: 8300, balance: 15200 },
    { code: '1002', label: '现金>备用金', opening: 5000, increase: 10000, decrease: 3000, balance: 12000 },
  ];
});
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
