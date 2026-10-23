<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台 / <el-link @click="router.push('/frontdesk/orderRecords')">工单记录</el-link></p>
        <h1>工单 {{ order.no }}</h1>
      </div>
      <div class="erp-pagehead-actions">
        <el-button v-if="order.unpaid > 0" type="primary" @click="handleSettle">收款结算</el-button>
        <el-button @click="handleTransfer">流程转单</el-button>
        <el-button @click="router.push(`/frontdesk/newOrder?id=${order.no}`)">编辑</el-button>
        <el-button @click="toggleAudit">{{ order.audited ? '反审核' : '审核' }}</el-button>
        <el-button @click="window.print()">打印</el-button>
      </div>
    </div>

    <el-alert v-if="order.audited" type="info" :closable="false" style="margin-bottom: 16px">
      本工单已审核：资料只读。金额与数量的修改需先反审核。
    </el-alert>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>基础资料</h2><span class="erp-panelhead-note">门店 0-本店 · 接待 {{ order.receptionist }}</span></div>
      <div class="erp-panelbody">
        <dl class="erp-kv">
          <div><dt>工单编号</dt><dd class="mono-cell">{{ order.no }}</dd></div>
          <div><dt>客户</dt><dd>{{ order.custCode }} {{ order.custName }} · {{ order.group }}</dd></div>
          <div><dt>联系人 / 电话</dt><dd>{{ [order.contact, order.phone].filter(Boolean).join(' · ') || '未提供' }}</dd></div>
          <div><dt>委托时间</dt><dd>{{ order.created }}</dd></div>
          <div><dt>交付日期</dt><dd>{{ order.due || '未约定' }}</dd></div>
          <div><dt>取送要求</dt><dd>{{ order.delivery || '未指定' }}</dd></div>
          <div><dt>制作任务</dt><dd>{{ order.task || '未指定' }}</dd></div>
          <div><dt>工单类型</dt><dd>{{ order.orderType || '未指定' }}</dd></div>
          <div><dt>制作要求</dt><dd>{{ order.req || '未提供' }}</dd></div>
          <div><dt>客户文件</dt><dd>{{ order.file || '未提供' }}</dd></div>
          <div><dt>审核</dt><dd><span class="erp-badge" :data-tone="order.audited ? 'success' : undefined">{{ order.audited ? '已审核' : '未审核' }}</span></dd></div>
          <div><dt>说明备注</dt><dd>{{ order.remark || '未提供' }}</dd></div>
        </dl>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>状态</h2><span class="erp-panelhead-note">结算状态与生产流程分别记录</span></div>
      <div class="erp-panelbody">
        <dl class="erp-kv">
          <div><dt>结算状态</dt><dd><span class="erp-badge" :data-tone="settleTone(order.settleStatus)">{{ order.settleStatus }}</span></dd></div>
          <div><dt>生产流程</dt><dd><span class="erp-badge" :data-tone="flowTone(order.flow)">{{ order.flow }}</span> <span v-if="order.handler" class="sub-text">当前处理：{{ order.handler }}</span></dd></div>
          <div><dt>实收（元）</dt><dd class="mono-cell">{{ fmtMoney(order.amount) }}</dd></div>
          <div><dt>已结（元）</dt><dd class="mono-cell">{{ fmtMoney(order.paid) }}</dd></div>
          <div><dt>未结（元）</dt><dd class="mono-cell" style="font-weight: 600">{{ fmtMoney(order.unpaid) }}</dd></div>
          <div><dt>最后更新</dt><dd>{{ order.updated || order.created }}</dd></div>
        </dl>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>明细</h2><span class="erp-panelhead-note">{{ order.lines.length }} 项</span></div>
      <div class="erp-table-wrap">
        <el-table :data="order.lines" stripe style="width: 100%">
          <el-table-column prop="code" label="编号" width="100" align="center" />
          <el-table-column prop="catName" label="主项" width="120" />
          <el-table-column prop="name" label="子项" min-width="160" />
          <el-table-column prop="unit" label="单位" width="80" align="center" />
          <el-table-column prop="listPrice" label="标价（元）" width="100" align="right">
            <template #default="{ row }">{{ fmtMoney(row.listPrice) }}</template>
          </el-table-column>
          <el-table-column prop="price" label="实价（元）" width="100" align="right">
            <template #default="{ row }">{{ fmtMoney(row.price) }}</template>
          </el-table-column>
          <el-table-column prop="copies" label="份数" width="80" align="right" />
          <el-table-column prop="qty" label="每份数量" width="100" align="right" />
          <el-table-column prop="amount" label="金额（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.amount) }}</span></template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>结算记录</h2></div>
      <div class="erp-table-wrap">
        <el-table :data="settlements" stripe style="width: 100%">
          <el-table-column prop="no" label="结算单号" width="140" align="center" />
          <el-table-column prop="date" label="时间" width="160" />
          <el-table-column prop="method" label="支付方式" width="100" />
          <el-table-column prop="handler" label="经手" width="100" />
          <el-table-column prop="amount" label="金额（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.amount) }}</span></template>
          </el-table-column>
        </el-table>
        <div v-if="!settlements.length" class="erp-empty">
          <h3>尚无结算记录</h3>
          <p>{{ order.amount > 0 ? '点"收款结算"登记收款。' : '0 元空单无需结算。' }}</p>
        </div>
      </div>
    </div>

    <div class="erp-form-actions" style="padding: 16px 0">
      <el-button @click="router.push('/frontdesk/orderRecords')">返回工单记录</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';

const router = useRouter();
const route = useRoute();

const order = reactive<any>({
  no: '',
  custCode: '',
  custName: '',
  group: '',
  contact: '',
  phone: '',
  created: '',
  due: '',
  delivery: '',
  task: '',
  orderType: '',
  req: '',
  file: '',
  remark: '',
  audited: false,
  receptionist: '',
  settleStatus: '',
  flow: '',
  handler: '',
  amount: 0,
  paid: 0,
  unpaid: 0,
  updated: '',
  lines: [],
});

const settlements = ref<any[]>([]);

const fmtMoney = (v: number) => '￥' + (v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const settleTone = (s: string) => ({ '尚未结算': 'warning', '部分结算': 'warning', '完成结算': 'success' } as Record<string, string>)[s];
const flowTone = (f: string) => {
  const flows = ['排队', '生产中', '完工', '交付'];
  const i = flows.indexOf(f);
  return i <= 0 ? undefined : i === flows.length - 1 ? 'success' : 'info';
};

const handleSettle = () => { ElMessage.info('收款结算功能开发中'); };
const handleTransfer = () => { ElMessage.info('流程转单功能开发中'); };
const toggleAudit = () => {
  order.audited = !order.audited;
  ElMessage.success(order.audited ? '已审核' : '已反审核');
};

onMounted(() => {
  const no = route.query.no as string;
  Object.assign(order, {
    no: no || 'GD261021001',
    custCode: '000001',
    custName: '世纪出版社',
    group: '企业客户',
    contact: '张三',
    phone: '13800138000',
    created: '2026-10-20 09:30:00',
    due: '2026-10-25',
    delivery: '快递',
    task: '印刷',
    orderType: '印刷',
    req: 'A4 200P 铜版纸',
    file: '',
    remark: '加急',
    audited: true,
    receptionist: '管理员',
    settleStatus: '完成结算',
    flow: '完工',
    handler: '李四',
    amount: 15800,
    paid: 15800,
    unpaid: 0,
    updated: '2026-10-21 10:00:00',
    lines: [
      { code: '110001', catName: '印刷', name: '产品画册印刷 A4 200P', unit: '本', listPrice: 79, price: 79, copies: 200, qty: 1, amount: 15800 },
    ],
  });
  settlements.value = [
    { no: 'JS261021001', date: '2026-10-20 10:00:00', method: '微信', handler: '管理员', amount: 15800 },
  ];
});
</script>
