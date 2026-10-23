<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台</p>
        <h1>工单记录 · {{ isFull ? '全面' : '基础' }}</h1>
        <p class="erp-pagehead-desc">{{ isFull ? '全部列：基础、制作、金额、生产、更多 · 按委托时间倒序' : '常用列：基础、制作、金额 · 按委托时间倒序' }}</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="isFull = !isFull">{{ isFull ? '切换到基础列' : '切换到全面列' }}</el-button>
        <el-button type="primary" @click="router.push('/frontdesk/newOrder')">
          <el-icon><Plus /></el-icon> 新建工单
        </el-button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索</label>
        <el-input v-model="search.OrderCode" placeholder="工单号 / 客户 / 制作要求" clearable style="width: 220px" />
      </div>
      <div class="erp-toolbar-item">
        <label>业务日期</label>
        <el-date-picker v-model="search.DateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
      </div>
      <div class="erp-toolbar-item">
        <label>结算状态</label>
        <el-select v-model="search.PayStatus" clearable placeholder="全部" style="width: 130px">
          <el-option v-for="s in settleOptions" :key="s" :label="s" :value="s" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>生产流程</label>
        <el-select v-model="search.OrderStatus" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="f in flowOptions" :key="f" :label="f" :value="f" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>工单类型</label>
        <el-select v-model="search.OrderType" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="t in orderTypeOptions" :key="t" :label="t" :value="t" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>制作任务</label>
        <el-select v-model="search.Task" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="t in taskOptions" :key="t" :label="t" :value="t" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>取送要求</label>
        <el-select v-model="search.Delivery" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="d in deliveryOptions" :key="d" :label="d" :value="d" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>客户分组</label>
        <el-select v-model="search.Group" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="g in groupOptions" :key="g" :label="g" :value="g" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>审核状态</label>
        <el-select v-model="search.AuditStatus" clearable placeholder="全部" style="width: 120px">
          <el-option label="已审核" value="已审核" />
          <el-option label="未审核" value="未审核" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="getTbody">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe style="width: 100%" @row-click="viewRow">
          <!-- 基础列 -->
          <el-table-column prop="OrderCode" label="工作单号" width="150" align="center">
            <template #default="{ row }">
              <el-link type="primary" @click.stop="viewRow(row)">{{ row.OrderCode }}</el-link>
              <div class="sub-text">{{ row.ClientName }} · {{ row.GroupName || '散户' }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="CrtTime" label="业务日期" width="120" align="center">
            <template #default="{ row }">{{ formatDate(row.CrtTime) }}</template>
          </el-table-column>

          <!-- 制作列 -->
          <el-table-column prop="OrderName" label="任务" min-width="160">
            <template #default="{ row }">
              {{ row.OrderName || '—' }}
              <div v-if="row.OrderDesc" class="sub-text">{{ row.OrderDesc }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="Contact" label="联络人员 / 电话" width="140" v-if="isFull">
            <template #default="{ row }">
              {{ row.Contact || '—' }}
              <div v-if="row.Phone" class="sub-text">{{ row.Phone }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="Address" label="联系地址" width="160" v-if="isFull" :show-overflow-tooltip="true" />

          <!-- 金额列 -->
          <el-table-column prop="ListAmount" label="标售（元）" width="110" align="right" v-if="isFull">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.ListAmount || row.SpAmt) }}</span></template>
          </el-table-column>
          <el-table-column prop="SpAmt" label="实售（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.SpAmt) }}</span></template>
          </el-table-column>
          <el-table-column prop="Wipe" label="抹零（元）" width="100" align="right" v-if="isFull">
            <template #default="{ row }"><span class="mono-cell">{{ row.Wipe ? fmtMoney(row.Wipe) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="RealAmount" label="实收（元）" width="110" align="right" v-if="isFull">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.RealAmount ?? row.SpAmt) }}</span></template>
          </el-table-column>
          <el-table-column prop="PayAmt" label="已结（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.PayAmt) }}</span></template>
          </el-table-column>
          <el-table-column label="未结（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney((row.SpAmt || 0) - (row.PayAmt || 0)) }}</span></template>
          </el-table-column>
          <el-table-column prop="PayMethod" label="结算方式" width="110" v-if="isFull" />

          <!-- 生产列 (全面) -->
          <template v-if="isFull">
            <el-table-column prop="OrderStatus" label="生产流程" width="110" align="center">
              <template #default="{ row }">
                <span class="erp-badge" :data-tone="getOrderStatusTone(row.OrderStatus)">{{ row.OrderStatus }}</span>
                <div v-if="row.Handler" class="sub-text">{{ row.Handler }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="ShippmentDate" label="交付日期" width="120" align="center">
              <template #default="{ row }">{{ formatDate(row.ShippmentDate) || '未约定' }}</template>
            </el-table-column>
            <el-table-column prop="Delivery" label="取送要求" width="100" />
            <el-table-column prop="OrderType" label="工单类型" width="100" />
          </template>

          <!-- 更多列 (全面) -->
          <template v-if="isFull">
            <el-table-column prop="PayStatus" label="结算状态" width="110" align="center">
              <template #default="{ row }">
                <span class="erp-badge" :data-tone="getPayStatusTone(row.PayStatus)">{{ row.PayStatus || '待付款' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="Receptionist" label="接待人员" width="100" />
            <el-table-column prop="Audited" label="审核" width="90" align="center">
              <template #default="{ row }">
                <span class="erp-badge" :data-tone="row.Audited ? 'success' : undefined">{{ row.Audited ? '已审核' : '未审核' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="OrderRemark" label="备注" min-width="140" :show-overflow-tooltip="true" />
          </template>

          <!-- 基础模式下的简化状态列 -->
          <template v-if="!isFull">
            <el-table-column prop="OrderStatus" label="生产流程" width="110" align="center">
              <template #default="{ row }">
                <span class="erp-badge" :data-tone="getOrderStatusTone(row.OrderStatus)">{{ row.OrderStatus }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="PayStatus" label="结算状态" width="110" align="center">
              <template #default="{ row }">
                <span class="erp-badge" :data-tone="getPayStatusTone(row.PayStatus)">{{ row.PayStatus || '待付款' }}</span>
              </template>
            </el-table-column>
          </template>

          <!-- 操作 -->
          <el-table-column label="操作" width="180" fixed="right" @click.stop>
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click.stop="viewRow(row)">详情</el-button>
                <el-button v-if="(row.SpAmt || 0) - (row.PayAmt || 0) > 0" link type="primary" size="small" @click.stop="handleSettle(row)">收款</el-button>
                <el-button link type="primary" size="small" @click.stop="handleTransfer(row)">转单</el-button>
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
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '@/api';

const router = useRouter();
const loading = ref(false);
const total = ref(0);
const isFull = ref(true);
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
  PayStatus: '',
  OrderType: '',
  Task: '',
  Delivery: '',
  Group: '',
  AuditStatus: '',
  DateRange: [] as string[],
});

const settleOptions = ['待付款', '少收货款', '挂账', '多收款', '货款收'];
const flowOptions = ['待审核', '待生产', '生产中', '完工', '结单'];
const orderTypeOptions = ['印刷', '复印', '打印', '装订', '设计', '其他'];
const taskOptions = ['印刷', '复印', '打印', '装订', '设计', '其他'];
const deliveryOptions = ['自取', '快递', '送货', '同城跑腿'];
const groupOptions = ['企业客户', '散户', 'VIP客户'];

const formatDate = (val: any) => {
  if (!val) return '';
  return val.length > 10 ? val.substring(0, 10) : val;
};

const fmtMoney = (val: any) => {
  const num = Number(val || 0);
  return '￥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getOrderStatusTone = (status: string): string => {
  const map: Record<string, string> = {
    '待审核': 'info', '待生产': '', '生产中': 'warning', '完工': 'success', '结单': 'success', '作废': 'danger',
  };
  return map[status] || 'info';
};

const getPayStatusTone = (status: string): string => {
  const map: Record<string, string> = {
    '待付款': 'info', '少收货款': 'danger', '挂账': 'info', '多收款': 'success', '货款收': 'success',
  };
  return map[status] || 'info';
};

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
      PayStatus: search.PayStatus,
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
    tableData.value = getMockData();
    total.value = tableData.value.length;
  } finally {
    loading.value = false;
  }
};

const getMockData = () => [
  {
    Id: '1', OrderCode: 'GD261021001', ClientName: '世纪出版社', GroupName: '企业客户',
    OrderName: '产品画册印刷', OrderDesc: 'A4 200P 铜版纸', Contact: '张三', Phone: '13800138000',
    Address: '北京市朝阳区建国路88号', CrtTime: '2026-10-20 09:30:00', ShippmentDate: '2026-10-25',
    SpAmt: 15800, ListAmount: 16200, Wipe: 0, RealAmount: 15800, PayAmt: 15800, BillingAmt: 15800,
    PayMethod: '微信', OrderStatus: '完工', PayStatus: '货款收', OrderType: '印刷',
    Delivery: '快递', Handler: '张三', Audited: true, Receptionist: '管理员', OrderRemark: '加急',
  },
  {
    Id: '2', OrderCode: 'GD261021002', ClientName: '新华书店', GroupName: '企业客户',
    OrderName: '教材封面覆膜', OrderDesc: '', Contact: '李四', Phone: '13900139000',
    Address: '', CrtTime: '2026-10-20 14:15:00', ShippmentDate: '2026-10-23',
    SpAmt: 3200, ListAmount: 3200, Wipe: 0, RealAmount: 3200, PayAmt: 0, BillingAmt: 0,
    PayMethod: '', OrderStatus: '生产中', PayStatus: '待付款', OrderType: '印刷',
    Delivery: '自取', Handler: '李四', Audited: false, Receptionist: '管理员', OrderRemark: '',
  },
  {
    Id: '3', OrderCode: 'GD261021003', ClientName: '晨光文具', GroupName: '散户',
    OrderName: '宣传折页', OrderDesc: '三折页 铜版纸', Contact: '', Phone: '',
    Address: '', CrtTime: '2026-10-21 08:00:00', ShippmentDate: '2026-10-22',
    SpAmt: 860, ListAmount: 900, Wipe: 40, RealAmount: 860, PayAmt: 500, BillingAmt: 0,
    PayMethod: '现钞', OrderStatus: '待生产', PayStatus: '少收货款', OrderType: '印刷',
    Delivery: '送货', Handler: '', Audited: false, Receptionist: '管理员', OrderRemark: '明天交货',
  },
  {
    Id: '4', OrderCode: 'GD261021004', ClientName: '万科地产', GroupName: '企业客户',
    OrderName: '楼书印刷', OrderDesc: '精装', Contact: '王五', Phone: '13700137000',
    Address: '深圳市南山区科技园', CrtTime: '2026-10-19 16:40:00', ShippmentDate: '2026-10-28',
    SpAmt: 42000, ListAmount: 43000, Wipe: 1000, RealAmount: 42000, PayAmt: 20000, BillingAmt: 42000,
    PayMethod: '转账', OrderStatus: '完工', PayStatus: '少收货款', OrderType: '印刷',
    Delivery: '送货', Handler: '王五', Audited: true, Receptionist: '管理员', OrderRemark: '分两批交货',
  },
  {
    Id: '5', OrderCode: 'GD261021005', ClientName: '华为技术', GroupName: '企业客户',
    OrderName: '产品手册', OrderDesc: '中英双语', Contact: '赵六', Phone: '13600136000',
    Address: '深圳市龙岗区坂田华为基地', CrtTime: '2026-10-21 10:20:00', ShippmentDate: '2026-11-01',
    SpAmt: 68000, ListAmount: 68000, Wipe: 0, RealAmount: 68000, PayAmt: 0, BillingAmt: 0,
    PayMethod: '', OrderStatus: '待审核', PayStatus: '待付款', OrderType: '印刷',
    Delivery: '快递', Handler: '', Audited: false, Receptionist: '管理员', OrderRemark: '需要打样确认',
  },
  {
    Id: '6', OrderCode: 'GD261021006', ClientName: '李明', GroupName: '散户',
    OrderName: '证件照', OrderDesc: '一寸 白底', Contact: '李明', Phone: '15800158000',
    Address: '', CrtTime: '2026-10-21 11:00:00', ShippmentDate: '2026-10-21',
    SpAmt: 30, ListAmount: 30, Wipe: 0, RealAmount: 30, PayAmt: 30, BillingAmt: 0,
    PayMethod: '微信', OrderStatus: '结单', PayStatus: '货款收', OrderType: '设计',
    Delivery: '自取', Handler: '管理员', Audited: true, Receptionist: '管理员', OrderRemark: '',
  },
];

const resetSearch = () => {
  search.OrderCode = '';
  search.ClientName = '';
  search.OrderName = '';
  search.OrderDesc = '';
  search.OrderStatus = '';
  search.PayStatus = '';
  search.OrderType = '';
  search.Task = '';
  search.Delivery = '';
  search.Group = '';
  search.AuditStatus = '';
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

const handleSettle = (row: any) => {
  ElMessage.info(`收款功能开发中：${row.OrderCode}`);
};

const handleTransfer = (row: any) => {
  ElMessage.info(`转单功能开发中：${row.OrderCode}`);
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
