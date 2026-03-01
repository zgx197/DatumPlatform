import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Tooltip, Space, Typography, Statistic, Row, Col, Card } from 'antd'
import ReactECharts from 'echarts-for-react'
import { api } from '../../api/client'

const { Title } = Typography

interface EntityScore {
  configId: number
  name: string
  foeType: number
  barriesId: number
  overallScore: number
  ehpScore: number
  dpsScore: number
  controlScore: number
}

export default function ScoreDashboard() {
  const { data: scores = [], isLoading } = useQuery<EntityScore[]>({
    queryKey: ['scores'],
    queryFn: () => api.get('/scores').then(r => r.data),
  })

  const scatterOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.data[2]}<br/>EHP: ${p.data[0].toFixed(2)} | DPS: ${p.data[1].toFixed(2)}` },
    xAxis: { name: 'EHP 评分', nameLocation: 'middle', nameGap: 30, splitLine: { lineStyle: { color: '#21262d' } } },
    yAxis: { name: 'DPS 评分', nameLocation: 'middle', nameGap: 40, splitLine: { lineStyle: { color: '#21262d' } } },
    series: [{
      type: 'scatter',
      data: scores.map(s => [s.ehpScore, s.dpsScore, s.name, s.overallScore]),
      symbolSize: (d: number[]) => Math.max(6, d[3] * 2),
      itemStyle: { color: '#4e9af1', opacity: 0.8 },
      emphasis: { itemStyle: { color: '#f1c04e' } },
    }],
  }

  const columns = [
    { title: 'ID', dataIndex: 'configId', width: 70 },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    { title: '类型', dataIndex: 'foeType', width: 70, render: (v: number) => <Tag>{v}</Tag> },
    { title: '关卡', dataIndex: 'barriesId', width: 70 },
    {
      title: '综合评分', dataIndex: 'overallScore', width: 100, defaultSortOrder: 'descend' as const,
      sorter: (a: EntityScore, b: EntityScore) => a.overallScore - b.overallScore,
      render: (v: number) => <span style={{ color: '#4e9af1', fontWeight: 600 }}>{v.toFixed(2)}</span>,
    },
    { title: 'EHP', dataIndex: 'ehpScore', width: 80, sorter: (a: EntityScore, b: EntityScore) => a.ehpScore - b.ehpScore, render: (v: number) => v.toFixed(2) },
    { title: 'DPS', dataIndex: 'dpsScore', width: 80, sorter: (a: EntityScore, b: EntityScore) => a.dpsScore - b.dpsScore, render: (v: number) => v.toFixed(2) },
    { title: '控制', dataIndex: 'controlScore', width: 80, sorter: (a: EntityScore, b: EntityScore) => a.controlScore - b.controlScore, render: (v: number) => v.toFixed(2) },
  ]

  const avg = scores.length > 0 ? scores.reduce((s, r) => s + r.overallScore, 0) / scores.length : 0
  const max = scores.length > 0 ? Math.max(...scores.map(s => s.overallScore)) : 0

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Title level={4} style={{ margin: 0 }}>评分看板</Title>

      <Row gutter={16}>
        <Col span={6}><Card size="small"><Statistic title="怪物总数" value={scores.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="平均评分" value={avg.toFixed(2)} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="最高评分" value={max.toFixed(2)} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="关卡数量" value={new Set(scores.map(s => s.barriesId)).size} /></Card></Col>
      </Row>

      <Card title="EHP vs DPS 分布" size="small">
        <ReactECharts option={scatterOption} style={{ height: 300 }} />
      </Card>

      <Card size="small">
        <Table
          rowKey="configId"
          dataSource={scores}
          columns={columns}
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
          scroll={{ x: 600 }}
        />
      </Card>
    </Space>
  )
}
