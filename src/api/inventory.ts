import client, { AUTH_CONFIG } from './client'
import type {
  CustomerListResponse,
  InventoryClassListResponse,
  StockListResponse,
  StockDetailResponse,
} from '../types'

/**
 * 获取客户列表
 */
export async function getCustomerList(): Promise<CustomerListResponse> {
  const response = await client.get<CustomerListResponse>(
    '/DeliveryApply/GetCustomerList',
    { params: { WXTokenID: AUTH_CONFIG.WXTokenID } }
  )
  return response.data
}

/**
 * 接口1: 获取品种与规格列表（一次性返回，前端本地联动）
 */
export async function getInventoryClassList(): Promise<InventoryClassListResponse> {
  const response = await client.get<InventoryClassListResponse>(
    '/DeliveryApply/GetInventoryClassList',
    {
      params: {
        IsSalesman: false,
      },
    }
  )
  return response.data
}

/**
 * 接口2: 查询在线库存列表
 * @param Inventoryclass 品种编码（InvCCode）
 * @param Standard 规格
 * @param WallThickness 壁厚（可选，二次筛选时传入）
 */
export async function getOnLineStockList(
  Inventoryclass: string,
  Standard: string,
  WallThickness?: string
): Promise<StockListResponse> {
  const response = await client.get<StockListResponse>(
    '/DeliveryApply/GetOnLineStockList',
    {
      params: {
        Inventoryclass,
        Standard,
        WallThickness: WallThickness ?? '',
        CusCode: AUTH_CONFIG.CusCode,
        WXTokenID: AUTH_CONFIG.WXTokenID,
      },
    }
  )
  return response.data
}

/**
 * 接口3: 加入暂存区前获取货品详情
 * @param InvCode 货品编码
 * @param Free1/2/3 货品附加属性
 * @param Brand 品牌
 * @param WhCode 仓库编码
 */
export async function getOnLineStockDetail(params: {
  InvCode: string
  Free1: string
  Free2: string
  Free3: string
  WhCode: string
}): Promise<StockDetailResponse> {
  const response = await client.get<StockDetailResponse>(
    '/DeliveryApply/GetOnLineStockListByInvCode',
    {
      params: {
        ...params,
        CusCode: AUTH_CONFIG.CusCode,
        WXTokenID: AUTH_CONFIG.WXTokenID,
      },
    }
  )
  return response.data
}
