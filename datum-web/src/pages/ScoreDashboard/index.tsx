import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tag, Space, Typography, Statistic, Row, Col, Card, Select, Input, Drawer, Descriptions, Alert, Button, message, Tooltip, Progress } from 'antd'
import { SearchOutlined, WarningOutlined, PlusOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useState, useMemo } from 'react'
import { datumApi } from '../../api/datum'
import type { EntityScore, CalibrationSample } from '../../types/datum'
import { FOE_TYPE_LABELS, FOE_TYPE_COLORS } from '../../types/datum'

const { Title, Text } = Typography

const TYPE_COLORS_HEX: Record<number, string> = {
  1: '#4e9af1', 2: '#36d6d6', 3: '#f1924e', 4: '#f14e4e', 5: '#7ec94e',
}

// 检测单个怪物的异常项
function detectAnomalies(s: EntityScore): string[] {
  const issues: string[] = []
  const ehp = s.ehpScore, dps = s.dpsScore, ctrl = s.controlScore
  if (ehp > 0 && dps > 0 && ehp / dps > 10) issues.push(`生存能力远大于输出能力（EHP ${ehp.toFixed(1)} vs DPS ${dps.toFixed(1)}）`)
  if (ehp > 0 && dps > 0 && dps / ehp > 10) issues.push(`输出能力远大于生存能力（DPS ${dps.toFixed(1)} vs EHP ${ehp.toFixed(1)}）`)
  if (ctrl >= 1.0) issues.push(`控制评分达到上限（${(ctrl * 100).toFixed(0)}%），建议检查技能配置`)
  if (dps === 0) issues.push(`DPS 为 0，可能缺少对应技能蓝图数据`)
  return issues
}

// 难度条：EHP(蓝) + DPS(橙) 双色
function DifficultyBar({ ehp, dps, maxVal }: { ehp: number; dps: number; maxVal: number }) {
  if (maxVal <= 0) return <span style={{ color: '#555' }}>—</span>
  const ehpW = Math.min((ehp / maxVal) * 100, 100)
  const dpsW = Math.min((dps / maxVal) * 100, 100)
  return (
    <div style={{ width: 120, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Tooltip title={`EHP: ${ehp.toFixed(2)}`}>
        <div style={{ height: 6, background: '#21262d', borderRadius: 3 }}>
          <div style={{ height: '100%', width: `${ehpW}%`, background: '#4e9af1', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
      </Tooltip>
      <Tooltip title={`DPS: ${dps.toFixed(2)}`}>
        <div style={{ height: 6, background: '#21262d', borderRadius: 3 }}>
          <div style={{ height: '100%', width: `${dpsW}%`, background: '#f1924e', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
      </Tooltip>
    </div>
  )
}

export default function ScoreDashboard() {
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState<number | null>(null)
  const [filterBarries, setFilterBarries] = useState<number | null>(null)
  const [selected, setSelected] = useState<EntityScore | null>(null)

  const { data: scores = [], isLoading } = useQuery<EntityScore[]>({
    queryKey: ['scores'],
    queryFn: () => datumApi.scores(),
  })

  const { data: calibSamples = [] } = useQuery<CalibrationSample[]>({
    queryKey: ['calibration-samples'],
    queryFn: () => datumApi.calibrationSamples(),
  })

  const addToCalibMutation = useMutation({
    mutationFn: async (score: EntityScore) => {
      const existing = calibSamples.find(s => s.configId === score.configId)
      if (existing) { message.info(`${score.name} 已在校准样本中`); return }
      const newSample: CalibrationSample = {
        configId: score.configId,
        name: score.name,
        subjectiveScore: 5,
        ehpNorm: score.normalizedValues?.EHP_norm ?? score.ehpScore,
        dpsNorm: score.normalizedValues?.DPS_norm ?? score.dpsScore,
        controlNorm: score.normalizedValues?.Control_norm ?? score.controlScore,
      }
      await datumApi.saveCalibrationSamples([...calibSamples, newSample])
    },
    onSuccess: () => {
      message.success('已添加到校准样本')
      queryClient.invalidateQueries({ queryKey: ['calibration-samples'] })
    },
  })

  const barriesIds = useMemo(() => [...new Set(scores.map(s => s.barriesId))].sort((a, b) => a - b), [scores])
  const foeTypes = useMemo(() => [...new Set(scores.map(s => s.foeType))].sort(), [scores])

  const filtered = useMemo(() => scores.filter(s => {
    const matchName = s.name.toLowerCase().includes(searchText.toLowerCase()) || String(s.configId).includes(searchText)
    const matchType = filterType == null || s.foeType === filterType
    const matchBarries = filterBarries == null || s.barriesId === filterBarries
    return matchName && matchType && matchBarries
  }), [scores, searchText, filterType, filterBarries])

  const maxEHP = useMemo(() => Math.max(...filtered.map(s => s.ehpScore), 1), [filtered])
  const maxDPS = useMemo(() => Math.max(...filtered.map(s => s.dpsScore), 1), [filtered])
  const maxBar  = Math.max(maxEHP, maxDPS)

  const scatterSeries = useMemo(() => {
    const grouped: Record<number, EntityScore[]> = {}
    filtered.forEach(s => { (grouped[s.foeType] ??= []).push(s) })
    return Object.entries(grouped).map(([type, items]) => ({
      name: FOE_TYPE_LABELS[Number(type)] ?? `类型${type}`,
      type: 'scatter',
      data: items.map(s => [s.ehpScore, s.dpsScore, s.name, s.overallScore, s.configId]),
      symbolSize: (d: number[]) => Math.max(8, Math.min(d[3] * 6 + 8, 40)),
      itemStyle: { color: TYPE_COLORS_HEX[Number(type)] ?? '#aaa', opacity: 0.85 },
      emphasis: { itemStyle: { color: '#f1c04e', opacity: 1 } },
    }))
  }, [filtered])

  const scatterOption = useMemo(() => ({
    backgroundColor: 'transparent',
    legend: { top: 0, right: 0, textStyle: { color: '#8b949e' } },
    tooltip: {
      trigger: 'item',
      formatter: (p: any) =>
        `<b>${p.data[2]}</b><br/>综合: ${(p.data[3] as number).toFixed(3)}<br/>EHP: ${(p.data[0] as number).toFixed(2)} | DPS: ${(p.data[1] as number).toFixed(2)}`,
    },
    xAxis: { name: 'EHP 评分', nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: '#8b949e' }, axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
    yAxis: { name: 'DPS 评分', nameLocation: 'middle', nameGap: 45, nameTextStyle: { color: '#8b949e' }, axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
    series: scatterSeries,
  }), [scatterSeries])

  const avg = filtered.length > 0 ? filtered.reduce((s, r) => s + r.overallScore, 0) / filtered.length : 0
  const maxScore = filtered.length > 0 ? Math.max(...filtered.map(s => s.overallScore)) : 0
  const anomalyCount = filtered.filter(s => detectAnomalies(s).length > 0).length

  const columns = [
    {
      title: '名称', dataIndex: 'name', ellipsis: true, width: 120,
      render: (v: string, row: EntityScore) => {
        const issues = detectAnomalies(row)
        return (
          <Space size={4}>
            {issues.length > 0 && <Tooltip title={issues.join('\n')}><WarningOutlined style={{ color: '#f1c04e' }} /></Tooltip>}
            <span>{v}</span>
          </Space>
        )
      },
    },
    {
      title: '类型', dataIndex: 'foeType', width: 64,
      render: (v: number) => <Tag color={FOE_TYPE_COLORS[v] ?? 'default'} style={{ fontSize: 11 }}>{FOE_TYPE_LABELS[v] ?? v}</Tag>,
    },
    { title: '关卡', dataIndex: 'barriesId', width: 52, sorter: (a: EntityScore, b: EntityScore) => a.barriesId - b.barriesId },
    {
      title: '综合评分', dataIndex: 'overallScore', width: 90, defaultSortOrder: 'descend' as const,
      sorter: (a: EntityScore, b: EntityScore) => a.overallScore - b.overallScore,
      render: (v: number) => <span style={{ color: '#4e9af1', fontWeight: 600 }}>{v.toFixed(3)}</span>,
    },
    {
      title: 'EHP', dataIndex: 'ehpScore', width: 80,
      sorter: (a: EntityScore, b: EntityScore) => a.ehpScore - b.ehpScore,
      render: (v: number) => v.toFixed(1),
    },
    {
      title: 'DPS', dataIndex: 'dpsScore', width: 80,
      sorter: (a: EntityScore, b: EntityScore) => a.dpsScore - b.dpsScore,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '难度', key: 'bar', width: 130,
      render: (_: any, row: EntityScore) => <DifficultyBar ehp={row.ehpScore} dps={row.dpsScore} maxVal={maxBar} />,
    },
  ]

  const selectedAnomalies = selected ? detectAnomalies(selected) : []
  const alreadyInCalib = selected ? calibSamples.some(s => s.configId === selected.configId) : false

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Title level={4} style={{ margin: 0 }}>全量评估</Title>

      <Row gutter={12}>
        <Col span={5}><Card size="small"><Statistic title="怪物总数" value={`${filtered.length} / ${scores.length}`} valueStyle={{ fontSize: 18 }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="平均评分" value={avg.toFixed(3)} valueStyle={{ fontSize: 18, color: '#4e9af1' }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="最高评分" value={maxScore.toFixed(3)} valueStyle={{ fontSize: 18, color: '#f1924e' }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="关卡数" value={barriesIds.length} valueStyle={{ fontSize: 18 }} /></Card></Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="异常怪物" value={anomalyCount}
              valueStyle={{ fontSize: 18, color: anomalyCount > 0 ? '#f1c04e' : '#7ec94e' }} />
          </Card>
        </Col>
      </Row>

      <Card title="EHP vs DPS 分布" size="small">
        <ReactECharts option={scatterOption} style={{ height: 280 }} />
      </Card>

      <Card
        size="small"
        title={
          <Row gutter={8} align="middle" wrap={false}>
            <Col>
              <Input placeholder="搜索名称/ID" prefix={<SearchOutlined />} value={searchText}
                onChange={e => setSearchText(e.target.value)} style={{ width: 170 }} allowClear />
            </Col>
            <Col>
              <Select placeholder="类型" allowClear style={{ width: 90 }} value={filterType}
                onChange={v => setFilterType(v ?? null)}
                options={foeTypes.map(t => ({ value: t, label: FOE_TYPE_LABELS[t] ?? `类型${t}` }))} />
            </Col>
            <Col>
              <Select placeholder="关卡" allowClear style={{ width: 80 }} value={filterBarries}
                onChange={v => setFilterBarries(v ?? null)}
                options={barriesIds.map(b => ({ value: b, label: `关卡 ${b}` }))} />
            </Col>
            <Col style={{ color: '#8b949e', fontSize: 12, whiteSpace: 'nowrap' }}>
              {filtered.length} / {scores.length} 条
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
          pagination={{ pageSize: 25, showSizeChanger: false }}
          scroll={{ x: 650 }}
          rowClassName={(row) => detectAnomalies(row).length > 0 ? 'row-warning' : ''}
          onRow={(row) => ({ onClick: () => setSelected(row), style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title={selected ? `${selected.name}（ID: ${selected.configId}）` : ''}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={400}
        styles={{ body: { padding: 16 } }}
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="ConfigId">{selected.configId}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={FOE_TYPE_COLORS[selected.foeType] ?? 'default'}>{FOE_TYPE_LABELS[selected.foeType] ?? selected.foeType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关卡">关卡 {selected.barriesId}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="综合评分">
              <Row gutter={12}>
                <Col span={12}>
                  <Statistic title="综合评分" value={selected.overallScore.toFixed(3)} valueStyle={{ color: '#4e9af1', fontSize: 20 }} />
                </Col>
                <Col span={12}>
                  <Statistic title="类型系数" value={
                    selected.foeType === 4 ? '×2.5 (Boss)' : selected.foeType === 5 ? '×1.5 (精英)' : '×1.0'
                  } valueStyle={{ fontSize: 14 }} />
                </Col>
              </Row>
            </Card>

            <Card size="small" title="战斗指标">
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>EHP（生存）</Text>
                  <Progress
                    percent={Math.min((selected.ehpScore / maxEHP) * 100, 100)}
                    strokeColor="#4e9af1" size="small"
                    format={() => selected.ehpScore.toFixed(1)}
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>DPS（输出）</Text>
                  <Progress
                    percent={Math.min((selected.dpsScore / maxDPS) * 100, 100)}
                    strokeColor="#f1924e" size="small"
                    format={() => selected.dpsScore.toFixed(2)}
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>控制评分</Text>
                  <Progress
                    percent={Math.min(selected.controlScore * 100, 100)}
                    strokeColor="#7ec94e" size="small"
                    format={() => (selected.controlScore * 100).toFixed(1) + '%'}
                  />
                </div>
              </Space>
            </Card>

            <Card size="small" title="贡献分解">
              <Row gutter={8}>
                <Col span={8}><Statistic title="生存贡献" value={(selected.normalizedValues?.EHP_norm ?? selected.ehpScore).toFixed(3)} valueStyle={{ fontSize: 14, color: '#4e9af1' }} /></Col>
                <Col span={8}><Statistic title="输出贡献" value={(selected.normalizedValues?.DPS_norm ?? selected.dpsScore).toFixed(3)} valueStyle={{ fontSize: 14, color: '#f1924e' }} /></Col>
                <Col span={8}><Statistic title="控制贡献" value={(selected.normalizedValues?.Control_norm ?? selected.controlScore).toFixed(4)} valueStyle={{ fontSize: 14, color: '#7ec94e' }} /></Col>
              </Row>
            </Card>

            {selectedAnomalies.length > 0 && (
              <Alert type="warning" showIcon
                message="异常检测"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {selectedAnomalies.map((issue, i) => <li key={i} style={{ fontSize: 12 }}>{issue}</li>)}
                  </ul>
                }
              />
            )}

            <Button
              type="primary"
              icon={<PlusOutlined />}
              block
              disabled={alreadyInCalib}
              loading={addToCalibMutation.isPending}
              onClick={() => addToCalibMutation.mutate(selected)}
            >
              {alreadyInCalib ? '已在校准样本中' : '添加到校准样本'}
            </Button>
          </Space>
        )}
      </Drawer>
    </Space>
  )
}
