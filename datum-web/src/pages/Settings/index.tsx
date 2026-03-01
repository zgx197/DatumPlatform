import { Card, Typography, Space, Descriptions } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'

const { Title } = Typography

export default function Settings() {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then(r => r.data),
  })

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Title level={4} style={{ margin: 0 }}>设置</Title>
      <Card title="系统信息" size="small">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="版本">{data?.version ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="数据目录">{data?.dataDir ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="服务地址">http://localhost:7000</Descriptions.Item>
          <Descriptions.Item label="前端版本">React 18 + Vite 6 + Ant Design 5</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  )
}
