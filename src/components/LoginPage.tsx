import React, { useState } from 'react'
import { Card, Form, Input, Button, message, Typography } from 'antd'
import { LockOutlined, PhoneOutlined } from '@ant-design/icons'
import { loginByPhone, getBase } from '../api/auth'
import { setAuthConfig } from '../api/client'

const { Title, Text } = Typography

interface LoginPageProps {
  onLoginSuccess: () => void
}

interface LoginFormValues {
  phone: string
  password: string
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [messageApi, contextHolder] = message.useMessage()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<LoginFormValues>()

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true)
    try {
      const res = await loginByPhone(values.phone, values.password)

      if (res.result && res.wxTokenID) {
        // 获取用户基础信息（UserName）
        let userName = ''
        try {
          const base = await getBase(res.wxTokenID)
          if (base.result && base.data) {
            userName = base.data.ContractName
          }
        } catch { /* 取不到用户名不影响登录 */ }

        setAuthConfig({ WXTokenID: res.wxTokenID, CusCode: '', CusName: '', UserName: userName })
        messageApi.success('登录成功')
        onLoginSuccess()
      } else {
        messageApi.error(res.errtext || '手机号或密码错误')
      }
    } catch (e) {
      console.error(e)
      messageApi.error('网络错误，请检查网络连接')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)',
      }}
    >
      {contextHolder}
      <Card
        style={{ width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Title level={3} style={{ margin: 0, color: '#1677ff' }}>
            ZDP 钢管管理系统
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            请使用手机号登录
          </Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '请输入有效的 11 位手机号' },
            ]}
          >
            <Input
              prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="13xxxxxxxxx"
              size="large"
              maxLength={11}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请输入密码"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 4 }}>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default LoginPage
