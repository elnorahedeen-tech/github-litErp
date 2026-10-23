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
| `CustomerType` | 客户分组 | `group`（编号）/ `groupName` | 完整版存分组**名称**、也按名称筛选；Lite 用编号 |
| `RegisterPhone` | 注册手机号 | `phone` | 基本对应 |
| `SalerName` | 销售代表 | `owner`（负责人员） | 待确认，见问题 1 |
| `CardBalance` | 储值卡余额 | `prestoreBalance` | 待确认，见问题 2 |
| `AccountPeriod` / `AccountAmt` | 账期 / 账额 | `settleType`（现结/记账/月结）、`creditLimit` | 建模不同，见问题 3 |
| `DepName` | 门店名称 | 无 | Lite 暂无多门店 |
| `PriceTableName` | 价格表 | 无（Lite 用分组折扣 + 协议价） | 见问题 5 |
| `LastOrderTime` / `OrderCostAmt` / `CouponsNum` | 最后下单 / 总消费 / 优惠券数 | 无 | 后端统计字段，Lite 直接显示 |
| `CreateTime` / `Creator` / `UpdateTime` / `Updater` | 创建、更新时间与人 | 仅 `created`（建交日期） | 待确认 `created` 是否就是 `CreateTime` |
| `Debt`（详情接口） | 欠款 | `debt` | 对应；列表接口里没有 |
| `PrestoreBalance`、`TotalSettlement`（详情接口） | 预存余额、累计结算 | `prestoreBalance` | 见问题 2 |

Lite 还有一批照旧版 Windows「客户资料」窗口做的字段，完整版前端目前没用到，不知道后端有没有、叫什么：

> 简称、机构/个人类型、固话、QQ、微信、传真、电子邮件、邮编、网址、地址、城市商圈、取送距离、客户来源、所属行业、机构性质、规模、价值评估、关系等级、信誉等级、无委托提醒天数、开票抬头、税号、开户银行、最近对账日期、说明备注、说明简介

联络人员（`pricecfg/GetAllSubAccounts`）完整版用到：`RecId`、`Name`、`CallName`、`ContactType`、`Department`、`Title`、`Mobile`、`Phone`、`Email`、`CrtTime`。Lite 另有性别、年龄段、QQ、地址、身份证、云端账号、负责人员、说明，同样需要确认。

## 2. 需要确认的问题

1. **`SalerName`（销售代表）** 和 Lite 的「负责人员」是不是同一个概念？
2. **`CardBalance`（储值卡余额）和 `PrestoreBalance`（预存余额）** 有什么区别？列表接口和详情接口各返回一个，是同一个数吗？
3. **结算方式**：后端有没有「现结 / 记账 / 月结」这样的字段？还是用 `AccountPeriod > 0` 表示记账、`AccountAmt` 表示信用额度？
4. **`GetSigCustomerBasic` 的完整返回字段**：请给一条真实返回（脱敏即可）或接口文档。上面那批 Lite 扩展字段能保留多少取决于这个。
5. **价格表**：`PriceTableName` 对应的价格表和「客户分组」是什么关系？客户开单价是怎么取的（价格表 / 分组 / 协议价的优先级）？
6. **`GetAllCustTypes` 返回字段**：前端写的是 `g.Code || g.code`、`g.Name || g.name`，实际是哪种大小写？`CustomerType` 筛选传名称还是编号？
7. **`QueryClientsInfos` 的筛选参数**：目前前端传 `ClientName`、`ClientCode`、`SalerName`、`CustomerType`、`RegisterPhone`。Lite 原来是一个关键字框同时搜编号、名称、电话、联系人、地址，后端能否加一个关键字参数（比如 `Keyword`）？是否支持排序参数？
8. **删除客户 `DelCustomer`**：后端是否会拦截「已有工单 / 结算 / 预存卡记录」或「有欠款」的客户？Lite 原设计是这类客户不能删、只能合并，需要后端给出明确的 `RespMsg`。散户 `000000` 是否也是系统默认客户、不可删除？
9. **新建 / 编辑 `AddOrModifyCustomer`**：请求字段和必填项是什么？客户编号由后端生成还是前端填？
10. **客户合并**：完整版有没有合并接口？Lite 有「客户合并」页面（把重复建档客户的记录并入另一个客户）。

## 3. 完整版前端里顺带发现的问题

只是记下来，Lite 这边没有改动这些代码。

- **客户相关跳转到不存在的路由**：`/customer/edit`（新建、编辑客户）、`/customer/contactEdit`（联络人）未在 `src/router/index.ts` 注册，点击后落到 404。`/system/employeeEdit` 同样。
- **客户列表的搜索条件 `ClientCode`** 在 `search` 里有，但界面上没有对应输入框。
- **经营子项编辑丢编码**（`src/views/system/bizItems.vue`）：`editSub` 没把 `SubItemCode` 放进表单，保存修改时传的 `SubItemCode` 是 `undefined`。
- **新建工单不保存**（`src/views/frontdesk/newOrder.vue`）：`submitForm` 只提示成功，没有调用 `CrtEmptyOrderInfo`。
- **接口失败时假装成功**：登录失败会用模拟 token 进入系统（`src/views/login/index.vue`）；工单列表失败显示模拟数据；作废失败提示「作废成功（模拟）」。正式环境会掩盖真实故障。
- **密钥在前端**：`apikey`（`src/utils/request.ts`）、登录签名用的 `AppId` / `AppSecret`（`src/views/login/index.vue`）写死在前端代码里，并已推到本仓库。如果是生产值，建议后端轮换。
