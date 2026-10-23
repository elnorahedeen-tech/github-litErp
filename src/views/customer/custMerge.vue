<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 客户</p>
        <h1>客户合并</h1>
        <p class="erp-pagehead-desc">把重复建档的来源客户并入目标客户。合并后来源客户档案被删除，不能撤销。</p>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>选择客户</h2></div>
      <div class="erp-panelbody">
        <div class="merge-form">
          <div class="merge-form-row">
            <label>来源客户</label>
            <el-select v-model="fromCust" filterable placeholder="请选择来源客户" style="width: 320px" @change="updatePreview">
              <el-option v-for="c in custOptions" :key="c.code" :label="`${c.code} ${c.name}（${c.groupName}）`" :value="c.code" :disabled="c.code === toCust" />
            </el-select>
            <span class="merge-form-help">重复建档、将被删除的客户。</span>
          </div>
          <div class="merge-form-row">
            <label>目标客户</label>
            <el-select v-model="toCust" filterable placeholder="请选择目标客户" style="width: 320px" @change="updatePreview">
              <el-option v-for="c in custOptions" :key="c.code" :label="`${c.code} ${c.name}（${c.groupName}）`" :value="c.code" :disabled="c.code === fromCust" />
            </el-select>
            <span class="merge-form-help">保留的客户，接收来源客户的全部记录。</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="fromCust && toCust && fromCust !== toCust" class="erp-panel">
      <div class="erp-panelhead"><h2>合并影响</h2><span class="erp-panelhead-note">客户资料（名称、分组、联系方式等）以目标客户为准</span></div>
      <div class="erp-panelbody">
        <table class="erp-mini-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>来源 {{ fromCust }}</th>
              <th>目标 {{ toCust }}</th>
              <th>合并后（目标）</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in mergePreview" :key="row.key">
              <td>{{ row.key }}</td>
              <td class="num">{{ row.from }}</td>
              <td class="num">{{ row.to }}</td>
              <td class="num"><strong>{{ row.result }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="fromCust && toCust" class="erp-panel">
      <div class="erp-panelhead"><h2>确认</h2></div>
      <div class="erp-panelbody">
        <div class="merge-warning">
          <h3>该操作不能撤销。</h3>
          <ol>
            <li>来源客户的工单、结算、预存卡、联络人员、协议价格都归目标客户所有。</li>
            <li>欠款、预存余额、待销账累加到目标客户。</li>
            <li>来源客户档案被删除，原编号不再可用。</li>
          </ol>
        </div>
        <div class="merge-form-row" style="margin-top: 16px;">
          <el-checkbox v-model="ackChecked">我已核对来源与目标客户，了解合并后不能撤销</el-checkbox>
        </div>
        <div style="margin-top: 16px;">
          <el-button type="primary" size="large" :disabled="!ackChecked" @click="handleMerge">合并客户</el-button>
        </div>
      </div>
    </div>

    <div v-else class="erp-panel">
      <div class="erp-empty">
        <h3>请选择来源和目标客户</h3>
        <p>选择后显示将要转移的记录和合并影响。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const fromCust = ref('');
const toCust = ref('');
const ackChecked = ref(false);
const mergePreview = ref<any[]>([]);

const custOptions = ref([
  { code: '100001', name: '世纪出版社', groupName: 'VIP客户', debt: 22000, prestoreBalance: 36800, orders: 15, settlements: 28, cards: 1, contacts: 2, agrees: 3 },
  { code: '100002', name: '新华书店', groupName: 'VIP客户', debt: 9700, prestoreBalance: 13500, orders: 8, settlements: 12, cards: 1, contacts: 1, agrees: 0 },
  { code: '100003', name: '万科地产', groupName: '协议客户', debt: 68000, prestoreBalance: 0, orders: 22, settlements: 35, cards: 0, contacts: 1, agrees: 5 },
  { code: '100004', name: '华为技术', groupName: '协议客户', debt: 18000, prestoreBalance: 0, orders: 10, settlements: 15, cards: 0, contacts: 1, agrees: 2 },
  { code: '100005', name: '晨光文具', groupName: '普通客户', debt: 0, prestoreBalance: 2300, orders: 3, settlements: 5, cards: 1, contacts: 1, agrees: 0 },
]);

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const updatePreview = () => {
  ackChecked.value = false;
  if (!fromCust.value || !toCust.value || fromCust.value === toCust.value) {
    mergePreview.value = [];
    return;
  }
  const a = custOptions.value.find(c => c.code === fromCust.value);
  const b = custOptions.value.find(c => c.code === toCust.value);
  if (!a || !b) return;

  mergePreview.value = [
    { key: '工单', from: String(a.orders), to: String(b.orders), result: String(a.orders + b.orders) },
    { key: '结算记录', from: String(a.settlements), to: String(b.settlements), result: String(a.settlements + b.settlements) },
    { key: '预存卡', from: String(a.cards), to: String(b.cards), result: String(a.cards + b.cards) },
    { key: '联络人员', from: String(a.contacts), to: String(b.contacts), result: String(a.contacts + b.contacts) },
    { key: '协议价格', from: String(a.agrees), to: String(b.agrees), result: String(a.agrees + b.agrees) },
    { key: '欠款（元）', from: fmtMoney(a.debt), to: fmtMoney(b.debt), result: fmtMoney(a.debt + b.debt) },
    { key: '预存余额（元）', from: fmtMoney(a.prestoreBalance), to: fmtMoney(b.prestoreBalance), result: fmtMoney(a.prestoreBalance + b.prestoreBalance) },
  ];
};

const handleMerge = () => {
  const a = custOptions.value.find(c => c.code === fromCust.value);
  const b = custOptions.value.find(c => c.code === toCust.value);
  if (!a || !b) return;

  ElMessageBox.confirm(
    `把「${a.code} ${a.name}」合并到「${b.code} ${b.name}」？将转移 ${a.orders} 张工单、${a.settlements} 条结算记录；来源客户 ${a.code} 随后删除，不能撤销。`,
    '确认合并客户',
    { type: 'warning', confirmButtonText: '合并并删除来源客户' }
  ).then(() => {
    custOptions.value = custOptions.value.filter(c => c.code !== a.code);
    fromCust.value = '';
    toCust.value = '';
    ackChecked.value = false;
    mergePreview.value = [];
    ElMessage.success(`合并完成：${a.code} ${a.name} → ${b.code} ${b.name}`);
    router.push(`/customer/detail?code=${b.code}`);
  }).catch(() => {});
};

onMounted(() => {});
</script>

<style scoped lang="scss">
.merge-form {
  display: flex;
  flex-direction: column;
  gap: var(--erp-space-4);
}
.merge-form-row {
  display: flex;
  align-items: center;
  gap: var(--erp-space-3);
  label {
    min-width: 100px;
    font-size: var(--erp-table-size);
    color: var(--erp-text);
    font-weight: 500;
  }
}
.merge-form-help {
  font-size: var(--erp-caption-size);
  color: var(--erp-muted);
}
.merge-warning {
  padding: var(--erp-space-3) var(--erp-space-4);
  background: #fff1f0;
  border: 1px solid #ffa39e;
  border-radius: 4px;
  h3 {
    margin: 0 0 var(--erp-space-2);
    font-size: var(--erp-table-size);
    color: var(--erp-danger, #d41920);
  }
  ol {
    margin: 0;
    padding-left: 20px;
    font-size: var(--erp-caption-size);
    color: var(--erp-text-soft);
    li { margin-bottom: var(--erp-space-1); }
  }
}
.erp-mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--erp-table-size);
  th, td { padding: var(--erp-space-2) var(--erp-space-3); border-bottom: 1px solid var(--erp-line); text-align: left; }
  th { font-weight: 500; color: var(--erp-muted); background: var(--erp-bg); }
  td.num { text-align: right; white-space: nowrap; }
}
.erp-empty {
  padding: var(--erp-space-12) var(--erp-space-6);
  text-align: center;
  color: var(--erp-muted);
  h3 { margin: 0 0 var(--erp-space-2); font-size: 16px; color: var(--erp-text-soft); }
  p { margin: 0; font-size: var(--erp-table-size); }
}
</style>
