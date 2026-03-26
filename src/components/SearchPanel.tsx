import React, { useState, useEffect, useCallback } from 'react'
import {
  Select,
  Button,
  Table,
  message,
  Space,
  Typography,
  Spin,
} from 'antd'
import { SearchOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getCustomerList, getInventoryClassList, getOnLineStockList, getOnLineStockDetail } from '../api/inventory'
import { setAuthConfig, AUTH_CONFIG } from '../api/client'
import type { CustomerItem, InventoryClass, StockItem, StagingItem } from '../types'

const { Text } = Typography

const CUSTOMER_STORAGE_KEY = 'zdp_last_cus_code'

interface SearchPanelProps {
  onAddToStaging: (item: StagingItem) => void
  stagingKeys: Set<string>
  onCusChange: (cusCode: string, cusName: string) => void
}

const SearchPanel: React.FC<SearchPanelProps> = ({ onAddToStaging, stagingKeys, onCusChange }) => {
  const [messageApi, contextHolder] = message.useMessage()

  // 客户列表
  const [customerList, setCustomerList] = useState<CustomerItem[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [selectedCusCode, setSelectedCusCode] = useState<string>('')

  // 品种列表（接口1数据）
  const [classList, setClassList] = useState<InventoryClass[]>([])
  const [classLoading, setClassLoading] = useState(false)

  // 三级联动选中值
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedStandard, setSelectedStandard] = useState<string>('')
  const [selectedWallThickness, setSelectedWallThickness] = useState<string>('')

  // 当前品种下的规格列表
  const [standards, setStandards] = useState<string[]>([])
  // 从查询结果提取的壁厚列表
  const [wallThicknesses, setWallThicknesses] = useState<string[]>([])

  // 查询结果
  const [stockList, setStockList] = useState<StockItem[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // 加入暂存中（loading 状态，key 为 AutoID）
  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set())

  // 加载客户列表（进入页面自动执行）
  useEffect(() => {
    setCustomerLoading(true)
    getCustomerList()
      .then((res) => {
        if (res.result && res.data.length > 0) {
          setCustomerList(res.data)
          // 优先恢复上次选择，否则选第一个
          const stored = localStorage.getItem(CUSTOMER_STORAGE_KEY)
          const found = stored ? res.data.find((c) => c.CusCode === stored) : null
          const target = found ?? res.data[0]
          setSelectedCusCode(target.CusCode)
          setAuthConfig({ ...AUTH_CONFIG, CusCode: target.CusCode, CusName: target.CusName })
          onCusChange(target.CusCode, target.CusName)
        } else {
          messageApi.warning('未查询到可用客户，请联系管理员')
        }
      })
      .catch(() => messageApi.error('网络错误，获取客户列表失败'))
      .finally(() => setCustomerLoading(false))
  }, [messageApi])

  // 客户变更
  const handleCusChange = (value: string) => {
    const customer = customerList.find((c) => c.CusCode === value)
    if (!customer) return
    setSelectedCusCode(value)
    localStorage.setItem(CUSTOMER_STORAGE_KEY, value)
    setAuthConfig({ ...AUTH_CONFIG, CusCode: customer.CusCode, CusName: customer.CusName })
    onCusChange(customer.CusCode, customer.CusName)
    // 重置下游
    setSelectedClass('')
    setSelectedStandard('')
    setSelectedWallThickness('')
    setWallThicknesses([])
    setStockList([])
    setHasSearched(false)
  }

  // 加载品种列表
  useEffect(() => {
    setClassLoading(true)
    getInventoryClassList()
      .then((res) => {
        if (res.result) {
          setClassList(res.data)
        } else {
          messageApi.error('获取品种列表失败')
        }
      })
      .catch(() => messageApi.error('网络错误，获取品种列表失败'))
      .finally(() => setClassLoading(false))
  }, [messageApi])

  // 品种变更：更新规格列表，重置下游
  const handleClassChange = (value: string) => {
    setSelectedClass(value)
    setSelectedStandard('')
    setSelectedWallThickness('')
    setWallThicknesses([])
    setStockList([])
    setHasSearched(false)

    const found = classList.find((c) => c.InvCName === value)
    if (found) {
      const stdList = found.OnLienInventoryClassItem.map((i) => i.Standard)
      setStandards(stdList)
    } else {
      setStandards([])
    }
  }

  // 规格变更：重置壁厚和结果，自动查询拉取壁厚选项
  const handleStandardChange = (value: string) => {
    setSelectedStandard(value)
    setSelectedWallThickness('')
    setWallThicknesses([])
    setStockList([])
    setHasSearched(false)

    if (!selectedClass || !value) return

    setSearching(true)
    setHasSearched(true)
    getOnLineStockList(selectedClass, value)
      .then((res) => {
        if (res.result) {
          const data = Array.isArray(res.data) ? res.data : []
          setStockList(data)
          const wts = [...new Set(data.map((item) => String(item.Wallthickness)).filter(Boolean))].sort()
          setWallThicknesses(wts)
        } else {
          messageApi.error('查询库存失败，请检查认证信息')
        }
      })
      .catch((e) => { console.error('查询库存失败', e); messageApi.error('查询库存失败') })
      .finally(() => setSearching(false))
  }

  // 壁厚变更：自动重新查询
  const handleWallThicknessChange = useCallback(
    (value: string) => {
      setSelectedWallThickness(value)
      if (selectedClass && selectedStandard) {
        setSearching(true)
        getOnLineStockList(selectedClass, selectedStandard, value || undefined)
          .then((res) => {
            if (res.result) {
              const data = Array.isArray(res.data) ? res.data : []
              setStockList(data)
            } else {
              messageApi.error('查询库存失败')
            }
          })
          .catch((e) => { console.error('查询库存失败', e); messageApi.error('查询库存失败') })
          .finally(() => setSearching(false))
      }
    },
    [selectedClass, selectedStandard, messageApi]
  )

  // 点击"查询库存"
  const handleSearch = async () => {
    if (!selectedClass) {
      messageApi.warning('请选择品种')
      return
    }
    if (!selectedStandard) {
      messageApi.warning('请选择规格')
      return
    }

    setSearching(true)
    setHasSearched(true)
    try {
      const res = await getOnLineStockList(
        selectedClass,
        selectedStandard,
        selectedWallThickness || undefined
      )
      if (res.result) {
        const data = Array.isArray(res.data) ? res.data : []
        setStockList(data)
        if (!selectedWallThickness) {
          const wts = [...new Set(data.map((item) => String(item.Wallthickness)).filter(Boolean))].sort()
          setWallThicknesses(wts)
        }
      } else {
        messageApi.error('查询库存失败，请检查认证信息')
        setStockList([])
      }
    } catch (e) {
      console.error('查询库存失败', e)
      messageApi.error('查询库存失败')
      setStockList([])
    } finally {
      setSearching(false)
    }
  }

  // 加入暂存区
  const handleAddToStaging = async (record: StockItem) => {
    const key = String(record.AutoID)
    if (stagingKeys.has(key)) {
      messageApi.warning('该货品已在暂存区')
      return
    }

    setAddingKeys((prev) => new Set(prev).add(key))
    try {
      const res = await getOnLineStockDetail({
        InvCode: record.InvCode,
        Free1: record.Free1,
        Free2: record.Free2,
        Free3: record.Free3,
        WhCode: record.WhCode,
      })

      console.log('GetOnLineStockListByInvCode 响应:', res)

      // data 实际为单个对象，统一转为数组
      const dataArr = Array.isArray(res.data)
        ? res.data
        : res.data
        ? [res.data]
        : []

      if (res.result && dataArr.length > 0) {
        const detail = dataArr[0]
        const stagingItem: StagingItem = {
          key,
          InvCode: detail.InvCode,
          InvName: detail.InvName,
          OnLineInvName: detail.OnLineInvName,
          InvCName: record.InvCName ?? '',      // 品种名，从列表行取
          InvStd: detail.InvStd ?? `${detail.Standard}*${detail.Wallthickness}`,
          Standard: detail.Standard,
          Wallthickness: String(detail.Wallthickness),
          Brand: '',
          WhCode: detail.WhCode,
          WhName: detail.WhName,
          Free1: detail.Free1,
          Free2: detail.Free2,
          Free3: detail.Free3,
          UPrice1: detail.UPrice1,
          Num: detail.Num,
          STNum: detail.STNum,
          NumWeight: detail.NumWeight,
          OnLinePackCount: detail.OnLinePackCount ?? '1',
          userNum: 1,
          remark: '',
        }
        onAddToStaging(stagingItem)
        messageApi.success(`${detail.InvName} 已加入暂存区`)
      } else {
        messageApi.error('获取货品详情失败')
      }
    } catch (e) {
      console.error('加入暂存区失败', e)
      messageApi.error('网络错误，加入暂存区失败')
    } finally {
      setAddingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const columns: ColumnsType<StockItem> = [
    {
      title: '货名',
      dataIndex: 'OnLineInvName',
      key: 'OnLineInvName',
      width: 200,
      ellipsis: true,
      render: (text: string, record) => (
        <div>
          <div>{text}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.WhName}
          </Text>
        </div>
      ),
    },
    {
      title: '规格',
      dataIndex: 'Standard',
      key: 'Standard',
      width: 120,
    },
    {
      title: '壁厚',
      dataIndex: 'Wallthickness',
      key: 'Wallthickness',
      width: 70,
    },
    {
      title: '库存(件)',
      dataIndex: 'Num',
      key: 'Num',
      width: 80,
      align: 'right',
    },
    {
      title: '单件重(吨)',
      dataIndex: 'NumWeight',
      key: 'NumWeight',
      width: 90,
      align: 'right',
      render: (v: number) => v?.toFixed(3),
    },
    {
      title: '单价(元/吨)',
      dataIndex: 'UPrice1',
      key: 'UPrice1',
      width: 100,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      align: 'center',
      render: (_: unknown, record) => {
        const key = String(record.AutoID)
        const isInStaging = stagingKeys.has(key)
        const isAdding = addingKeys.has(key)
        return (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            loading={isAdding}
            disabled={isInStaging}
            onClick={() => handleAddToStaging(record)}
          >
            {isInStaging ? '已加入' : '加入'}
          </Button>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {contextHolder}

      {/* 筛选区 */}
      <div style={{ padding: '16px 16px 0', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
        <Space wrap>
          <Select
            placeholder="选择客户"
            style={{ width: 240 }}
            value={selectedCusCode || undefined}
            onChange={handleCusChange}
            loading={customerLoading}
            showSearch
            optionFilterProp="label"
            options={customerList.map((c) => ({
              value: c.CusCode,
              label: c.CusName || c.CusCode,
            }))}
          />

          <Select
            placeholder="选择品种"
            style={{ width: 180 }}
            value={selectedClass || undefined}
            onChange={handleClassChange}
            loading={classLoading}
            showSearch
            optionFilterProp="label"
            disabled={!selectedCusCode}
            options={classList.map((c) => ({ value: c.InvCName, label: c.InvCName }))}
          />

          <Select
            placeholder="选择规格"
            style={{ width: 180 }}
            value={selectedStandard || undefined}
            onChange={handleStandardChange}
            disabled={!selectedCusCode || !selectedClass}
            showSearch
            optionFilterProp="label"
            options={standards.map((s) => ({ value: s, label: s }))}
          />

          <Select
            placeholder="选择壁厚（可选）"
            style={{ width: 160 }}
            value={selectedWallThickness || undefined}
            onChange={handleWallThicknessChange}
            disabled={!selectedCusCode || wallThicknesses.length === 0}
            allowClear
            onClear={() => handleWallThicknessChange('')}
            options={wallThicknesses.map((wt) => ({ value: wt, label: wt }))}
          />

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={searching}
            disabled={!selectedCusCode || !selectedClass || !selectedStandard}
          >
            查询库存
          </Button>
        </Space>
      </div>

      {/* 结果表格 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {searching ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <Spin size="large" tip="查询中..." />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={stockList}
            rowKey={(r) => String(r.AutoID)}
            size="small"
            pagination={{
              pageSize: 20,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
            }}
            locale={{
              emptyText: hasSearched ? '暂无库存数据' : '请选择品种和规格后点击查询',
            }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </div>
    </div>
  )
}

export default SearchPanel
