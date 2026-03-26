import { useState, useCallback } from 'react'
import { Layout, Typography, Button, Tooltip, Menu, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'
import { LogoutOutlined } from '@ant-design/icons'
import SearchPanel from './components/SearchPanel'
import StagingPanel from './components/StagingPanel'
import OrderListPage from './components/OrderListPage'
import LoginPage from './components/LoginPage'
import { isAuthenticated, clearAuthConfig, AUTH_CONFIG } from './api/client'
import type { StagingItem } from './types'
import './App.css'

dayjs.locale('zh-cn')

const { Header, Content } = Layout
const { Title, Text } = Typography

type PageKey = 'create-order' | 'order-list'

const NAV_ITEMS: { key: PageKey; label: string }[] = [
  { key: 'create-order', label: '创建订单' },
  { key: 'order-list', label: '订单列表' },
]

const PAGE_KEY = 'zdp_active_page'

function getInitialPage(): PageKey {
  const saved = sessionStorage.getItem(PAGE_KEY) as PageKey | null
  return saved && NAV_ITEMS.some((i) => i.key === saved) ? saved : 'create-order'
}

function App() {
  const [authed, setAuthed] = useState<boolean>(isAuthenticated)
  const [cusName, setCusName] = useState(AUTH_CONFIG.CusName)
  const [cusCode, setCusCode] = useState(AUTH_CONFIG.CusCode)
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([])
  const [activePage, setActivePage] = useState<PageKey>(getInitialPage)

  const stagingKeys = new Set(stagingItems.map((i) => i.key))

  const handleLoginSuccess = useCallback(() => {
    setAuthed(true)
  }, [])

  const handleCusChange = useCallback((code: string, name: string) => {
    setCusCode(code)
    setCusName(name)
  }, [])

  const handleLogout = useCallback(() => {
    clearAuthConfig()
    setStagingItems([])
    setCusName('')
    setCusCode('')
    setAuthed(false)
  }, [])

  const handleAddToStaging = useCallback((item: StagingItem) => {
    setStagingItems((prev) => {
      if (prev.find((i) => i.key === item.key)) return prev
      return [...prev, item]
    })
  }, [])

  const handleUpdateItem = useCallback(
    (key: string, changes: Partial<StagingItem>) => {
      setStagingItems((prev) =>
        prev.map((i) => (i.key === key ? { ...i, ...changes } : i))
      )
    },
    []
  )

  const handleRemoveItem = useCallback((key: string) => {
    setStagingItems((prev) => prev.filter((i) => i.key !== key))
  }, [])

  const handleClear = useCallback(() => {
    setStagingItems([])
  }, [])

  if (!authed) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* 顶部 Header */}
      <Header
        style={{
          background: '#1677ff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexShrink: 0,
        }}
      >
        <Title level={4} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
          ZDP 钢管库存系统
        </Title>

        {/* 导航菜单 */}
        <Menu
          mode="horizontal"
          theme="dark"
          selectedKeys={[activePage]}
          items={NAV_ITEMS}
          onSelect={({ key }) => {
            const k = key as PageKey
            setActivePage(k)
            sessionStorage.setItem(PAGE_KEY, k)
          }}
          style={{
            background: 'transparent',
            borderBottom: 'none',
            flex: 1,
            minWidth: 0,
          }}
        />

        {/* 用户信息 + 退出 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {AUTH_CONFIG.UserName && (
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
              {AUTH_CONFIG.UserName}
            </Text>
          )}
          {cusName && (
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              {cusName}（{cusCode}）
            </Text>
          )}
          <Tooltip title="退出登录">
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ color: 'rgba(255,255,255,0.85)' }}
            />
          </Tooltip>
        </div>
      </Header>

      {/* 主体内容区 */}
      <Content style={{ display: 'flex', overflow: 'hidden', flex: 1 }}>
        {/* 创建订单页：左查询 + 右暂存 */}
        <div
          style={{
            display: activePage === 'create-order' ? 'flex' : 'none',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <SearchPanel
              onAddToStaging={handleAddToStaging}
              stagingKeys={stagingKeys}
              onCusChange={handleCusChange}
            />
          </div>
          <div
            style={{
              width: 480,
              flexShrink: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <StagingPanel
              items={stagingItems}
              onUpdateItem={handleUpdateItem}
              onRemoveItem={handleRemoveItem}
              onClear={handleClear}
            />
          </div>
        </div>

        {/* 订单列表页 */}
        <div
          style={{
            display: activePage === 'order-list' ? 'flex' : 'none',
            flex: 1,
            overflow: 'hidden',
            flexDirection: 'column',
          }}
        >
          <OrderListPage />
        </div>
      </Content>
    </Layout>
    </ConfigProvider>
  )
}

export default App
