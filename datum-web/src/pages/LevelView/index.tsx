import { useQuery } from '@tanstack/react-query'
import { Card, Tag, Typography, Space, Row, Col, Table, Statistic, Slider, Tooltip as AntTooltip } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useMemo, useState } from 'react'
import { datumApi } from '../../api/datum'
import type { EntityScore, LevelMetrics, WaveMetricsItem } from '../../types/datum'
import { FOE_TYPE_LABELS, FOE_TYPE_COLORS, ELEMENT_LABELS, ELEMENT_COLORS } from '../../types/datum'

const { Title, Text } = Typography

export default function LevelView() {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const [lifetime, setLifetime] = useState<number>(30)

  const { data: scores = [], isLoading: scoresLoading } = useQuery<EntityScore[]>({
    queryKey: ['scores'],
    queryFn: () => datumApi.scores(),
  })

  const { data: metrics = [], isLoading: metricsLoading } = useQuery<LevelMetrics[]>({
    queryKey: ['levelMetrics', lifetime],
    queryFn: () => datumApi.levelMetrics(lifetime),
  })

  const isLoading = scoresLoading || metricsLoading

  // 按 barriesId 分组怪物评分
  const levelGroups = useMemo(() => {
    const m: Record<number, EntityScore[]> = {}
    scores.forEach(s => { (m[s.barriesId] ??= []).push(s) })
    return Object.entries(m)
      .map(([id, items]) => {
        const sorted = items.slice().sort((a, b) => a.overallScore - b.overallScore)
        const avg = items.reduce((s, r) => s + r.overallScore, 0) / items.length
        const metricsItem = metrics.find(mt => mt.levelId === Number(id))
        return {
          id: Number(id),
          items,
          sorted,
          avg: parseFloat(avg.toFixed(2)),
          max: parseFloat(Math.max(...items.map(s => s.overallScore)).toFixed(2)),
          min: parseFloat(Math.min(...items.map(s => s.overallScore)).toFixed(2)),
          count: items.length,
          metrics: metricsItem,
        }
      })
      .sort((a, b) => a.id - b.id)
  }, [scores, metrics])

  const selectedGroup = selectedLevel != null ? levelGroups.find(g => g.id === selectedLevel) : null
  const selectedMetrics = selectedGroup?.metrics

  // ─── 关卡总览热力图 ─────────────────────────────────
  const overviewOption = useMemo(() => {
    if (metrics.length === 0) return null
    const labels = metrics.map(m => m.levelName || `关卡${m.levelId}`)
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: '#8b949e', fontSize: 11 } },
      grid: { top: 20, left: 60, right: 20, bottom: 50 },
      xAxis: { type: 'category', data: labels, axisLabel: { color: '#8b949e', fontSize: 10, rotate: 15 } },
      yAxis: [
        { type: 'value', name: '难度', axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
        { type: 'value', name: '怪物数', axisLabel: { color: '#8b949e' }, splitLine: { show: false } },
      ],
      series: [
        { name: '总难度', type: 'bar', data: metrics.map(m => +m.totalDifficulty.toFixed(1)), itemStyle: { color: '#4e9af1' } },
        { name: '峰值难度', type: 'bar', data: metrics.map(m => +m.peakSimultaneousDifficulty.toFixed(1)), itemStyle: { color: '#f14e4e' } },
        { name: '怪物数', type: 'line', yAxisIndex: 1, data: metrics.map(m => m.totalMonsterCount), itemStyle: { color: '#7ec94e' }, lineStyle: { type: 'dashed' } },
      ],
    }
  }, [metrics])

  // ─── 难度曲线（理论 + 加速对比） ─────────────────────
  const curveOption = useMemo(() => {
    if (!selectedMetrics?.difficultyCurve?.length) return null
    const curve = selectedMetrics.difficultyCurve
    const accel = selectedMetrics.acceleratedCurve ?? []
    const hasAccel = accel.length > 0

    const series: any[] = [
      {
        name: '理论难度', type: 'line', areaStyle: { opacity: 0.2 },
        data: curve.map(p => +p.difficulty.toFixed(1)),
        itemStyle: { color: '#f1924e' }, smooth: true,
      },
      {
        name: '理论存活', type: 'line', yAxisIndex: 1,
        data: curve.map(p => p.aliveCount),
        itemStyle: { color: '#4e9af1' }, lineStyle: { type: 'dashed' }, smooth: true,
        symbol: 'none',
      },
    ]

    if (hasAccel) {
      series.push(
        {
          name: '加速难度', type: 'line',
          data: accel.map(p => +p.difficulty.toFixed(1)),
          itemStyle: { color: '#a855f7' }, lineStyle: { type: 'dotted', width: 2 }, smooth: true,
          symbol: 'none',
        },
        {
          name: '加速存活', type: 'line', yAxisIndex: 1,
          data: accel.map(p => p.aliveCount),
          itemStyle: { color: '#61dafb' }, lineStyle: { type: 'dotted' }, smooth: true,
          symbol: 'none',
        },
      )
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const t = params[0]?.axisValue ?? ''
          let html = `<b>${t}s</b><br/>`
          params.forEach((p: any) => {
            html += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`
          })
          return html
        },
      },
      legend: { bottom: 0, textStyle: { color: '#8b949e', fontSize: 11 } },
      grid: { top: 20, left: 50, right: 50, bottom: 50 },
      xAxis: {
        type: 'category',
        data: curve.map(p => p.timeSeconds),
        name: '时间(s)',
        axisLabel: { color: '#8b949e', fontSize: 10 },
      },
      yAxis: [
        { type: 'value', name: '难度', axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
        { type: 'value', name: '存活数', axisLabel: { color: '#8b949e' }, splitLine: { show: false } },
      ],
      series,
    }
  }, [selectedMetrics])

  // ─── 类型分布饼图 ──────────────────────────────────
  const typePieOption = useMemo(() => {
    if (!selectedMetrics?.monsterTypeDistribution) return null
    const dist = selectedMetrics.monsterTypeDistribution
    const data = [
      { value: dist.boss ?? 0, name: 'Boss', itemStyle: { color: '#f14e4e' } },
      { value: dist.elite ?? 0, name: '精英', itemStyle: { color: '#7ec94e' } },
      { value: dist.ordinary ?? 0, name: '普通', itemStyle: { color: '#4e9af1' } },
    ].filter(d => d.value > 0)
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['40%', '70%'],
        label: { color: '#8b949e', fontSize: 11 },
        data,
      }],
    }
  }, [selectedMetrics])

  // ─── 元素分布饼图 ──────────────────────────────────
  const elementPieOption = useMemo(() => {
    if (!selectedMetrics?.elementDistribution) return null
    const dist = selectedMetrics.elementDistribution
    const data = Object.entries(dist)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => {
        const elemId = Object.entries(ELEMENT_LABELS).find(([, label]) =>
          label === { physics: '物理', ice: '冰', fire: '火', poison: '毒', electric: '电' }[key]
        )?.[0]
        const idNum = elemId != null ? Number(elemId) : 0
        const colorMap: Record<string, string> = {
          physics: '#aaa', ice: '#61dafb', fire: '#ff6b35', poison: '#a855f7', electric: '#facc15'
        }
        return { value, name: { physics: '物理', ice: '冰', fire: '火', poison: '毒', electric: '电' }[key] ?? key, itemStyle: { color: colorMap[key] ?? '#8b949e' } }
      })
    if (data.length === 0) return null
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['40%', '70%'],
        label: { color: '#8b949e', fontSize: 11 },
        data,
      }],
    }
  }, [selectedMetrics])

  // ─── 波次详情表格 ──────────────────────────────────
  const waveColumns = [
    { title: '触发器', dataIndex: 'triggerId', width: 72 },
    { title: '区域', dataIndex: 'regionId', width: 66 },
    { title: '波次', dataIndex: 'waveIndex', width: 52 },
    { title: '延迟(s)', dataIndex: 'delaySeconds', width: 80, render: (v: number) => v.toFixed(1) },
    { title: '怪物数', dataIndex: 'monsterCount', width: 70 },
    {
      title: '波次难度', dataIndex: 'waveDifficulty', width: 90,
      defaultSortOrder: 'descend' as const,
      sorter: (a: WaveMetricsItem, b: WaveMetricsItem) => a.waveDifficulty - b.waveDifficulty,
      render: (v: number) => <span style={{ color: '#f1924e', fontWeight: 600 }}>{v.toFixed(1)}</span>,
    },
    {
      title: '怪物构成', dataIndex: 'monsters', ellipsis: true,
      render: (_: any, row: WaveMetricsItem) =>
        row.monsters.map(m => `${m.configId}×${m.count}`).join(', '),
    },
  ]

  // ─── 怪物评分表 ────────────────────────────────────
  const monsterColumns = [
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

  // ─── 维度分解柱状图 ────────────────────────────────
  const barOption = useMemo(() => {
    const items = selectedGroup
      ? selectedGroup.items.slice().sort((a, b) => b.overallScore - a.overallScore)
      : []
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
        { name: 'EHP', type: 'bar', stack: 'score', data: items.map(s => +s.ehpScore.toFixed(2)), itemStyle: { color: '#4e9af1' } },
        { name: 'DPS', type: 'bar', stack: 'score', data: items.map(s => +s.dpsScore.toFixed(2)), itemStyle: { color: '#f1924e' } },
        { name: '控制', type: 'bar', stack: 'score', data: items.map(s => +s.controlScore.toFixed(2)), itemStyle: { color: '#7ec94e' } },
      ],
    }
  }, [selectedGroup])

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Row align="middle" justify="space-between">
        <Col><Title level={4} style={{ margin: 0 }}>关卡分析</Title></Col>
        <Col>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>怪物存活时间(s):</Text>
            <AntTooltip title={`${lifetime}s`}>
              <Slider
                style={{ width: 120 }}
                min={5} max={120} step={5}
                value={lifetime}
                onChange={setLifetime}
              />
            </AntTooltip>
            <Tag>{lifetime}s</Tag>
          </Space>
        </Col>
      </Row>

      {/* 关卡总览柱状图 */}
      {overviewOption && (
        <Card title="关卡难度总览" size="small">
          <ReactECharts option={overviewOption} style={{ height: 240 }} />
        </Card>
      )}

      {/* 关卡卡片 */}
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
              <Text style={{ fontSize: 12, color: '#8b949e' }}>
                {g.metrics?.levelName || `关卡 ${g.id}`}
              </Text>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#4e9af1', lineHeight: 1.4 }}>
                {g.metrics ? g.metrics.totalDifficulty.toFixed(0) : g.avg}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {g.metrics
                  ? `${g.metrics.totalMonsterCount}怪 · ${g.metrics.waveCount}波 · 峰${g.metrics.peakSimultaneousDifficulty.toFixed(0)}`
                  : `${g.count}怪 · ${g.min}~${g.max}`
                }
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 选中关卡 - 详情 */}
      {selectedGroup && (
        <>
          {/* 顶部统计 */}
          <Card size="small">
            <Row gutter={24}>
              <Col><Statistic title="总难度" value={selectedMetrics?.totalDifficulty?.toFixed(1) ?? selectedGroup.avg} valueStyle={{ color: '#4e9af1' }} /></Col>
              <Col><Statistic title="峰值难度" value={selectedMetrics?.peakSimultaneousDifficulty?.toFixed(1) ?? '-'} valueStyle={{ color: '#f14e4e' }} /></Col>
              <Col><Statistic title="平均密度" value={selectedMetrics?.averageDifficultyDensity?.toFixed(2) ?? '-'} valueStyle={{ color: '#f1924e' }} /></Col>
              <Col><Statistic title="怪物总数" value={selectedMetrics?.totalMonsterCount ?? selectedGroup.count} /></Col>
              <Col><Statistic title="波次数" value={selectedMetrics?.waveCount ?? '-'} /></Col>
              <Col><Statistic title="持续时间" value={selectedMetrics?.durationSeconds ? `${selectedMetrics.durationSeconds.toFixed(0)}s` : '-'} /></Col>
              <Col><Statistic title="难度弹性" value={selectedMetrics?.difficultyElasticity ? selectedMetrics.difficultyElasticity.toFixed(2) : '-'} valueStyle={{ color: (selectedMetrics?.difficultyElasticity ?? 1) < 0.8 ? '#7ec94e' : '#f1924e' }} /></Col>
            </Row>
          </Card>

          {/* 难度曲线 */}
          <Card size="small" title="难度曲线">
            {curveOption
              ? <ReactECharts option={curveOption} style={{ height: 300 }} />
              : <Text type="secondary">无难度曲线数据</Text>
            }
          </Card>

          {/* 类型分布 + 元素分布 */}
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" title="怪物类型分布">
                {typePieOption
                  ? <ReactECharts option={typePieOption} style={{ height: 240 }} />
                  : <Text type="secondary">无分布数据</Text>
                }
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="元素分布">
                {elementPieOption
                  ? <ReactECharts option={elementPieOption} style={{ height: 240 }} />
                  : <Text type="secondary">所有怪物均为物理属性</Text>
                }
              </Card>
            </Col>
          </Row>

          {/* 波次详情 + 维度分解 */}
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" title="波次详情">
                {selectedMetrics?.waveDetails?.length
                  ? <Table
                      rowKey={(r: WaveMetricsItem) => `${r.regionId}-${r.triggerId}-${r.waveIndex}`}
                      dataSource={selectedMetrics.waveDetails}
                      columns={waveColumns}
                      size="small"
                      pagination={false}
                      scroll={{ y: 240 }}
                    />
                  : <Text type="secondary">无波次数据</Text>
                }
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="评分维度分解">
                <ReactECharts option={barOption} style={{ height: 280 }} />
              </Card>
            </Col>
          </Row>

          {/* 怪物列表 */}
          <Card
            size="small"
            title={<Space><Text>怪物列表</Text><Text type="secondary" style={{ fontSize: 12 }}>共 {selectedGroup.count} 个</Text></Space>}
          >
            <Table
              rowKey="configId"
              dataSource={selectedGroup.items}
              columns={monsterColumns}
              size="small"
              loading={isLoading}
              pagination={false}
              scroll={{ x: 420, y: 240 }}
            />
          </Card>
        </>
      )}

      {levelGroups.length === 0 && !isLoading && (
        <Card size="small">
          <Text type="secondary">暂无关卡数据，请确保已导出 level_structure.json 和怪物数据</Text>
        </Card>
      )}
    </Space>
  )
}
