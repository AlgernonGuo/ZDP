import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Select,
  InputNumber,
  Input,
  Button,
  Typography,
  Tag,
  Spin,
  message,
  Popconfirm,
} from 'antd'
import {
  PlusOutlined,
  PlayCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  DownOutlined,
  RightOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { getCustomerList, getOnLineStockList, getOnLineStockDetail } from '../api/inventory'
import { setAuthConfig, AUTH_CONFIG } from '../api/client'
import { buildOrderPayload, createDeliveryApply } from '../api/order'
import type {
  InventoryClass,
  StagingItem,
  AutoSnatchTarget,
  AutoSnatchLog,
  AutoSnatchStatus,
  AutoSnatchTask,
} from '../types'

interface AutoSnatchPanelProps {
  classList: InventoryClass[]
  onSnatchingChange?: (snatching: boolean) => void
}

const { Text } = Typography
const { TextArea } = Input

const STATUS_TAG: Record<AutoSnatchStatus, { color: string; label: string }> = {
  idle:      { color: 'default',    label: '待抢' },
  searching: { color: 'processing', label: '搜索中' },
  placing:   { color: 'warning',    label: '下单中' },
  success:   { color: 'success',    label: '成功' },
  failed:    { color: 'error',      label: '失败' },
  stopped:   { color: 'default',    label: '已停止' },
}

const LOG_COLORS: Record<AutoSnatchLog['level'], string> = {
  info:    '#9ca3af',
  success: '#34d399',
  error:   '#f87171',
  warn:    '#fbbf24',
}

const STORAGE_KEY = 'zdp_auto_snatch_tasks'
const MAX_TASKS = 20

function nowStr() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function loadTasksFromStorage(): AutoSnatchTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const tasks: AutoSnatchTask[] = JSON.parse(raw)
    // 意外中断的 running task → status='stopped'
    return tasks.map((t) =>
      t.status === 'running' ? { ...t, status: 'stopped', endTime: t.endTime ?? new Date().toISOString() } : t
    )
  } catch {
    return []
  }
}

function persistTasks(tasks: AutoSnatchTask[]) {
  const toSave = tasks.filter((t) => t.status !== 'running').slice(-MAX_TASKS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
}

let pendingTargetIdCounter = 0

// ── TaskCard ──────────────────────────────────────────────────────────────
interface TaskCardProps {
  task: AutoSnatchTask
  isRunning: boolean
  onStop: (taskId: string) => void
  onResume: (task: AutoSnatchTask) => void
  onReuseTargets: (targets: AutoSnatchTarget[]) => void
  onDelete: (taskId: string) => void
}

function TaskCard({ task, isRunning, onStop, onResume, onReuseTargets, onDelete }: TaskCardProps) {
  const [logsOpen, setLogsOpen] = useState(false)
  const [editInterval, setEditInterval] = useState(task.interval)
  const [deleteHover, setDeleteHover] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logsOpen) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [task.logs, logsOpen])

  const borderColor = isRunning ? '#c4b5fd' : 'rgba(0,0,0,0.09)'
  const bgColor = isRunning ? 'rgba(124,58,237,0.03)' : '#fafafa'

  const statusLabel = isRunning ? '运行中' : task.status === 'completed' ? '已完成' : '已停止'
  const statusColor = isRunning ? 'processing' : task.status === 'completed' ? 'success' : 'default'

  const startTime = new Date(task.startTime).toLocaleTimeString('zh-CN', { hour12: false })

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        background: bgColor,
        marginBottom: 10,
        overflow: 'hidden',
        transition: 'border-color 0.3s, background 0.3s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          flexWrap: 'wrap',
        }}
      >
        {isRunning && <span className="snatch-indicator-dot" />}
        <Text style={{ fontWeight: 600, fontSize: 13 }}>任务 #{task.taskNo}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{startTime}</Text>
        {task.cusName && (
          <Text type="secondary" style={{ fontSize: 12 }}>{task.cusName}</Text>
        )}
        <Tag color={statusColor} style={{ margin: 0, fontSize: 11 }}>{statusLabel}</Tag>
        {isRunning && (
          <Text type="secondary" style={{ fontSize: 12 }}>已搜 {task.searchCount} 次</Text>
        )}
        {isRunning ? (
          <Text type="secondary" style={{ fontSize: 12 }}>间隔 {task.interval}ms</Text>
        ) : task.status === 'stopped' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <InputNumber
              size="small"
              min={500}
              max={30000}
              step={500}
              value={editInterval}
              onChange={(v) => setEditInterval(v ?? task.interval)}
              style={{ width: 64, fontSize: 11, height: 22 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>ms</Text>
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>间隔 {task.interval}ms</Text>
        )}
        {/* 头部右侧操作 */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {isRunning ? (
            <Button
              type="text"
              danger
              size="small"
              icon={<StopOutlined />}
              onClick={() => onStop(task.id)}
            />
          ) : task.status === 'stopped' ? (
            <>
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                style={{ padding: 0, fontSize: 12 }}
                onClick={() => onResume({ ...task, interval: editInterval })}
              >
                恢复
              </Button>
              <Popconfirm
                title="确认删除此任务？"
                okText="删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
                onConfirm={() => onDelete(task.id)}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onMouseEnter={() => setDeleteHover(true)}
                  onMouseLeave={() => setDeleteHover(false)}
                  style={{
                    color: deleteHover ? '#ef4444' : '#d1d5db',
                    transition: 'color 0.15s',
                    padding: '0 4px',
                  }}
                />
              </Popconfirm>
            </>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              style={{ padding: 0, fontSize: 12 }}
              onClick={() => onReuseTargets(task.targetsSnapshot)}
            >
              复用规格
            </Button>
          )}
        </div>
      </div>

      {/* 规格 Tag 行 */}
      <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {task.targetsSnapshot.map((t) => {
          const st = task.statuses[t.id] ?? 'idle'
          const { color, label } = STATUS_TAG[st]
          return (
            <Tag key={t.id} color={color} style={{ fontSize: 11, margin: 0 }}>
              {t.invCName} {t.standard}
              {t.wallThickness != null ? ` 壁厚${t.wallThickness}` : ''}
              {` · ${t.userNum}件`}
              {` · ${label}`}
            </Tag>
          )
        })}
      </div>

      {/* 日志折叠 */}
      <div style={{ padding: '0 12px 8px' }}>
        <Button
          type="text"
          size="small"
          icon={logsOpen ? <DownOutlined /> : <RightOutlined />}
          style={{ fontSize: 12, color: '#6b7280', padding: '0 4px' }}
          onClick={() => setLogsOpen((v) => !v)}
        >
          {logsOpen ? '收起日志' : '展开日志'}
        </Button>
        {logsOpen && (
          <div
            style={{
              marginTop: 6,
              maxHeight: 160,
              overflowY: 'auto',
              background: '#1a1a2e',
              borderRadius: 6,
              padding: '6px 10px',
              fontFamily: "'Menlo', 'Consolas', monospace",
              fontSize: 11,
            }}
          >
            {task.logs.length === 0 ? (
              <div style={{ color: '#4b5563' }}>暂无日志</div>
            ) : (
              task.logs.map((log, i) => (
                <div key={i} style={{ color: LOG_COLORS[log.level], lineHeight: '1.6' }}>
                  <span style={{ color: '#6b7280', marginRight: 6 }}>{log.time}</span>
                  {log.message}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── PendingTargetCard ─────────────────────────────────────────────────────
interface PendingTargetCardProps {
  target: AutoSnatchTarget
  status: AutoSnatchStatus
  hitItem: StagingItem | null | undefined
  hasSearched: boolean
  onRemove: (id: string) => void
  onUpdateNum: (id: string, num: number) => void
}

function PendingTargetCard({ target, status, hitItem, hasSearched, onRemove, onUpdateNum }: PendingTargetCardProps) {
  return (
    <div
      style={{
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 8,
        background: '#fafafa',
        border: '1px solid rgba(0,0,0,0.09)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* 行1：规格名 + 状态 + 删除 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }} ellipsis>
          {target.invCName} · {target.standard}
          {target.wallThickness != null ? ` · 壁厚${target.wallThickness}` : ''}
        </Text>
        {status === 'searching' && <Spin size="small" />}
        <Button
          type="text" danger size="small"
          icon={<DeleteOutlined />}
          style={{ flexShrink: 0 }}
          onClick={() => onRemove(target.id)}
        />
      </div>

      {/* 行2：库存摘要 */}
      {status !== 'searching' && hasSearched && hitItem != null && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>{hitItem.WhName}</Text>
          {hitItem.Wallthickness && (
            <Text type="secondary" style={{ fontSize: 11 }}>壁厚 {hitItem.Wallthickness}</Text>
          )}
          <Text style={{ fontSize: 11 }}>
            <span style={{ color: '#e11d48' }}>{hitItem.UPrice1.toFixed(2)}</span>
            <Text type="secondary" style={{ fontSize: 10 }}> 元/吨</Text>
          </Text>
          <Text style={{ fontSize: 11 }}>
            库存 {hitItem.Num}
            <Text type="secondary" style={{ fontSize: 10 }}> 件</Text>
          </Text>
        </div>
      )}
      {status !== 'searching' && hasSearched && hitItem === null && (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>暂无库存</Text>
      )}

      {/* 行3：件数 + 备注 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>件数</Text>
          <InputNumber
            size="small" min={1}
            value={target.userNum}
            onChange={(val) => { if (val != null) onUpdateNum(target.id, val) }}
            style={{ width: 72 }}
          />
        </div>
        {target.remark && (
          <Text type="secondary" style={{ fontSize: 11 }}>{target.remark}</Text>
        )}
      </div>
    </div>
  )
}

// ── RightPanelHeader ──────────────────────────────────────────────────────
interface RightPanelHeaderProps {
  tasks: AutoSnatchTask[]
  onDeleteAllStopped: () => void
}

function RightPanelHeader({ tasks, onDeleteAllStopped }: RightPanelHeaderProps) {
  const [clearHover, setClearHover] = useState(false)
  const stoppedCount = tasks.filter((t) => t.status === 'stopped').length

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px 4px',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      <Text type="secondary" style={{ fontSize: 12 }}>
        共 {tasks.length} 个任务
      </Text>
      {stoppedCount > 0 && (
        <Popconfirm
          title="确认清空已停止任务？"
          okText="清空"
          okButtonProps={{ danger: true }}
          cancelText="取消"
          onConfirm={onDeleteAllStopped}
        >
          <Button
            type="text"
            size="small"
            onMouseEnter={() => setClearHover(true)}
            onMouseLeave={() => setClearHover(false)}
            style={{
              color: clearHover ? '#ef4444' : '#9ca3af',
              transition: 'color 0.15s',
              fontSize: 12,
              padding: '0 4px',
              height: 'auto',
            }}
          >
            清空已停止 ({stoppedCount})
          </Button>
        </Popconfirm>
      )}
    </div>
  )
}

// ── AutoSnatchPanel ───────────────────────────────────────────────────────
function AutoSnatchPanel({ classList, onSnatchingChange }: AutoSnatchPanelProps) {
  const [messageApi, contextHolder] = message.useMessage()

  // ── 客户 ────────────────────────────────────────────────────────────────
  const [customerList, setCustomerList] = useState<{ CusCode: string; CusName: string }[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [selectedCusCode, setSelectedCusCode] = useState<string>(AUTH_CONFIG.CusCode ?? '')

  useEffect(() => {
    setCustomerLoading(true)
    getCustomerList().then((res) => {
      if (res.result && res.data.length > 0) {
        setCustomerList(res.data)
        const stored = localStorage.getItem('zdp_last_cus_code')
        const found = stored ? res.data.find((c) => c.CusCode === stored) : null
        const target = found ?? res.data.find((c) => c.CusCode === AUTH_CONFIG.CusCode) ?? res.data[0]
        setSelectedCusCode(target.CusCode)
        setAuthConfig({ ...AUTH_CONFIG, CusCode: target.CusCode, CusName: target.CusName })
      }
    }).catch(() => {}).finally(() => setCustomerLoading(false))
  }, [])

  const handleCusChange = (value: string) => {
    const customer = customerList.find((c) => c.CusCode === value)
    if (!customer) return
    setSelectedCusCode(value)
    localStorage.setItem('zdp_last_cus_code', value)
    setAuthConfig({ ...AUTH_CONFIG, CusCode: customer.CusCode, CusName: customer.CusName })
  }

  // ── 配置表单 ─────────────────────────────────────────────────────────────
  const [formClass, setFormClass] = useState<string>('')
  const [formStd, setFormStd]     = useState<string>('')
  const [formWt, setFormWt]       = useState<string | null>(null)
  const [formNum, setFormNum]     = useState<number>(1)
  const [formRemark, setFormRemark] = useState<string>('')
  const [wtOptions, setWtOptions]   = useState<string[]>([])
  const [wtInputVal, setWtInputVal] = useState('')

  const standards = classList.find((c) => c.InvCName === formClass)
    ?.OnLienInventoryClassItem.map((i) => i.Standard) ?? []

  useEffect(() => {
    if (!formClass || !formStd) { setWtOptions([]); setFormWt(null); setWtInputVal(''); return }
    getOnLineStockList(formClass, formStd).then((res) => {
      const wts = [...new Set((res.data ?? []).map((i) => String(i.Wallthickness)).filter(Boolean))]
        .sort((a, b) => Number(a) - Number(b))
      setWtOptions(wts)
    }).catch(() => {})
  }, [formClass, formStd])

  const wtSelectOptions = [
    ...wtOptions.map((w) => ({ label: w, value: w })),
    ...(wtInputVal && !isNaN(Number(wtInputVal)) && !wtOptions.includes(wtInputVal)
      ? [{ label: `使用 "${wtInputVal}"`, value: wtInputVal }]
      : []),
  ]

  // ── 左侧：待发起规格 ──────────────────────────────────────────────────────
  const [pendingTargets, setPendingTargets]   = useState<AutoSnatchTarget[]>([])
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, AutoSnatchStatus>>({})
  const [previewHitItems, setPreviewHitItems] = useState<Record<string, StagingItem | null>>({})

  // 已做过预览搜索的 target id 集合（避免重复搜索）
  const previewedIds = useRef<Set<string>>(new Set())

  // ── 右侧：任务列表 + 控制栏 ──────────────────────────────────────────────
  const [tasks, setTasks]             = useState<AutoSnatchTask[]>(loadTasksFromStorage)
  const [runningTaskIds, setRunningTaskIds] = useState<Set<string>>(new Set())
  const [orderMemo, setOrderMemo]           = useState('')
  const [autoSnatchInterval, setAutoSnatchInterval] = useState(2000)
  // taskId → shouldStop
  const stopRefs = useRef<Map<string, boolean>>(new Map())
  const snatchIntervalRef = useRef(2000)

  // 任务序号从历史记录中读取
  const taskNoCounterRef = useRef(
    tasks.reduce((max, t) => Math.max(max, t.taskNo), 0)
  )

  const runningCount = runningTaskIds.size
  const canStartNew = runningCount < 3

  // ── 持久化辅助 ─────────────────────────────────────────────────────────
  const updateTask = useCallback(
    (taskId: string, updater: (t: AutoSnatchTask) => AutoSnatchTask) =>
      setTasks((prev) => prev.map((t) => t.id === taskId ? updater(t) : t)),
    []
  )

  // ── 预览搜索 ───────────────────────────────────────────────────────────
  const previewSearch = useCallback(async (target: AutoSnatchTarget) => {
    const { id, invCName, standard, wallThickness } = target
    setPendingStatuses((prev) => ({ ...prev, [id]: 'searching' }))
    try {
      const wtStr = wallThickness != null ? String(wallThickness) : undefined
      const res = await getOnLineStockList(invCName, standard, wtStr)
      if (!res.result || !res.data || res.data.length === 0) {
        setPreviewHitItems((prev) => ({ ...prev, [id]: null }))
      } else {
        const hit = res.data[0]
        setPreviewHitItems((prev) => ({
          ...prev,
          [id]: {
            key: String(hit.AutoID),
            InvCode: hit.InvCode, InvName: hit.InvName,
            OnLineInvName: hit.OnLineInvName, InvCName: hit.InvCName,
            InvStd: hit.InvStd, Standard: hit.Standard,
            Wallthickness: String(hit.Wallthickness), Brand: '',
            WhCode: hit.WhCode, WhName: hit.WhName,
            Free1: hit.Free1, Free2: hit.Free2, Free3: hit.Free3,
            UPrice1: hit.UPrice1, Num: hit.Num, STNum: hit.STNum,
            NumWeight: hit.NumWeight,
            OnLinePackCount: hit.OnLinePackCount,
            userNum: target.userNum, remark: target.remark,
          },
        }))
      }
    } catch {
      setPreviewHitItems((prev) => ({ ...prev, [id]: null }))
    } finally {
      setPendingStatuses((prev) => {
        if (prev[id] === 'searching') return { ...prev, [id]: 'idle' }
        return prev
      })
    }
  }, [])

  // 新增规格时自动做一次预览搜索（不再限制 isRunning）
  useEffect(() => {
    pendingTargets.forEach((t) => {
      if (!previewedIds.current.has(t.id)) {
        previewedIds.current.add(t.id)
        previewSearch(t)
      }
    })
  }, [pendingTargets, previewSearch])

  // ── 添加规格 ───────────────────────────────────────────────────────────
  const handleAddTarget = () => {
    if (!formClass) { messageApi.warning('请选择品种'); return }
    if (!formStd)   { messageApi.warning('请选择规格'); return }
    if (!formNum || formNum <= 0) { messageApi.warning('件数必须大于0'); return }

    const id = String(++pendingTargetIdCounter)
    const wtNum = formWt != null ? Number(formWt) : null
    const newTarget: AutoSnatchTarget = {
      id, invCName: formClass, standard: formStd,
      wallThickness: wtNum, userNum: formNum, remark: formRemark,
    }
    setPendingTargets((prev) => [...prev, newTarget])
    setPendingStatuses((s) => ({ ...s, [id]: 'idle' as AutoSnatchStatus }))
    setFormRemark('')
  }

  const handleRemovePending = useCallback((id: string) => {
    previewedIds.current.delete(id)
    setPendingTargets((prev) => prev.filter((t) => t.id !== id))
    setPendingStatuses((s) => { const ns = { ...s }; delete ns[id]; return ns })
    setPreviewHitItems((prev) => { const n = { ...prev }; delete n[id]; return n })
  }, [])

  const handleUpdatePendingNum = useCallback((id: string, num: number) => {
    setPendingTargets((prev) => prev.map((t) => t.id === id ? { ...t, userNum: num } : t))
  }, [])

  // ── 复用规格 ───────────────────────────────────────────────────────────
  const handleReuseTargets = useCallback((targets: AutoSnatchTarget[]) => {
    previewedIds.current.clear()
    const newTargets = targets.map((t) => ({
      ...t,
      id: String(++pendingTargetIdCounter),
    }))
    setPendingTargets(newTargets)
    const newStatuses: Record<string, AutoSnatchStatus> = {}
    newTargets.forEach((t) => { newStatuses[t.id] = 'idle' })
    setPendingStatuses(newStatuses)
    setPreviewHitItems({})
    messageApi.success('已复用上次规格列表')
  }, [messageApi])

  // ── runTarget：在任务内搜索+下单 ─────────────────────────────────────────
  const runTarget = useCallback(async (
    target: AutoSnatchTarget,
    taskId: string,
    memo: string,
    stopRefsMap: React.MutableRefObject<Map<string, boolean>>,
  ): Promise<void> => {
    const { id, invCName, standard, wallThickness, userNum, remark } = target
    let cachedHit: StagingItem | null = null

    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

    const addTaskLog = (level: AutoSnatchLog['level'], msg: string) => {
      const entry: AutoSnatchLog = { time: nowStr(), level, message: msg }
      updateTask(taskId, (t) => ({
        ...t,
        logs: t.logs.length >= 200 ? [...t.logs.slice(1), entry] : [...t.logs, entry],
      }))
    }

    const setTaskTargetStatus = (status: AutoSnatchStatus) => {
      updateTask(taskId, (t) => ({
        ...t,
        statuses: { ...t.statuses, [id]: status },
      }))
    }

    const loop = async (): Promise<void> => {
      if (stopRefsMap.current.get(taskId)) {
        setTaskTargetStatus('stopped')
        addTaskLog('info', `[${invCName} ${standard}] 已停止`)
        return
      }

      if (!cachedHit) {
        setTaskTargetStatus('searching')
        addTaskLog('info', `[${invCName} ${standard}] 搜索库存...`)
        updateTask(taskId, (t) => ({ ...t, searchCount: t.searchCount + 1 }))

        try {
          const wtStr = wallThickness != null ? String(wallThickness) : undefined
          const res = await getOnLineStockList(invCName, standard, wtStr)

          if (!res.result || !res.data || res.data.length === 0) {
            updateTask(taskId, (t) => ({
              ...t,
              hitItems: { ...t.hitItems, [id]: null },
            }))
            addTaskLog('info', `[${invCName} ${standard}] 暂无库存，等待重试`)
            await sleep(snatchIntervalRef.current)
            return loop()
          }

          const hit = res.data[0]
          addTaskLog('warn', `[${invCName} ${standard}] 搜到库存！获取详情...`)

          const detailRes = await getOnLineStockDetail({
            InvCode: hit.InvCode, Free1: hit.Free1,
            Free2: hit.Free2, Free3: hit.Free3, WhCode: hit.WhCode,
          })

          const dataArr = Array.isArray(detailRes.data)
            ? detailRes.data
            : detailRes.data ? [detailRes.data] : []

          if (!detailRes.result || dataArr.length === 0) {
            addTaskLog('error', `[${invCName} ${standard}] 获取详情失败，重试`)
            await sleep(snatchIntervalRef.current)
            return loop()
          }

          const detail = dataArr[0]
          cachedHit = {
            key: String(hit.AutoID),
            InvCode: detail.InvCode, InvName: detail.InvName,
            OnLineInvName: detail.OnLineInvName,
            InvCName: hit.InvCName ?? '',
            InvStd: detail.InvStd ?? `${detail.Standard}*${detail.Wallthickness}`,
            Standard: detail.Standard,
            Wallthickness: String(detail.Wallthickness),
            Brand: '', WhCode: detail.WhCode, WhName: detail.WhName,
            Free1: detail.Free1, Free2: detail.Free2, Free3: detail.Free3,
            UPrice1: detail.UPrice1, Num: detail.Num, STNum: detail.STNum,
            NumWeight: detail.NumWeight,
            OnLinePackCount: detail.OnLinePackCount ?? '1',
            userNum, remark,
          }
          updateTask(taskId, (t) => ({
            ...t,
            hitItems: { ...t.hitItems, [id]: cachedHit },
          }))
        } catch (e) {
          console.error('AutoSnatch search error', e)
          addTaskLog('error', `[${invCName} ${standard}] 搜索请求异常，等待重试`)
          cachedHit = null
          await sleep(snatchIntervalRef.current)
          return loop()
        }
      }

      if (!cachedHit) return loop()

      setTaskTargetStatus('placing')
      addTaskLog('warn', `[${invCName} ${standard}] 尝试下单...`)

      try {
        const payload = buildOrderPayload([cachedHit], memo)
        const res = await createDeliveryApply(payload)

        if (res.result) {
          setTaskTargetStatus('success')
          addTaskLog('success', `[${invCName} ${standard}] 抢单成功！`)
          messageApi.success(`${invCName} ${standard} 抢单成功！`)
          return
        }

        if (res.errtype === '1') {
          addTaskLog('info', `[${invCName} ${standard}] 未到下单时间（${res.errtext ?? ''}），保留缓存等待重试`)
          await sleep(snatchIntervalRef.current)
          return loop()
        }

        addTaskLog('error', `[${invCName} ${standard}] 下单失败：${res.errtext ?? '未知错误'}`)
        cachedHit = null
        setTaskTargetStatus('failed')
      } catch (e) {
        console.error('AutoSnatch place error', e)
        addTaskLog('error', `[${invCName} ${standard}] 下单请求异常，清除缓存等待重试`)
        cachedHit = null
        await sleep(snatchIntervalRef.current)
        return loop()
      }
    }

    await loop()
  }, [updateTask, messageApi])

  // ── 发起新任务 ─────────────────────────────────────────────────────────
  const handleStartTask = useCallback(() => {
    if (pendingTargets.length === 0) {
      messageApi.warning('请先添加待抢规格')
      return
    }
    if (runningTaskIds.size >= 3) {
      messageApi.warning('最多同时运行 3 个任务')
      return
    }

    const taskId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const taskNo = ++taskNoCounterRef.current
    const snapshot = JSON.parse(JSON.stringify(pendingTargets)) as AutoSnatchTarget[]
    const initStatuses: Record<string, AutoSnatchStatus> = {}
    snapshot.forEach((t) => { initStatuses[t.id] = 'idle' })

    const newTask: AutoSnatchTask = {
      id: taskId,
      taskNo,
      startTime: new Date().toISOString(),
      targetsSnapshot: snapshot,
      memo: orderMemo,
      interval: autoSnatchInterval,
      cusCode: AUTH_CONFIG.CusCode ?? '',
      cusName: AUTH_CONFIG.CusName ?? '',
      status: 'running',
      statuses: initStatuses,
      hitItems: {},
      logs: [],
      searchCount: 0,
    }

    setTasks((prev) => [newTask, ...prev])
    stopRefs.current.set(taskId, false)
    setRunningTaskIds((prev) => new Set([...prev, taskId]))

    // 清空待发起列表
    previewedIds.current.clear()
    setPendingTargets([])
    setPendingStatuses({})
    setPreviewHitItems({})

    snatchIntervalRef.current = autoSnatchInterval
    onSnatchingChange?.(true)

    Promise.allSettled(snapshot.map((t) => runTarget(t, taskId, orderMemo, stopRefs))).then(() => {
      if (!stopRefs.current.get(taskId)) {
        setTasks((prev) => {
          const updated = prev.map((t) =>
            t.id === taskId ? { ...t, status: 'completed' as const, endTime: new Date().toISOString() } : t
          )
          persistTasks(updated)
          return updated
        })
      }
      setRunningTaskIds((prev) => {
        const s = new Set(prev)
        s.delete(taskId)
        if (s.size === 0) onSnatchingChange?.(false)
        return s
      })
      stopRefs.current.delete(taskId)
    })
  }, [pendingTargets, orderMemo, autoSnatchInterval, runTarget, onSnatchingChange, messageApi, runningTaskIds])

  // ── 停止指定任务 ───────────────────────────────────────────────────────
  const handleStopTask = useCallback((taskId: string) => {
    // 只设标志位，不删除——loop 下次检查时会读到 true 然后退出
    // cleanup（delete）统一在 Promise.allSettled().then() 里完成
    stopRefs.current.set(taskId, true)
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, status: 'stopped' as const, endTime: new Date().toISOString() } : t
      )
      persistTasks(updated)
      return updated
    })
    setRunningTaskIds((prev) => {
      const s = new Set(prev)
      s.delete(taskId)
      if (s.size === 0) onSnatchingChange?.(false)
      return s
    })
  }, [onSnatchingChange])

  // ── 恢复已停止任务 ─────────────────────────────────────────────────────
  const handleResumeTask = useCallback((stoppedTask: AutoSnatchTask) => {
    if (runningTaskIds.size >= 3) {
      messageApi.warning('最多同时运行 3 个任务')
      return
    }

    const taskId = stoppedTask.id  // 复用原 taskId，在原任务上继续

    // 跳过已成功的规格，只重跑未完成的
    const targetsToResume = stoppedTask.targetsSnapshot.filter(
      (t) => stoppedTask.statuses[t.id] !== 'success'
    )
    if (targetsToResume.length === 0) {
      messageApi.info('所有规格已抢单成功')
      return
    }

    // 未完成的规格状态重置为 idle
    const resetStatuses = { ...stoppedTask.statuses }
    targetsToResume.forEach((t) => { resetStatuses[t.id] = 'idle' })

    // 原地更新 task 状态
    setTasks((prev) => prev.map((t) =>
      t.id === taskId
        ? { ...t, status: 'running' as const, interval: stoppedTask.interval, statuses: resetStatuses, endTime: undefined }
        : t
    ))
    stopRefs.current.set(taskId, false)
    setRunningTaskIds((prev) => new Set([...prev, taskId]))

    snatchIntervalRef.current = stoppedTask.interval
    onSnatchingChange?.(true)

    Promise.allSettled(targetsToResume.map((t) => runTarget(t, taskId, stoppedTask.memo, stopRefs))).then(() => {
      if (!stopRefs.current.get(taskId)) {
        setTasks((prev) => {
          const updated = prev.map((t) =>
            t.id === taskId ? { ...t, status: 'completed' as const, endTime: new Date().toISOString() } : t
          )
          persistTasks(updated)
          return updated
        })
      }
      setRunningTaskIds((prev) => {
        const s = new Set(prev)
        s.delete(taskId)
        if (s.size === 0) onSnatchingChange?.(false)
        return s
      })
      stopRefs.current.delete(taskId)
    })
  }, [runningTaskIds, runTarget, onSnatchingChange, messageApi])

  // ── 删除单个已停止任务 ──────────────────────────────────────────────────
  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks((prev) => {
      const updated = prev.filter((t) => t.id !== taskId)
      persistTasks(updated)
      return updated
    })
  }, [])

  // ── 删除全部已停止任务 ──────────────────────────────────────────────────
  const handleDeleteAllStopped = useCallback(() => {
    setTasks((prev) => {
      const updated = prev.filter((t) => t.status !== 'stopped')
      persistTasks(updated)
      return updated
    })
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {contextHolder}

      {/* ── 左侧 480px ──────────────────────────────────────────────── */}
      <div
        style={{
          width: 480,
          flexShrink: 0,
          borderRight: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 客户选择 */}
        <div style={{ flexShrink: 0, padding: '10px 16px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>客户</Text>
          <Select
            placeholder="选择客户"
            style={{ width: '100%' }}
            value={selectedCusCode || undefined}
            onChange={handleCusChange}
            loading={customerLoading}
            showSearch
            optionFilterProp="label"
            options={customerList.map((c) => ({ value: c.CusCode, label: c.CusName || c.CusCode }))}
          />
        </div>

        {/* 添加规格表单 */}
        <div style={{ flexShrink: 0, padding: '10px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          {/* 第一行：品种 + 规格 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>品种</Text>
              <Select
                placeholder="选择品种"
                value={formClass || undefined}
                onChange={(v) => { setFormClass(v); setFormStd(''); setFormWt(null); setWtInputVal('') }}
                style={{ width: '100%' }}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                disabled={!selectedCusCode}
                options={classList.map((c) => ({ label: c.InvCName, value: c.InvCName }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>规格</Text>
              <Select
                placeholder="选择规格"
                value={formStd || undefined}
                onChange={(v) => { setFormStd(v); setFormWt(null); setWtInputVal('') }}
                style={{ width: '100%' }}
                disabled={!formClass}
                showSearch
                options={standards.map((s) => ({ label: s, value: s }))}
              />
            </div>
          </div>
          {/* 第二行：壁厚 + 件数 + 备注 + 添加 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 110px' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>壁厚</Text>
              <Select
                showSearch allowClear
                placeholder="可选"
                value={formWt ?? undefined}
                onChange={(v) => { setFormWt(v != null ? String(v) : null); setWtInputVal('') }}
                onSearch={setWtInputVal}
                filterOption={false}
                options={wtSelectOptions}
                disabled={!formStd}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: '0 0 80px' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>件数</Text>
              <InputNumber
                placeholder="件数"
                value={formNum}
                onChange={(v) => setFormNum(v ?? 1)}
                style={{ width: '100%' }}
                min={1}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>行备注</Text>
              <Input
                placeholder="可选"
                value={formRemark}
                onChange={(e) => setFormRemark(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddTarget}
            >
              添加
            </Button>
          </div>
        </div>

        {/* 待发起规格列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {pendingTargets.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', paddingTop: 40 }}>
              添加规格后点击"发起任务"
            </div>
          ) : (
            pendingTargets.map((t) => (
              <PendingTargetCard
                key={t.id}
                target={t}
                status={pendingStatuses[t.id] ?? 'idle'}
                hitItem={previewHitItems[t.id]}
                hasSearched={t.id in previewHitItems}
                onRemove={handleRemovePending}
                onUpdateNum={handleUpdatePendingNum}
              />
            ))
          )}
        </div>

        {/* 左侧底部：整单备注 + 间隔 + 发起任务 */}
        <div
          style={{
            flexShrink: 0,
            padding: '10px 16px 14px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            {/* 整单备注 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>整单备注</Text>
              <TextArea
                rows={1}
                value={orderMemo}
                onChange={(e) => setOrderMemo(e.target.value)}
                placeholder="整单备注（可选）"
              />
            </div>

            {/* 搜索间隔 */}
            <div style={{ flexShrink: 0 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>间隔</Text>
              <InputNumber
                min={500}
                max={30000}
                step={500}
                value={autoSnatchInterval}
                onChange={(v) => setAutoSnatchInterval(v ?? 2000)}
                style={{ width: 100 }}
                addonAfter="ms"
              />
            </div>

            {/* 发起任务 */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {runningCount > 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>运行中 {runningCount}/3</Text>
              )}
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStartTask}
                disabled={pendingTargets.length === 0 || !canStartNew}
                style={
                  pendingTargets.length === 0 || !canStartNew
                    ? undefined
                    : { background: '#7c3aed', borderColor: '#7c3aed' }
                }
              >
                发起任务
                {pendingTargets.length > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      background: 'rgba(255,255,255,0.25)',
                      borderRadius: 10,
                      padding: '0 6px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {pendingTargets.length}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 右侧 flex:1 ────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 右侧顶部 header bar */}
        <RightPanelHeader
          tasks={tasks}
          onDeleteAllStopped={handleDeleteAllStopped}
        />
        {/* 任务卡片列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
          {tasks.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', paddingTop: 60 }}>
              发起抢单任务后，历史记录将在此处显示
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isRunning={runningTaskIds.has(task.id)}
                onStop={handleStopTask}
                onResume={handleResumeTask}
                onReuseTargets={handleReuseTargets}
                onDelete={handleDeleteTask}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default AutoSnatchPanel
