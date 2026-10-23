<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台</p>
        <h1>会员卡资料</h1>
        <p class="erp-pagehead-desc">IC 卡与电子卡的发行、持卡、余额资料。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="router.push('/frontdesk/cardIssue')">发行新卡</el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索</label>
        <el-input v-model="search.q" placeholder="卡片序号 / 客户 / 持卡人" clearable style="width: 200px" />
      </div>
      <div class="erp-toolbar-item">
        <label>客户分组</label>
        <el-select v-model="search.group" clearable placeholder="全部" style="width: 140px">
          <el-option v-for="g in groupOptions" :key="g" :label="g" :value="g" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>卡片状态</label>
        <el-select v-model="search.state" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="s in stateOptions" :key="s" :label="s" :value="s" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>卡片类型</label>
        <el-select v-model="search.cardType" clearable placeholder="全部" style="width: 120px">
          <el-option label="电子卡片" value="电子卡片" />
          <el-option label="实体卡片" value="实体卡片" />
        </el-select>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="cardNo" label="卡片序号 / 类型" width="160">
            <template #default="{ row }">
              <el-link type="primary" @click="viewDetail(row)">{{ row.cardNo }}</el-link>
              <div class="sub-text">{{ row.cardType }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="state" label="状态" width="100" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="stateTone(row.state)">{{ row.state }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="custName" label="客户 / 分组" min-width="180">
            <template #default="{ row }">
              {{ row.custCode }} {{ row.custName }}
              <div class="sub-text">{{ row.group }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="holder" label="持卡人员" width="120" />
          <el-table-column prop="applicant" label="办卡人 / 电话" width="160">
            <template #default="{ row }">
              {{ row.applicant || '未提供' }}
              <div v-if="row.applicantPhone" class="sub-text">{{ row.applicantPhone }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="expire" label="失效日期" width="120" align="center">
            <template #default="{ row }">{{ row.expire || '永久有效' }}</template>
          </el-table-column>
          <el-table-column prop="issueDate" label="发行日期 / 人员" width="160">
            <template #default="{ row }">
              {{ row.issueDate }}
              <div class="sub-text">{{ row.issuer }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="balance" label="预存余额（元）" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.balance) }}</span></template>
          </el-table-column>
          <el-table-column prop="totalIn" label="累计储值（元）" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.totalIn) }}</span></template>
          </el-table-column>
          <el-table-column prop="totalOut" label="累计消费（元）" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.totalOut) }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="viewDetail(row)">详情</el-button>
                <el-button v-if="row.state === '正常'" link type="primary" size="small" @click="router.push(`/frontdesk/prestore?cardNo=${row.cardNo}`)">储值</el-button>
                <el-button v-if="row.state === '正常' && row.balance > 0" link type="primary" size="small" @click="router.push(`/frontdesk/prestore?mode=refund&cardNo=${row.cardNo}`)">退款</el-button>
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
import { ElMessage } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);

const search = reactive({ q: '', group: '', state: '', cardType: '' });
const groupOptions = ['企业客户', '散户', 'VIP客户'];
const stateOptions = ['正常', '已锁定', '已挂失', '已过期', '已注销'];

const stateTone = (s: string) => ({ '正常': 'success', '已锁定': 'warning', '已挂失': 'danger', '已过期': 'danger' } as Record<string, string>)[s];

const fmtMoney = (v: number) => '￥' + (v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const viewDetail = (row: any) => { ElMessage.info(`查看会员卡详情：${row.cardNo}`); };

onMounted(() => {
  tableData.value = [
    { cardNo: 'IC880001', cardType: '电子卡片', state: '正常', custCode: '000001', custName: '世纪出版社', group: '企业客户', holder: '张三', applicant: '张三', applicantPhone: '13800138000', expire: '', issueDate: '2026-01-15', issuer: '管理员', balance: 5000, totalIn: 10000, totalOut: 5000 },
    { cardNo: 'IC880002', cardType: '电子卡片', state: '正常', custCode: '000002', custName: '新华书店', group: '企业客户', holder: '李四', applicant: '李四', applicantPhone: '13900139000', expire: '2027-12-31', issueDate: '2026-03-20', issuer: '张三', balance: 3200, totalIn: 5000, totalOut: 1800 },
    { cardNo: 'IC880003', cardType: '实体卡片', state: '正常', custCode: '000003', custName: '晨光文具', group: '散户', holder: '王五', applicant: '王五', applicantPhone: '13700137000', expire: '', issueDate: '2026-06-10', issuer: '管理员', balance: 800, totalIn: 1500, totalOut: 700 },
    { cardNo: 'IC880004', cardType: '电子卡片', state: '已锁定', custCode: '000004', custName: '万科地产', group: 'VIP客户', holder: '赵六', applicant: '赵六', applicantPhone: '13600136000', expire: '2028-06-30', issueDate: '2026-02-28', issuer: '管理员', balance: 12000, totalIn: 20000, totalOut: 8000 },
  ];
});
</script>
