<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台</p>
        <h1>零收</h1>
        <p class="erp-pagehead-desc">登记无需开工作单的零散收入（复印、打印、扫描等），直接收款入账。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="handleChangeCalc">找零计算器</el-button>
        <el-button @click="router.push('/frontdesk/miscIncomeRecords')">零收记录</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>零收单</h2></div>
      <div class="erp-panelbody">
        <el-form ref="formRef" :model="form" label-width="120px" class="erp-form">
          <div class="erp-form-section">
            <h3>基础</h3>
            <div class="erp-form-grid">
              <el-form-item label="客户名称">
                <el-input v-model="form.custName" placeholder="零收散户" />
              </el-form-item>
              <el-form-item label="业务日期" required>
                <el-date-picker v-model="form.date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
            </div>
          </div>

          <div class="erp-form-section">
            <h3>项目</h3>
            <div style="margin-bottom: 12px">
              <el-button type="primary" @click="selectItem">选择项目</el-button>
              <span v-if="selectedItem" style="margin-left: 12px; color: var(--erp-text-soft)">{{ selectedItem.catName }} · 单位：{{ selectedItem.unit }} · 标价 {{ fmtMoney(selectedItem.price) }} 元</span>
            </div>
            <div class="erp-form-grid">
              <el-form-item label="经营子项" required style="grid-column: 1 / -1">
                <el-input v-model="form.itemName" readonly placeholder="点击选择项目" />
              </el-form-item>
              <el-form-item label="单价（元）" required>
                <el-input-number v-model="form.price" :min="0" :precision="3" style="width: 100%" @change="calcAmount" />
              </el-form-item>
              <el-form-item label="数量" required>
                <el-input-number v-model="form.qty" :min="0" style="width: 100%" @change="calcAmount" />
              </el-form-item>
            </div>
          </div>

          <div class="erp-form-section">
            <h3>金额与入账</h3>
            <div class="erp-form-grid erp-form-grid-3">
              <el-form-item label="零收金额（元）" required>
                <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
              <el-form-item label="支付方式">
                <el-select v-model="form.method" style="width: 100%" @change="onMethodChange">
                  <el-option v-for="w in payWayOptions" :key="w" :label="w" :value="w" />
                </el-select>
              </el-form-item>
              <el-form-item label="入账科目">
                <el-select v-model="form.account" style="width: 100%">
                  <el-option v-for="a in accountOptions" :key="a" :label="a" :value="a" />
                </el-select>
              </el-form-item>
              <el-form-item label="手续费用（元）">
                <el-input-number v-model="form.fee" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
              <el-form-item label="票据信息">
                <el-input v-model="form.ticket" placeholder="票据信息" />
              </el-form-item>
              <el-form-item label="已开发票">
                <el-checkbox v-model="form.invoice" />
              </el-form-item>
            </div>
          </div>

          <div class="erp-form-section">
            <h3>备注</h3>
            <el-form-item label="说明备注">
              <el-input v-model="form.remark" placeholder="备注信息" />
            </el-form-item>
          </div>

          <div class="erp-form-actions">
            <el-button type="primary" @click="submitForm">保存零收</el-button>
            <el-button @click="saveAndNew">保存并新增</el-button>
            <el-button @click="router.push('/frontdesk/miscIncomeRecords')">返回零收记录</el-button>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const formRef = ref();

const form = reactive({
  custName: '零收散户',
  date: new Date().toISOString().slice(0, 10),
  itemName: '',
  price: 0,
  qty: 1,
  amount: 0,
  method: '现钞',
  account: '现金>前台钱箱',
  fee: 0,
  ticket: '',
  invoice: false,
  remark: '',
});

const selectedItem = ref<any>(null);

const payWayOptions = ['现钞', '微信', '支付宝', '刷卡', '转账', '支票', '汇款', '其他'];
const accountOptions = ['现金>前台钱箱', '现金>备用金', '银行存款>微信', '银行存款>支付宝', '银行存款>一般账户'];

const fmtMoney = (v: number) => '￥' + (v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const selectItem = () => {
  const items = [
    { code: '11', name: '复印 A4 黑白', catName: '复印', unit: '张', price: 0.1 },
    { code: '12', name: '黑白打印 A4 单面', catName: '打印', unit: '张', price: 0.15 },
    { code: '80', name: '排版', catName: '扫描', unit: '页', price: 2 },
    { code: '60', name: '证件照', catName: '证件照', unit: '版', price: 20 },
    { code: '15', name: '骑马钉', catName: '装订', unit: '本', price: 5 },
  ];
  ElMessageBox({
    title: '添加经营项目',
    message: '选择项目（演示：默认选第一项）',
    showCancelButton: true,
  }).then(() => {
    selectedItem.value = items[0];
    form.itemName = items[0].name;
    form.price = items[0].price;
    calcAmount();
  }).catch(() => {});
};

const calcAmount = () => {
  form.amount = Math.round(form.price * form.qty * 100) / 100;
};

const onMethodChange = () => {
  const map: Record<string, string> = { '现钞': '现金>前台钱箱', '微信': '银行存款>微信', '支付宝': '银行存款>支付宝' };
  if (map[form.method]) form.account = map[form.method];
};

const submitForm = () => {
  if (!form.itemName) { ElMessage.warning('请选择经营项目'); return; }
  if (form.amount <= 0) { ElMessage.warning('零收金额需大于 0'); return; }
  ElMessage.success(`零收已登记：${fmtMoney(form.amount)} 元`);
  router.push('/frontdesk/miscIncomeRecords');
};

const saveAndNew = () => {
  if (!form.itemName) { ElMessage.warning('请选择经营项目'); return; }
  ElMessage.success(`零收已登记：${fmtMoney(form.amount)} 元`);
  form.itemName = '';
  form.price = 0;
  form.qty = 1;
  form.amount = 0;
  form.remark = '';
  selectedItem.value = null;
};

const handleChangeCalc = () => {
  ElMessageBox({
    title: '找零计算器',
    message: `应收 ${fmtMoney(form.amount)} 元（演示）`,
  }).catch(() => {});
};
</script>
