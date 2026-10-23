# 客户资料：Lite 对接完整版接口的待确认事项

给完整版（根目录 Vue 工程 `src/`）的开发同事看。LiteERP（`v2/`）要向下兼容完整版后端：**沿用完整版原始字段名和状态值，只在前端显示层起中文别名**。下面是客户资料这一块对照后需要你们确认的地方，直接在本文件里回复或改都可以。

对照范围：

- 完整版：`src/views/customer/index.vue`、`src/views/customer/customerDetail.vue`，接口 `src/api/customer.ts`、`src/api/pricecfg.ts`
- Lite：`v2/js/pages/customer.js`（客户资料 `custManage`、客户详情 `customerDetail`）

## 1. 字段对照

| 完整版字段 | 显示名 | Lite v2 现用 | 情况 |
|---|---|---|---|
| `ClientCode` | 客户编号 | `code` | 对应 |
| `ClientName` | 客户名称 | `name` | 对应 |
| `CustomerType` | 客户分组 | `group`（编号）/ `groupName` | 后端存分组**编号**，按编号筛选；Lite 用编号。一致 |
| `RegisterPhone` | 注册手机号 | `phone` | 基本对应 |
| `SalerName` | 销售代表 | `owner`（负责人员） | 待确认，见问题 1 |
| `CardBalance` | 储值卡余额 | `prestoreBalance` | 待确认，见问题 2 |
| `AccountPeriod` / `AccountAmt` | 账期上限 / 账额上限 | `settleType`（现结/记账/月结）、`creditLimit` | 两个都是管控上限，不是欠款本身。见问题 3 |
| `DepName` | 门店名称 | 无 | Lite 暂无多门店 |
| `PriceTableName` | 价格表 | 无（Lite 用分组折扣 + 协议价） | 见问题 5 |
| `LastOrderTime` / `OrderCostAmt` / `CouponsNum` | 最后下单 / 总消费 / 优惠券数 | 无 | 后端统计字段，Lite 直接显示 |
| `CreateTime` / `Creator` / `UpdateTime` / `Updater` | 创建、更新时间与人 | 仅 `created`（建交日期） | 待确认 `created` 是否就是 `CreateTime` |
| `Debt`（详情接口） | 欠款 | `debt` | 不在客户主表，由 `TotalAmtAndPeriod` 实时计算 |
| `PrestoreBalance`、`TotalSettlement`（详情接口） | 预存余额、累计结算 | `prestoreBalance` | `PrestoreBalance` = `CardBalance`；`TotalSettlement` 后端未返回 |

Lite 还有一批照旧版 Windows「客户资料」窗口做的字段，完整版前端目前没用到，不知道后端有没有、叫什么：

> 简称、机构/个人类型、固话、QQ、微信、传真、电子邮件、邮编、网址、地址、城市商圈、取送距离、客户来源、所属行业、机构性质、规模、价值评估、关系等级、信誉等级、无委托提醒天数、开票抬头、税号、开户银行、最近对账日期、说明备注、说明简介

联络人员（`pricecfg/GetAllSubAccounts`）完整版用到：`RecId`、`Name`、`CallName`、`ContactType`、`Department`、`Title`、`Mobile`、`Phone`、`Email`、`CrtTime`。Lite 另有性别、年龄段、QQ、地址、身份证、云端账号、负责人员、说明，同样需要确认。

回答：能用的字段保留，没有的新增

## 2. 需要确认的问题

1. **`SalerName`（销售代表）** 和 Lite 的「负责人员」是不是同一个概念？
   回答：是同一个概念。后端 `C3_314456831953` 字段存储的就是负责人员/销售代表，两者对应同一个字段。

3. **`CardBalance`（储值卡余额）和 `PrestoreBalance`（预存余额）** 有什么区别？列表接口和详情接口各返回一个，是同一个数吗？
   回答：是同一个数。后端数据库字段是 `C3_319816521955`，别名为 `CardBalance`。列表接口 `GetAllCustomerInfo` 和详情接口 `getClientBasicInfo` 都返回这个字段，是同一个值。Lite 的 `prestoreBalance` 对应的就是后端的 `CardBalance`。

4. **结算方式**：后端有没有「现结 / 记账 / 月结」这样的字段？还是用 `AccountPeriod > 0` 表示记账、`AccountAmt` 表示信用额度？
   回答：
   - 后端没有独立的「现结/记账/月结」枚举字段
   - `AccountAmt`（C3_314456863421）：**信用额度上限**，客户最多能欠多少钱
   - `AccountPeriod`（C3_314456853250）：**账期上限**，客户一笔欠款最长能欠多少天
   - 两个都是**管控上限**，不是欠款本身
   - 实际欠款由 `TotalAmtAndPeriod` 接口从订单表实时汇总计算
   - 判断逻辑：`AccountAmt > 0` 表示该客户允许挂账（记账），`AccountPeriod > 0` 表示允许赊账天数

5. **`GetSigCustomerBasic` 的完整返回字段**：请给一条真实返回（脱敏即可）或接口文档。上面那批 Lite 扩展字段能保留多少取决于这个。
   回答：详情接口返回字段如下（见 4.2 第 1 条的真实返回示例）：
   - 基础信息：`Id`, `DepName`, `DepCode`, `ClientCode`, `ClientName`, `LogUserName`, `LogPassword`（建议移除）, `RegisterPhone`, `ContactPerson`, `SalerName`, `AccountPeriod`, `AccountAmt`
   - 价格相关：`PriceTableName`, `PriceTable`, `CustomerType`（分组编号）
   - 地址相关：`ContactAddress`, `ContactUserName`, `ContactUserPhone`, `IsClientShopAddress`
   - 统计字段：`LastOrderTime`, `OrderCostAmt`, `CouponsNum`, `CardBalance`
   - 审计字段：`Creator`, `CreateTime`, `Updater`, `UpdateTime`
   - 其他：`NotAllOldVerLogin`
   
   **缺失字段：**
   - `Debt`（欠款）：不在此接口，需调用 `TotalAmtAndPeriod` 获取
   - `TotalSettlement`（累计结算）：后端未返回，页面显示为空
   - `LogPassword`：建议从返回结果中移除
   
   **Lite 扩展字段对照：**
   - 已有的：地址（`ContactAddress`）、固话（`CompanyTel`，需确认是否在返回中）、传真（`Fax`，需确认）、邮箱（`Email`，需确认）、邮编（`PostCode`，需确认）、联系人（`ContactPerson`）、手机（`RegisterPhone`）
   - 缺失需新增的：简称、QQ、微信、网址、城市商圈、取送距离、客户来源、所属行业、机构性质、规模、价值评估、关系等级、信誉等级、无委托提醒天数、最近对账日期、说明备注、说明简介
   - 开票信息（开票抬头、税号、开户银行）：在独立表 `ct342194900968`，需通过 `GetInvoiceHeader` 接口获取，见 4.2 第 2 条

6. **价格表**：`PriceTableName` 对应的价格表和「客户分组」是什么关系？客户开单价是怎么取的（价格表 / 分组 / 协议价的优先级）？
   回答：
   - `PriceTable`（C3_334927333156）：价格表编号
   - `PriceTableName`（C3_328976593456）：价格表名称
   - `CustomerType`（C3_758400058259）：客户分组编号
   - 三者是独立字段，客户同时有价格表和分组
   - **开单价优先级（业务方确认）：协议价 > 分组价格 > 基础价格表**
   - 即：客户有协议价就用协议价；没有就用所在分组的价格（分组折扣）；再没有就用基础价格表
   - 注意：之前答复中写的「价格表 > 分组折扣 > 协议价」顺序是**错误的**，以此为准

7. **`GetAllCustTypes` 返回字段**：前端写的是 `g.Code || g.code`、`g.Name || g.name`，实际是哪种大小写？`CustomerType` 筛选传名称还是编号？
   回答：
   - 后端返回字段：`CustomerType`（分组编号）、`Sort`（排序号）
   - 数据库字段 `C3_758399706712` 别名是 `CustomerType`，存储的是分组**编号**（如 "VIP"、"NORMAL"）
   - 前端应该用 `g.CustomerType` 获取编号
   - 筛选时 `CustomerType` 参数传的是分组**编号**，不是名称
   - 证据：`QueryClientsInfos` 中筛选条件是 `C3_758400058259 = '{0}'`（精确匹配），说明存的是编号
   - 注意：后端没有返回 `Code` 或 `Name` 字段，只有 `CustomerType`（编号）和 `Sort`（排序）。前端代码里的 `g.Code || g.code` 和 `g.Name || g.name` 都取不到值，需要改为 `g.CustomerType`
   - **之前答复说存的是名称，这是错误的，以此为准：存的是编号**

8. **`QueryClientsInfos` 的筛选参数**：目前前端传 `ClientName`、`ClientCode`、`SalerName`、`CustomerType`、`RegisterPhone`。Lite 原来是一个关键字框同时搜编号、名称、电话、联系人、地址，后端能否加一个关键字参数（比如 `Keyword`）？是否支持排序参数？
   回答：
   - 当前支持的筛选参数：`ClientCode`, `ClientName`, `SalerName`, `CustomerType`, `PriceTable`, `ExInPriceTable`, `RegisterPhone`, `DepCode`, `PageIndex`, `PageLimit`
   - **不支持** `Keyword` 关键字搜索，需要后端新增
   - **不支持** 排序参数，当前固定按 `C3_509327544331`（创建时间）降序排列
   - 建议：后端新增 `Keyword` 参数，同时搜索编号、名称、电话、联系人、地址；新增 `OrderBy` 和 `OrderDirection` 参数支持排序

9. **删除客户 `DelCustomer`**：后端是否会拦截「已有工单 / 结算 / 预存卡记录」或「有欠款」的客户？Lite 原设计是这类客户不能删、只能合并，需要后端给出明确的 `RespMsg`。散户 `000000` 是否也是系统默认客户、不可删除？
   回答：
   - 后端**会拦截**已有订单的客户：检查订单表 `ct563276270738` 是否有该客户记录，如果有则返回错误 "客户已创建订单,不能删除"
   - 后端**目前不检查**欠款、预存余额等情况（需要改进，见 4.2 第 4 条）
   - 后端**没有**针对散户 `000000` 的特殊保护逻辑
   - **之前答复建议用 `AccountAmt > 0` 判断欠款，这是错误的**：`AccountAmt` 是信用额度上限，不是实际欠款。实际欠款由 `TotalAmtAndPeriod` 接口从订单表汇总计算
   - 正确的欠款判断：调用 `checkClientZhangDayAndAmt` 方法，返回的 `amt > 0` 表示有欠款

10. **新建 / 编辑 `AddOrModifyCustomer`**：请求字段和必填项是什么？客户编号由后端生成还是前端填？
    回答：
    - **客户编号生成规则**：后端自动生成，格式为 "LYCC" + 自增序号（如 LYCC1, LYCC2...）
    - **新建时**：`ClientCode` 传空或不传，后端自动生成
    - **编辑时**：必须传 `ClientCode`
    - **必填字段**：
      - `ClientName`（客户名称）- 后端检查不能重复
      - `SalerName`（销售代表/负责人员）
      - `RegisterPhone`（注册手机号）
      - `DepCode`（门店编号）
    - **可选字段**：
      - `LogUserName`（登录用户名）
      - `LogPassword`（登录密码）
      - `ContactPerson`（联系人）
      - `ContactUserPhone`（联系人电话）
      - `ContactAddress`（联系地址）
      - `IsClientShopAddress`（是否门店地址，布尔值）
      - `PriceTable`（价格表编号）
      - `CustomerType`（客户分组编号）
      - `AccountPeriod`（账期天数）
      - `AccountAmt`（账额/信用额度）
      - `Operator`（操作员）
      - `NotAllOldVerLogin`（是否禁止旧版登录，布尔值）

11. **客户合并**：完整版有没有合并接口？Lite 有「客户合并」页面（把重复建档客户的记录并入另一个客户）。
    回答：**没有**合并接口。后端代码中未找到任何客户合并相关的 API 或 DAO 方法。如果需要实现客户合并功能，需要后端新增接口，逻辑包括：
    - 将源客户的所有订单、结算记录、优惠券等关联数据转移到目标客户
    - 删除源客户记录
    - 需要事务保证数据一致性

## 3. 完整版前端里顺带发现的问题

只是记下来，Lite 这边没有改动这些代码。

- **客户相关跳转到不存在的路由**：`/customer/edit`（新建、编辑客户）、`/customer/contactEdit`（联络人）未在 `src/router/index.ts` 注册，点击后落到 404。`/system/employeeEdit` 同样。
- **客户列表的搜索条件 `ClientCode`** 在 `search` 里有，但界面上没有对应输入框。
- **经营子项编辑丢编码**（`src/views/system/bizItems.vue`）：`editSub` 没把 `SubItemCode` 放进表单，保存修改时传的 `SubItemCode` 是 `undefined`。
- **新建工单不保存**（`src/views/frontdesk/newOrder.vue`）：`submitForm` 只提示成功，没有调用 `CrtEmptyOrderInfo`。
- **接口失败时假装成功**：登录失败会用模拟 token 进入系统（`src/views/login/index.vue`）；工单列表失败显示模拟数据；作废失败提示「作废成功（模拟）」。正式环境会掩盖真实故障。
- **密钥在前端**：`apikey`（`src/utils/request.ts`）、登录签名用的 `AppId` / `AppSecret`（`src/views/login/index.vue`）写死在前端代码里，并已推到本仓库。如果是生产值，建议后端轮换。

## 4. 第二轮：业务口径确认与追问（2026-10-23）

谢谢回复。下面是 Lite 侧（业务方）对几处答复的确认和更正，以及需要你们进一步核查的问题。题号对应第 2 节里的编号。

### 4.1 业务口径（业务方确认，以此为准）

- **客户分组存编号。** 客户上的 `CustomerType` 应该是分组**编号**，不是名称。第 6 条和第 7 条的答复互相矛盾（一处说编号、一处说名称），请按编号核对后端实际存储和 `GetAllCustTypes` 的返回；如果现在确实存的是名称，请说明，我们一起定迁移方案。
- **开单价优先级：协议价 > 分组价格 > 基础价格表。** 客户有协议价就用协议价；没有就用所在分组的价格（分组折扣）；再没有就用基础价格表。第 6 条答复里的「价格表 > 分组折扣 > 协议价」顺序是反的，请对照后端真实定价代码确认是否按这个顺序实现，不一致的地方请列出来。
- **账额和账期是两个独立的限制。**
  - `AccountAmt` 账额：客户最多能欠多少钱（信用额度）。
  - `AccountPeriod` 账期：客户一笔欠款最长能欠多少天。
  - 两个都是管控上限，**不是欠款本身**。
- **欠款的来源：开单形成欠款，核销减少欠款。**
- **有欠款的客户不能删除。** 第 9 条答复建议用 `AccountAmt > 0` 判断「有欠款」，这是不对的：`AccountAmt` 是信用额度，按这个判断，所有给过额度的客户都删不掉。应按客户**实际欠款余额 > 0** 拦截。

### 4.2 请进一步说明或核查（后端回复）

#### 1. 详情接口补充说明

**GetSigCustomerBasic 真实返回示例（脱敏）：**
```json
{
  "Id": "1729654321098",
  "DepName": "总店",
  "DepCode": "D001",
  "ClientCode": "LYCC1001",
  "ClientName": "张三印刷厂",
  "LogUserName": "zhangsan",
  "LogPassword": "加密后的密码",
  "RegisterPhone": "13800138000",
  "ContactPerson": "李四",
  "SalerName": "王业务",
  "AccountPeriod": "30",
  "AccountAmt": "50000",
  "PriceTableName": "标准价格表",
  "PriceTable": "PT001",
  "CustomerType": "VIP",
  "ContactAddress": "北京市朝阳区XX路XX号",
  "ContactUserName": "李四",
  "ContactUserPhone": "13900139000",
  "IsClientShopAddress": "true",
  "LastOrderTime": "2026-10-20 14:30:00",
  "OrderCostAmt": "125000.50",
  "CouponsNum": "5",
  "CardBalance": "3000.00",
  "Creator": "admin",
  "CreateTime": "2025-01-15 10:00:00",
  "Updater": "admin",
  "UpdateTime": "2026-10-20 14:30:00",
  "NotAllOldVerLogin": 0
}
```

**Debt、PrestoreBalance、TotalSettlement 来源：**
- `Debt`（欠款）：不在客户主表，由 `TotalAmtAndPeriod` 接口实时计算返回。查询订单表 `ct556479606591`，统计状态为"挂账"且未核销的订单总金额。
- `PrestoreBalance`（预存余额）：就是 `CardBalance`，来自客户主表 `C3_319816521955` 字段。
- `TotalSettlement`（累计结算）：后端目前没有返回这个字段，前端显示为空。需要后端新增统计逻辑。

**TotalAmtAndPeriod 接口返回字段：**
```json
{
  "AccountAmt": "15000.00",  // 当前实际欠款金额（不是信用额度）
  "AccountPeriod": "45"      // 最早一笔欠款的天数（不是账期上限）
}
```
计算逻辑：从订单表查询该客户所有"挂账"状态且未核销的订单，`AccountAmt` = 欠款总额，`AccountPeriod` = 最早一笔欠款距今的天数。

**方法名对应关系：**
- `GetAllCustomerInfo` 是后端 DAO 方法名，对应前端接口 `QueryClientsInfos`
- `getClientBasicInfo` 是后端 DAO 方法名，对应前端接口 `GetSigCustomerBasic`
- 前端调用的是 Controller 层的接口名，Controller 内部调用 DAO 方法

**LogPassword 安全问题：**
确认是加密存储的密码哈希值，不是明文。但前端确实不需要这个字段，建议从 `GetSigCustomerBasic` 返回结果中移除。

#### 2. 开票信息

**表名：** `ct342194900968`（开票信息表）

**字段清单：**
| C3_ 列名 | 别名 | 说明 |
|---|---|---|
| `C3_796307944110` | CompanyCode | 公司编号（关联客户表的 C3_589570928743） |
| `C3_507553104926` | ClientCode | 客户编号（关联客户表的 C3_314456699328） |
| `C3_342195020421` | InvoiceHeader / ConpanynNames | 开票抬头 |
| `C3_507551356025` | TaxNo / Taxpayer | 税号 |
| `C3_507551356353` | InvoiceBank | 开户银行 |
| `C3_507551356287` | InvoiceAddress | 银行账号 |
| `C3_507551378462` | InvoiceType | 发票类型 |
| `C3_842820885746` | BipUserCode | 用友客户编号 |
| `C3_844103387852` | BipUserName | 用友客户名称 |

**关联方式：** 一个客户一条开票记录，通过 `ClientCode` 关联。

**现有接口：**
- `GetInvoiceHeader`：查询开票信息列表（支持分页、按客户编号/名称/开票抬头筛选）
- `ModBipCustomerInfo`：修改用友客户信息（BipUserCode、BipUserName）
- 前端 API：`/api/CustomerMan/GetInvoiceHeader`

#### 3. CRM 类信息

**客户主表 `ct314456162312` 已有字段：**
| C3_ 列名 | 别名 | 说明 |
|---|---|---|
| `C3_314456717328` | ClientName | 客户名称（可作简称用） |
| `C3_363871601703` | CompanyTel | 固话 |
| `C3_344096054140` | Email | 电子邮件 |
| `C3_363871665343` | Fax | 传真 |
| `C3_318857585359` | PostCode | 邮编 |
| `C3_318857579765` | Address | 地址 |
| `C3_363873090062` | ContactPerson | 联系人 |
| `C3_344425630953` | ContactUserPhone | 手机号 |

**后端目前缺失的字段（需要新增）：**
- QQ、微信、网址
- 城市商圈、取送距离、客户来源、所属行业
- 机构性质、规模、价值评估、关系等级、信誉等级
- 无委托提醒天数、最近对账日期
- 说明备注、说明简介

这些字段在客户主表中没有找到对应列，需要后端评估是否新增数据库列或创建扩展表。

#### 4. 删除拦截

**当前逻辑：**
- 检查订单表 `ct563276270738` 是否有该客户的订单记录
- 有订单则返回错误："客户已创建订单,不能删除"

**建议改为：**
```csharp
// 1. 检查是否有订单
int orderCount = 查询订单表 where ClientCode = @clientCode;
if (orderCount > 0) {
    errorMsg = "客户已创建订单,不能删除";
    return false;
}

// 2. 检查是否有欠款（调用 TotalAmtAndPeriod 的逻辑）
int debtDays = 0;
decimal debtAmt = 0;
bool hasDebt = VTOrderSecDao.checkClientZhangDayAndAmt(companyCode, clientCode, out debtDays, out debtAmt);
if (hasDebt && debtAmt > 0) {
    errorMsg = "客户有未结清欠款，不能删除";
    return false;
}

// 3. 检查是否有预存余额
decimal cardBalance = 查询客户表 CardBalance where ClientCode = @clientCode;
if (cardBalance > 0) {
    errorMsg = "客户有预存余额，不能删除";
    return false;
}

// 4. 执行删除
delete from 客户表 where ClientCode = @clientCode;
```

**预存余额拦截：** 建议拦截。`CardBalance > 0` 说明客户还有钱没用完，删除会导致财务数据不一致。
