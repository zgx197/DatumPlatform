import { useQuery } from '@tanstack/react-query'
import { Card, Tag, Typography, Space, Empty, Row, Col, Table, Badge } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useState } from 'react'
import { datumApi } from '../../api/datum'
import type { MonsterTemplate } from '../../types/datum'
import { FOE_TYPE_LABELS, FOE_TYPE_COLORS } from '../../types/datum'

const { Title, Text } = Typography

const ATTR_NAMES = ['Atk', 'Def', 'HP', 'AtkSpd', 'Tough', 'Spd', 'IceR', 'FireR', 'PoiR', 'EleR']
const ATTR_COLORS = ['#4e9af1', '#f1924e', '#7ec94e', '#f1c04e', '#b44ef1', '#36d6d6', '#f14e9a', '#d64ef1', '#4ef18e', '#f14e4e']

function ScaleCurveChart({ template }: { template: MonsterTemplate }) {
  const activeDims = ATTR_NAMES
    .map((name, i) => ({ name, idx: i, base: template.baseValues[i] }))
    .filter(d => d.base > 0)

  const series = activeDims.map(d => ({
    name: d.name,
    type: 'line',
    smooth: true,
    data: template.variants.map(v => parseFloat(v.scales[d.idx].toFixed(3))),
    itemStyle: { color: ATTR_COLORS[d.idx] },
    lineStyle: { color: ATTR_COLORS[d.idx], width: 2 },
    symbol: 'circle', symbolSize: 6,
  }))

  const option = {
    backgroundColor: 'transparent',
    legend: { bottom: 0, textStyle: { color: '#8b949e', fontSize: 11 } },
    tooltip: { trigger: 'axis' },
    grid: { top: 10, left: 40, right: 10, bottom: 60 },
    xAxis: {
      type: 'category',
      data: template.variants.map(v => v.name.length > 8 ? v.name.slice(-6) : v.name),
      axisLabel: { color: '#8b949e', fontSize: 10 },
    },
    yAxis: {
      name: '缩放系数', nameTextStyle: { color: '#8b949e', fontSize: 10 },
      axisLabel: { color: '#8b949e', fontSize: 10 },
      splitLine: { lineStyle: { color: '#21262d' } },
    },
    series,
  }

  return <ReactECharts option={option} style={{ height: 220 }} />
}

function TemplateCard({ template }: { template: MonsterTemplate }) {
  const variantColumns = [
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '评分', dataIndex: 'score', width: 72,
      render: (v: number) => <span style={{ color: '#4e9af1', fontWeight: 600 }}>{v.toFixed(2)}</span>,
    },
    ...ATTR_NAMES.slice(0, 5).map((name, i) => ({
      title: name,
      width: 60,
      render: (_: any, row: any) => {
        const scale = row.scales[i]
        const color = scale === 0 ? '#555' : scale > 1.05 ? '#f1924e' : scale < 0.95 ? '#4e9af1' : '#8b949e'
        return <span style={{ color, fontSize: 12 }}>{scale === 0 ? '—' : `×${scale.toFixed(2)}`}</span>
      },
    })),
  ]

  return (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      title={
        <Space>
          <Tag color={FOE_TYPE_COLORS[template.foeType] ?? 'default'}>
            {FOE_TYPE_LABELS[template.foeType] ?? `类型${template.foeType}`}
          </Tag>
          <Text code style={{ fontSize: 12 }}>{template.clusterKey}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>({template.variants.length} 个变种)</Text>
          {template.hasConsistencyIssue && <Badge status="warning" text={<Text type="warning" style={{ fontSize: 12 }}>一致性警告</Text>} />}
        </Space>
      }
    >
      <Row gutter={16}>
        <Col span={14}>
          <ScaleCurveChart template={template} />
        </Col>
        <Col span={10}>
          <Table
            rowKey="configId"
            dataSource={template.variants}
            columns={variantColumns}
            size="small"
            pagination={false}
            scroll={{ x: 300, y: 200 }}
          />
        </Col>
      </Row>
    </Card>
  )
}

export default function TemplateAnalysis() {
  const [selectedType, setSelectedType] = useState<number | null>(null)

  const { data: templates = [], isLoading } = useQuery<MonsterTemplate[]>({
    queryKey: ['templates'],
    queryFn: () => datumApi.templates(),
  })

  const foeTypes = [...new Set(templates.map(t => t.foeType))].sort()
  const filtered = selectedType == null ? templates : templates.filter(t => t.foeType === selectedType)

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Row align="middle" justify="space-between">
        <Col><Title level={4} style={{ margin: 0 }}>模板分析</Title></Col>
        <Col>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>类型筛选：</Text>
            <Tag
              style={{ cursor: 'pointer' }}
              color={selectedType == null ? 'blue' : undefined}
              onClick={() => setSelectedType(null)}
            >全部 ({templates.length})</Tag>
            {foeTypes.map(t => (
              <Tag
                key={t}
                style={{ cursor: 'pointer' }}
                color={selectedType === t ? (FOE_TYPE_COLORS[t] ?? 'blue') : undefined}
                onClick={() => setSelectedType(t)}
              >
                {FOE_TYPE_LABELS[t] ?? `类型${t}`} ({templates.filter(x => x.foeType === t).length})
              </Tag>
            ))}
          </Space>
        </Col>
      </Row>

      {!isLoading && filtered.length === 0 ? (
        <Empty description="暂无模板数据（需 ≥2 个同类型同技能组的怪物才能自动发现模板）" />
      ) : (
        filtered.map(tmpl => <TemplateCard key={tmpl.clusterKey} template={tmpl} />)
      )}
    </Space>
  )
}
