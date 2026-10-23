<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 财务</p>
        <h1>期末结账</h1>
        <p class="erp-pagehead-desc">存档本期财务数据，开辟新的会计期间。结账前需审核本期全部财务相关单据。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="router.push('/finance/accountCalendar')">会计日历</el-button>
      </div>
    </div>

    <!-- 结账检查 -->
    <div class="erp-panel">
      <div class="erp-panelhead">
        <h2>结账检查</h2>
        <span class="erp-panelhead-note">会计期间 {{ periodName(currentPeriod) }} · 检查时间 {{ nowStamp }}</span>
      </div>
      <div class="erp-panelbody">
        <ul class="check-list">
          <li class="check-item">
            <span class="check-label">财务相关业务单据已审核</span>
            <span class="check-value">
              <span v-if="unauditedData.length" class="erp-badge" data-tone="warning">{{ unauditedData.length }} 张未审核</span>
              <span v-else class="erp-badge" data-tone="success">已全部进行审核</span>
            </span>
            <span class="check-desc">{{ unauditedData.length ? '结算单、预存单、销账单、一般收支单、转账单需全部审核；可在下方逐张或批量审核。' : '本期没有未审核的财务相关单据。' }}</span>
          </li>
          <li class="check-item">
            <span class="check-label">资金科目没有负余额</span>
            <span class="check-value">
              <span v-if="negAccounts.length" class="erp-badge" data-tone="danger">{{ negAccounts.length }} 个负余额</span>
              <span v-else class="erp-badge" data-tone="success">通过</span>
            </span>
            <span class="check-desc">{{ negAccounts.length ? `负余额科目：${negAccounts.map(a => a.name).join('、')}。请先核对转账与收支单据。` : '现金、银行科目余额均不小于 0。' }}</span>
          </li>
          <li class="check-item">
            <span class="check-label">记账凭证已过账</span>
            <span class="check-value"><span class="erp-badge">不适用</span></span>
            <span class="check-desc">本原型不生成记账凭证；正式版由财务服务检查凭证过账状态。</span>
          </li>
          <li class="check-item">
            <span class="check-label">没有其他客户端在录入本期单据</span>
            <span class="check-value"><span class="erp-badge" data-tone="warning">需人工确认</span></span>
            <span class="check-desc">前端无法检测其他客户端连接，请在下方结账表单中勾选确认。</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- 未审核单据 -->
    <div class="erp-panel">
      <div class="erp-panelhead"><h2>尚未审核的财务相关单据</h2><span class="erp-panelhead-note">审核后单据不能删除；如单据有误，请到对应记录页处理后再审核。</span></div>
      <div class="erp-table-wrap">
        <el-table :data="unauditedData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="module" label="模块" width="80" />
          <el-table-column prop="docName" label="单据名称" width="120" />
          <el-table-column prop="code" label="单据编号" width="160">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="date" label="业务日期" width="120" />
          <el-table-column prop="handler" label="经手人员" width="100">
            <template #default="{ row }">
              {{ row.handler }}
              <div class="sub-text">编号 {{ row.handlerCode }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="说明备注" min-width="160" :show-overflow-tooltip="true" />
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="auditOne(row)">审核</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 结账表单 -->
    <div class="erp-panel">
      <div class="erp-panelhead"><h2>结账</h2><span class="erp-panelhead-note">结账会关闭当前会计期间；本期单据此后不能修改。</span></div>
      <div class="erp-panelbody">
        <div class="close-form">
          <div class="close-form-row">
            <label>当前会计期间</label>
            <el-input :model-value="`${periodName(currentPeriod)}（${currentPeriod}）`" readonly style="width: 240px" />
          </div>
          <div class="close-form-row">
            <label>结束日期</label>
            <el-date-picker v-model="endDate" type="date" placeholder="本期最后一天" value-format="YYYY-MM-DD" style="width: 200px" />
            <span class="close-form-help">本期最后一天，按北京时间 23:59:59 截止。</span>
          </div>
          <div class="close-form-row">
            <el-checkbox v-model="ackNoOther">已确认没有其他客户端正在录入本期单据</el-checkbox>
          </div>
          <div class="close-form-row" style="margin-top: 16px;">
            <el-button type="primary" size="large" :disabled="!canClose" @click="handleClose">结账 {{ periodName(currentPeriod) }}</el-button>
          </div>
          <div v-if="closeMsg" class="close-form-msg" :class="{ error: closeMsgType === 'error' }">{{ closeMsg }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const currentPeriod = ref('202610');
const endDate = ref('2026-10-31');
const ackNoOther = ref(false);
const closeMsg = ref('');
const closeMsgType = ref<'info' | 'error'>('info');

const nowStamp = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
});

const periodName = (p: string) => `${p.slice(0, 4)}年${+p.slice(4)}月`;

const negAccounts = computed(() => []);

const unauditedData = ref<any[]>([
  { module: '销售', docName: '结算单', code: 'JS261021004', date: '2026-10-21', handler: '管理员', handlerCode: 'EMP001', remark: '万科地产 记账单' },
  { module: '财务', docName: '转账单', code: 'ZZ261015001', date: '2026-10-15', handler: '管理员', handlerCode: 'EMP001', remark: '支付宝提现' },
  { module: '财务', docName: '一般支出单', code: 'ZC261012001', date: '2026-10-12', handler: '管理员', handlerCode: 'EMP001', remark: '9月电费' },
]);

const canClose = computed(() => unauditedData.value.length === 0 && ackNoOther.value);

const auditOne = (row: any) => {
  ElMessageBox.confirm(`审核${row.docName} ${row.code}？`, '提示', { type: 'warning' })
    .then(() => {
      unauditedData.value = unauditedData.value.filter(r => r.code !== row.code);
      ElMessage.success(`${row.docName} ${row.code} 已审核`);
    }).catch(() => {});
};

const handleClose = () => {
  if (unauditedData.value.length > 0) {
    closeMsg.value = `不能结账：尚有 ${unauditedData.value.length} 张财务相关单据未审核。`;
    closeMsgType.value = 'error';
    return;
  }
  ElMessageBox.confirm(`结束会计期间「${periodName(currentPeriod.value)}」？结账后本期单据不能再修改。`, '确认期末结账', { type: 'warning', confirmButtonText: '结账' })
    .then(() => {
      const y = +currentPeriod.value.slice(0, 4);
      const m = +currentPeriod.value.slice(4);
      currentPeriod.value = m === 12 ? `${y + 1}01` : `${y}${String(m + 1).padStart(2, '0')}`;
      endDate.value = '';
      ackNoOther.value = false;
      closeMsg.value = `已结账 ${periodName(currentPeriod.value)}，当前会计期间 ${periodName(currentPeriod.value)}。`;
      closeMsgType.value = 'info';
      ElMessage.success(closeMsg.value);
    }).catch(() => {});
};

onMounted(() => {
  loading.value = true;
  setTimeout(() => { loading.value = false; }, 200);
});
</script>

<style scoped lang="scss">
.check-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.check-item {
  display: flex;
  gap: var(--erp-space-3);
  align-items: baseline;
  padding: var(--erp-space-3) 0;
  border-bottom: 1px solid var(--erp-line);
  &:last-child { border-bottom: none; }
}
.check-label {
  min-width: 200px;
  font-weight: 500;
  font-size: var(--erp-table-size);
  color: var(--erp-text);
}
.check-value {
  min-width: 120px;
}
.check-desc {
  font-size: var(--erp-caption-size);
  color: var(--erp-muted);
  flex: 1;
}
.close-form {
  max-width: 560px;
}
.close-form-row {
  display: flex;
  align-items: center;
  gap: var(--erp-space-3);
  margin-bottom: var(--erp-space-3);
  > label {
    min-width: 120px;
    font-size: var(--erp-table-size);
    color: var(--erp-text);
  }
}
.close-form-help {
  font-size: var(--erp-caption-size);
  color: var(--erp-muted);
}
.close-form-msg {
  margin-top: var(--erp-space-3);
  padding: var(--erp-space-2) var(--erp-space-3);
  border-radius: 4px;
  font-size: var(--erp-table-size);
  background: var(--erp-bg);
  color: var(--erp-muted);
  &.error {
    background: #fff1f0;
    color: var(--erp-danger, #d41920);
  }
}
</style>
