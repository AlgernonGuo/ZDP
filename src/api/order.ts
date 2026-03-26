import client, { AUTH_CONFIG } from './client'
import type {
  StagingItem,
  OrderPayload,
  OrderItemPayload,
  CreateOrderResponse,
} from '../types'

/**
 * 根据暂存区条目构建订单 payload
 */
export function buildOrderPayload(
  stagingItems: StagingItem[],
  orderMemo: string,
  id?: number
): OrderPayload {
  const items: OrderItemPayload[] = stagingItems.map((item) => {
    const theroQuantity = parseFloat((item.userNum * item.NumWeight).toFixed(4))
    const money = parseFloat((theroQuantity * item.UPrice1).toFixed(2))

    return {
      InventoryClass: item.InvCName,
      InvCode: item.InvCode,
      InvStd: item.InvStd,
      Standard: item.Standard,
      Wallthickness: parseFloat(item.Wallthickness),
      WhCode: item.WhCode,
      WhName: item.WhName,
      Brand: item.Brand,
      Free1: item.Free1,
      Free2: item.Free2,
      Free3: item.Free3,
      PackCount: item.OnLinePackCount,
      Information: `${item.OnLineInvName},${item.userNum}`,
      Price: item.UPrice1,
      Num: String(item.userNum),
      TheroQuantity: theroQuantity,
      Quantity: String(theroQuantity),
      Money: money.toFixed(2),
      StockNum: item.Num,
      Memo: item.remark,
      DeliveryApplysDetailList: [
        {
          WhCode: item.WhCode,
          Num: String(item.userNum),
        },
      ],
    }
  })

  const payload: OrderPayload = {
    CusCode: AUTH_CONFIG.CusCode,
    CusName: AUTH_CONFIG.CusName,
    Memo: orderMemo,
    DeliveryApplysList: items,
  }
  if (id !== undefined) payload.ID = id
  return payload
}

/**
 * 接口4: 提交提货申请订单
 * Content-Type: application/x-www-form-urlencoded
 */
export async function createDeliveryApply(
  payload: OrderPayload
): Promise<CreateOrderResponse> {
  const formData = new URLSearchParams()
  formData.append('jsonstr', JSON.stringify(payload))
  formData.append('WXTokenID', AUTH_CONFIG.WXTokenID)

  const response = await client.post<CreateOrderResponse>(
    '/DeliveryApply/CreateDeliveryApply',
    formData,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )
  return response.data
}
