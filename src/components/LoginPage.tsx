import React, { useState, useEffect } from 'react'
import { Card, Form, Input, Button, message, Typography, Checkbox } from 'antd'
import { LockOutlined, PhoneOutlined } from '@ant-design/icons'
import { loginByPhone, getBase } from '../api/auth'
import { setAuthConfig, saveCredentials, loadCredentials, clearCredentials } from '../api/client'

const { Title, Text } = Typography

interface LoginPageProps {
  onLoginSuccess: () => void
}

interface LoginFormValues {
  phone: string
  password: string
  remember: boolean
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [messageApi, contextHolder] = message.useMessage()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<LoginFormValues>()

  // 初始化时读取已保存的账号密码
  useEffect(() => {
    const cred = loadCredentials()
    if (cred) {
      form.setFieldsValue({ phone: cred.phone, password: cred.password, remember: true })
    } else {
      form.setFieldValue('remember', false)
    }
  }, [form])

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true)
    try {
      const res = await loginByPhone(values.phone, values.password)

      if (res.result && res.wxTokenID) {
        // 根据"记住密码"决定是否保存
        if (values.remember) {
          saveCredentials(values.phone, values.password)
        } else {
          clearCredentials()
        }

        // 获取用户基础信息（UserName）
        let userName = ''
        try {
          const base = await getBase(res.wxTokenID)
          if (base.result && base.data) {
            userName = base.data.ContractName
          }
        } catch { /* 取不到用户名不影响登录 */ }

        setAuthConfig({ WXTokenID: res.wxTokenID, LoginID: res.loginID ?? res.wxTokenID, CusCode: '', CusName: '', UserName: userName })
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
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #eff6ff 0%, #f0f9ff 45%, #f5f3ff 100%)',
        padding: 16,
      }}
    >
      {contextHolder}
      <Card
        style={{ width: 'min(400px, calc(100vw - 32px))', boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)' }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="10" fill="#eff6ff"/>
              <rect x="8" y="17" width="24" height="6" rx="3" fill="#1677ff"/>
              <rect x="8" y="10" width="24" height="4" rx="2" fill="#93c5fd"/>
              <rect x="8" y="26" width="24" height="4" rx="2" fill="#93c5fd"/>
              <circle cx="14" cy="20" r="2.5" fill="#ffffff"/>
              <circle cx="26" cy="20" r="2.5" fill="#ffffff"/>
            </svg>
          </div>
          <Title level={3} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
            ZDP 钢管管理系统
          </Title>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>
            钢管库存查询 · 提货申请系统
          </Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="phone"
            label="手机号"
            style={{ marginBottom: 20 }}
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '请输入有效的 11 位手机号' },
            ]}
          >
            <Input
              prefix={<PhoneOutlined style={{ color: '#9ca3af' }} />}
              placeholder="13xxxxxxxxx"
              size="large"
              maxLength={11}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
            style={{ marginBottom: 20 }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder="请输入密码"
              size="large"
            />
          </Form.Item>

          <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 16 }}>
            <Checkbox>记住密码</Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              style={{ fontWeight: 500, letterSpacing: '0.02em' }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default LoginPage
