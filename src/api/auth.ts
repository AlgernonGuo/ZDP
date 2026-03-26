import client from './client'
import type { LoginResponse } from '../types'

interface GetBaseResponse {
  result: boolean
  data?: {
    UserName: string
    ContractName: string
    CusCode: string
    CusName: string
  }
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/`
}

/**
 * 清除登录 Cookie（退出时调用）
 */
export function clearLoginCookies() {
  for (const name of ['LoginType', 'LoginID', 'WXTokenID', 'IsSalesman']) {
    document.cookie = `${name}=; path=/; max-age=0`
  }
}

/**
 * 登录接口
 * GET /WXAuth/LoginByPhone?Phone=...&password=...
 *
 * 成功时 data 为 "loginId;wxTokenId;isSalesman"
 * 解析后通过 document.cookie 写入，后续请求浏览器自动携带，
 * Vite proxy 会将 Cookie 头原样转发给后端。
 */
export async function loginByPhone(phone: string, password: string): Promise<{
  result: boolean
  wxTokenID?: string
  errtext?: string | null
}> {
  const response = await client.get<LoginResponse>('/WXAuth/LoginByPhone', {
    params: { Phone: phone, password },
  })

  const res = response.data

  if (res.result && res.data) {
    const parts = res.data.split(';')
    const loginId   = parts[0] ?? ''
    const wxTokenId = parts[1] ?? phone   // 通常等于手机号
    const isSalesman = parts[2] ?? 'False'

    // 写入浏览器 Cookie，后续代理请求自动携带
    setCookie('LoginType', 'PC')
    setCookie('LoginID', loginId)
    setCookie('WXTokenID', wxTokenId)
    setCookie('IsSalesman', isSalesman)

    return { result: true, wxTokenID: wxTokenId }
  }

  return { result: false, errtext: res.errtext }
}

/**
 * 获取登录用户基础信息（UserName 等）
 */
export async function getBase(wxTokenID: string): Promise<GetBaseResponse> {
  const response = await client.get<GetBaseResponse>('/WXAuth/GetBase', {
    params: { WXTokenID: wxTokenID },
  })
  return response.data
}
