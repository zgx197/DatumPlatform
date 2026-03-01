import { useQuery } from '@tanstack/react-query'
import { Card, Tag, Typography, Space, Empty, Row, Col, Table, Badge, List, Divider, Alert } from 'antd'
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useState, useMemo } from 'react'
import { datumApi } from '../../api/datum'
import type { MonsterTemplate, TemplateVariant } from '../../types/datum'
import { FOE_TYPE_LABELS, FOE_TYPE_COLORS } from '../../types/datum'

const { Title, Text } = Typography

const ATTR_NAMES = ['Atk', 'Def', 'HP', 'AtkSpd', 'Tough', 'Spd', 'IceR', 'FireR', 'PoiR', 'EleR']
const ATTR_COLORS = ['#4e9af1', '#f1924e', '#7ec94e', '#f1c04e', '#b44ef1', '#36d6d6', '#f14e9a', '#d64ef1', '#4ef18e', '#f14e4e']

// 缩放曲线图（属性缩放趋势）
function ScaleCurveChart({ template }: { template: MonsterTemplate }) {
  const activeDims = ATTR_NAMES
    .map((name, i) => ({ name, idx: i, base: template.baseValues[i] }))
    .filter(d => d.base > 0)

  const xLabels = template.variants.map(v => v.name.length > 8 ? v.name.slice(-6) : v.name)

  const attrSeries = activeDims.map(d => ({
    name: d.name,
    type: 'line',
    smooth: true,
    data: template.variants.map(v => parseFloat(v.scales[d.idx].toFixed(3))),
    itemStyle: { color: ATTR_COLORS[d.idx] },
    lineStyle: { color: ATTR_COLORS[d.idx], width: 1.5, opacity: 0.7 },
    symbol: 'circle', symbolSize: 4,
  }))

  // 评分曲线（归一化到缩放系数量纲）
  const scores = template.variants.map(v => v.score)
  const maxScore = Math.max(...scores, 0.001)
  const scoreSeries = {
    name: '评分（归一）',
    type: 'line',
    smooth: true,
    data: scores.map(s => parseFloat((s / maxScore).toFixed(3))),
    itemStyle: { color: '#ffffff' },
    lineStyle: { color: '#ffffff', width: 2.5, type: 'solid' },
    symbol: 'circle', symbolSize: 6,
    z: 10,
  }

  const option = {
    backgroundColor: 'transparent',
    legend: { bottom: 0, textStyle: { color: '#8b949e', fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
    tooltip: { trigger: 'axis' },
    grid: { top: 8, left: 38, right: 8, bottom: 68 },
    xAxis: {
      type: 'category', data: xLabels,
      axisLabel: { color: '#8b949e', fontSize: 9, rotate: 30 },
    },
    yAxis: {
      name: '×', nameTextStyle: { color: '#8b949e', fontSize: 10 },
      axisLabel: { color: '#8b949e', fontSize: 10 },
      splitLine: { lineStyle: { color: '#21262d' } },
    },
    series: [...attrSeries, scoreSeries],
  }

  return <ReactECharts option={option} style={{ height: 240 }} />
}

// 变种评分柱状图（含偏差%）
function ScoreBarChart({ template }: { template: MonsterTemplate }) {
  const variants = template.variants
  const scores = variants.map(v => v.score)
  const baseScore = scores[0] ?? 0

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        const v = variants[params[0].dataIndex]
        const diff = baseScore > 0 ? ((v.score - baseScore) / baseScore * 100) : 0
        return `<b>${v.name}</b><br/>评分: ${v.score.toFixed(3)}<br/>vs标准: ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`
      },
    },
    grid: { top: 8, left: 48, right: 8, bottom: 40 },
    xAxis: {
      type: 'category',
      data: variants.map(v => v.name.length > 8 ? v.name.slice(-5) : v.name),
      axisLabel: { color: '#8b949e', fontSize: 9, rotate: 20 },
    },
    yAxis: { axisLabel: { color: '#8b949e', fontSize: 10 }, splitLine: { lineStyle: { color: '#21262d' } } },
    series: [{
      type: 'bar',
      data: variants.map((v, i) => ({
        value: parseFloat(v.score.toFixed(3)),
        itemStyle: {
          color: i === 0 ? '#555' : v.score > baseScore * 1.1 ? '#f1924e' : v.score < baseScore * 0.9 ? '#4e9af1' : '#7ec94e',
        },
        label: {
          show: true, position: 'top', fontSize: 9, color: '#8b949e',
          formatter: () => {
            if (i === 0 || baseScore <= 0) return ''
            const d = (v.score - baseScore) / baseScore * 100
            return `${d >= 0 ? '+' : ''}${d.toFixed(0)}%`
          },
        },
      })),
    }],
  }

  return <ReactECharts option={option} style={{ height: 200 }} />
}

// 一致性问题描述
function ConsistencyIssues({ template }: { template: MonsterTemplate }) {
  const baseScore = template.variants[0]?.score ?? 0

  const issues = useMemo(() => {
    const result: string[] = []
    template.variants.forEach((v, i) => {
      if (i === 0) return
      const scoreDiff = baseScore > 0 ? Math.abs(v.score - baseScore) / baseScore : 0
      // 主属性缩放均值
      const activeScales = ATTR_NAMES.map((_, idx) => template.baseValues[idx] > 0 ? v.scales[idx] : null).filter(s => s !== null) as number[]
      const avgScale = activeScales.length > 0 ? activeScales.reduce((a, b) => a + b, 0) / activeScales.length : 1
      if (scoreDiff > 0.25 && avgScale > 0) {
        const expected = baseScore * avgScale
        const pct = Math.round(scoreDiff * 100)
        result.push(`Lv.${i + 1}(ID-${v.configId}) 属性均值缩放×${avgScale.toFixed(2)}，评分${v.score.toFixed(2)} → 预期${expected.toFixed(2)}（偏差 ${pct}%）`)
      }
    })
    return result
  }, [template])

  if (issues.length === 0) return null

  return (
    <Alert
      type="warning"
      showIcon
      style={{ fontSize: 12 }}
      message={`发现 ${issues.length} 个变种评分与属性缩放不一致（偏差 >25%）`}
      description={
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {issues.map((s, i) => <li key={i} style={{ fontSize: 11 }}>{s}</li>)}
        </ul>
      }
    />
  )
}

function TemplateDetail({ template }: { template: MonsterTemplate }) {
  const variantColumns = [
    { title: 'ID', dataIndex: 'configId', width: 80 },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '评分', dataIndex: 'score', width: 72,
      render: (v: number, _row: TemplateVariant, idx: number) => {
        const base = template.variants[0]?.score ?? 0
        const diff = idx > 0 && base > 0 ? (v - base) / base * 100 : null
        return (
          <Space size={2}>
            <span style={{ color: '#4e9af1', fontWeight: 600 }}>{v.toFixed(3)}</span>
            {diff != null && (
              <span style={{ fontSize: 10, color: diff > 10 ? '#f1924e' : diff < -10 ? '#4e9af1' : '#8b949e' }}>
                {diff >= 0 ? '+' : ''}{diff.toFixed(0)}%
              </span>
            )}
          </Space>
        )
      },
    },
    ...ATTR_NAMES.slice(0, 5).map((name, i) => ({
      title: name, width: 58,
      render: (_: any, row: TemplateVariant) => {
        const scale = row.scales[i]
        const color = scale === 0 ? '#555' : scale > 1.05 ? '#f1924e' : scale < 0.95 ? '#4e9af1' : '#8b949e'
        return <span style={{ color, fontSize: 11 }}>{scale === 0 ? '—' : `×${scale.toFixed(2)}`}</span>
      },
    })),
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {template.hasConsistencyIssue && <ConsistencyIssues template={template} />}

      <Row gutter={12}>
        <Col span={14}>
          <Card size="small" title="缩放曲线（等级 vs 各属性缩放 + 评分归一）">
            <ScaleCurveChart template={template} />
          </Card>
        </Col>
        <Col span={10}>
          <Card size="small" title="变种评分（vs 标准行偏差%）">
            <ScoreBarChart template={template} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="变种列表">
        <Table
          rowKey="configId"
          dataSource={template.variants}
          columns={variantColumns}
          size="small"
          pagination={false}
          scroll={{ x: 500 }}
        />
      </Card>
    </Space>
  )
}

export default function TemplateAnalysis() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<number | null>(null)

  const { data: templates = [], isLoading } = useQuery<MonsterTemplate[]>({
    queryKey: ['templates'],
    queryFn: () => datumApi.templates(),
  })

  const foeTypes = [...new Set(templates.map(t => t.foeType))].sort()
  const filtered = selectedType == null ? templates : templates.filter(t => t.foeType === selectedType)
  const selected = filtered.find(t => t.clusterKey === selectedKey) ?? filtered[0] ?? null

  const issueCount = templates.filter(t => t.hasConsistencyIssue).length

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Row align="middle" justify="space-between">
        <Col><Title level={4} style={{ margin: 0 }}>模板发现 & 评估</Title></Col>
        <Col>
          <Space size={6}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              模板数: {templates.length} | 已评估: {templates.filter(t => t.variants.some(v => v.score > 0)).length}
              {issueCount > 0 && <span style={{ color: '#f1c04e' }}> | ⚠ 一致性问题: {issueCount}</span>}
            </Text>
          </Space>
        </Col>
      </Row>

      {/* 类型筛选 */}
      <Space size={6} wrap>
        <Tag style={{ cursor: 'pointer' }} color={selectedType == null ? 'blue' : undefined}
          onClick={() => { setSelectedType(null); setSelectedKey(null) }}>
          全部 ({templates.length})
        </Tag>
        {foeTypes.map(t => (
          <Tag key={t} style={{ cursor: 'pointer' }}
            color={selectedType === t ? (FOE_TYPE_COLORS[t] ?? 'blue') : undefined}
            onClick={() => { setSelectedType(t); setSelectedKey(null) }}>
            {FOE_TYPE_LABELS[t] ?? `类型${t}`} ({templates.filter(x => x.foeType === t).length})
          </Tag>
        ))}
      </Space>

      {!isLoading && filtered.length === 0 ? (
        <Empty description="暂无模板数据（需 ≥2 个同类型同技能组的怪物才能自动发现模板）" />
      ) : (
        <Row gutter={12} style={{ minHeight: 500 }}>
          {/* 左侧列表 */}
          <Col span={6}>
            <Card size="small" title="模板列表" style={{ height: '100%' }}>
              <List
                size="small"
                dataSource={filtered}
                renderItem={tmpl => (
                  <List.Item
                    onClick={() => setSelectedKey(tmpl.clusterKey)}
                    style={{
                      cursor: 'pointer',
                      background: tmpl.clusterKey === (selected?.clusterKey) ? '#1f6feb22' : 'transparent',
                      borderRadius: 4, padding: '6px 8px', marginBottom: 2,
                    }}
                  >
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Tag color={FOE_TYPE_COLORS[tmpl.foeType] ?? 'default'} style={{ fontSize: 10, margin: 0 }}>
                            {FOE_TYPE_LABELS[tmpl.foeType] ?? `T${tmpl.foeType}`}
                          </Tag>
                        </Col>
                        <Col>
                          {tmpl.hasConsistencyIssue
                            ? <WarningOutlined style={{ color: '#f1c04e', fontSize: 12 }} />
                            : <CheckCircleOutlined style={{ color: '#7ec94e', fontSize: 12 }} />
                          }
                        </Col>
                      </Row>
                      <Text style={{ fontSize: 11 }} ellipsis>{tmpl.variants[0]?.name ?? tmpl.clusterKey}</Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {tmpl.variants.length} 变种 · 基准 {tmpl.variants[0]?.score.toFixed(2) ?? '—'}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* 右侧详情 */}
          <Col span={18}>
            {selected ? (
              <Card
                size="small"
                title={
                  <Space>
                    <Tag color={FOE_TYPE_COLORS[selected.foeType] ?? 'default'}>
                      {FOE_TYPE_LABELS[selected.foeType] ?? `类型${selected.foeType}`}
                    </Tag>
                    <Text code style={{ fontSize: 12 }}>{selected.clusterKey}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {selected.variants.length} 个变种 · 基准评分 {selected.variants[0]?.score.toFixed(3) ?? '—'}
                    </Text>
                    {selected.hasConsistencyIssue && (
                      <Badge status="warning" text={<Text type="warning" style={{ fontSize: 12 }}>一致性警告</Text>} />
                    )}
                  </Space>
                }
              >
                <TemplateDetail template={selected} />
              </Card>
            ) : (
              <Empty description="点击左侧模板查看详情" />
            )}
          </Col>
        </Row>
      )}
    </Space>
  )
}
