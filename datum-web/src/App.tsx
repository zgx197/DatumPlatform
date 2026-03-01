import { Layout, Menu, notification } from 'antd'
import { useState, useEffect } from 'react'
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  DashboardOutlined,
  ExperimentOutlined,
  ApartmentOutlined,
  SettingOutlined,
  BugOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import * as signalR from '@microsoft/signalr'
import AppRoutes from './routes/AppRoutes'
import UpdateBanner from './components/UpdateBanner'
import './App.css'

const { Sider, Content, Header } = Layout

const NAV_ITEMS = [
  { key: '/',             icon: <DashboardOutlined />,   label: '评分看板' },
  { key: '/templates',    icon: <ApartmentOutlined />,   label: '模板分析' },
  { key: '/levels',       icon: <EnvironmentOutlined />, label: '关卡视图' },
  { key: '/calibration',  icon: <ExperimentOutlined />,  label: '权重调节' },
  { key: '/health',       icon: <BugOutlined />,         label: '数值健康' },
  { key: '/settings',     icon: <SettingOutlined />,      label: '设置' },
]

function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [collapsed, setCollapsed] = useState(false)

  // SignalR 实时数据更新：文件变更后自动刷新所有查询
  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/datum')
      .withAutomaticReconnect()
      .build()

    connection.on('DataUpdated', () => {
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['weights'] })
      notification.info({
        message: '数据已自动更新',
        description: 'datum_export/ 文件变更，评分已重新计算。',
        duration: 4,
        placement: 'bottomRight',
      })
    })

    connection.start().catch(() => {
      // 开发期后端未启动时静默忽略
    })

    return () => { connection.stop() }
  }, [queryClient])

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: '#0d1117', borderRight: '1px solid #21262d' }}
      >
        <div style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          color: '#4e9af1',
          fontWeight: 700,
          fontSize: collapsed ? 18 : 16,
          letterSpacing: 1,
          borderBottom: '1px solid #21262d',
        }}>
          {collapsed ? 'D' : '⚡ Datum'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ background: '#0d1117', border: 'none', marginTop: 8 }}
          items={NAV_ITEMS.map(item => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            onClick: () => navigate(item.key),
          }))}
        />
      </Sider>

      <Layout style={{ background: '#0d1117' }}>
        <Header style={{
          background: '#161b22',
          padding: '0 20px',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <UpdateBanner />
        </Header>
        <Content style={{ overflow: 'auto', padding: 24 }}>
          <AppRoutes />
        </Content>
      </Layout>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
