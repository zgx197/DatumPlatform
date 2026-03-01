import { useQuery } from '@tanstack/react-query'
import { Card, Alert, Space, Typography, Statistic, Row, Col } from 'antd'
import { api } from '../../api/client'

const { Title } = Typography

interface HealthInfo {
  status: string
  version: string
  monsterCount: number
  scoreCount: number
  dataDir: string
  serverTime: string
}

export default function HealthReport() {
  const { data } = useQuery<HealthInfo>({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then(r => r.data),
    refetchInterval: 30000,
  })

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Title level={4} style={{ margin: 0 }}>数值健康报告</Title>

      {data && (
        <>
          <Alert
            type={data.status === 'ok' ? 'success' : 'error'}
            message={`服务状态：${data.status === 'ok' ? '正常' : '异常'}`}
            description={`数据目录：${data.dataDir}`}
          />
          <Row gutter={16}>
            <Col span={6}><Card size="small"><Statistic title="版本" value={data.version} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="怪物数量" value={data.monsterCount} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="评分数量" value={data.scoreCount} /></Card></Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="服务时间" value={new Date(data.serverTime).toLocaleString('zh-CN')} />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Space>
  )
}
