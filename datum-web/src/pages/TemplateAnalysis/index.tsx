import { useQuery } from '@tanstack/react-query'
import { List, Card, Tag, Typography, Space, Empty } from 'antd'
import { api } from '../../api/client'

const { Title, Text } = Typography

interface MonsterTemplate {
  clusterKey: string
  foeType: number
  variants: { configId: number; name: string; score: number }[]
}

export default function TemplateAnalysis() {
  const { data: templates = [], isLoading } = useQuery<MonsterTemplate[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then(r => r.data),
  })

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Title level={4} style={{ margin: 0 }}>模板分析</Title>
      {templates.length === 0 && !isLoading ? (
        <Empty description="暂无模板数据，请先在 Unity 中运行模板发现并导出数据" />
      ) : (
        <List
          loading={isLoading}
          grid={{ gutter: 16, column: 2 }}
          dataSource={templates}
          renderItem={tmpl => (
            <List.Item>
              <Card
                size="small"
                title={<Space><Tag>{tmpl.foeType}</Tag><Text code>{tmpl.clusterKey}</Text></Space>}
              >
                <List
                  size="small"
                  dataSource={tmpl.variants}
                  renderItem={v => (
                    <List.Item>
                      <Text>{v.name}</Text>
                      <Text style={{ color: '#4e9af1', marginLeft: 8 }}>{v.score.toFixed(2)}</Text>
                    </List.Item>
                  )}
                />
              </Card>
            </List.Item>
          )}
        />
      )}
    </Space>
  )
}
