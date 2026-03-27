import axios from 'axios'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

// ===== 运行时认证配置 =====
// Cookie 由 document.cookie 管理（auth.ts 登录后写入），浏览器自动携带。
// 此处只存需要作为查询参数传递的字段：WXTokenID、CusCode、CusName。
export interface AuthConfig {
  WXTokenID: string
  LoginID: string    // 登录 ID（LoginByPhone 返回的第一段）
  CusCode: string
  CusName: string
  UserName: string   // 登录用户姓名，来自 GetBase 接口
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
// 生产环境用 tauri-plugin-http 的 fetch 替换全局 fetch，axios 走 Rust 层发请求，绕过 CORS
const BASE_URL = import.meta.env.DEV ? '' : 'http://qaweixin.flsoft.cc'

if (import.meta.env.PROD) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = tauriFetch
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
  adapter: import.meta.env.PROD ? 'fetch' : 'xhr',
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
})

// 注入时间戳防 GET 缓存
// PROD（Tauri）：Cookie 无法由 webview 自动携带，需手动注入到请求头
client.interceptors.request.use((config) => {
  if (config.method?.toLowerCase() === 'get') {
    config.params = { ...config.params, _: Date.now() }
  }
  if (import.meta.env.PROD && AUTH_CONFIG.WXTokenID) {
    // tauriFetch 走 Rust 层，不共享 webview 的 Cookie jar
    // 手动将登录 Cookie 注入请求头，确保服务端 Session 校验通过
    const cookieStr = [
      `LoginType=PC`,
      `WXTokenID=${AUTH_CONFIG.WXTokenID}`,
      `LoginID=${AUTH_CONFIG.LoginID}`,
    ].join('; ')
    config.headers = config.headers ?? {}
    config.headers['Cookie'] = cookieStr
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
