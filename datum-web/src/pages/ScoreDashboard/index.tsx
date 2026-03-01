import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Space, Typography, Statistic, Row, Col, Card, Select, Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useState, useMemo } from 'react'
import { datumApi } from '../../api/datum'
import type { EntityScore } from '../../types/datum'
import { FOE_TYPE_LABELS, FOE_TYPE_COLORS } from '../../types/datum'

const { Title } = Typography

const TYPE_COLORS_HEX: Record<number, string> = {
  1: '#4e9af1', 2: '#36d6d6', 3: '#f1924e', 4: '#f14e4e', 5: '#7ec94e',
}

export default function ScoreDashboard() {
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState<number | null>(null)

  const { data: scores = [], isLoading } = useQuery<EntityScore[]>({
    queryKey: ['scores'],
    queryFn: () => datumApi.scores(),
  })

  const filtered = useMemo(() => scores.filter(s => {
    const matchName = s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      String(s.configId).includes(searchText)
    const matchType = filterType == null || s.foeType === filterType
    return matchName && matchType
  }), [scores, searchText, filterType])

  const foeTypes = useMemo(() => [...new Set(scores.map(s => s.foeType))].sort(), [scores])

  const scatterSeries = useMemo(() => {
    const grouped: Record<number, EntityScore[]> = {}
    filtered.forEach(s => { (grouped[s.foeType] ??= []).push(s) })
    return Object.entries(grouped).map(([type, items]) => ({
      name: FOE_TYPE_LABELS[Number(type)] ?? `类型${type}`,
      type: 'scatter',
      data: items.map(s => [s.ehpScore, s.dpsScore, s.name, s.overallScore]),
      symbolSize: (d: number[]) => Math.max(8, Math.min(d[3] * 1.5, 40)),
      itemStyle: { color: TYPE_COLORS_HEX[Number(type)] ?? '#aaa', opacity: 0.85 },
      emphasis: { itemStyle: { color: '#f1c04e', opacity: 1 } },
    }))
  }, [filtered])

  const scatterOption = {
    backgroundColor: 'transparent',
    legend: { top: 0, right: 0, textStyle: { color: '#8b949e' } },
    tooltip: {
      trigger: 'item',
      formatter: (p: any) =>
        `<b>${p.data[2]}</b><br/>综合: ${p.data[3].toFixed(2)}<br/>EHP: ${p.data[0].toFixed(2)} | DPS: ${p.data[1].toFixed(2)}`,
    },
    xAxis: {
      name: 'EHP 评分', nameLocation: 'middle', nameGap: 30,
      nameTextStyle: { color: '#8b949e' },
      axisLabel: { color: '#8b949e' },
      splitLine: { lineStyle: { color: '#21262d' } },
    },
    yAxis: {
      name: 'DPS 评分', nameLocation: 'middle', nameGap: 45,
      nameTextStyle: { color: '#8b949e' },
      axisLabel: { color: '#8b949e' },
      splitLine: { lineStyle: { color: '#21262d' } },
    },
    series: scatterSeries,
  }

  const avg = filtered.length > 0 ? filtered.reduce((s, r) => s + r.overallScore, 0) / filtered.length : 0
  const max = filtered.length > 0 ? Math.max(...filtered.map(s => s.overallScore)) : 0

  const columns = [
    { title: 'ID', dataIndex: 'configId', width: 72, sorter: (a: EntityScore, b: EntityScore) => a.configId - b.configId },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '类型', dataIndex: 'foeType', width: 72,
      render: (v: number) => <Tag color={FOE_TYPE_COLORS[v] ?? 'default'}>{FOE_TYPE_LABELS[v] ?? v}</Tag>,
    },
    { title: '关卡', dataIndex: 'barriesId', width: 65, sorter: (a: EntityScore, b: EntityScore) => a.barriesId - b.barriesId },
    {
      title: '综合评分', dataIndex: 'overallScore', width: 100, defaultSortOrder: 'descend' as const,
      sorter: (a: EntityScore, b: EntityScore) => a.overallScore - b.overallScore,
      render: (v: number) => <span style={{ color: '#4e9af1', fontWeight: 600 }}>{v.toFixed(2)}</span>,
    },
    {
      title: 'EHP', dataIndex: 'ehpScore', width: 80,
      sorter: (a: EntityScore, b: EntityScore) => a.ehpScore - b.ehpScore,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'DPS', dataIndex: 'dpsScore', width: 80,
      sorter: (a: EntityScore, b: EntityScore) => a.dpsScore - b.dpsScore,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '控制', dataIndex: 'controlScore', width: 80,
      sorter: (a: EntityScore, b: EntityScore) => a.controlScore - b.controlScore,
      render: (v: number) => v.toFixed(2),
    },
  ]

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
        <ReactECharts option={scatterOption} style={{ height: 320 }} />
      </Card>

      <Card
        size="small"
        title={
          <Row gutter={8} align="middle">
            <Col>
              <Input
                placeholder="搜索怪物名称或 ID"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
            </Col>
            <Col>
              <Select
                placeholder="类型筛选"
                allowClear
                style={{ width: 120 }}
                value={filterType}
                onChange={v => setFilterType(v ?? null)}
                options={foeTypes.map(t => ({ value: t, label: FOE_TYPE_LABELS[t] ?? `类型${t}` }))}
              />
            </Col>
            <Col style={{ color: '#8b949e', fontSize: 12 }}>
              {filtered.length !== scores.length ? `筛选 ${filtered.length} / ${scores.length}` : `共 ${scores.length} 条`}
            </Col>
          </Row>
        }
      >
        <Table
          rowKey="configId"
          dataSource={filtered}
          columns={columns}
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          scroll={{ x: 650 }}
        />
      </Card>
    </Space>
  )
}
