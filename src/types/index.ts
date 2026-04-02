// 所有 TypeScript 类型定义

// ===== 登录 =====
// 响应 data 字段格式："loginId;wxTokenId;isSalesman"
// 例："c340bc49-7921-4934-877e-5a1959fcd845;13389921806;False"
export interface LoginResponse {
  result: boolean
  data?: string
  errtext?: string | null
  errtype?: string | null
  time?: string
}

// ===== 客户列表 =====
export interface CustomerItem {
  CusCode: string
  CusName: string
  CusAbbName: string | null
}

export interface CustomerListResponse {
  result: boolean
  data: CustomerItem[]
  errtext?: string | null
}


export interface InventoryClassItem {
  AutoID: number
  Standard: string
  Version: number
}

export interface InventoryClass {
  ID: string
  InvCCode: string
  InvCName: string
  ProduceNation: string
  OnLienInventoryClassItem: InventoryClassItem[]
}

export interface InventoryClassListResponse {
  result: boolean
  data: InventoryClass[]
}

// ===== 接口2: 在线库存列表 =====
export interface StockItem {
  AutoID: number
  InvCode: string
  InvName: string
  InvCName: string          // 品种名，如"螺旋B级管"
  OnLineInvName: string
  InvStd: string            // 含壁厚的完整规格，如"529*6*12000"
  Wallthickness: number     // 数字类型，如 6
  Standard: string          // 不含壁厚的规格，如"529*12000"
  WhCode: string
  WhName: string
  Free1: string
  Free2: string
  Free3: string
  Num: number               // 件数（库存）
  STNum: number             // 支数
  NumWeight: number         // 单件重量（吨）
  UPrice1: number           // 单价（元/吨）
  SCTAutoID: number
  SCTVersion: number
  OnLineSTNum: number
  OnLinePackCount: string
  OnLinePrice: string
  OnLineNum: string
}

export interface StockListResponse {
  result: boolean
  data: StockItem[]
}

// ===== 接口3: 加入暂存区前获取详情 =====
// 实际响应 data 为单个对象（非数组）
export interface StockDetailItem {
  InvCode: string
  InvName: string
  OnLineInvName: string
  InvStd: string            // 含壁厚完整规格，如"529*6*12000"
  Wallthickness: number
  Standard: string
  WhCode: string
  WhName: string
  Free1: string
  Free2: string
  Free3: string
  Num: number
  STNum: number
  NumWeight: number
  UPrice1: number
  OnLinePackCount: string
  SCTAutoID: number
  SCTVersion: number
}

export interface StockDetailResponse {
  result: boolean
  data: StockDetailItem | StockDetailItem[] | null
}

// ===== 暂存区条目 =====
export interface StagingItem {
  key: string               // String(AutoID)
  InvCode: string
  InvName: string           // 基础货名，如"螺旋管"
  OnLineInvName: string     // 含规格完整货名，如"螺旋管529*6*12000"
  InvCName: string          // 品种名，如"螺旋B级管"（对应 InventoryClass）
  InvStd: string            // 含壁厚完整规格，如"529*6*12000"
  Standard: string          // 不含壁厚规格，如"529*12000"
  Wallthickness: string
  Brand: string
  WhCode: string
  WhName: string
  Free1: string
  Free2: string
  Free3: string
  UPrice1: number
  Num: number               // 库存件数（上限）
  STNum: number             // 总支数
  NumWeight: number         // 单件重量（吨）
  OnLinePackCount: string   // 件包数
  userNum: number           // 用户填写的订购件数
  remark: string            // 行备注
}

// ===== 接口4: 提交订单 =====
interface DeliveryApplysDetailItem {
  WhCode: string
  Num: string
}

export interface OrderItemPayload {
  InventoryClass: string    // 品种名
  InvCode: string
  InvStd: string            // 含壁厚完整规格
  Standard: string
  Wallthickness: number
  WhCode: string
  WhName: string
  Brand: string
  Free1: string
  Free2: string
  Free3: string
  PackCount: string         // 件包数
  Information: string       // 货名+包装规格的描述，如"螺旋管529*6*12000,6"
  Price: number             // 单价
  Num: string               // 件数（字符串）
  TheroQuantity: number     // 理论重量
  Quantity: string          // 理论重量（字符串，与 TheroQuantity 值相同）
  Money: string             // 金额（字符串，保留两位小数）
  StockNum: number          // 库存件数
  Memo: string              // 行备注
  DeliveryApplysDetailList: DeliveryApplysDetailItem[]
}

export interface OrderPayload {
  ID?: number               // 传入则为修改，否则为新建
  CusCode: string
  CusName: string
  Memo: string              // 整单备注
  DeliveryApplysList: OrderItemPayload[]
}

export interface CreateOrderResponseItem {
  InvName?: string
  InvStd?: string
  StockNum: number
}

export interface CreateOrderResponse {
  result: boolean
  errtype?: string | null
  errtext?: string | null
  data?: {
    DeliveryApplysList?: CreateOrderResponseItem[]
    ErrorText?: string | null
    [key: string]: unknown
  }
}

// ===== 查询表单 =====
export interface SearchForm {
  invCCode: string          // 品种 ID
  standard: string          // 规格
  wallThickness: string     // 壁厚（可选）
}

// ===== 订单列表 =====
export interface DeliveryApplyDetailItem {
  DetailID: number
  WhCode: string
  WhName: string
  Num: number
  DeliveryListNum: number
  DeliveryListQty: number
  CloseNum: number
  DispatchListNum: number
  DispatchListQty: number
  CloseTime: string | null
  Version: number
}

export interface DeliveryApplyLineItem {
  AutoID: number
  Information: string
  InventoryClass: string
  InvCode: string
  InvName: string
  InvStd: string
  Brand: string
  Standard: string
  Wallthickness: string
  PackCount: string
  Free1: string
  Free2: string
  Free3: string
  Num: number
  Quantity: number
  Price: number
  Money: number
  Memo: string
  TheroQuantity: number
  StockNum: number
  DeliveryApplysDetailList: DeliveryApplyDetailItem[]
  Version: number
}

export interface OrderListItem {
  ID: number
  VouchCode: string
  VouchDate: string
  CusCode: string
  CusName: string
  Memo: string
  Maker: string
  MakeTime: string
  SumQuantity: number
  SumMoney: number
  SumNum: number
  SelfPick: boolean
  DeliveryStatus: string
  DeliveryApplysList: DeliveryApplyLineItem[]
  Verifier: string | null
  VerifyTime: string | null
  CloseTime: string | null
  DeleteTime: string | null
  CloseMemo: string | null
  TimeOut: string | null
  Receiver: string | null
  RecvAddress: string | null
  ReceiveProvince: string | null
  ReceiveCity: string | null
  ReceiveDistrict: string | null
  ReceiverPhone: string | null
  Version: number
}

export interface OrderListResponse {
  result: boolean
  data: OrderListItem[]
  errtext: string | null
  errtype: string | null
  time: string
}

// ===== 自动搜索抢单模式 =====
export interface AutoSnatchTarget {
  id: string
  invCName: string        // 品种名（InvCName，用于接口参数）
  standard: string        // 规格（不含壁厚）
  wallThickness: number | null
  userNum: number
  remark: string
}

export interface AutoSnatchLog {
  time: string
  level: 'info' | 'success' | 'error' | 'warn'
  message: string
}

export type AutoSnatchStatus = 'idle' | 'searching' | 'placing' | 'success' | 'failed' | 'stopped'

export type AutoSnatchTaskStatus = 'running' | 'stopped' | 'completed'

export interface AutoSnatchTask {
  id: string                           // Date.now().toString(36) + 随机后缀
  taskNo: number                       // 序号，用于显示"任务 #N"
  startTime: string                    // ISO 字符串
  endTime?: string                     // 任务结束时写入
  targetsSnapshot: AutoSnatchTarget[]  // 发起时的深拷贝快照
  memo: string
  interval: number
  cusCode: string
  cusName: string
  status: AutoSnatchTaskStatus
  statuses: Record<string, AutoSnatchStatus>
  hitItems: Record<string, StagingItem | null>
  logs: AutoSnatchLog[]
  searchCount: number
}
