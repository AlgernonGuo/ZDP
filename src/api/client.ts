import axios from 'axios'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

// ===== 运行时认证配置 =====
export interface AuthConfig {
  WXTokenID: string
  LoginID: string
  CusCode: string
  CusName: string
  UserName: string
}

const SESSION_KEY = 'zdp_auth'

function loadFromSession(): AuthConfig | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthConfig) : null
  } catch {
    return null
  }
}

export const AUTH_CONFIG: AuthConfig = loadFromSession() ?? {
  WXTokenID: '',
  LoginID: '',
  CusCode: '',
  CusName: '',
  UserName: '',
}

export function setAuthConfig(config: AuthConfig) {
  Object.assign(AUTH_CONFIG, config)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(config))
}

export function clearAuthConfig() {
  AUTH_CONFIG.WXTokenID = ''
  AUTH_CONFIG.LoginID = ''
  AUTH_CONFIG.CusCode = ''
  AUTH_CONFIG.CusName = ''
  sessionStorage.removeItem(SESSION_KEY)
}

export function isAuthenticated(): boolean {
  return Boolean(AUTH_CONFIG.WXTokenID)
}

// ===== axios 实例 =====
// 开发时（Vite dev server）baseURL 为空，走 proxy；生产时（Tauri 桌面）直接请求后端
// 生产环境通过 axios config.env.fetch 注入 tauriFetch，走 Rust 层发请求，绕过 CORS
// 注意：不能替换 globalThis.fetch，否则 invoke() 的 IPC 通信会无限递归
const BASE_URL = import.meta.env.DEV ? '' : 'http://qaweixin.flsoft.cc'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
  adapter: 'fetch',
  // 仅在 PROD 模式注入 tauriFetch，DEV 模式走浏览器原生 fetch（Vite proxy）
  ...(import.meta.env.PROD ? { env: { fetch: tauriFetch } } : {}),
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
})

// 注入时间戳防 GET 缓存
client.interceptors.request.use((config) => {
  if (config.method?.toLowerCase() === 'get') {
    config.params = { ...config.params, _: Date.now() }
  }
  if (import.meta.env.PROD && AUTH_CONFIG.WXTokenID) {
    // *** 关键：Cookie 不能放 config.headers ***
    // axios 将 config.headers 放入 new Request(url, {headers}) 构造器，
    // 浏览器的 Request 构造器会自动过滤 forbidden headers（包括 Cookie）。
    // fetchOptions 才是作为第二参数直接传给 tauriFetch(request, fetchOptions)，
    // tauriFetch 用 new Headers(fetchOptions.headers) 构造（guard="none"，不过滤），
    // Cookie 才能真正传到 Rust 层再发给服务器。
    //
    // *** 同样关键：fetchOptions.headers 会替换 Request 自带的所有 headers ***
    // tauriFetch 内部等效 new Request(request, fetchOptions)，遵循 Fetch 规范：
    // init.headers 完全替换 request.headers，导致 Content-Type 丢失。
    // 因此必须在 fetchOptions.headers 里显式带上所有必要的请求头。
    const cookieStr = [
      `LoginType=PC`,
      `WXTokenID=${AUTH_CONFIG.WXTokenID}`,
      `LoginID=${AUTH_CONFIG.LoginID}`,
    ].join('; ')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fc = config as any

    // AxiosHeaders.forEach 在部分版本不可靠，用 get() + 直接属性访问兜底提取 Content-Type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = config.headers as any
    const contentType: string | null =
      h?.get?.('Content-Type') ??
      h?.get?.('content-type') ??
      h?.['Content-Type'] ??
      h?.['content-type'] ??
      null
    const baseHeaders: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
    }
    if (contentType) baseHeaders['Content-Type'] = String(contentType)

    fc.fetchOptions = {
      ...(fc.fetchOptions ?? {}),
      headers: {
        ...baseHeaders,
        ...(fc.fetchOptions?.headers ?? {}),
        Cookie: cookieStr,
      },
    }
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('请求失败:', error)
    return Promise.reject(error)
  }
)

export default client
