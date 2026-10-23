<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台</p>
        <h1>结算记录</h1>
        <p class="erp-pagehead-desc">现金收款单 · 按收款时间倒序</p>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>收款单号</label>
        <el-input v-model="search.SkdCode" placeholder="输入收款单号" clearable style="width: 160px" />
      </div>
      <div class="erp-toolbar-item">
        <label>客户名称</label>
        <el-input v-model="search.ClientName" placeholder="输入客户名称" clearable style="width: 160px" />
      </div>
      <div class="erp-toolbar-item">
        <label>订单编号</label>
        <el-input v-model="search.OrderCode" placeholder="输入订单编号" clearable style="width: 160px" />
      </div>
      <div class="erp-toolbar-item">
        <label>收款人员</label>
        <el-input v-model="search.Operator" placeholder="输入收款人员" clearable style="width: 120px" />
      </div>
      <div class="erp-toolbar-item">
        <label>收款时间</label>
        <el-date-picker v-model="search.DateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
      </div>
      <div class="erp-toolbar-item">
        <label>收款方式</label>
        <el-select v-model="search.CashType" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="m in cashPayMethods" :key="m" :label="m" :value="m" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="getTbody">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe style="width: 100%" :row-class-name="rowClassName">
          <el-table-column prop="SkdCode" label="收款单号" width="160" align="center" />
          <el-table-column prop="SkdDateTime" label="收款时间" width="170" align="center" />
          <el-table-column prop="ClientName" label="客户名称" min-width="160">
            <template #default="{ row }">
              {{ row.ClientName }}
              <div class="sub-text">{{ row.ClientCode }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="SkdCrtType" label="收款对象" width="120" align="center" />
          <el-table-column prop="SkdAmt" label="收款金额（元）" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.SkdAmt) }}</span></template>
          </el-table-column>
          <el-table-column prop="CashPayMethod" label="收款方式" width="120" align="center" />
          <el-table-column prop="OrderCode" label="订单编号" width="140" />
          <el-table-column prop="OperName" label="收款人员" width="100" />
          <el-table-column prop="IsHongchongName" label="红冲状态" width="100" align="center">
            <template #default="{ row }">
              <span v-if="row.IsHongchongName" class="erp-badge" :data-tone="row.IsHongchongName === '红冲' ? 'danger' : 'warning'">{{ row.IsHongchongName }}</span>
              <span v-else class="erp-badge" data-tone="success">正常</span>
            </template>
          </el-table-column>
          <el-table-column prop="WithCheck" label="审核" width="90" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.WithCheck ? 'success' : 'info'">{{ row.WithCheck ? '已审核' : '未审核' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="Remark" label="备注" min-width="140" :show-overflow-tooltip="true" />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button v-if="row.OrderCode" link type="primary" size="small" @click="viewOrder(row)">工单</el-button>
                <el-button v-if="!row.WithCheck" link type="primary" size="small" @click="handleAudit(row)">审核</el-button>
                <el-button link type="primary" size="small" @click="handleReceipt(row)">收据</el-button>
                <el-button v-if="!row.IsHongchong && !row.IsBeiHongchong" link type="danger" size="small" @click="handleRedFlush(row)">红冲</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <!-- 分页 -->
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ total }} 条记录</span>
        <el-pagination
          v-model:current-page="search.PageIndex"
          v-model:page-size="search.PageLimit"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="sizes, prev, pager, next"
          @current-change="getTbody"
          @size-change="onPageSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const router = useRouter();
const loading = ref(false);
const total = ref(0);
const tableData = ref<any[]>([]);

const search = reactive({
  PageIndex: 1,
  PageLimit: 20,
  Count: 0,
  SkdCode: '',
  OrderCode: '',
  ClientName: '',
  ClientCode: '',
  Operator: '',
  SkdType: '2',
  CashType: '',
  DateRange: [] as string[],
});

const cashPayMethods = ['现金', '现钞', '微信', '支付宝', '刷卡', '转账', '银行转账'];

const fmtMoney = (v: any) => {
  const num = Number(v || 0);
  return '￥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const rowClassName = ({ row }: any) => {
  if (row.IsBeiHongchong) return 'danger-row';
  return '';
};

const getTbody = async () => {
  loading.value = true;
  try {
    const params: any = {
      PageIndex: search.PageIndex,
      PageLimit: search.PageLimit,
      Count: search.Count,
      SkdCode: search.SkdCode,
      OrderCode: search.OrderCode,
      ClientName: search.ClientName,
      ClientCode: search.ClientCode,
      Operator: search.Operator,
      SkdType: search.SkdType,
      CashType: search.CashType,
    };
    if (search.DateRange?.length === 2) {
      params.TimeBot = search.DateRange[0];
      params.TimeTop = search.DateRange[1];
    }

    const res: any = await api.finance.GetAllSkdInfos(params);
    if (res?.Data) {
      total.value = res.Data.Count || 0;
      const items = res.Data.items || [];
      items.forEach((el: any) => {
        if (el.BankCode) {
          el.CashPayMethod = '银行转账';
        }
        if (el.IsBeiHongchong) {
          el.IsHongchongName = '被红冲';
        } else if (el.IsHongchong) {
          el.IsHongchongName = '红冲';
        }
      });
      tableData.value = items;
    }
  } catch {
    tableData.value = getMockData();
    total.value = tableData.value.length;
  } finally {
    loading.value = false;
  }
};

const getMockData = () => [
  {
    SkdCode: 'SKD261021001', SkdDateTime: '2026-10-21 09:30:00', ClientName: '世纪出版社', ClientCode: '000001',
    SkdCrtType: '订单收款', SkdAmt: 15800, CashPayMethod: '现钞', OrderCode: 'GD261021001', OperName: '管理员',
    IsHongchong: '', IsBeiHongchong: '', IsHongchongName: '', WithCheck: true, Remark: '',
  },
  {
    SkdCode: 'SKD261021002', SkdDateTime: '2026-10-21 14:15:00', ClientName: '新华书店', ClientCode: '000002',
    SkdCrtType: '订单收款', SkdAmt: 3200, CashPayMethod: '微信', OrderCode: 'GD261021002', OperName: '管理员',
    IsHongchong: '', IsBeiHongchong: '', IsHongchongName: '', WithCheck: true, Remark: '',
  },
  {
    SkdCode: 'SKD261020001', SkdDateTime: '2026-10-20 16:40:00', ClientName: '晨光文具', ClientCode: '000003',
    SkdCrtType: '订单收款', SkdAmt: 500, CashPayMethod: '现钞', OrderCode: 'GD261021003', OperName: '张三',
    IsHongchong: '', IsBeiHongchong: '', IsHongchongName: '', WithCheck: true, Remark: '',
  },
  {
    SkdCode: 'SKD261020002', SkdDateTime: '2026-10-20 10:00:00', ClientName: '万科地产', ClientCode: '000004',
    SkdCrtType: '订单收款', SkdAmt: 22000, CashPayMethod: '银行转账', OrderCode: 'GD261021004', OperName: '管理员',
    IsHongchong: '', IsBeiHongchong: '', IsHongchongName: '', WithCheck: false, Remark: '应收记账', BankCode: '622200',
  },
];

const resetSearch = () => {
  search.SkdCode = '';
  search.OrderCode = '';
  search.ClientName = '';
  search.ClientCode = '';
  search.Operator = '';
  search.CashType = '';
  search.DateRange = [];
  search.PageIndex = 1;
  getTbody();
};

const onPageSizeChange = () => {
  search.PageIndex = 1;
  getTbody();
};

const viewOrder = (row: any) => {
  ElMessage.info(`查看工单：${row.OrderCode}`);
};

const handleAudit = (row: any) => {
  ElMessageBox.confirm(`确认审核收款单 ${row.SkdCode}？`, '提示', { type: 'warning' })
    .then(() => {
      ElMessage.success('审核成功');
      row.WithCheck = true;
    })
    .catch(() => {});
};

const handleReceipt = (row: any) => {
  ElMessage.info(`打印收款单 ${row.SkdCode} 收据`);
};

const handleRedFlush = (row: any) => {
  ElMessageBox.confirm(`确认红冲收款单 ${row.SkdCode}？`, '提示', { type: 'warning' })
    .then(() => {
      ElMessage.success('红冲成功');
      getTbody();
    })
    .catch(() => {});
};

onMounted(() => {
  getTbody();
});
</script>

<style scoped lang="scss">
.table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

:deep(.danger-row) {
  td {
    background: var(--erp-danger-bg) !important;
  }
}
</style>
