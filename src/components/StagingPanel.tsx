import React, { useState, useRef, useEffect } from 'react'
import {
  Button,
  InputNumber,
  Input,
  Typography,
  Popconfirm,
  message,
  Empty,
  Statistic,
  Row,
  Col,
  Divider,
  Switch,
  Space,
  Badge,
} from 'antd'
import { DeleteOutlined, SendOutlined, ThunderboltOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import { buildOrderPayload, createDeliveryApply } from '../api/order'
import type { StagingItem, InventoryClass } from '../types'

const { Text } = Typography
const { TextArea } = Input

interface StagingPanelProps {
  items: StagingItem[]
  onUpdateItem: (key: string, changes: Partial<StagingItem>) => void
  onRemoveItem: (key: string) => void
  onClear: () => void
  orderId?: number
  initialMemo?: string
  onSubmitSuccess?: () => void
  classList?: InventoryClass[]
}

const MAX_IN_FLIGHT = 20

const StagingPanel: React.FC<StagingPanelProps> = ({
  items,
  onUpdateItem,
  onRemoveItem,
  onClear,
  orderId,
  initialMemo,
  onSubmitSuccess,
}) => {
  const [messageApi, contextHolder] = message.useMessage()
  const [orderMemo, setOrderMemo] = useState(initialMemo ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [snatching, setSnatching] = useState(false)
  const [snatchMode, setSnatchMode] = useState(false)
  const [snatchCount, setSnatchCount] = useState(0)
  const [snatchInterval, setSnatchInterval] = useState(300)
  const [inFlightCount, setInFlightCount] = useState(0)
  const [deleteHover, setDeleteHover] = useState<Record<string, boolean>>({})
  const [clearHover, setClearHover] = useState(false)
  const snatchStopRef = useRef(false)
  const snatchIntervalRef = useRef(300)
  const snatchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inFlightRef = useRef(0)
  const snatchCountRef = useRef(0)
  const abortControllersRef = useRef<Set<AbortController>>(new Set())

  // 记录最新加入的 key，用于触发入场动画
  const [newKey, setNewKey] = useState<string | null>(null)
  const prevKeysRef = useRef<Set<string>>(new Set())
  const [listAnimKey, setListAnimKey] = useState(0)
  const wasEmptyRef = useRef(true)
  const isInitialMountRef = useRef(true)

  useEffect(() => {
    const currentKeys = new Set(items.map((i) => i.key))
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      prevKeysRef.current = currentKeys
      if (currentKeys.size > 0) wasEmptyRef.current = false
      return
    }
    if (wasEmptyRef.current && currentKeys.size > 0) {
      wasEmptyRef.current = false
      setListAnimKey((k) => k + 1)
    } else if (currentKeys.size === 0) {
      wasEmptyRef.current = true
    }
    for (const key of currentKeys) {
      if (!prevKeysRef.current.has(key)) {
        setNewKey(key)
        const t = setTimeout(() => setNewKey(null), 1200)
        prevKeysRef.current = currentKeys
        return () => clearTimeout(t)
      }
    }
    prevKeysRef.current = currentKeys
  }, [items])

  const totalWeight = items.reduce((sum, item) => sum + item.userNum * item.NumWeight, 0)
  const totalAmount = items.reduce((sum, item) => sum + item.userNum * item.NumWeight * item.UPrice1, 0)

  const handleSubmit = async () => {
    if (items.length === 0) { messageApi.warning('暂存区为空，请先加入货品'); return }
    for (const item of items) {
      if (!item.userNum || item.userNum <= 0) {
        messageApi.error(`${item.OnLineInvName} 的件数必须大于 0`); return
      }
      if (item.userNum > item.Num) {
        messageApi.error(`${item.OnLineInvName} 的件数不能超过库存 ${item.Num} 件`); return
      }
    }
    if (snatchMode) { handleSnatch() } else { await handleNormalSubmit() }
  }

  const handleNormalSubmit = async () => {
    setSubmitting(true)
    try {
      const payload = buildOrderPayload(items, orderMemo, orderId)
      const res = await createDeliveryApply(payload)
      if (res.result) {
        messageApi.success(orderId ? '订单修改成功！' : '提货申请提交成功！')
        onClear(); setOrderMemo(''); onSubmitSuccess?.()
      } else {
        messageApi.error(`${orderId ? '修改' : '提交'}失败：${res.errtext ?? '未知错误'}`)
      }
    } catch (e) {
      console.error('提交失败', e); messageApi.error('网络错误，提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSnatch = () => {
    snatchStopRef.current = false
    snatchCountRef.current = 0
    inFlightRef.current = 0
    abortControllersRef.current.clear()
    setSnatching(true)
    setSnatchCount(0)
    setInFlightCount(0)

    const payload = buildOrderPayload(items, orderMemo, orderId)

    const stop = (success: boolean, msg: string) => {
      if (snatchStopRef.current) return
      snatchStopRef.current = true
      if (snatchTimerRef.current !== null) {
        clearInterval(snatchTimerRef.current)
        snatchTimerRef.current = null
      }
      // 中止所有在途请求，尽量避免多次下单
      abortControllersRef.current.forEach((c) => c.abort())
      abortControllersRef.current.clear()
      setSnatching(false)
      setInFlightCount(0)
      if (success) {
        messageApi.success(msg)
        onClear(); setOrderMemo(''); onSubmitSuccess?.()
      } else {
        messageApi.error(msg)
      }
    }

    const fire = () => {
      if (snatchStopRef.current) return
      if (inFlightRef.current >= MAX_IN_FLIGHT) return

      const controller = new AbortController()
      abortControllersRef.current.add(controller)
      inFlightRef.current++

      const myCount = ++snatchCountRef.current
      setSnatchCount(myCount)

      createDeliveryApply(payload, controller.signal).then((res) => {
        if (snatchStopRef.current) return
        if (res.result) {
          stop(true, `抢单成功！（第 ${myCount} 次尝试）`)
          return
        }
        if (res.errtype !== '1') {
          stop(false, `抢单终止：${res.errtext ?? '未知错误'}（已尝试 ${myCount} 次）`)
        }
        // errtype === '1'：未到时间，继续
      }).catch((e: unknown) => {
        // AbortError 是主动取消，静默处理；其他网络异常继续下一轮
        if (e instanceof Error && e.name === 'AbortError') return
        if (e instanceof Error && e.name === 'CanceledError') return  // axios abort
        console.error('抢单请求失败', e)
      }).finally(() => {
        abortControllersRef.current.delete(controller)
        inFlightRef.current = Math.max(0, inFlightRef.current - 1)
      })
    }

    fire()  // 立即发出第一个
    snatchTimerRef.current = setInterval(fire, snatchIntervalRef.current)
  }

  const handleStopSnatch = () => {
    snatchStopRef.current = true
    if (snatchTimerRef.current !== null) {
      clearInterval(snatchTimerRef.current)
      snatchTimerRef.current = null
    }
    abortControllersRef.current.forEach((c) => c.abort())
    abortControllersRef.current.clear()
    setSnatching(false)
    setInFlightCount(0)
    messageApi.info(`已停止抢单（共尝试 ${snatchCountRef.current} 次）`)
  }

  // 轮询 inFlightRef，每 200ms 刷新一次显示，避免高频 setState 导致闪烁
  useEffect(() => {
    if (!snatching) { setInFlightCount(0); return }
    const id = setInterval(() => setInFlightCount(inFlightRef.current), 200)
    return () => clearInterval(id)
  }, [snatching])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {contextHolder}

      {/* 顶部操作条 */}
      {items.length > 0 && (
        <div style={{ padding: '10px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{items.length} 种货品</Text>
          <Popconfirm
            title="清空所有暂存货品？"
            description="列表中所有货品将被移除。"
            icon={<ExclamationCircleFilled style={{ color: '#faad14' }} />}
            okText="清空"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={onClear}
          >
            <Button
              type="text"
              size="small"
              style={{
                color: clearHover ? '#ef4444' : '#9ca3af',
                transition: 'color 0.15s',
                fontSize: 12,
                padding: '0 4px',
                height: 'auto',
              }}
              onMouseEnter={() => setClearHover(true)}
              onMouseLeave={() => setClearHover(false)}
            >清空</Button>
          </Popconfirm>
        </div>
      )}

      {/* 货品列表 */}
      <div
        key={listAnimKey}
        className={items.length > 0 ? 'staging-list' : undefined}
        style={{ flex: 1, overflow: 'auto', padding: items.length > 0 ? '0 12px 8px' : '8px 12px' }}
      >
        {items.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无货品，从左侧查询后加入"
            style={{ paddingTop: 60 }}
          />
        ) : (
          items.map((item) => (
            <div
              key={item.key}
              className={item.key === newKey ? 'staging-item-new' : undefined}
              style={{
                borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                background: 'rgb(250,250,250)',
                border: '1px solid rgba(0,0,0,0.09)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#262626', wordBreak: 'break-all', lineHeight: '1.5' }}>
                    {item.OnLineInvName}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {item.WhName}{item.Wallthickness ? ` · 壁厚 ${item.Wallthickness}` : ''}
                  </Text>
                </div>
                <Popconfirm
                  title="移除该货品？"
                  icon={<ExclamationCircleFilled style={{ color: '#faad14' }} />}
                  okText="移除"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={() => onRemoveItem(item.key)}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    style={{
                      flexShrink: 0,
                      color: deleteHover[item.key] ? '#ef4444' : '#d1d5db',
                      transition: 'color 0.15s',
                      padding: '0 4px',
                    }}
                    onMouseEnter={() => setDeleteHover((prev) => ({ ...prev, [item.key]: true }))}
                    onMouseLeave={() => setDeleteHover((prev) => ({ ...prev, [item.key]: false }))}
                  />
                </Popconfirm>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <Text style={{ fontSize: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>单价 </Text>
                  <Text style={{ color: '#e11d48', fontSize: 13 }}>{item.UPrice1.toFixed(2)}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}> 元/吨</Text>
                </Text>
                <Text style={{ fontSize: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>库存 </Text>
                  {item.Num}
                  <Text type="secondary" style={{ fontSize: 11 }}> 件</Text>
                </Text>
                <Text style={{ fontSize: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>单件重 </Text>
                  {item.NumWeight.toFixed(3)}
                  <Text type="secondary" style={{ fontSize: 11 }}> 吨</Text>
                </Text>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>件数</Text>
                  <InputNumber
                    size="small" min={1} max={item.Num} value={item.userNum}
                    onChange={(val) => { if (val != null) onUpdateItem(item.key, { userNum: val }) }}
                    style={{ width: 72 }}
                  />
                </div>
                <Input
                  size="small" value={item.remark} placeholder="行备注（可选）"
                  onChange={(e) => onUpdateItem(item.key, { remark: e.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部操作区 */}
      <div
        className="staging-footer"
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}
      >
        {items.length > 0 && (
          <>
            <Row gutter={16} style={{ marginBottom: 8 }}>
              <Col span={12}>
                <Statistic title="预估重量(吨)" value={totalWeight.toFixed(3)} valueStyle={{ fontSize: 16 }} />
              </Col>
              <Col span={12}>
                <Statistic title="预估金额(元)" value={totalAmount.toFixed(2)} valueStyle={{ fontSize: 18, color: '#e11d48' }} />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>整单备注</Text>
              <TextArea rows={2} value={orderMemo} onChange={(e) => setOrderMemo(e.target.value)} placeholder="整单备注（可选）" style={{ marginTop: 4 }} />
            </div>
          </>
        )}

        {/* 抢单模式（普通模式子选项） */}
        {snatchMode && !snatching && (
          <div style={{ marginBottom: 8, padding: '5px 10px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8 }}>
            <Text style={{ fontSize: 12, color: '#ad6800' }}>
              开启后将持续尝试下单，直到成功或遇到非时间限制的错误（如无货）
            </Text>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, minHeight: 28 }}>
          <Space size={6} style={{ lineHeight: 1 }}>
            <ThunderboltOutlined style={{ color: snatchMode ? '#faad14' : '#bfbfbf' }} />
            <Text style={{ fontSize: 13 }}>抢单模式</Text>
            <Switch
              size="small"
              checked={snatchMode}
              onChange={setSnatchMode}
              disabled={snatching}
            />
            {snatchMode && (
              <>
                <Text type="secondary" style={{ fontSize: 12 }}>间隔</Text>
                <InputNumber
                  size="small" min={10} max={10000} step={100}
                  value={snatchInterval} disabled={snatching}
                  onChange={(val) => { const v = val ?? 300; setSnatchInterval(v); snatchIntervalRef.current = v }}
                  controls={false}
                  style={{ width: 68 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>ms</Text>
              </>
            )}
          </Space>
          {snatching && (
            <Badge count={snatchCount} overflowCount={9999} style={{ backgroundColor: '#faad14' }} />
          )}
        </div>
        {snatching && (() => {
          const ratio = inFlightCount / MAX_IN_FLIGHT
          const dotColor  = ratio >= 1 ? '#ef4444' : ratio >= 0.6 ? '#faad14' : '#52c41a'
          const label     = ratio >= 1 ? '发送过快' : ratio >= 0.6 ? '发送较快' : '发送正常'
          const barColor  = dotColor
          return (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                {/* 交通灯小圆点 */}
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: dotColor, flexShrink: 0,
                  boxShadow: `0 0 4px ${dotColor}`,
                }} />
                <Text style={{ fontSize: 12, color: dotColor }}>{label}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  · {inFlightCount} 个请求待回复
                </Text>
                {ratio >= 1 && (
                  <Text style={{ fontSize: 12, color: '#ef4444' }}>
                    · 订单系统回复速度跟不上，建议将间隔调大
                  </Text>
                )}
              </div>
              {/* 进度条 */}
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(ratio * 100, 100)}%`,
                  background: barColor,
                  borderRadius: 2,
                  transition: 'width 0.2s, background 0.3s',
                }} />
              </div>
            </div>
          )
        })()}

        {snatching ? (
          <Button block size="large" danger onClick={handleStopSnatch}>
            停止抢单（已尝试 {snatchCount} 次）
          </Button>
        ) : (
          <Button
            type="primary" block size="large"
            icon={snatchMode ? <ThunderboltOutlined /> : <SendOutlined />}
            loading={submitting}
            disabled={items.length === 0}
            onClick={handleSubmit}
            style={snatchMode && items.length > 0 ? { background: '#faad14', borderColor: '#faad14' } : undefined}
          >
            {snatchMode
              ? `开始抢单${items.length > 0 ? `（${items.length} 种货品）` : ''}`
              : orderId ? `保存修改${items.length > 0 ? `（${items.length} 种货品）` : ''}` : `提交提货申请${items.length > 0 ? `（${items.length} 种货品）` : ''}`}
          </Button>
        )}
      </div>
    </div>
  )
}

export default StagingPanel
