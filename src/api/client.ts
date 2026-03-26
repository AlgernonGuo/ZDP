import axios from 'axios'

// ===== 运行时认证配置 =====
// Cookie 由 document.cookie 管理（auth.ts 登录后写入），浏览器自动携带。
// 此处只存需要作为查询参数传递的字段：WXTokenID、CusCode、CusName。
export interface AuthConfig {
  WXTokenID: string
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
  AUTH_CONFIG.CusCode = ''
  AUTH_CONFIG.CusName = ''
  sessionStorage.removeItem(SESSION_KEY)
}

export function isAuthenticated(): boolean {
  return Boolean(AUTH_CONFIG.WXTokenID)
}

// ===== axios 实例 =====
// 开发时（Vite dev server）baseURL 为空，走 proxy；生产时（Tauri 桌面）直接请求后端
const BASE_URL = import.meta.env.DEV ? '' : 'http://qaweixin.flsoft.cc'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
})

// 注入时间戳防 GET 缓存（Cookie 由浏览器自动携带，无需手动注入）
client.interceptors.request.use((config) => {
  if (config.method?.toLowerCase() === 'get') {
    config.params = { ...config.params, _: Date.now() }
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
