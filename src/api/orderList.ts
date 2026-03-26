import client from './client'
import { AUTH_CONFIG } from './client'
import type { OrderListResponse } from '../types'

export interface OrderListParams {
  InventoryClass?: string
  Status?: string
  Person?: string
  Department?: string
  Maker?: string
  beginDate?: string
  endDate?: string
  fistResult?: number
  maxResult?: number
}

function buildFormBody(params: OrderListParams): string {
  const body: Record<string, string> = {
    WXTokenID: AUTH_CONFIG.WXTokenID,
    CusCode: AUTH_CONFIG.CusCode,
    InventoryClass: params.InventoryClass ?? '',
    Status: params.Status ?? '',
    Person: params.Person ?? '',
    Department: params.Department ?? '',
    Maker: params.Maker ?? '',
    beginDate: params.beginDate ?? '',
    endDate: params.endDate ?? '',
  }
  return Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

export async function fetchOrderCount(params: OrderListParams = {}): Promise<number> {
  const res = await client.post('/DeliveryApply/GetDeliveryApplyListCount', buildFormBody(params), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
  })
  // 响应可能是数字或 { result, data } 形式，兼容两种
  const raw = res.data
  if (typeof raw === 'number') return raw
  if (typeof raw === 'object' && raw !== null) {
    if (typeof raw.data === 'number') return raw.data
    if (typeof raw.result === 'number') return raw.result
  }
  return 0
}

export async function closeOrder(id: number): Promise<{ result: boolean; errtext: string | null }> {
  const res = await client.get('/DeliveryApply/CloseDeliveryApply', {
    params: { ID: id, WXTokenID: AUTH_CONFIG.WXTokenID },
  })
  return res.data
}

export async function fetchOrderList(params: OrderListParams = {}): Promise<OrderListResponse> {
  const res = await client.get('/DeliveryApply/GetDeliveryApplyListPaging', {
    params: {
      WXTokenID: AUTH_CONFIG.WXTokenID,
      CusCode: AUTH_CONFIG.CusCode,
      InventoryClass: params.InventoryClass ?? '',
      Status: params.Status ?? '',
      Person: params.Person ?? '',
      Department: params.Department ?? '',
      Maker: params.Maker ?? '',
      beginDate: params.beginDate ?? '',
      endDate: params.endDate ?? '',
      fistResult: params.fistResult ?? 0,
      maxResult: params.maxResult ?? 20,
    },
  })
  return res.data as OrderListResponse
}
