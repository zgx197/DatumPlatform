import { useQuery } from '@tanstack/react-query'
import { Card, Alert, Space, Typography, Statistic, Row, Col, Table, Tag, Badge, Progress, Collapse } from 'antd'
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { datumApi } from '../../api/datum'
import type { EntityScore, MonsterTemplate, HealthInfo } from '../../types/datum'
import { FOE_TYPE_LABELS, FOE_TYPE_COLORS } from '../../types/datum'

const { Title, Text } = Typography

const ATTR_NAMES = ['Atk', 'Def', 'HP', 'AtkSpd', 'Tough', 'Spd', 'IceR', 'FireR', 'PoiR', 'EleR']

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

// 模板一致性问题详细分析（与 TemplateAnalysis 逻辑一致）
function getTemplateIssues(template: MonsterTemplate): string[] {
  const result: string[] = []
  const baseScore = template.variants[0]?.score ?? 0
  template.variants.forEach((v, i) => {
    if (i === 0) return
    const scoreDiff = baseScore > 0 ? Math.abs(v.score - baseScore) / baseScore : 0
    const activeScales = ATTR_NAMES.map((_, idx) => template.baseValues[idx] > 0 ? v.scales[idx] : null).filter(s => s !== null) as number[]
    const avgScale = activeScales.length > 0 ? activeScales.reduce((a, b) => a + b, 0) / activeScales.length : 1
    if (scoreDiff > 0.25 && avgScale > 0) {
      const expected = baseScore * avgScale
      const pct = Math.round(scoreDiff * 100)
      result.push(`Lv.${i + 1}(ID-${v.configId}) 属性均值缩放×${avgScale.toFixed(2)}，评分${v.score.toFixed(2)} → 预期${expected.toFixed(2)}（偏差 ${pct}%）`)
    }
  })
  return result
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
      avg: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)),
      max: parseFloat(Math.max(...vals).toFixed(3)),
      min: parseFloat(Math.min(...vals).toFixed(3)),
    }))
  }, [scores])

  // 跨模板横向对比：基准分/最高分/缩放率/一致性
  const templateComparison = useMemo(() => templates
    .map(t => ({
      key: t.clusterKey,
      name: t.variants[0]?.name ?? t.clusterKey,
      foeType: t.foeType,
      baseScore: t.variants[0]?.score ?? 0,
      maxScore: Math.max(...t.variants.map(v => v.score), 0),
      variantCount: t.variants.length,
      scaleRatio: (() => {
        const base = t.variants[0]?.score ?? 0
        const max = Math.max(...t.variants.map(v => v.score), 0)
        return base > 0 ? parseFloat((max / base).toFixed(2)) : 0
      })(),
      hasIssue: t.hasConsistencyIssue,
    }))
    .sort((a, b) => b.baseScore - a.baseScore),
    [templates])

  const boxOption = useMemo(() => {
    const typeGroups: Record<number, number[]> = {}
    scores.forEach(s => { (typeGroups[s.foeType] ??= []).push(s.overallScore) })
    const types = Object.keys(typeGroups).map(Number).sort()
    const boxData = types.map(t => {
      const vals = typeGroups[t].slice().sort((a, b) => a - b)
      const n = vals.length
      return [vals[0], vals[Math.floor(n * 0.25)], vals[Math.floor(n * 0.5)], vals[Math.floor(n * 0.75)], vals[n - 1]]
    })
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      xAxis: { type: 'category', data: types.map(t => FOE_TYPE_LABELS[t] ?? `类型${t}`), axisLabel: { color: '#8b949e' } },
      yAxis: { axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
      series: [
        { type: 'boxplot', data: boxData, itemStyle: { color: '#4e9af1', borderColor: '#4e9af1' } },
        {
          type: 'scatter',
          data: outliers.map(s => [types.indexOf(s.foeType), s.overallScore]),
          itemStyle: { color: '#f14e4e' }, symbolSize: 8,
          tooltip: { formatter: (p: any) => outliers[p.dataIndex]?.name ?? '' },
        },
      ],
    }
  }, [scores, outliers])

  // 跨模板对比横向条形图
  const tmplBarOption = useMemo(() => {
    const top = templateComparison.slice(0, 20)
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, right: 0, textStyle: { color: '#8b949e', fontSize: 11 } },
      grid: { top: 28, left: 80, right: 16, bottom: 8 },
      xAxis: { axisLabel: { color: '#8b949e', fontSize: 10 }, splitLine: { lineStyle: { color: '#21262d' } } },
      yAxis: {
        type: 'category',
        data: top.map(t => t.name.length > 8 ? t.name.slice(0, 8) : t.name).reverse(),
        axisLabel: { color: '#8b949e', fontSize: 10 },
      },
      series: [
        {
          name: '基准分', type: 'bar', stack: 'a',
          data: top.map(t => parseFloat(t.baseScore.toFixed(3))).reverse(),
          itemStyle: { color: '#4e9af1' },
        },
        {
          name: '最高分溢出', type: 'bar', stack: 'a',
          data: top.map(t => parseFloat(Math.max(t.maxScore - t.baseScore, 0).toFixed(3))).reverse(),
          itemStyle: { color: '#f1924e' },
        },
      ],
    }
  }, [templateComparison])

  const healthScore = scores.length > 0
    ? Math.max(0, Math.round(100 - outliers.length * 8 - issueTemplates.length * 5))
    : 0

  const outlierColumns = [
    { title: '名称', dataIndex: 'name', ellipsis: true },
    { title: '类型', dataIndex: 'foeType', width: 70, render: (v: number) => <Tag color={FOE_TYPE_COLORS[v] ?? 'default'}>{FOE_TYPE_LABELS[v] ?? v}</Tag> },
    { title: '关卡', dataIndex: 'barriesId', width: 55 },
    { title: '综合评分', dataIndex: 'overallScore', width: 90, render: (v: number) => <span style={{ color: '#f14e4e', fontWeight: 600 }}>{v.toFixed(3)}</span> },
    { title: 'EHP', dataIndex: 'ehpScore', width: 75, render: (v: number) => v.toFixed(2) },
    { title: 'DPS', dataIndex: 'dpsScore', width: 75, render: (v: number) => v.toFixed(2) },
  ]

  const tmplCmpColumns = [
    { title: '模板名', dataIndex: 'name', ellipsis: true },
    { title: '类型', dataIndex: 'foeType', width: 64, render: (v: number) => <Tag color={FOE_TYPE_COLORS[v] ?? 'default'} style={{ fontSize: 10 }}>{FOE_TYPE_LABELS[v] ?? v}</Tag> },
    { title: '基准分', dataIndex: 'baseScore', width: 80, sorter: (a: any, b: any) => a.baseScore - b.baseScore, render: (v: number) => <span style={{ color: '#4e9af1' }}>{v.toFixed(3)}</span> },
    { title: '最高分', dataIndex: 'maxScore', width: 80, render: (v: number) => <span style={{ color: '#f1924e' }}>{v.toFixed(3)}</span> },
    { title: '缩放率', dataIndex: 'scaleRatio', width: 72, render: (v: number) => <span style={{ color: v > 2 ? '#f1924e' : '#8b949e' }}>×{v.toFixed(2)}</span> },
    { title: '变种', dataIndex: 'variantCount', width: 52 },
    {
      title: '一致性', dataIndex: 'hasIssue', width: 70,
      render: (v: boolean) => v
        ? <Space size={3}><WarningOutlined style={{ color: '#f1c04e' }} /><Text style={{ fontSize: 11, color: '#f1c04e' }}>警告</Text></Space>
        : <Space size={3}><CheckCircleOutlined style={{ color: '#7ec94e' }} /><Text style={{ fontSize: 11, color: '#7ec94e' }}>良好</Text></Space>,
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Title level={4} style={{ margin: 0 }}>健康报告</Title>

      {health && (
        <Alert
          type={health.status === 'ok' ? 'success' : 'error'}
          showIcon
          message={`服务 ${health.status === 'ok' ? '正常' : '异常'} | 版本 ${health.version} | 数据目录：${health.dataDir}`}
        />
      )}

      {/* 全局统计 */}
      <Row gutter={12}>
        <Col span={4}>
          <Card size="small" title="整体健康度" style={{ textAlign: 'center' }}>
            <Progress
              type="circle" percent={healthScore} size={72}
              strokeColor={healthScore >= 80 ? '#7ec94e' : healthScore >= 60 ? '#f1c04e' : '#f14e4e'}
              format={p => <span style={{ fontSize: 14 }}>{p}%</span>}
            />
          </Card>
        </Col>
        <Col span={5}><Card size="small"><Statistic title="模板总数" value={templates.length} valueStyle={{ fontSize: 18 }} /></Card></Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="已评估" value={templates.filter(t => t.variants.some(v => v.score > 0)).length}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>/ {templates.length}</Text>}
              valueStyle={{ fontSize: 18, color: '#4e9af1' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="一致性问题" value={issueTemplates.length}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>/ {templates.length}</Text>}
              valueStyle={{ fontSize: 18, color: issueTemplates.length > 0 ? '#f1c04e' : '#7ec94e' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="异常怪物" value={outliers.length}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>/ {scores.length}</Text>}
              valueStyle={{ fontSize: 18, color: outliers.length > 0 ? '#f14e4e' : '#7ec94e' }} />
          </Card>
        </Col>
      </Row>

      {/* 评分分布 + 跨模板对比 */}
      {scores.length > 0 && (
        <Row gutter={12}>
          <Col span={11}>
            <Card title="各类型评分分布（箱线图）" size="small"
              extra={outliers.length > 0 && <Badge status="error" text={<Text style={{ fontSize: 12, color: '#f14e4e' }}>红点异常值</Text>} />}>
              <ReactECharts option={boxOption} style={{ height: 240 }} />
            </Card>
          </Col>
          <Col span={13}>
            <Card title="跨模板横向对比（基准分+最高分，按基准排序）" size="small">
              <ReactECharts option={tmplBarOption} style={{ height: 240 }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 一致性问题逐条展开 */}
      {issueTemplates.length > 0 && (
        <Card
          size="small"
          title={<Space><WarningOutlined style={{ color: '#f1c04e' }} /><Text>一致性问题详情（{issueTemplates.length} 个模板）</Text></Space>}
        >
          <Collapse size="small" ghost>
            {issueTemplates.map(t => {
              const issues = getTemplateIssues(t)
              return (
                <Collapse.Panel
                  key={t.clusterKey}
                  header={
                    <Space>
                      <Tag color={FOE_TYPE_COLORS[t.foeType] ?? 'default'} style={{ fontSize: 10 }}>
                        {FOE_TYPE_LABELS[t.foeType] ?? `T${t.foeType}`}
                      </Tag>
                      <Text style={{ fontSize: 12 }}>{t.variants[0]?.name ?? t.clusterKey}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        基准分 {t.variants[0]?.score.toFixed(2) ?? '—'} · {t.variants.length} 变种
                      </Text>
                      {issues.length > 0 && <Badge count={issues.length} color="#f1c04e" />}
                    </Space>
                  }
                >
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {issues.map((iss, i) => (
                      <li key={i} style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>{iss}</li>
                    ))}
                    {issues.length === 0 && (
                      <li style={{ fontSize: 11, color: '#8b949e' }}>后端标记了一致性问题，但前端检测阈值内未发现具体偏差（&gt;25%）</li>
                    )}
                  </ul>
                </Collapse.Panel>
              )
            })}
          </Collapse>
        </Card>
      )}

      {/* 跨模板对比表格 */}
      {templateComparison.length > 0 && (
        <Card size="small" title="跨模板积分向对比（按基准分排序）">
          <Table
            rowKey="key"
            dataSource={templateComparison}
            columns={tmplCmpColumns}
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: false }}
            scroll={{ x: 550 }}
          />
        </Card>
      )}

      {/* 异常怪物列表 */}
      {outliers.length > 0 && (
        <Card size="small" title={<Space><Badge status="error" /><Text>异常评分怪物（IQR 检测）</Text></Space>}>
          <Table rowKey="configId" dataSource={outliers} columns={outlierColumns} size="small" pagination={false} />
        </Card>
      )}

      {outliers.length === 0 && issueTemplates.length === 0 && scores.length > 0 && (
        <Alert type="success" showIcon message="数值健康状态良好，未发现异常怪物或模板一致性问题" />
      )}
    </Space>
  )
}
