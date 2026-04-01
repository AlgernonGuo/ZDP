import { useState, useCallback, useEffect } from 'react'
import { Layout, Typography, Button, Tooltip, Menu, ConfigProvider, Popover, Grid, Segmented } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'
import { LogoutOutlined, CheckOutlined, FontSizeOutlined } from '@ant-design/icons'
import SearchPanel from './components/SearchPanel'
import StagingPanel from './components/StagingPanel'
import OrderListPage from './components/OrderListPage'
import LoginPage from './components/LoginPage'
import AutoSnatchPanel from './components/AutoSnatchPanel'
import { isAuthenticated, clearAuthConfig, AUTH_CONFIG, authBus } from './api/client'
import { getInventoryClassList } from './api/inventory'
import type { StagingItem, InventoryClass } from './types'
import './App.css'

dayjs.locale('zh-cn')

const { Header, Content } = Layout
const { Title, Text } = Typography

type PageKey = 'create-order' | 'order-list'
type FontPresetKey = 'compact' | 'standard' | 'comfortable' | 'large'
type MobileCreatePane = 'search' | 'staging'

interface FontPreset {
  key: FontPresetKey
  label: string
  desc: string
  fontSize: number
  menuFontSize: number
  menuLineHeight: string
  statisticSize: number
}

const FONT_PRESETS: FontPreset[] = [
  { key: 'compact',     label: '紧凑', desc: '信息密度高，适合熟练用户', fontSize: 13, menuFontSize: 14, menuLineHeight: '44px', statisticSize: 16 },
  { key: 'standard',   label: '标准', desc: '默认推荐',                  fontSize: 14, menuFontSize: 15, menuLineHeight: '46px', statisticSize: 18 },
  { key: 'comfortable',label: '舒适', desc: '字号稍大，长时间使用更轻松', fontSize: 15, menuFontSize: 16, menuLineHeight: '50px', statisticSize: 20 },
  { key: 'large',      label: '大字', desc: '最大字号，适合视力不佳用户', fontSize: 17, menuFontSize: 18, menuLineHeight: '56px', statisticSize: 24 },
]

const FONT_PRESET_KEY = 'zdp_font_preset'

function getInitialPreset(): FontPresetKey {
  const saved = localStorage.getItem(FONT_PRESET_KEY) as FontPresetKey | null
  return saved && FONT_PRESETS.some((p) => p.key === saved) ? saved : 'standard'
}

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
  const screens = Grid.useBreakpoint()
  const [authed, setAuthed] = useState<boolean>(isAuthenticated)
  const [cusName, setCusName] = useState(AUTH_CONFIG.CusName)
  const [cusCode, setCusCode] = useState(AUTH_CONFIG.CusCode)
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([])
  const [classList, setClassList] = useState<InventoryClass[]>([])
  const [activePage, setActivePage] = useState<PageKey>(getInitialPage)
  const [orderListRefreshKey, setOrderListRefreshKey] = useState(0)
  const [fontPresetKey, setFontPresetKey] = useState<FontPresetKey>(getInitialPreset)
  const [mobileCreatePane, setMobileCreatePane] = useState<MobileCreatePane>('search')
  const [autoSnatchMode, setAutoSnatchMode] = useState(false)
  const [autoSnatching, setAutoSnatching] = useState(false)

  const preset = FONT_PRESETS.find((p) => p.key === fontPresetKey) ?? FONT_PRESETS[1]
  const isNarrowLayout = !screens.lg
  const isCompactHeader = !screens.md

  const handleFontPreset = (key: FontPresetKey) => {
    setFontPresetKey(key)
    localStorage.setItem(FONT_PRESET_KEY, key)
  }

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

  // 后端 Session 失效时自动跳回登录页
  useEffect(() => {
    const onUnauthorized = () => handleLogout()
    authBus.addEventListener('unauthorized', onUnauthorized)
    return () => authBus.removeEventListener('unauthorized', onUnauthorized)
  }, [handleLogout])

  useEffect(() => {
    if (authed) {
      getInventoryClassList().then((res) => {
        if (res.result) setClassList(res.data)
      }).catch(() => {})
    }
  }, [authed])

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
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          borderRadius: 6,
          borderRadiusLG: 10,
          colorPrimary: '#1677ff',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          fontSize: preset.fontSize,
          colorText: '#111827',
          colorTextSecondary: '#6b7280',
          colorBorder: 'rgba(0,0,0,0.12)',
          colorBorderSecondary: 'rgba(0,0,0,0.06)',
          colorSplit: 'rgba(0,0,0,0.06)',
          colorFillAlter: '#f8fafc',
          motionDurationSlow: '0.16s',
          motionDurationMid: '0.1s',
        },
        components: {
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#6b7280',
            borderColor: 'rgba(0,0,0,0.06)',
            rowHoverBg: '#f8fafc',
            headerSortActiveBg: '#f1f5f9',
            headerSortHoverBg: '#f1f5f9',
          },
          Button: {
            primaryShadow: 'none',
            defaultShadow: 'none',
            dangerShadow: 'none',
          },
          Layout: {
            headerBg: '#ffffff',
          },
          Menu: {
            itemColor: '#374151',
            itemHoverColor: '#1677ff',
            fontSize: preset.menuFontSize,
            fontWeightStrong: 600,
            horizontalLineHeight: preset.menuLineHeight,
          },
          Input: {
            activeShadow: '0 0 0 2px rgba(22,119,255,0.12)',
          },
          Select: {
            optionSelectedBg: '#eff6ff',
          },
          Statistic: {
            titleFontSize: preset.fontSize - 2,
            contentFontSize: preset.statisticSize,
          },
          Divider: {
            marginLG: 16,
          },
        },
      }}
    >
      <Layout style={{ minHeight: '100vh', height: '100dvh', overflow: 'hidden' }}>
      {/* 顶部 Header */}
        <Header
          style={{
            background: '#fff',
            padding: isCompactHeader ? '0 12px' : '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: isCompactHeader ? 10 : 24,
            flexShrink: 0,
            borderBottom: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <Title level={4} style={{ color: '#1677ff', margin: 0, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>
          {screens.sm ? 'ZDP 钢管库存系统' : 'ZDP'}
          </Title>

        {/* 导航菜单 */}
        <Menu
          mode="horizontal"
          selectedKeys={[activePage]}
          items={NAV_ITEMS}
          onSelect={({ key }) => {
            const k = key as PageKey
            setActivePage(k)
            sessionStorage.setItem(PAGE_KEY, k)
            if (k === 'order-list') setOrderListRefreshKey((n) => n + 1)
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
            <Text
              ellipsis
              style={{
                color: 'rgba(0,0,0,0.4)',
                fontSize: isCompactHeader ? 12 : 14,
                maxWidth: screens.xl ? 180 : 100,
                display: 'inline-block',
              }}
            >
              {AUTH_CONFIG.UserName}
            </Text>
          )}
          {cusName && (
            <Text
              ellipsis
              style={{
                color: 'rgba(0,0,0,0.65)',
                fontSize: isCompactHeader ? 12 : 14,
                maxWidth: screens.xl ? 220 : 130,
                display: 'inline-block',
              }}
            >
              {cusName}（{cusCode}）
            </Text>
          )}

          {/* 字体预设选择器 */}
          <Popover
            placement="bottomRight"
            trigger="click"
            content={
              <div style={{ width: 220, padding: '4px 0' }}>
                <Text type="secondary" style={{ fontSize: 11, padding: '0 12px 6px', display: 'block' }}>
                  字号设置
                </Text>
                {FONT_PRESETS.map((p) => (
                  <div
                    key={p.key}
                    onClick={() => handleFontPreset(p.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: fontPresetKey === p.key ? '#eff6ff' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: p.fontSize, fontWeight: 500, color: '#111827' }}>
                        {p.label}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>
                        {p.desc}
                      </span>
                    </div>
                    {fontPresetKey === p.key && (
                      <CheckOutlined style={{ color: '#1677ff', fontSize: 12 }} />
                    )}
                  </div>
                ))}
              </div>
            }
          >
            <Tooltip title="字号设置">
              <Button
                type="text"
                icon={<FontSizeOutlined />}
                style={{ color: 'rgba(0,0,0,0.4)' }}
              />
            </Tooltip>
          </Popover>

          <Tooltip title="退出登录">
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ color: 'rgba(0,0,0,0.4)' }}
            />
          </Tooltip>
        </div>
      </Header>

      {/* 主体内容区 */}
      <Content style={{ display: 'flex', overflow: 'hidden', flex: 1, background: '#fff' }}>
        {/* 创建订单页：左查询 + 右暂存 */}
        <div
          style={{
            display: activePage === 'create-order' ? 'flex' : 'none',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
            flexDirection: 'column',
          }}
        >
          {/* 页面级模式切换栏 */}
          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              flexShrink: 0,
              background: '#fff',
            }}
          >
            <Segmented
              value={autoSnatchMode ? 'auto' : 'normal'}
              disabled={autoSnatching}
              onChange={(v) => {
                const isAuto = v === 'auto'
                setAutoSnatchMode(isAuto)
              }}
              options={[
                { label: '普通下单', value: 'normal' },
                { label: '自动搜索抢单', value: 'auto' },
              ]}
            />
          </div>

          {/* 两列内容区 */}
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              minHeight: 0,
              display: 'flex',
              flexDirection: isNarrowLayout ? 'column' : 'row',
            }}
          >
          {isNarrowLayout && !autoSnatchMode && (
            <div
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                flexShrink: 0,
                background: '#fff',
              }}
            >
              <Segmented
                block
                value={mobileCreatePane}
                onChange={(value) => setMobileCreatePane(value as MobileCreatePane)}
                options={[
                  { label: '查询库存', value: 'search' },
                  { label: `暂存区（${stagingItems.length}）`, value: 'staging' },
                ]}
              />
            </div>
          )}
          {/* 自动搜索抢单模式：占满全宽 */}
          {autoSnatchMode && (
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <AutoSnatchPanel
                classList={classList}
                onSnatchingChange={(v) => setAutoSnatching(v)}
              />
            </div>
          )}
          {/* 普通模式：左查询 + 右暂存 */}
          {!autoSnatchMode && (
            <>
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              display: !isNarrowLayout || mobileCreatePane === 'search' ? 'flex' : 'none',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
              <SearchPanel
                onAddToStaging={handleAddToStaging}
                stagingKeys={stagingKeys}
                onCusChange={handleCusChange}
              />
          </div>
          <div
            style={{
              width: isNarrowLayout ? '100%' : 'clamp(360px, 33vw, 520px)',
              height: isNarrowLayout ? '100%' : '100%',
              flex: isNarrowLayout ? 1 : undefined,
              flexShrink: 0,
              overflow: 'hidden',
              display: !isNarrowLayout || mobileCreatePane === 'staging' ? 'flex' : 'none',
              flexDirection: 'column',
              minHeight: 0,
              borderLeft: isNarrowLayout ? 'none' : '1px solid rgba(0,0,0,0.06)',
              borderTop: 'none',
            }}
          >
            <StagingPanel
              items={stagingItems}
              onUpdateItem={handleUpdateItem}
              onRemoveItem={handleRemoveItem}
              onClear={handleClear}
              classList={classList}
            />
          </div>
            </>
          )}
          </div>{/* 两列内容区 end */}
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
          <OrderListPage refreshKey={orderListRefreshKey} />
        </div>
      </Content>
    </Layout>
    </ConfigProvider>
  )
}

export default App
