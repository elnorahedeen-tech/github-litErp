<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台</p>
        <h1>预存储值</h1>
        <p class="erp-pagehead-desc">为会员卡客户预存（充值），可同时赠送金额并调整客户分组。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="router.push('/frontdesk/prestoreRecords')">预存记录</el-button>
        <el-button @click="router.push('/frontdesk/prestore?mode=refund')">预存退款</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>储值单</h2></div>
      <div class="erp-panelbody">
        <el-form ref="formRef" :model="form" label-width="120px" class="erp-form">
          <div class="erp-form-section">
            <h3>会员卡</h3>
            <el-form-item label="会员卡" required>
              <el-select v-model="form.cardNo" filterable placeholder="请选择会员卡" style="width: 100%" @change="onCardChange">
                <el-option v-for="c in cardOptions" :key="c.cardNo" :label="`${c.cardNo} · ${c.custName}（余额 ${fmtMoney(c.balance)} 元）`" :value="c.cardNo" />
              </el-select>
            </el-form-item>
            <div v-if="selectedCard" class="erp-kv" style="margin-top: 12px">
              <div><dt>持卡客户</dt><dd>{{ selectedCard.custCode }} {{ selectedCard.custName }}</dd></div>
              <div><dt>客户分组</dt><dd>{{ selectedCard.group }}</dd></div>
              <div><dt>卡片状态</dt><dd><span class="erp-badge" data-tone="success">{{ selectedCard.status }}</span></dd></div>
              <div><dt>当前余额（元）</dt><dd class="mono-cell" style="font-weight: 600">{{ fmtMoney(selectedCard.balance) }}</dd></div>
            </div>
          </div>

          <div class="erp-form-section">
            <h3>预存金额</h3>
            <div class="erp-form-grid">
              <el-form-item label="实收金额（元）" required>
                <el-input-number v-model="form.real" :min="0" :precision="2" style="width: 100%" @change="calcTotal" />
              </el-form-item>
              <el-form-item label="赠送金额（元）">
                <el-input-number v-model="form.gift" :min="0" :precision="2" style="width: 100%" @change="calcTotal" />
              </el-form-item>
            </div>
            <dl class="erp-summary" style="margin-top: 12px">
              <div><dt>预存合计（元）</dt><dd class="mono-cell">{{ fmtMoney(form.real + form.gift) }}</dd></div>
              <div><dt>存后余额（元）</dt><dd class="mono-cell">{{ selectedCard ? fmtMoney(selectedCard.balance + form.real + form.gift) : '先选择会员卡' }}</dd></div>
            </dl>
          </div>

          <div class="erp-form-section">
            <h3>入账信息</h3>
            <div class="erp-form-grid erp-form-grid-3">
              <el-form-item label="入账科目">
                <el-select v-model="form.account" style="width: 100%">
                  <el-option v-for="a in accountOptions" :key="a" :label="a" :value="a" />
                </el-select>
              </el-form-item>
              <el-form-item label="支付方式">
                <el-select v-model="form.method" style="width: 100%" @change="onMethodChange">
                  <el-option v-for="w in payWayOptions" :key="w" :label="w" :value="w" />
                </el-select>
              </el-form-item>
              <el-form-item label="手续费用（元）">
                <el-input-number v-model="form.fee" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
              <el-form-item label="调整分组">
                <el-select v-model="form.newGroup" clearable placeholder="（不变）" style="width: 100%">
                  <el-option v-for="g in groupOptions" :key="g" :label="g" :value="g" />
                </el-select>
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
            <el-form-item label="详细说明">
              <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="最多 200 个字符" />
            </el-form-item>
          </div>

          <div class="erp-form-actions">
            <el-button type="primary" @click="submitForm">确认储值</el-button>
            <el-button @click="router.push('/frontdesk/prestoreRecords')">返回预存记录</el-button>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

const router = useRouter();
const formRef = ref();

const form = reactive({
  cardNo: '',
  real: 0,
  gift: 0,
  account: '现金>前台钱箱',
  method: '现钞',
  fee: 0,
  newGroup: '',
  ticket: '',
  invoice: false,
  remark: '',
});

const cardOptions = ref([
  { cardNo: 'IC880001', custCode: '000001', custName: '世纪出版社', group: '企业客户', balance: 5000, status: '正常' },
  { cardNo: 'IC880002', custCode: '000002', custName: '新华书店', group: '企业客户', balance: 3200, status: '正常' },
  { cardNo: 'IC880003', custCode: '000003', custName: '晨光文具', group: '散户', balance: 800, status: '正常' },
]);

const selectedCard = computed(() => cardOptions.value.find(c => c.cardNo === form.cardNo));

const accountOptions = ['现金>前台钱箱', '现金>备用金', '银行存款>微信', '银行存款>支付宝', '银行存款>一般账户'];
const payWayOptions = ['现钞', '微信', '支付宝', '刷卡', '转账', '支票', '汇款', '其他'];
const groupOptions = ['企业客户', '散户', 'VIP客户'];

const fmtMoney = (v: number) => '￥' + (v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const onCardChange = () => {};
const onMethodChange = () => {
  const map: Record<string, string> = { '现钞': '现金>前台钱箱', '微信': '银行存款>微信', '支付宝': '银行存款>支付宝' };
  if (map[form.method]) form.account = map[form.method];
};

const calcTotal = () => {
  if (form.real >= 1000 && form.gift === 0) {
    form.gift = form.real >= 5000 ? form.real * 0.1 : form.real * 0.2;
  }
};

const submitForm = () => {
  if (!form.cardNo) { ElMessage.warning('请选择会员卡'); return; }
  if (form.real <= 0) { ElMessage.warning('实收金额需大于 0'); return; }
  ElMessage.success(`储值成功：${selectedCard.value?.custName} +${fmtMoney(form.real + form.gift)} 元`);
  router.push('/frontdesk/prestoreRecords');
};
</script>
