import { useQuery } from '@tanstack/react-query'
import { Card, Alert, Space, Typography, Statistic, Row, Col, Table, Tag, Badge, Progress } from 'antd'
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { datumApi } from '../../api/datum'
import type { EntityScore, MonsterTemplate, HealthInfo } from '../../types/datum'
import { FOE_TYPE_LABELS, FOE_TYPE_COLORS } from '../../types/datum'

const { Title, Text } = Typography

function detectOutliers(scores: EntityScore[]): EntityScore[] {
  if (scores.length < 4) return []
  const vals = scores.map(s => s.overallScore).sort((a, b) => a - b)
  const q1 = vals[Math.floor(vals.length * 0.25)]
  const q3 = vals[Math.floor(vals.length * 0.75)]
  const iqr = q3 - q1
  const lo = q1 - 1.5 * iqr
  const hi = q3 + 1.5 * iqr
  return scores.filter(s => s.overallScore < lo || s.overallScore > hi)
}

export default function HealthReport() {
  const { data: health } = useQuery<HealthInfo>({
    queryKey: ['health'],
    queryFn: () => datumApi.health(),
    refetchInterval: 30_000,
  })
  const { data: scores = [] } = useQuery<EntityScore[]>({
    queryKey: ['scores'],
    queryFn: () => datumApi.scores(),
  })
  const { data: templates = [] } = useQuery<MonsterTemplate[]>({
    queryKey: ['templates'],
    queryFn: () => datumApi.templates(),
  })

  const outliers = useMemo(() => detectOutliers(scores), [scores])
  const issueTemplates = useMemo(() => templates.filter(t => t.hasConsistencyIssue), [templates])

  const byType = useMemo(() => {
    const m: Record<number, number[]> = {}
    scores.forEach(s => { (m[s.foeType] ??= []).push(s.overallScore) })
    return Object.entries(m).map(([type, vals]) => ({
      type: Number(type),
      label: FOE_TYPE_LABELS[Number(type)] ?? `类型${type}`,
      count: vals.length,
      avg: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
      max: parseFloat(Math.max(...vals).toFixed(2)),
      min: parseFloat(Math.min(...vals).toFixed(2)),
    }))
  }, [scores])

  const boxOption = useMemo(() => {
    const typeGroups: Record<number, number[]> = {}
    scores.forEach(s => { (typeGroups[s.foeType] ??= []).push(s.overallScore) })
    const types = Object.keys(typeGroups).map(Number).sort()

    const boxData = types.map(t => {
      const vals = typeGroups[t].slice().sort((a, b) => a - b)
      const n = vals.length
      return [
        vals[0],
        vals[Math.floor(n * 0.25)],
        vals[Math.floor(n * 0.5)],
        vals[Math.floor(n * 0.75)],
        vals[n - 1],
      ]
    })

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      xAxis: {
        type: 'category',
        data: types.map(t => FOE_TYPE_LABELS[t] ?? `类型${t}`),
        axisLabel: { color: '#8b949e' },
      },
      yAxis: { axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
      series: [
        {
          type: 'boxplot',
          data: boxData,
          itemStyle: { color: '#4e9af1', borderColor: '#4e9af1' },
        },
        {
          type: 'scatter',
          data: outliers.map(s => [
            types.indexOf(s.foeType),
            s.overallScore,
          ]),
          itemStyle: { color: '#f14e4e' },
          symbolSize: 8,
          tooltip: { formatter: (p: any) => outliers[p.dataIndex]?.name ?? '' },
        },
      ],
    }
  }, [scores, outliers])

  const outlierColumns = [
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '类型', dataIndex: 'foeType', width: 72,
      render: (v: number) => <Tag color={FOE_TYPE_COLORS[v] ?? 'default'}>{FOE_TYPE_LABELS[v] ?? v}</Tag>,
    },
    {
      title: '综合评分', dataIndex: 'overallScore', width: 100,
      render: (v: number) => <span style={{ color: '#f14e4e', fontWeight: 600 }}>{v.toFixed(2)}</span>,
    },
    { title: 'EHP', dataIndex: 'ehpScore', width: 80, render: (v: number) => v.toFixed(2) },
    { title: 'DPS', dataIndex: 'dpsScore', width: 80, render: (v: number) => v.toFixed(2) },
    { title: '控制', dataIndex: 'controlScore', width: 80, render: (v: number) => v.toFixed(2) },
  ]

  const issueCount = outliers.length + issueTemplates.length
  const healthScore = scores.length > 0
    ? Math.max(0, 100 - outliers.length * 15 - issueTemplates.length * 10)
    : 0

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Title level={4} style={{ margin: 0 }}>数值健康报告</Title>

      {health && (
        <Alert
          type={health.status === 'ok' ? 'success' : 'error'}
          showIcon
          message={`服务状态：${health.status === 'ok' ? '正常运行' : '异常'} | 数据目录：${health.dataDir}`}
        />
      )}

      <Row gutter={16}>
        <Col span={6}>
          <Card size="small" title="数值健康度">
            <Progress
              type="circle"
              percent={healthScore}
              size={80}
              strokeColor={healthScore >= 80 ? '#7ec94e' : healthScore >= 60 ? '#f1c04e' : '#f14e4e'}
            />
          </Card>
        </Col>
        <Col span={6}><Card size="small"><Statistic title="怪物总数" value={scores.length} /></Card></Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="异常怪物"
              value={outliers.length}
              valueStyle={{ color: outliers.length > 0 ? '#f14e4e' : '#7ec94e' }}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>/ {scores.length}</Text>}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="模板问题"
              value={issueTemplates.length}
              valueStyle={{ color: issueTemplates.length > 0 ? '#f1c04e' : '#7ec94e' }}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>/ {templates.length}</Text>}
            />
          </Card>
        </Col>
      </Row>

      {scores.length > 0 && (
        <Card title="各类型评分分布（箱线图）" size="small"
          extra={outliers.length > 0 && <Badge status="error" text={<Text style={{ fontSize: 12, color: '#f14e4e' }}>红点为异常值</Text>} />}>
          <ReactECharts option={boxOption} style={{ height: 260 }} />
        </Card>
      )}

      <Row gutter={16}>
        {byType.map(t => (
          <Col key={t.type} span={8} style={{ marginBottom: 8 }}>
            <Card size="small" title={<Tag color={FOE_TYPE_COLORS[t.type] ?? 'default'}>{t.label}</Tag>}>
              <Row>
                <Col span={8}><Statistic title="数量" value={t.count} valueStyle={{ fontSize: 16 }} /></Col>
                <Col span={8}><Statistic title="均值" value={t.avg} valueStyle={{ fontSize: 16, color: '#4e9af1' }} /></Col>
                <Col span={8}><Statistic title="区间" value={`${t.min}~${t.max}`} valueStyle={{ fontSize: 12 }} /></Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>

      {outliers.length > 0 && (
        <Card
          size="small"
          title={<Space><Badge status="error" /><Text>异常评分怪物（IQR 检测）</Text></Space>}
        >
          <Table
            rowKey="configId"
            dataSource={outliers}
            columns={outlierColumns}
            size="small"
            pagination={false}
          />
        </Card>
      )}

      {issueTemplates.length > 0 && (
        <Card size="small" title={<Space><Badge status="warning" /><Text>模板一致性问题</Text></Space>}>
          {issueTemplates.map(t => (
            <Alert
              key={t.clusterKey}
              type="warning"
              showIcon
              message={`模板 ${t.clusterKey}`}
              description={`${t.variants.length} 个变种存在属性缩放一致性问题`}
              style={{ marginBottom: 8 }}
            />
          ))}
        </Card>
      )}

      {issueCount === 0 && scores.length > 0 && (
        <Alert type="success" showIcon message="数值健康状态良好，未发现异常怪物或模板问题" />
      )}
    </Space>
  )
}
