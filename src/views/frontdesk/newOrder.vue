<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台</p>
        <h1>{{ isEdit ? `编辑工单 ${orderNo}` : '新建工单' }}</h1>
        <p class="erp-pagehead-desc">为客户新开工作单；需要时可同时新建客户资料。</p>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>{{ isEdit ? '工单资料' : '新工单' }}</h2></div>
      <div class="erp-panelbody">
        <div class="order-form">

          <!-- 客户 -->
          <div class="erp-form-section">
            <h2 class="section-title">客户</h2>
            <div class="cust-radios">
              <label class="cust-radio" :class="{ active: custMode === 'walkin' }">
                <input type="radio" v-model="custMode" value="walkin" /> 散户（000000）
              </label>
              <label class="cust-radio" :class="{ active: custMode === 'old' }">
                <input type="radio" v-model="custMode" value="old" /> 选老客户
              </label>
              <label class="cust-radio" :class="{ active: custMode === 'new' }">
                <input type="radio" v-model="custMode" value="new" /> 建新客户
              </label>
            </div>
            <div class="erp-form-grid" v-if="custMode === 'old'">
              <div class="erp-field" style="grid-column: 1 / -1">
                <label>选择客户</label>
                <el-select v-model="form.custCode" filterable placeholder="选择客户" style="width: 100%">
                  <el-option v-for="c in customerOptions" :key="c.code" :label="`${c.code} ${c.name}（${c.group}）`" :value="c.code" />
                </el-select>
                <span class="field-help">可输入首字快速定位。</span>
              </div>
            </div>
            <div class="erp-form-grid" v-if="custMode === 'new'">
              <div class="erp-field">
                <label>客户名称</label>
                <el-input v-model="form.newCustName" placeholder="企业名或客户称呼" maxlength="100" />
                <span class="field-help">企业名或客户称呼，最多 100 个字符。</span>
              </div>
              <div class="erp-field">
                <label>手机</label>
                <el-input v-model="form.newPhone" placeholder="手机号码" />
              </div>
              <div class="erp-field">
                <label>客户分组</label>
                <el-select v-model="form.newGroup" placeholder="选择分组" style="width: 100%">
                  <el-option v-for="g in groupOptions" :key="g" :label="g" :value="g" />
                </el-select>
              </div>
            </div>
          </div>

          <!-- 联系与交付 -->
          <div class="erp-form-section">
            <h2 class="section-title">联系与交付</h2>
            <div class="erp-form-grid erp-form-grid-3">
              <div class="erp-field">
                <label>联系人</label>
                <el-input v-model="form.contact" placeholder="联系人姓名" />
              </div>
              <div class="erp-field">
                <label>电话</label>
                <el-input v-model="form.phone" placeholder="联系电话" />
              </div>
              <div class="erp-field">
                <label>交付日期</label>
                <el-date-picker v-model="form.due" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
                <span class="field-help">例如 2026-10-21；不填表示未约定。</span>
              </div>
              <div class="erp-field">
                <label>制作任务</label>
                <el-select v-model="form.task" placeholder="选择任务" style="width: 100%">
                  <el-option v-for="t in taskOptions" :key="t" :label="t" :value="t" />
                </el-select>
              </div>
              <div class="erp-field">
                <label>取送要求</label>
                <el-select v-model="form.delivery" placeholder="选择取送方式" style="width: 100%">
                  <el-option v-for="d in deliveryOptions" :key="d" :label="d" :value="d" />
                </el-select>
              </div>
              <div class="erp-field">
                <label>工单类型</label>
                <el-select v-model="form.orderType" placeholder="选择类型" style="width: 100%">
                  <el-option v-for="t in orderTypeOptions" :key="t" :label="t" :value="t" />
                </el-select>
              </div>
              <div class="erp-field" style="grid-column: 1 / -1">
                <label>制作要求</label>
                <el-input v-model="form.req" type="textarea" :rows="3" placeholder="纸张、尺寸、装订、颜色等" maxlength="500" />
                <span class="field-help">最多 500 个字符。</span>
              </div>
            </div>
          </div>

          <!-- 明细 -->
          <div class="erp-form-section">
            <h2 class="section-title">明细</h2>
            <div class="lines-toolbar">
              <el-button type="primary" @click="showItemPicker = true">添加经营项目</el-button>
              <span class="lines-total">合计（元）：<strong class="mono-cell">{{ fmtMoney(totalAmount) }}</strong></span>
            </div>
            <div v-if="form.lines.length === 0" class="lines-empty">
              <p class="lines-empty-title">尚未添加项目</p>
              <p class="lines-empty-text">点"添加经营项目"选择打印、装订等项目；也可以先保存为 0 元空单。</p>
            </div>
            <div v-else class="erp-table-wrap">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th style="width: 90px">编号</th>
                    <th>项目</th>
                    <th style="text-align: right; width: 100px">标价（元）</th>
                    <th style="text-align: right; width: 120px">实价（元）</th>
                    <th style="text-align: right; width: 100px">份数</th>
                    <th style="text-align: right; width: 110px">每份数量</th>
                    <th style="text-align: right; width: 110px">金额（元）</th>
                    <th style="width: 70px; text-align: center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(line, idx) in form.lines" :key="idx">
                    <td><span class="mono-text">{{ line.code }}</span></td>
                    <td>
                      {{ line.name }}
                      <div class="sub-text">{{ line.catName }} · {{ line.unit }}</div>
                    </td>
                    <td style="text-align: right"><span class="mono-cell">{{ fmtMoney(line.listPrice) }}</span></td>
                    <td style="text-align: right">
                      <el-input-number v-model="line.price" :min="0" :precision="2" size="small" controls-position="right" style="width: 96px" @change="calcLine(line)" />
                    </td>
                    <td style="text-align: right">
                      <el-input-number v-model="line.copies" :min="0" size="small" controls-position="right" style="width: 80px" @change="calcLine(line)" />
                    </td>
                    <td style="text-align: right">
                      <el-input-number v-model="line.qty" :min="0" size="small" controls-position="right" style="width: 90px" @change="calcLine(line)" />
                    </td>
                    <td style="text-align: right"><span class="mono-cell">{{ fmtMoney(line.amount) }}</span></td>
                    <td style="text-align: center">
                      <el-button link type="danger" size="small" @click="removeItem(idx)">移除</el-button>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="6" style="text-align: right; font-weight: 600">合计</td>
                    <td style="text-align: right"><span class="mono-cell" style="font-weight: 700">{{ fmtMoney(totalAmount) }}</span></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- 其他 -->
          <div class="erp-form-section">
            <h2 class="section-title">其他</h2>
            <div class="erp-form-grid">
              <div class="erp-field">
                <label>客户文件</label>
                <el-input v-model="form.file" placeholder="文件名或存放位置" />
                <span class="field-help">Web 版建议改为上传附件，正式版接入文件服务。</span>
              </div>
              <div class="erp-field">
                <label>说明备注</label>
                <el-input v-model="form.remark" placeholder="备注信息" maxlength="200" />
              </div>
            </div>
          </div>

          <!-- 操作 -->
          <div class="erp-form-actions">
            <el-button type="primary" @click="submitForm">{{ isEdit ? '保存工单' : '创建工单' }}</el-button>
            <el-button @click="router.back()">{{ isEdit ? '返回详情' : '返回列表' }}</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 经营项目选择弹窗 -->
    <el-dialog v-model="showItemPicker" title="添加经营项目" width="900px" top="6vh">
      <div class="picker-layout">
        <!-- 左侧：经营主项 -->
        <div class="picker-left">
          <div class="picker-panel-header">
            <h3>经营主项</h3>
          </div>
          <div class="picker-list" v-loading="mainLoading">
            <div
              v-for="item in itemCategories"
              :key="item.ItemCode"
              class="picker-list-item"
              :class="{ active: pickerCat === item.ItemCode }"
              @click="pickerCat = item.ItemCode"
            >
              <div class="picker-list-item-info">
                <span class="picker-code">{{ item.ItemCode }}</span>
                <span class="picker-name">{{ item.ItemName }}</span>
              </div>
            </div>
            <div v-if="!mainLoading && itemCategories.length === 0" class="picker-empty">暂无主项</div>
          </div>
        </div>

        <!-- 右侧：经营子项 -->
        <div class="picker-right">
          <div class="picker-panel-header">
            <h3>经营子项 <template v-if="selectedMainName">— {{ selectedMainName }}</template></h3>
            <el-input
              v-model="pickerKw"
              placeholder="搜索编号/名称"
              clearable
              size="small"
              style="width: 180px"
            />
          </div>
          <div class="picker-list" v-loading="subLoading">
            <div
              v-for="sub in filteredItems"
              :key="sub.SubItemCode"
              class="picker-list-item sub-item"
              @click="pickItem(sub)"
            >
              <div class="picker-list-item-info">
                <span class="picker-code">{{ sub.SubItemCode }}</span>
                <span class="picker-name">{{ sub.SubItemName }}</span>
                <span class="picker-unit">{{ sub.Unit }}</span>
              </div>
              <div class="picker-list-item-price">
                <span class="mono-cell">{{ fmtMoney(sub.SalePrice) }}</span>
              </div>
            </div>
            <div v-if="!subLoading && filteredItems.length === 0" class="picker-empty">
              {{ pickerCat ? '暂无子项' : '请先选择左侧主项' }}
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showItemPicker = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import bizItemsApi from '@/api/bizItems';

const router = useRouter();
const route = useRoute();

const isEdit = computed(() => !!route.query.id);
const orderNo = computed(() => (route.query.no as string) || '');

const custMode = ref('walkin');
const showItemPicker = ref(false);
const pickerCat = ref('');
const pickerKw = ref('');

const form = reactive({
  custCode: '',
  newCustName: '',
  newPhone: '',
  newGroup: '',
  contact: '',
  phone: '',
  due: '',
  task: '',
  delivery: '',
  orderType: '',
  req: '',
  file: '',
  remark: '',
  lines: [] as any[],
});

const customerOptions = [
  { code: '000001', name: '世纪出版社', group: '企业客户' },
  { code: '000002', name: '新华书店', group: '企业客户' },
  { code: '000003', name: '晨光文具', group: '散户' },
];

const groupOptions = ['企业客户', '散户', 'VIP客户'];
const taskOptions = ['印刷', '复印', '打印', '装订', '设计', '其他'];
const deliveryOptions = ['自取', '快递', '送货', '同城跑腿'];
const orderTypeOptions = ['印刷', '复印', '打印', '装订', '设计', '其他'];

const itemCategories = ref<any[]>([]);
const allItems = ref<any[]>([]);
const subLoading = ref(false);
const mainLoading = ref(false);

const selectedMainName = computed(() => {
  return itemCategories.value.find(c => c.ItemCode === pickerCat.value)?.ItemName || '';
});

const itemCatName = (cat: string) => itemCategories.value.find(c => c.ItemCode === cat)?.ItemName || cat;

const filteredItems = computed(() => {
  const kw = pickerKw.value.trim();
  return allItems.value.filter(i =>
    (!pickerCat.value || i.MainItemCode === pickerCat.value) &&
    (!kw || i.SubItemCode.includes(kw) || i.SubItemName.includes(kw))
  ).slice(0, 60);
});

const fmtMoney = (v: number) => '￥' + (v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const totalAmount = computed(() => form.lines.reduce((s, l) => s + l.amount, 0));

const calcLine = (line: any) => {
  line.amount = Math.round(((Number(line.price) || 0) * (Number(line.qty) || 0) * (line.copies === '' || line.copies == null ? 1 : Number(line.copies) || 0)) * 100) / 100;
};

const pickItem = (item: any) => {
  form.lines.push({
    code: item.SubItemCode,
    cat: item.MainItemCode,
    catName: itemCatName(item.MainItemCode),
    name: item.SubItemName,
    unit: item.Unit || '',
    listPrice: item.SalePrice || 0,
    price: item.SalePrice || 0,
    copies: 1,
    qty: 1,
    amount: item.SalePrice || 0,
  });
  ElMessage.success(`已添加：${item.SubItemName}`);
};

const removeItem = (index: number) => {
  form.lines.splice(index, 1);
};

const loadMainItems = async () => {
  mainLoading.value = true;
  try {
    const res: any = await bizItemsApi.GetBizMainItems({ PageIndex: 1, PageLimit: 100 });
    if (res?.Data?.children) {
      itemCategories.value = res.Data.children;
    }
  } catch (e) {
    console.error('加载经营主项失败', e);
  }
  mainLoading.value = false;
};

const loadSubItems = async () => {
  if (!pickerCat.value) {
    allItems.value = [];
    return;
  }
  subLoading.value = true;
  try {
    const res: any = await bizItemsApi.GetBizSubItems({
      MainItemCode: pickerCat.value,
      Keyword: pickerKw.value.trim(),
      PageIndex: 1,
      PageLimit: 100,
    });
    if (res?.Data?.children) {
      allItems.value = res.Data.children;
    }
  } catch (e) {
    console.error('加载经营子项失败', e);
    allItems.value = [];
  }
  subLoading.value = false;
};

watch(showItemPicker, (val) => {
  if (val) {
    loadMainItems();
    if (pickerCat.value) {
      loadSubItems();
    }
  }
});

watch(pickerCat, () => {
  loadSubItems();
});

watch(pickerKw, () => {
  if (pickerCat.value) {
    loadSubItems();
  }
});

const submitForm = () => {
  ElMessage.success(isEdit.value ? `工单 ${orderNo.value} 已保存` : '工单已创建');
  router.push('/frontdesk/orderRecords');
};

onMounted(() => {
  if (isEdit.value) {
    form.contact = '张三';
    form.phone = '13800138000';
    form.task = '印刷';
    form.req = 'A4 200P 铜版纸';
    form.lines.push({
      code: '110001', cat: '11', catName: '复印', name: '复印 A4 黑白', unit: '张',
      listPrice: 0.1, price: 0.1, copies: 100, qty: 1, amount: 10,
    });
  }
});
</script>

<style scoped lang="scss">
.order-form {
  max-width: none;
}

.section-title {
  font-size: var(--erp-section-size);
  font-weight: 600;
  color: var(--erp-ink);
  padding-bottom: var(--erp-space-2);
  border-bottom: 1px solid var(--erp-line);
  margin: 0 0 var(--erp-space-4);
}

.cust-radios {
  display: flex;
  flex-wrap: wrap;
  gap: var(--erp-space-2) var(--erp-space-4);
  margin-bottom: var(--erp-space-4);
}

.cust-radio {
  display: inline-flex;
  align-items: center;
  gap: var(--erp-space-2);
  padding: var(--erp-space-2) var(--erp-space-4);
  border: 1px solid var(--erp-line);
  border-radius: var(--erp-control-radius);
  cursor: pointer;
  font-size: var(--erp-table-size);
  font-weight: 500;
  color: var(--erp-text);
  transition: all var(--erp-motion-duration);

  input[type="radio"] {
    width: 16px;
    height: 16px;
    accent-color: var(--erp-primary);
    margin: 0;
  }

  &:hover {
    border-color: var(--erp-control-border);
  }

  &.active {
    border-color: var(--erp-primary);
    background: var(--erp-primary-light);
    color: var(--erp-primary);
  }
}

.lines-toolbar {
  display: flex;
  align-items: center;
  gap: var(--erp-space-4);
  margin-bottom: var(--erp-space-4);
}

.lines-total {
  color: var(--erp-muted);
  font-size: var(--erp-table-size);

  strong {
    font-size: 16px;
    font-weight: 700;
    color: var(--erp-ink);
  }
}

.lines-empty {
  text-align: center;
  padding: var(--erp-space-8) var(--erp-space-4);
  border: 1px dashed var(--erp-line);
  border-radius: var(--erp-panel-radius);
}

.lines-empty-title {
  font-size: var(--erp-table-size);
  font-weight: 600;
  color: var(--erp-text);
  margin-bottom: var(--erp-space-1);
}

.lines-empty-text {
  font-size: var(--erp-caption-size);
  color: var(--erp-muted);
}

.mono-text {
  font-family: var(--erp-font-mono);
  font-variant-numeric: tabular-nums;
}

.picker-toolbar {
  display: flex;
  gap: var(--erp-space-4);
  align-items: flex-end;
}

.picker-layout {
  display: flex;
  gap: var(--erp-space-4);
  height: 480px;
}

.picker-left,
.picker-right {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--erp-line);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.picker-left {
  flex: 0 0 260px;
}

.picker-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--erp-space-3) var(--erp-space-4);
  border-bottom: 1px solid var(--erp-line);
  background: var(--erp-bg-secondary, #fafafa);

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }
}

.picker-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--erp-space-2);
}

.picker-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--erp-space-2) var(--erp-space-3);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 2px;

  &:hover {
    background: var(--erp-hover);
  }

  &.active {
    background: var(--erp-primary-light, #ecf5ff);
    border-left: 3px solid var(--erp-primary);
    padding-left: calc(var(--erp-space-3) - 3px);
  }
}

.picker-list-item-info {
  display: flex;
  align-items: center;
  gap: var(--erp-space-2);
  min-width: 0;
  flex: 1;
}

.picker-code {
  font-family: var(--erp-font-mono);
  font-size: var(--erp-caption-size);
  color: var(--erp-muted);
  flex-shrink: 0;
}

.picker-name {
  font-size: var(--erp-table-size);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.picker-unit {
  font-size: var(--erp-caption-size);
  color: var(--erp-muted);
  flex-shrink: 0;
}

.picker-list-item-price {
  flex-shrink: 0;
  font-size: var(--erp-table-size);
  font-weight: 600;
}

.picker-empty {
  text-align: center;
  padding: var(--erp-space-8) var(--erp-space-4);
  color: var(--erp-muted);
  font-size: var(--erp-caption-size);
}
</style>
