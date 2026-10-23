<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台</p>
        <h1>零收记录</h1>
        <p class="erp-pagehead-desc">零散收入单据，含手动登记与云端交易自动创建。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="router.push('/frontdesk/miscIncome')">登记零收</el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索</label>
        <el-input v-model="search.q" placeholder="零收单号 / 项目 / 客户" clearable style="width: 200px" />
      </div>
      <div class="erp-toolbar-item">
        <label>业务日期</label>
        <el-date-picker v-model="search.dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
      </div>
      <div class="erp-toolbar-item">
        <label>创建方式</label>
        <el-select v-model="search.source" clearable placeholder="全部" style="width: 160px">
          <el-option label="手动登记创建" value="手动登记创建" />
          <el-option label="云端交易（支付宝）" value="云端交易（支付宝）" />
          <el-option label="云端交易（微信）" value="云端交易（微信）" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>支付方式</label>
        <el-select v-model="search.method" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="m in methodOptions" :key="m" :label="m" :value="m" />
        </el-select>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="no" label="零收单号" width="140" align="center" />
          <el-table-column prop="date" label="业务日期" width="120" />
          <el-table-column prop="custName" label="客户名称" width="120" />
          <el-table-column prop="itemName" label="经营项目" min-width="160">
            <template #default="{ row }">
              {{ row.itemName }}
              <div class="sub-text">{{ row.catName }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="60" align="center" />
          <el-table-column prop="price" label="单价（元）" width="100" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ Number(row.price).toFixed(3) }}</span></template>
          </el-table-column>
          <el-table-column prop="qty" label="数量" width="80" align="right" />
          <el-table-column prop="amount" label="零收金额（元）" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.amount) }}</span></template>
          </el-table-column>
          <el-table-column prop="account" label="入账科目" width="170" />
          <el-table-column prop="method" label="支付方式" width="100" />
          <el-table-column prop="source" label="创建方式" width="140" />
          <el-table-column prop="handler" label="经手人" width="90" />
          <el-table-column prop="audited" label="审核" width="90" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.audited ? 'success' : undefined">{{ row.audited ? '已审核' : '未审核' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="toggleAudit(row)">{{ row.audited ? '反审核' : '审核' }}</el-button>
                <el-button link type="primary" size="small" @click="handlePrint(row)">小票</el-button>
                <el-button v-if="!row.audited" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="erp-pagination">
        <span>共 {{ tableData.length }} 条记录</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);

const search = reactive({ q: '', dateRange: [] as string[], source: '', method: '' });
const methodOptions = ['现金', '现钞', '微信', '支付宝', '刷卡', '转账'];

const fmtMoney = (v: number) => '￥' + (v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toggleAudit = (row: any) => {
  row.audited = !row.audited;
  ElMessage.success(row.audited ? '已审核' : '已反审核');
};

const handlePrint = (row: any) => { ElMessage.info(`打印零收单 ${row.no} 小票`); };

const handleDelete = (row: any) => {
  ElMessageBox.confirm(`删除零收单 ${row.no}？金额 ${fmtMoney(row.amount)} 元。`, '提示', { type: 'warning' })
    .then(() => {
      tableData.value = tableData.value.filter(r => r.no !== row.no);
      ElMessage.success('删除成功');
    }).catch(() => {});
};

onMounted(() => {
  tableData.value = [
    { no: 'LS26102110001', date: '2026-10-21', custName: '零收散户', itemName: '复印 A4 黑白', catName: '复印', unit: '张', price: 0.1, qty: 50, amount: 5, account: '现金>前台钱箱', method: '现钞', source: '手动登记创建', handler: '管理员', audited: true },
    { no: 'LS26102110002', date: '2026-10-21', custName: '零收散户', itemName: '证件照', catName: '证件照', unit: '版', price: 20, qty: 2, amount: 40, account: '银行存款>微信', method: '微信', source: '手动登记创建', handler: '张三', audited: true },
    { no: 'LS26102010001', date: '2026-10-20', custName: '零收散户', itemName: '黑白打印 A4 单面', catName: '打印', unit: '张', price: 0.15, qty: 100, amount: 15, account: '现金>前台钱箱', method: '现钞', source: '手动登记创建', handler: '管理员', audited: true },
    { no: 'LS26101910001', date: '2026-10-19', custName: '零收散户', itemName: '骑马钉', catName: '装订', unit: '本', price: 5, qty: 3, amount: 15, account: '银行存款>支付宝', method: '支付宝', source: '云端交易（支付宝）', handler: '管理员', audited: true },
  ];
});
</script>

<style scoped lang="scss">
.table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
