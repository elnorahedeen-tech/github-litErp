<template>
  <div class="erp-content">
    <!-- 页面头部 -->
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台</p>
        <h1>前台业务中心</h1>
        <p class="erp-pagehead-desc">接待中的工作单。结算状态与生产流程分开记录；点工单号查看详情。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="router.push('/frontdesk/newOrder')">
          <el-icon><Plus /></el-icon> 新建工单
        </el-button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>订单编号</label>
        <el-input v-model="search.OrderCode" placeholder="输入订单编号" clearable style="width: 160px" />
      </div>
      <div class="erp-toolbar-item">
        <label>客户名称</label>
        <el-input v-model="search.ClientName" placeholder="输入客户名称" clearable style="width: 160px" />
      </div>
      <div class="erp-toolbar-item">
        <label>订单名称</label>
        <el-input v-model="search.OrderName" placeholder="输入订单名称" clearable style="width: 160px" />
      </div>
      <div class="erp-toolbar-item">
        <label>订单备注</label>
        <el-input v-model="search.OrderDesc" placeholder="输入备注" clearable style="width: 140px" />
      </div>
      <div class="erp-toolbar-item">
        <label>开单日期</label>
        <el-date-picker
          v-model="search.DateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 240px"
        />
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="getTbody">查询</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe style="width: 100%" @row-click="viewRow">
          <el-table-column prop="OrderCode" label="订单编号" width="150" align="center" />
          <el-table-column prop="ClientName" label="客户名称" min-width="180" />
          <el-table-column prop="OrderName" label="订单名称" min-width="260" />
          <el-table-column prop="CrtTime" label="开单日期" width="120" align="center">
            <template #default="{ row }">
              {{ formatDate(row.CrtTime) }}
            </template>
          </el-table-column>
          <el-table-column prop="ShippmentDate" label="交货日期" width="120" align="center">
            <template #default="{ row }">
              {{ formatDate(row.ShippmentDate) }}
            </template>
          </el-table-column>
          <el-table-column prop="SpAmt" label="订单金额" width="110" align="right">
            <template #default="{ row }">
              <span class="mono-cell">{{ formatMoney(row.SpAmt) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="PayAmt" label="已收金额" width="110" align="right">
            <template #default="{ row }">
              <span class="mono-cell">{{ formatMoney(row.PayAmt) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="BillingAmt" label="已开票额" width="110" align="right">
            <template #default="{ row }">
              <span class="mono-cell">{{ formatMoney(row.BillingAmt) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="OrderStatus" label="订单状态" width="100" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="getOrderStatusTone(row.OrderStatus)">{{ row.OrderStatus }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="PayStatus" label="付款状态" width="100" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="getPayStatusTone(row.PayStatus)">{{ row.PayStatus || '待付款' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="OrderRemark" label="订单备注" min-width="140" />
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click.stop="viewRow(row)">查看</el-button>
                <el-button v-if="canEdit(row)" link type="primary" size="small" @click.stop="editRow(row)">编辑</el-button>
                <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, row)">
                  <el-button link type="primary" size="small">
                    更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="production">查看生产</el-dropdown-item>
                      <el-dropdown-item command="receipt">打印小票</el-dropdown-item>
                      <el-dropdown-item command="copy">订单复制</el-dropdown-item>
                      <el-dropdown-item command="delete" divided v-if="canDelete(row)">作废</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
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
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import api from '@/api';

const router = useRouter();
const loading = ref(false);
const total = ref(0);
const tableData = ref<any[]>([]);

const search = reactive({
  PageIndex: 1,
  PageLimit: 20,
  Count: 0,
  OrderCode: '',
  ClientName: '',
  OrderName: '',
  OrderDesc: '',
  OrderStatus: '',
  DateRange: [] as string[],
});

const formatDate = (val: any) => {
  if (!val) return '';
  return val.length > 10 ? val.substring(0, 10) : val;
};

const formatMoney = (val: any) => {
  const num = Number(val || 0);
  return '￥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getOrderStatusTone = (status: string): string => {
  const map: Record<string, string> = {
    '待审核': 'info',
    '待生产': '',
    '生产中': 'warning',
    '完工': 'success',
    '结单': 'success',
    '待退款': 'success',
    '已退款': 'success',
    '作废': 'danger',
  };
  return map[status] || 'info';
};

const getPayStatusTone = (status: string): string => {
  const map: Record<string, string> = {
    '待付款': 'info',
    '少收货款': 'danger',
    '挂账': 'info',
    '多收款': 'success',
    '货款收': 'success',
  };
  return map[status] || 'info';
};

const canEdit = (row: any) => row.OrderStatus !== '结单';
const canDelete = (row: any) => row.OrderStatus === '待审核' && ['待付款', '待收款'].includes(row.PayStatus);

const getTbody = async () => {
  loading.value = true;
  try {
    const params: any = {
      PageIndex: search.PageIndex,
      PageLimit: search.PageLimit,
      OrderCode: search.OrderCode,
      ClientName: search.ClientName,
      OrderName: search.OrderName,
      OrderDesc: search.OrderDesc,
      OrderStatus: search.OrderStatus,
    };
    if (search.DateRange?.length === 2) {
      params.BeginDate = search.DateRange[0];
      params.EndDate = search.DateRange[1];
    }

    const res: any = await api.order.GetList(params);
    if (res?.Data) {
      total.value = res.Data.Count || 0;
      tableData.value = res.Data.orders || [];
    }
  } catch {
    // 接口未连通时使用模拟数据
    tableData.value = getMockData();
    total.value = tableData.value.length;
  } finally {
    loading.value = false;
  }
};

const getMockData = () => [
  {
    Id: '1', OrderCode: 'DD20261021001', ClientName: '世纪出版社', OrderName: '产品画册印刷 A4 200P',
    CrtTime: '2026-10-20 09:30:00', ShippmentDate: '2026-10-25', SpAmt: 15800, PayAmt: 15800,
    BillingAmt: 15800, OrderStatus: '结单', PayStatus: '货款收讫', OrderRemark: '加急'
  },
  {
    Id: '2', OrderCode: 'DD20261021002', ClientName: '新华书店', OrderName: '教材封面覆膜',
    CrtTime: '2026-10-20 14:15:00', ShippmentDate: '2026-10-23', SpAmt: 3200, PayAmt: 0,
    BillingAmt: 0, OrderStatus: '生产中', PayStatus: '待付款', OrderRemark: ''
  },
  {
    Id: '3', OrderCode: 'DD20261021003', ClientName: '晨光文具', OrderName: '宣传折页 三折页 铜版纸',
    CrtTime: '2026-10-21 08:00:00', ShippmentDate: '2026-10-22', SpAmt: 860, PayAmt: 860,
    BillingAmt: 0, OrderStatus: '待生产', PayStatus: '货款收讫', OrderRemark: '明天交货'
  },
  {
    Id: '4', OrderCode: 'DD20261021004', ClientName: '万科地产', OrderName: '楼书印刷 精装',
    CrtTime: '2026-10-19 16:40:00', ShippmentDate: '2026-10-28', SpAmt: 42000, PayAmt: 20000,
    BillingAmt: 42000, OrderStatus: '完工', PayStatus: '少收货款', OrderRemark: '分两批交货'
  },
  {
    Id: '5', OrderCode: 'DD20261021005', ClientName: '华为技术', OrderName: '产品手册 中英双语',
    CrtTime: '2026-10-21 10:20:00', ShippmentDate: '2026-11-01', SpAmt: 68000, PayAmt: 0,
    BillingAmt: 0, OrderStatus: '待审核', PayStatus: '待付款', OrderRemark: '需要打样确认'
  },
];

const resetSearch = () => {
  search.OrderCode = '';
  search.ClientName = '';
  search.OrderName = '';
  search.OrderDesc = '';
  search.OrderStatus = '';
  search.DateRange = [];
  search.PageIndex = 1;
  getTbody();
};

const onPageSizeChange = () => {
  search.PageIndex = 1;
  getTbody();
};

const viewRow = (row: any) => {
  router.push(`/frontdesk/orderDetail?id=${row.Id}`);
};

const editRow = (row: any) => {
  router.push(`/frontdesk/newOrder?id=${row.Id}&type=2`);
};

const handleCommand = (cmd: string, row: any) => {
  switch (cmd) {
    case 'production':
      ElMessage.info('查看生产功能开发中');
      break;
    case 'receipt':
      ElMessage.info('打印小票功能开发中');
      break;
    case 'copy':
      ElMessage.info('订单复制功能开发中');
      break;
    case 'delete':
      ElMessageBox.confirm(`确认作废订单 ${row.OrderCode}？`, '提示', { type: 'warning' })
        .then(async () => {
          try {
            await api.order.Delete({ Id: row.Id, OrderStatus: '作废' });
            ElMessage.success('作废成功');
            getTbody();
          } catch {
            ElMessage.success('作废成功（模拟）');
            getTbody();
          }
        })
        .catch(() => {});
      break;
  }
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
</style>
