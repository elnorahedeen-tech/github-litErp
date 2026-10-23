<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 系统</p>
        <h1>会计科目</h1>
        <p class="erp-pagehead-desc">科目树形结构，包含资产类与损益类科目。科目余额用于财务报表。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="addAccount">
          <el-icon><Plus /></el-icon> 新建科目
        </el-button>
        <el-button @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>科目列表</h2><span class="erp-panelhead-note">会计期间 {{ periodName }} · 单位：元</span></div>
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe row-key="code" default-expand-all :tree-props="{ children: 'children' }" style="width: 100%">
          <el-table-column prop="code" label="科目编号" width="140">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="name" label="科目名称" min-width="200" />
          <el-table-column prop="type" label="类别" width="100" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.type === '资产' ? '' : row.type === '负债' ? 'warning' : 'info'">{{ row.type }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="direction" label="余额方向" width="100" align="center">
            <template #default="{ row }">{{ row.direction || '—' }}</template>
          </el-table-column>
          <el-table-column prop="opening" label="期初余额" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ row.opening != null ? fmtMoney(row.opening) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="inc" label="本期增加" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ row.inc != null ? fmtMoney(row.inc) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="dec" label="本期减少" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ row.dec != null ? fmtMoney(row.dec) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="balance" label="当前余额" width="130" align="right">
            <template #default="{ row }">
              <span class="mono-cell" :class="{ 'text-danger': row.balance < 0 }">{{ row.balance != null ? fmtMoney(row.balance) : '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <div v-if="!row.children" class="table-actions">
                <el-button link type="primary" size="small" @click="editAccount(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="deleteAccount(row)">删除</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus';

const loading = ref(false);
const tableData = ref<any[]>([]);
const periodName = '2026年10月';

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const addAccount = () => { ElMessage.info('新建科目'); };
const editAccount = (row: any) => { ElMessage.info(`编辑科目 ${row.code}`); };
const handleExport = () => { ElMessage.info('导出会计科目 CSV'); };

const deleteAccount = (row: any) => {
  ElMessageBox.confirm(`删除科目 ${row.code} ${row.name}？`, '提示', { type: 'warning' })
    .then(() => { ElMessage.success('删除成功'); })
    .catch(() => {});
};

onMounted(() => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      {
        code: '1', name: '资产类', type: '资产', direction: '借', opening: null, inc: null, dec: null, balance: null,
        children: [
          {
            code: '1001', name: '现金', type: '资产', direction: '借', opening: 5000, inc: 45800, dec: 28456, balance: 22344, children: [
              { code: '1001001', name: '前台钱箱', type: '资产', direction: '借', opening: 2000, inc: 25800, dec: 18456, balance: 9344 },
              { code: '1001002', name: '备用金', type: '资产', direction: '借', opening: 3000, inc: 20000, dec: 10000, balance: 13000 },
            ],
          },
          {
            code: '1002', name: '银行存款', type: '资产', direction: '借', opening: 50000, inc: 120000, dec: 95000, balance: 75000, children: [
              { code: '1002001', name: '工商银行', type: '资产', direction: '借', opening: 30000, inc: 60000, dec: 55000, balance: 35000 },
              { code: '1002002', name: '微信', type: '资产', direction: '借', opening: 10000, inc: 35000, dec: 20000, balance: 25000 },
              { code: '1002003', name: '支付宝', type: '资产', direction: '借', opening: 10000, inc: 25000, dec: 20000, balance: 15000 },
            ],
          },
          { code: '1122', name: '应收账款', type: '资产', direction: '借', opening: 0, inc: 117700, dec: 22000, balance: 95700 },
        ],
      },
      {
        code: '2', name: '负债类', type: '负债', direction: '贷', opening: null, inc: null, dec: null, balance: null,
        children: [
          { code: '2203', name: '预收账款', type: '负债', direction: '贷', opening: 0, inc: 75000, dec: 57300, balance: 17700 },
        ],
      },
      {
        code: '5', name: '损益类', type: '损益', direction: '—', opening: null, inc: null, dec: null, balance: null,
        children: [
          { code: '5001', name: '主营业务收入', type: '损益', direction: '贷', opening: 0, inc: 285000, dec: 0, balance: 285000 },
          { code: '5401', name: '主营业务成本', type: '损益', direction: '借', opening: 0, inc: 95000, dec: 0, balance: 95000 },
          { code: '5601', name: '管理费用', type: '损益', direction: '借', opening: 0, inc: 18500, dec: 0, balance: 18500 },
        ],
      },
    ];
    loading.value = false;
  }, 200);
});
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
