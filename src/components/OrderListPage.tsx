import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Spin,
  Alert,
  Tooltip,
  DatePicker,
  Input,
  Statistic,
  Drawer,
  Descriptions,
  Divider,
  Select,
  Popconfirm,
  message,
  Grid,
} from 'antd'
import { ReloadOutlined, SearchOutlined, FileTextOutlined, StopOutlined, EditOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { OrderListItem, DeliveryApplyLineItem } from '../types'
import { fetchOrderList, fetchOrderCount, closeOrder } from '../api/orderList'
import EditOrderModal from './EditOrderModal'
import dayjs from 'dayjs'

const { Text } = Typography
const { RangePicker } = DatePicker

const STATUS_COLOR: Record<string, string> = {
  已关闭: 'default',
  已确认发货: 'success',
  待审核: 'processing',
  已审核: 'blue',
  已删除: 'error',
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: '01', label: '待审核' },
  { value: '02', label: '已审核' },
  { value: '03', label: '已确认发货' },
  { value: '04', label: '已关闭' },
  { value: '05', label: '已删除' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const LINE_COLUMNS: ColumnsType<DeliveryApplyLineItem> = [
  { title: '货名', dataIndex: 'InvName', width: 90, ellipsis: true },
  { title: '规格', dataIndex: 'InvStd', ellipsis: true },
  { title: '品种', dataIndex: 'InventoryClass', width: 100, ellipsis: true },
  { title: '件数', dataIndex: 'Num', width: 60, align: 'right' },
  {
    title: '重量(吨)',
    dataIndex: 'Quantity',
    width: 90,
    align: 'right',
    render: (v: number) => v.toFixed(3),
  },
  {
    title: '单价(元/吨)',
    dataIndex: 'Price',
    width: 100,
    align: 'right',
    render: (v: number) => v.toLocaleString(),
  },
  {
    title: '金额(元)',
    dataIndex: 'Money',
    width: 120,
    align: 'right',
    render: (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
  },
  { title: '备注', dataIndex: 'Memo', width: 100, ellipsis: true },
]

export default function OrderListPage({ refreshKey }: { refreshKey?: number }) {
  const screens = Grid.useBreakpoint()
  const [data, setData] = useState<OrderListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [maker, setMaker] = useState('')
  const [status, setStatus] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])

  const [drawerRecord, setDrawerRecord] = useState<OrderListItem | null>(null)
  const [editRecord, setEditRecord] = useState<OrderListItem | null>(null)

  const load = useCallback(
    async (
      currentPage: number,
      makerVal: string,
      statusVal: string,
      range: [dayjs.Dayjs | null, dayjs.Dayjs | null],
      pageSizeVal: number
    ) => {
      setLoading(true)
      setError(null)
      try {
        const queryParams = {
          fistResult: (currentPage - 1) * pageSizeVal,
          maxResult: pageSizeVal,
          Maker: makerVal,
          Status: statusVal,
          beginDate: range[0] ? range[0].format('YYYY-MM-DD') : '',
          endDate: range[1] ? range[1].format('YYYY-MM-DD') : '',
        }
        const [res, count] = await Promise.all([
          fetchOrderList(queryParams),
          fetchOrderCount(queryParams),
        ])
        if (!res.result) {
          setError(res.errtext ?? '请求失败')
          setData([])
        } else {
          setData(res.data ?? [])
          setTotal(count)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '网络错误')
        setData([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // 初次挂载（refreshKey=0）及切换到本页时（refreshKey 递增）均触发一次加载
  useEffect(() => {
    setMaker('')
    setStatus('')
    setDateRange([null, null])
    setPage(1)
    load(1, '', '', [null, null], pageSize)
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setPage(1)
    load(1, maker, status, dateRange, pageSize)
  }

  const handleReset = () => {
    setMaker('')
    setStatus('')
    setDateRange([null, null])
    setPage(1)
    load(1, '', '', [null, null], 20)
  }

  const handleClose = async (id: number) => {
    try {
      const res = await closeOrder(id)
      if (res.result) {
        message.success('订单已关闭')
        load(page, maker, status, dateRange, pageSize)
      } else {
        message.error(res.errtext ?? '关闭失败')
      }
    } catch {
      message.error('网络错误，关闭失败')
    }
  }

  const totalMoney = data.reduce((s, r) => s + r.SumMoney, 0)
  const totalQty = data.reduce((s, r) => s + r.SumQuantity, 0)

  const columns: ColumnsType<OrderListItem> = [
    {
      title: '#',
      key: 'index',
      width: 48,
      align: 'center',
      render: (_: unknown, __: OrderListItem, index: number) =>
        (page - 1) * pageSize + index + 1,
    },
    {
      title: '单号',
      dataIndex: 'VouchCode',
      width: 130,
      render: (v: string) => <Text copyable style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: '日期',
      dataIndex: 'VouchDate',
      width: 100,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    { title: '客户', dataIndex: 'CusName', ellipsis: true },
    { title: '制单人', dataIndex: 'Maker', width: 80 },
    {
      title: '制单时间',
      dataIndex: 'MakeTime',
      width: 145,
      render: (v: string) => dayjs(v).format('MM-DD HH:mm:ss'),
    },
    { title: '件数', dataIndex: 'SumNum', width: 60, align: 'right' },
    {
      title: '总重(吨)',
      dataIndex: 'SumQuantity',
      width: 90,
      align: 'right',
      render: (v: number) => v.toFixed(3),
    },
    {
      title: '总金额(元)',
      dataIndex: 'SumMoney',
      width: 130,
      align: 'right',
      render: (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    {
      title: '状态',
      dataIndex: 'DeliveryStatus',
      width: 110,
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    { title: '备注', dataIndex: 'Memo', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 130,
      align: 'center',
      render: (_: unknown, record: OrderListItem) => {
        const closed = record.DeliveryStatus === '已关闭' || record.DeliveryStatus === '已删除'
        return (
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            <Tooltip title="查看明细">
              <Button
                type="text"
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => setDrawerRecord(record)}
              />
            </Tooltip>
            <Tooltip title={closed ? '已关闭，不可编辑' : '修改订单'}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                disabled={closed}
                onClick={() => setEditRecord(record)}
              />
            </Tooltip>
            <Popconfirm
              title="确认关闭此订单？"
              description="关闭后不可恢复，请谨慎操作。"
              icon={<ExclamationCircleFilled style={{ color: '#faad14' }} />}
              okText="确认关闭"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={closed}
              onConfirm={() => handleClose(record.ID)}
            >
              <Tooltip title={closed ? '已关闭' : '关闭订单'}>
                <Button
                  type="text"
                  size="small"
                  danger={!closed}
                  disabled={closed}
                  icon={<StopOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: screens.sm ? '16px 16px 0' : '10px 10px 0', overflow: 'hidden' }}>
      {/* 筛选栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          flexWrap: 'wrap',
          rowGap: 8,
          flexShrink: 0,
          paddingBottom: 14,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 120 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>制单人</Text>
          <Input
            placeholder="输入制单人"
            value={maker}
            onChange={(e) => setMaker(e.target.value)}
            style={{ width: '100%' }}
            allowClear
            onPressEnter={handleSearch}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 120 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>状态</Text>
          <Select
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px', minWidth: 170 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>日期范围</Text>
          <RangePicker
            value={dateRange}
            onChange={(v) => setDateRange(v ?? [null, null])}
            style={{ width: '100%' }}
            placeholder={['开始日期', '结束日期']}
          />
        </div>

        <Space size={8}>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
          <Button onClick={handleReset}>重置</Button>
          <Tooltip title="刷新">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => load(page, maker, status, dateRange, pageSize)}
              loading={loading}
            />
          </Tooltip>
        </Space>

        {data.length > 0 && (
          <div style={{ marginLeft: screens.md ? 'auto' : 0, display: 'flex', gap: screens.sm ? 24 : 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Statistic
              title="本页总重(吨)"
              value={totalQty.toFixed(3)}
              valueStyle={{ fontSize: 14 }}
            />
            <Statistic
              title="本页总金额(元)"
              value={totalMoney.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              valueStyle={{ fontSize: 14, color: '#1677ff' }}
            />
          </div>
        )}
      </div>

      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} closable />
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Spin spinning={loading}>
          <Table
            rowKey="ID"
            columns={columns}
            dataSource={data}
            onRow={(record) => ({
              onClick: () => setDrawerRecord(record),
              style: { cursor: 'pointer' },
            })}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (p, ps) => {
                setPage(p)
                setPageSize(ps)
                load(p, maker, status, dateRange, ps)
              },
              showSizeChanger: true,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              showTotal: (t) => `共 ${t} 条`,
            }}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        </Spin>
      </div>

      {/* 订单明细 Drawer */}
      <Drawer
        title={
          drawerRecord ? (
            <Space>
              <Text strong>{drawerRecord.VouchCode}</Text>
              <Tag color={STATUS_COLOR[drawerRecord.DeliveryStatus] ?? 'default'}>
                {drawerRecord.DeliveryStatus}
              </Tag>
            </Space>
          ) : null
        }
        placement="right"
        width={screens.lg ? 780 : 'min(780px, calc(100vw - 16px))'}
        open={drawerRecord !== null}
        onClose={() => setDrawerRecord(null)}
        styles={{ body: { padding: screens.sm ? '16px 24px' : '12px 12px' } }}
      >
        {drawerRecord && (
          <>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="客户">{drawerRecord.CusName}</Descriptions.Item>
              <Descriptions.Item label="是否自提">
                {drawerRecord.SelfPick ? '是' : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="制单人">{drawerRecord.Maker}</Descriptions.Item>
              <Descriptions.Item label="制单时间">
                {dayjs(drawerRecord.MakeTime).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="件数">{drawerRecord.SumNum} 件</Descriptions.Item>
              <Descriptions.Item label="总重量">{drawerRecord.SumQuantity.toFixed(3)} 吨</Descriptions.Item>
              <Descriptions.Item label="金额" span={2}>
                <Text style={{ color: '#1677ff', fontWeight: 600 }}>
                  ¥ {drawerRecord.SumMoney.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </Text>
              </Descriptions.Item>
              {(drawerRecord.ReceiveProvince || drawerRecord.ReceiveCity || drawerRecord.ReceiveDistrict) && (
                <Descriptions.Item label="发货地区">
                  {[drawerRecord.ReceiveProvince, drawerRecord.ReceiveCity, drawerRecord.ReceiveDistrict]
                    .filter(Boolean)
                    .join(' ')}
                </Descriptions.Item>
              )}
              {drawerRecord.RecvAddress && (
                <Descriptions.Item label="详细地址">{drawerRecord.RecvAddress}</Descriptions.Item>
              )}
              {drawerRecord.TimeOut && (
                <Descriptions.Item label="到期时间">
                  {dayjs(drawerRecord.TimeOut).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {drawerRecord.Verifier && (
                <Descriptions.Item label="审核人">{drawerRecord.Verifier}</Descriptions.Item>
              )}
              {drawerRecord.VerifyTime && (
                <Descriptions.Item label="审核时间">
                  {dayjs(drawerRecord.VerifyTime).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {drawerRecord.CloseTime && (
                <Descriptions.Item label="关闭时间">
                  {dayjs(drawerRecord.CloseTime).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {drawerRecord.CloseMemo && (
                <Descriptions.Item label="关闭原因">{drawerRecord.CloseMemo}</Descriptions.Item>
              )}
              {drawerRecord.Memo && (
                <Descriptions.Item label="备注" span={2}>{drawerRecord.Memo}</Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left" plain style={{ marginTop: 20 }}>
              货物明细（{drawerRecord.DeliveryApplysList.length} 项）
            </Divider>

            <Table
              rowKey="AutoID"
              columns={LINE_COLUMNS}
              dataSource={drawerRecord.DeliveryApplysList}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              summary={(rows) => {
                const totalQtySum = rows.reduce((s, r) => s + r.Quantity, 0)
                const totalMoneySum = rows.reduce((s, r) => s + r.Money, 0)
                return (
                  <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                    <Table.Summary.Cell index={0} colSpan={3}>合计</Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      {rows.reduce((s, r) => s + r.Num, 0)}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      {totalQtySum.toFixed(3)}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} />
                    <Table.Summary.Cell index={6} align="right">
                      {totalMoneySum.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} />
                  </Table.Summary.Row>
                )
              }}
            />
          </>
        )}
      </Drawer>

      <EditOrderModal
        record={editRecord}
        onClose={() => setEditRecord(null)}
        onSuccess={() => load(page, maker, status, dateRange, pageSize)}
      />
    </div>
  )
}
