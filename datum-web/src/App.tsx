import { App as AntdApp, Button, Layout, Menu, Tooltip, Badge } from 'antd'
import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  DashboardOutlined,
  ExperimentOutlined,
  ApartmentOutlined,
  SettingOutlined,
  BugOutlined,
  EnvironmentOutlined,
  BookOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import * as signalR from '@microsoft/signalr'
import AppRoutes from './routes/AppRoutes'
import UpdateBanner from './components/UpdateBanner'
import DebugPanel, { installGlobalHandlers } from './components/DebugPanel'
import AiChatDrawer from './components/AiChatDrawer'
import { getEffectiveKeys, matchEvent } from './services/shortcuts'
import './App.css'

installGlobalHandlers()

const { Sider, Content, Header } = Layout

const NAV_ITEMS = [
  { key: '/',             icon: <DashboardOutlined />,   label: '评分看板' },
  { key: '/templates',    icon: <ApartmentOutlined />,   label: '模板分析' },
  { key: '/levels',       icon: <EnvironmentOutlined />, label: '关卡视图' },
  { key: '/calibration',  icon: <ExperimentOutlined />,  label: '权重调节' },
  { key: '/health',       icon: <BugOutlined />,         label: '数值健康' },
  { key: '/docs',         icon: <BookOutlined />,         label: '系统文档' },
  { key: '/settings',     icon: <SettingOutlined />,      label: '设置' },
]

function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [collapsed, setCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const { notification: antNotification } = AntdApp.useApp()

  // 全局快捷键注册（从 shortcuts 服务读取当前按键配置）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 如果焦点在输入框内则跳过页面跳转快捷键（但 AI 助手和调试面板仍然生效）
      const tag = (e.target as HTMLElement)?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable

      if (matchEvent(e, getEffectiveKeys('toggle-ai-chat')))    { e.preventDefault(); setChatOpen(p => !p); return }
      if (matchEvent(e, getEffectiveKeys('toggle-debug-panel'))) { e.preventDefault(); setDebugOpen(p => !p); return }
      if (inInput) return
      if (matchEvent(e, getEffectiveKeys('go-dashboard')))   { e.preventDefault(); navigate('/'); return }
      if (matchEvent(e, getEffectiveKeys('go-templates')))   { e.preventDefault(); navigate('/templates'); return }
      if (matchEvent(e, getEffectiveKeys('go-levels')))      { e.preventDefault(); navigate('/levels'); return }
      if (matchEvent(e, getEffectiveKeys('go-calibration'))) { e.preventDefault(); navigate('/calibration'); return }
      if (matchEvent(e, getEffectiveKeys('go-settings')))    { e.preventDefault(); navigate('/settings'); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

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
      queryClient.invalidateQueries({ queryKey: ['levelMetrics'] })
      queryClient.invalidateQueries({ queryKey: ['levelStructures'] })
      antNotification.info({
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
        <div style={{
          position: 'absolute',
          bottom: 48,
          left: 0,
          right: 0,
          padding: collapsed ? '0 8px' : '0 4px',
          borderTop: '1px solid #21262d',
          paddingTop: 8,
        }}>
          {collapsed ? (
            <Tooltip title="调试信息" placement="right">
              <Button
                type="text"
                icon={<BugOutlined />}
                onClick={() => setDebugOpen(true)}
                style={{ color: '#8b949e', width: '100%' }}
              />
            </Tooltip>
          ) : (
            <DebugPanel externalOpen={debugOpen} onExternalClose={() => setDebugOpen(false)} />
          )}
        </div>
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
          <Tooltip title={`AI 助手 (${getEffectiveKeys('toggle-ai-chat')})`}>
            <Button
              icon={<RobotOutlined />}
              onClick={() => setChatOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #1f6feb 0%, #8b5cf6 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                borderRadius: 20,
                padding: '0 16px',
                height: 34,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 0 12px rgba(31,111,235,0.4)',
              }}
            >
              AI 助手
            </Button>
          </Tooltip>
        </Header>
        <AiChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
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
      <AntdApp>
        <AppLayout />
      </AntdApp>
    </BrowserRouter>
  )
}
