import { useState, useEffect, useCallback } from 'react'
import { Modal, Typography, Tag, Grid } from 'antd'
import SearchPanel from './SearchPanel'
import StagingPanel from './StagingPanel'
import type { OrderListItem, StagingItem, InventoryClass } from '../types'
import { getInventoryClassList } from '../api/inventory'

const { Text } = Typography

interface EditOrderModalProps {
  record: OrderListItem | null
  onClose: () => void
  onSuccess: () => void
}

/** 将订单行明细转换为暂存区条目 */
function lineItemsToStaging(record: OrderListItem): StagingItem[] {
  return record.DeliveryApplysList.map((line) => {
    const detail = line.DeliveryApplysDetailList[0]
    const numWeight = line.Num > 0 ? line.Quantity / line.Num : 0

    return {
      key: `edit_${line.AutoID}`,
      InvCode: line.InvCode,
      InvName: line.InvName,
      OnLineInvName: `${line.InvName}${line.InvStd}`,
      InvCName: line.InventoryClass,
      InvStd: line.InvStd,
      Standard: line.Standard,
      Wallthickness: line.Wallthickness,
      Brand: line.Brand,
      WhCode: detail?.WhCode ?? '',
      WhName: detail?.WhName ?? '',
      Free1: line.Free1 ?? '',
      Free2: line.Free2 ?? '',
      Free3: line.Free3 ?? '',
      UPrice1: line.Price,
      Num: line.Num,          // 以当前件数作上限，用户可自行调整
      STNum: 0,
      NumWeight: parseFloat(numWeight.toFixed(6)),
      OnLinePackCount: line.PackCount,
      userNum: line.Num,
      remark: line.Memo ?? '',
    }
  })
}

export default function EditOrderModal({ record, onClose, onSuccess }: EditOrderModalProps) {
  const screens = Grid.useBreakpoint()
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([])
  const [classList, setClassList] = useState<InventoryClass[]>([])

  useEffect(() => {
    getInventoryClassList().then((res) => {
      if (res.result) setClassList(res.data)
    }).catch(() => {})
  }, [])

  // 每次打开（record 变化）时重置暂存区
  useEffect(() => {
    if (record) {
      setStagingItems(lineItemsToStaging(record))
    } else {
      setStagingItems([])
    }
  }, [record])

  const stagingKeys = new Set(stagingItems.map((i) => i.key))

  const handleAddToStaging = useCallback((item: StagingItem) => {
    setStagingItems((prev) => {
      if (prev.find((i) => i.key === item.key)) return prev
      return [...prev, item]
    })
  }, [])

  const handleUpdateItem = useCallback((key: string, changes: Partial<StagingItem>) => {
    setStagingItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...changes } : i))
    )
  }, [])

  const handleRemoveItem = useCallback((key: string) => {
    setStagingItems((prev) => prev.filter((i) => i.key !== key))
  }, [])

  const handleClear = useCallback(() => setStagingItems([]), [])

  const handleSuccess = useCallback(() => {
    onSuccess()
    onClose()
  }, [onSuccess, onClose])

  return (
    <Modal
      open={record !== null}
      onCancel={onClose}
      footer={null}
      width={screens.lg ? '90vw' : '96vw'}
      style={{ top: screens.sm ? 16 : 8 }}
      styles={{ body: { height: screens.sm ? 'calc(100dvh - 120px)' : 'calc(100dvh - 72px)', padding: 0, display: 'flex', flexDirection: 'column' } }}
      title={
        record && (
          <span>
            修改订单&nbsp;
            <Text copyable style={{ fontSize: 14, fontWeight: 600 }}>{record.VouchCode}</Text>
            &nbsp;
            <Tag color="blue" style={{ verticalAlign: 'middle' }}>{record.CusName}</Tag>
          </span>
        )
      }
      destroyOnClose
    >
      {record && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', flexDirection: screens.lg ? 'row' : 'column' }}>
          {/* 左：查询新增货品 */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <SearchPanel
              onAddToStaging={handleAddToStaging}
              stagingKeys={stagingKeys}
              onCusChange={() => {}}
              classList={classList}
            />
          </div>

          {/* 右：暂存区（预填当前订单货品） */}
          <div
            style={{
              width: screens.lg ? 'clamp(360px, 33vw, 520px)' : '100%',
              height: screens.lg ? '100%' : '46%',
              minHeight: screens.lg ? 0 : 260,
              flexShrink: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: screens.lg ? '1px solid rgba(0,0,0,0.06)' : 'none',
              borderTop: screens.lg ? 'none' : '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <StagingPanel
              items={stagingItems}
              onUpdateItem={handleUpdateItem}
              onRemoveItem={handleRemoveItem}
              onClear={handleClear}
              orderId={record.ID}
              initialMemo={record.Memo ?? ''}
              onSubmitSuccess={handleSuccess}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
