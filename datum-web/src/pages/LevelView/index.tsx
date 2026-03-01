import { useQuery } from '@tanstack/react-query'
import { Card, Tag, Typography, Space, Row, Col, Table, Statistic } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useMemo, useState } from 'react'
import { datumApi } from '../../api/datum'
import type { EntityScore } from '../../types/datum'
import { FOE_TYPE_LABELS, FOE_TYPE_COLORS } from '../../types/datum'

const { Title, Text } = Typography

export default function LevelView() {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)

  const { data: scores = [], isLoading } = useQuery<EntityScore[]>({
    queryKey: ['scores'],
    queryFn: () => datumApi.scores(),
  })

  const levelGroups = useMemo(() => {
    const m: Record<number, EntityScore[]> = {}
    scores.forEach(s => { (m[s.barriesId] ??= []).push(s) })
    return Object.entries(m)
      .map(([id, items]) => {
        const sorted = items.slice().sort((a, b) => a.overallScore - b.overallScore)
        const avg = items.reduce((s, r) => s + r.overallScore, 0) / items.length
        return {
          id: Number(id),
          items,
          sorted,
          avg: parseFloat(avg.toFixed(2)),
          max: parseFloat(Math.max(...items.map(s => s.overallScore)).toFixed(2)),
          min: parseFloat(Math.min(...items.map(s => s.overallScore)).toFixed(2)),
          count: items.length,
        }
      })
      .sort((a, b) => a.id - b.id)
  }, [scores])

  const heatmapOption = useMemo(() => {
    const levels = levelGroups.map(g => `关卡 ${g.id}`)
    const percentiles = ['最低', 'Q1', '中位', 'Q3', '最高']

    const data: number[][] = []
    levelGroups.forEach((g, li) => {
      const n = g.sorted.length
      const pVals = [
        g.sorted[0]?.overallScore ?? 0,
        g.sorted[Math.floor(n * 0.25)]?.overallScore ?? 0,
        g.sorted[Math.floor(n * 0.5)]?.overallScore ?? 0,
        g.sorted[Math.floor(n * 0.75)]?.overallScore ?? 0,
        g.sorted[n - 1]?.overallScore ?? 0,
      ]
      pVals.forEach((v, pi) => data.push([li, pi, parseFloat(v.toFixed(2))]))
    })

    const allVals = data.map(d => d[2])
    const minVal = Math.min(...allVals)
    const maxVal = Math.max(...allVals)

    return {
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (p: any) => `${levels[p.data[0]]} ${percentiles[p.data[1]]}: ${p.data[2]}`,
      },
      grid: { top: 20, left: 60, right: 80, bottom: 40 },
      xAxis: { type: 'category', data: levels, axisLabel: { color: '#8b949e' } },
      yAxis: { type: 'category', data: percentiles, axisLabel: { color: '#8b949e' } },
      visualMap: {
        min: minVal, max: maxVal,
        calculable: true,
        orient: 'vertical',
        right: 0, top: 20,
        textStyle: { color: '#8b949e' },
        inRange: { color: ['#0d1117', '#1a3a5c', '#4e9af1', '#f1c04e', '#f14e4e'] },
      },
      series: [{
        type: 'heatmap',
        data,
        label: { show: true, fontSize: 10, color: '#fff' },
        emphasis: { itemStyle: { shadowBlur: 10 } },
      }],
    }
  }, [levelGroups])

  const barOption = useMemo(() => {
    const target = selectedLevel != null
      ? levelGroups.find(g => g.id === selectedLevel)
      : null
    const items = target ? target.items.slice().sort((a, b) => b.overallScore - a.overallScore) : []
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: '#8b949e', fontSize: 11 } },
      grid: { top: 10, left: 50, right: 10, bottom: 50 },
      xAxis: {
        type: 'category',
        data: items.map(s => s.name.length > 6 ? s.name.slice(-6) : s.name),
        axisLabel: { color: '#8b949e', fontSize: 10, rotate: 20 },
      },
      yAxis: { axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
      series: [
        { name: 'EHP', type: 'bar', stack: 'score', data: items.map(s => parseFloat(s.ehpScore.toFixed(2))), itemStyle: { color: '#4e9af1' } },
        { name: 'DPS', type: 'bar', stack: 'score', data: items.map(s => parseFloat(s.dpsScore.toFixed(2))), itemStyle: { color: '#f1924e' } },
        { name: '控制', type: 'bar', stack: 'score', data: items.map(s => parseFloat(s.controlScore.toFixed(2))), itemStyle: { color: '#7ec94e' } },
      ],
    }
  }, [selectedLevel, levelGroups])

  const tableColumns = [
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '类型', dataIndex: 'foeType', width: 70,
      render: (v: number) => <Tag color={FOE_TYPE_COLORS[v] ?? 'default'}>{FOE_TYPE_LABELS[v] ?? v}</Tag>,
    },
    {
      title: '综合', dataIndex: 'overallScore', width: 80,
      defaultSortOrder: 'descend' as const,
      sorter: (a: EntityScore, b: EntityScore) => a.overallScore - b.overallScore,
      render: (v: number) => <span style={{ color: '#4e9af1', fontWeight: 600 }}>{v.toFixed(2)}</span>,
    },
    { title: 'EHP', dataIndex: 'ehpScore', width: 70, render: (v: number) => v.toFixed(2) },
    { title: 'DPS', dataIndex: 'dpsScore', width: 70, render: (v: number) => v.toFixed(2) },
    { title: '控制', dataIndex: 'controlScore', width: 70, render: (v: number) => v.toFixed(2) },
  ]

  const selectedGroup = selectedLevel != null ? levelGroups.find(g => g.id === selectedLevel) : null

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Title level={4} style={{ margin: 0 }}>关卡视图</Title>

      {levelGroups.length > 0 && (
        <Card title="关卡强度热力图" size="small">
          <ReactECharts option={heatmapOption} style={{ height: 220 }} />
        </Card>
      )}

      <Row gutter={12}>
        {levelGroups.map(g => (
          <Col key={g.id} span={Math.max(4, Math.floor(24 / Math.max(levelGroups.length, 1)))}>
            <Card
              size="small"
              hoverable
              onClick={() => setSelectedLevel(g.id === selectedLevel ? null : g.id)}
              style={{
                cursor: 'pointer',
                borderColor: g.id === selectedLevel ? '#4e9af1' : undefined,
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 12, color: '#8b949e' }}>关卡 {g.id}</Text>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#4e9af1', lineHeight: 1.4 }}>
                {g.avg}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {g.count}怪 · {g.min}~{g.max}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      {selectedGroup && (
        <Row gutter={16}>
          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <Text>关卡 {selectedGroup.id} 详情</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>共 {selectedGroup.count} 个怪物</Text>
                </Space>
              }
              extra={
                <Row gutter={12}>
                  <Col><Statistic title="均值" value={selectedGroup.avg} valueStyle={{ fontSize: 14, color: '#4e9af1' }} /></Col>
                  <Col><Statistic title="最高" value={selectedGroup.max} valueStyle={{ fontSize: 14, color: '#f14e4e' }} /></Col>
                  <Col><Statistic title="最低" value={selectedGroup.min} valueStyle={{ fontSize: 14, color: '#7ec94e' }} /></Col>
                </Row>
              }
            >
              <Table
                rowKey="configId"
                dataSource={selectedGroup.items}
                columns={tableColumns}
                size="small"
                loading={isLoading}
                pagination={false}
                scroll={{ x: 420, y: 200 }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title="评分维度分解（堆叠柱状图）">
              <ReactECharts option={barOption} style={{ height: 280 }} />
            </Card>
          </Col>
        </Row>
      )}

      {levelGroups.length === 0 && !isLoading && (
        <Card size="small">
          <Text type="secondary">暂无关卡数据，请确保怪物数据包含有效的 barriesId 字段</Text>
        </Card>
      )}
    </Space>
  )
}
