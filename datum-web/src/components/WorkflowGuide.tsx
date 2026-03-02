import { Card, Steps, Typography, Space, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  BugOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'

const { Text } = Typography

const STEPS = [
  {
    icon: <BugOutlined style={{ color: '#f1c04e' }} />,
    title: '① 数值健康',
    path: '/health',
    tag: { label: '先看这里', color: 'gold' },
    desc: '整体有没有明显异常？模板一致性有没有问题？',
  },
  {
    icon: <DashboardOutlined style={{ color: '#4e9af1' }} />,
    title: '② 评分看板',
    path: '/',
    tag: { label: '找可疑怪物', color: 'blue' },
    desc: '⚠ 标记表示异常——DPS 为 0、能力悬殊 10x、控制满值等',
  },
  {
    icon: <ExperimentOutlined style={{ color: '#7ec94e' }} />,
    title: '③ 权重调节',
    path: '/calibration',
    tag: { label: '调到符合直觉', color: 'green' },
    desc: '移动滑块预览效果；添加主观评分样本后用一键校准自动求解',
  },
  {
    icon: <EnvironmentOutlined style={{ color: '#f1924e' }} />,
    title: '④ 关卡视图',
    path: '/levels',
    tag: { label: '验证关卡节奏', color: 'orange' },
    desc: '看难度曲线——哪个波次压力最大？节奏是否均匀？',
  },
]

export default function WorkflowGuide({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()

  return (
    <Card
      size="small"
      title={
        <Space>
          <span>📋 使用流程</span>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            第一次使用？按照以下步骤快速上手
          </Text>
        </Space>
      }
      extra={
        onClose && (
          <Text
            type="secondary"
            style={{ fontSize: 12, cursor: 'pointer' }}
            onClick={onClose}
          >
            收起
          </Text>
        )
      }
      style={{ marginBottom: 12 }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STEPS.map((step, i) => (
          <div
            key={i}
            onClick={() => navigate(step.path)}
            style={{
              flex: '1 1 180px',
              minWidth: 160,
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: 8,
              padding: '10px 12px',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#4e9af1')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#21262d')}
          >
            <Space size={6} style={{ marginBottom: 4 }}>
              {step.icon}
              <Text style={{ fontWeight: 600, fontSize: 13 }}>{step.title}</Text>
              <Tag color={step.tag.color} style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                {step.tag.label}
              </Tag>
            </Space>
            <div>
              <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.5 }}>
                {step.desc}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
