import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { App as AntdApp, Card, Slider, Button, Typography, Space, Row, Col, Statistic, Table, Tag, Alert, Divider, Progress, InputNumber, Popconfirm } from 'antd'
import { ThunderboltOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons'
import { useState, useEffect, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { datumApi } from '../../api/datum'
import type { WeightConfig, EntityScore, CalibrationSample } from '../../types/datum'
import { FOE_TYPE_LABELS, FOE_TYPE_COLORS } from '../../types/datum'

const { Title, Text } = Typography

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Card size="small" title={label} style={{ textAlign: 'center' }}>
      <Slider min={0} max={1} step={0.01} value={value} onChange={onChange} />
      <Statistic value={(value * 100).toFixed(0)} suffix="%" valueStyle={{ fontSize: 20 }} />
    </Card>
  )
}

export default function WeightCalibration() {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const { data: weights } = useQuery<WeightConfig>({
    queryKey: ['weights'],
    queryFn: () => datumApi.weights(),
  })

  const [local, setLocal] = useState<WeightConfig | null>(null)
  const [previewScores, setPreviewScores] = useState<EntityScore[] | null>(null)
  const [samplesForCalib, setSamplesForCalib] = useState<import('../../types/datum').CalibrationSample[]>([])

  useEffect(() => { if (weights && !local) setLocal({ ...weights }) }, [weights])

  const saveMutation = useMutation({
    mutationFn: (w: WeightConfig) => datumApi.updateWeights(w),
    onSuccess: () => {
      message.success('权重已保存并重新计算评分')
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['weights'] })
      setPreviewScores(null)
    },
  })

  const recalcMutation = useMutation({
    mutationFn: (w: WeightConfig) => datumApi.recalcScores(w),
    onSuccess: (data) => setPreviewScores(data),
    onError: (err: any) => message.error(`预览重算失败：${err?.response?.data?.message ?? err?.message ?? '未知错误'}`),
  })

  const totalWeight = local ? parseFloat((local.survival_weight + local.damage_weight + local.control_weight).toFixed(3)) : 0
  const isWeightValid = Math.abs(totalWeight - 1.0) < 0.01

  const scatterOption = useMemo(() => {
    const src = previewScores ?? []
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `<b>${p.data[2]}</b><br/>综合: ${p.data[3].toFixed(2)}`,
      },
      xAxis: { name: 'EHP 评分', nameLocation: 'middle', nameGap: 28, axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
      yAxis: { name: 'DPS 评分', nameLocation: 'middle', nameGap: 42, axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
      series: [{
        type: 'scatter',
        data: src.map(s => [s.ehpScore, s.dpsScore, s.name, s.overallScore]),
        symbolSize: (d: number[]) => Math.max(8, Math.min(d[3] * 1.5, 36)),
        itemStyle: { color: '#4e9af1', opacity: 0.85 },
        emphasis: { itemStyle: { color: '#f1c04e' } },
      }],
    }
  }, [previewScores])

  if (!local) return null

  const previewColumns = [
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '类型', dataIndex: 'foeType', width: 70,
      render: (v: number) => <Tag color={FOE_TYPE_COLORS[v] ?? 'default'}>{FOE_TYPE_LABELS[v] ?? v}</Tag>,
    },
    {
      title: '综合评分', dataIndex: 'overallScore', width: 100, defaultSortOrder: 'descend' as const,
      sorter: (a: EntityScore, b: EntityScore) => a.overallScore - b.overallScore,
      render: (v: number) => <span style={{ color: '#4e9af1', fontWeight: 600 }}>{v.toFixed(2)}</span>,
    },
    { title: 'EHP', dataIndex: 'ehpScore', width: 80, render: (v: number) => v.toFixed(2) },
    { title: 'DPS', dataIndex: 'dpsScore', width: 80, render: (v: number) => v.toFixed(2) },
    { title: '控制', dataIndex: 'controlScore', width: 80, render: (v: number) => v.toFixed(2) },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Title level={4} style={{ margin: 0 }}>权重调节</Title>

      <Row gutter={16}>
        <Col span={8}>
          <WeightSlider label="EHP 权重（生存能力）" value={local.survival_weight}
            onChange={v => setLocal({ ...local, survival_weight: v })} />
        </Col>
        <Col span={8}>
          <WeightSlider label="DPS 权重（输出能力）" value={local.damage_weight}
            onChange={v => setLocal({ ...local, damage_weight: v })} />
        </Col>
        <Col span={8}>
          <WeightSlider label="控制权重（控场能力）" value={local.control_weight}
            onChange={v => setLocal({ ...local, control_weight: v })} />
        </Col>
      </Row>

      {!isWeightValid && (
        <Alert
          type="warning"
          message={`权重总和为 ${totalWeight.toFixed(2)}，建议调整为 1.00 以保证评分量纲一致`}
          showIcon
        />
      )}

      <Space>
        <Button
          type="primary"
          onClick={() => recalcMutation.mutate(local)}
          loading={recalcMutation.isPending}
        >
          预览重算
        </Button>
        <Button
          onClick={() => saveMutation.mutate(local)}
          loading={saveMutation.isPending}
          disabled={!isWeightValid}
        >
          保存并应用
        </Button>
        <Button onClick={() => { if (weights) setLocal({ ...weights }); setPreviewScores(null) }}>
          重置
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          权重总和：<Text type={isWeightValid ? 'success' : 'warning'}>{totalWeight.toFixed(2)}</Text>
        </Text>
      </Space>

      {previewScores && (
        <>
          <Divider style={{ margin: '4px 0' }} />
          <Card title={`预览结果（${previewScores.length} 条，未保存）`} size="small" extra={<Text type="warning" style={{ fontSize: 12 }}>预览模式</Text>}>
            <ReactECharts option={scatterOption} style={{ height: 260 }} />
            <Table
              rowKey="configId"
              dataSource={previewScores}
              columns={previewColumns}
              size="small"
              pagination={false}
              scroll={{ x: 500, y: 240 }}
              style={{ marginTop: 12 }}
            />
          </Card>
        </>
      )}

      <Divider style={{ margin: '4px 0' }}>校准样本管理</Divider>
      <SamplesPanel onSamplesChange={setSamplesForCalib} />

      <Divider style={{ margin: '4px 0' }}>最小二乘权重校准</Divider>
      <CalibrationPanel
        localSampleCount={samplesForCalib.length}
        onApply={(w) => { setLocal({ ...local!, ...w }); setPreviewScores(null) }}
      />
    </Space>
  )
}

function CalibrationPanel({ onApply, localSampleCount }: { onApply: (w: Partial<WeightConfig>) => void; localSampleCount: number }) {
  const { message } = AntdApp.useApp()
  const [calibResult, setCalibResult] = useState<{
    survival_weight: number; damage_weight: number; control_weight: number
    scaleFactor: number; rSquared: number; mse: number; interpretation: string
  } | null>(null)

  const { data: samples = [] } = useQuery<CalibrationSample[]>({
    queryKey: ['calibration-samples'],
    queryFn: () => datumApi.calibrationSamples(),
  })

  const sampleCount = localSampleCount > 0 ? localSampleCount : samples.length

  const calibMutation = useMutation({
    mutationFn: () => datumApi.runCalibration(),
    onSuccess: (data) => setCalibResult(data),
    onError: () => message.error('校准失败，样本数据不足或矩阵奇异，请先保存样本'),
  })

  const scatterOpt = useMemo(() => {
    if (!calibResult || samples.length === 0) return null
    const { survival_weight, damage_weight, control_weight, scaleFactor } = calibResult
    const pts = samples.map(s => {
      const pred = scaleFactor * (survival_weight * s.ehpNorm + damage_weight * s.dpsNorm + control_weight * s.controlNorm) * 10
      return [pred, s.subjectiveScore, s.name]
    })
    const maxVal = Math.max(...pts.flatMap(p => [p[0] as number, p[1] as number])) * 1.1
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: (p: any) => `${p.data[2]}<br/>预测: ${(p.data[0] as number).toFixed(2)} | 主观: ${p.data[1]}` },
      xAxis: { name: '预测评分', nameLocation: 'middle', nameGap: 28, min: 0, max: maxVal, axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
      yAxis: { name: '主观评分', nameLocation: 'middle', nameGap: 36, min: 0, max: maxVal, axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
      series: [
        { type: 'line', data: [[0, 0], [maxVal, maxVal]], lineStyle: { color: '#444', type: 'dashed' }, symbol: 'none' },
        { type: 'scatter', data: pts, symbolSize: 10, itemStyle: { color: '#4e9af1', opacity: 0.85 }, emphasis: { itemStyle: { color: '#f1c04e' } } },
      ],
    }
  }, [calibResult, samples])

  return (
    <Card
      size="small"
      title="权重自动校准（最小二乘法）"
      extra={
        <Button
          type="primary"
          size="small"
          icon={<ThunderboltOutlined />}
          loading={calibMutation.isPending}
          onClick={() => calibMutation.mutate()}
          disabled={sampleCount < 3}
        >
          一键校准（{sampleCount} 条样本）
        </Button>
      }
    >
      {sampleCount < 3 && (
        <Alert type="info" showIcon
          message="需要至少 3 条校准样本才能运行自动校准"
          description="请在 calibration.json 中添加主观评分样本"
          style={{ marginBottom: 12 }}
        />
      )}

      {calibResult && (
        <>
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Card size="small" title="推荐 EHP 权重">
                <div style={{ fontSize: 20, fontWeight: 700, color: '#4e9af1' }}>{(calibResult.survival_weight * 100).toFixed(0)}%</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" title="推荐 DPS 权重">
                <div style={{ fontSize: 20, fontWeight: 700, color: '#f1924e' }}>{(calibResult.damage_weight * 100).toFixed(0)}%</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" title="推荐控制权重">
                <div style={{ fontSize: 20, fontWeight: 700, color: '#7ec94e' }}>{(calibResult.control_weight * 100).toFixed(0)}%</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" title="拟合度 R²">
                <Progress
                  type="circle" size={60}
                  percent={Math.round(calibResult.rSquared * 100)}
                  strokeColor={calibResult.rSquared >= 0.7 ? '#7ec94e' : '#f1c04e'}
                />
              </Card>
            </Col>
          </Row>

          <Alert
            type={calibResult.rSquared >= 0.7 ? 'success' : 'warning'}
            showIcon
            message={calibResult.interpretation}
            description={`MSE: ${calibResult.mse.toFixed(4)} | 缩放因子: ${calibResult.scaleFactor.toFixed(3)}`}
            style={{ marginBottom: 12 }}
          />

          {scatterOpt && <ReactECharts option={scatterOpt} style={{ height: 240 }} />}

          <Button
            type="primary"
            onClick={() => onApply({
              survival_weight: calibResult.survival_weight,
              damage_weight: calibResult.damage_weight,
              control_weight: calibResult.control_weight,
            })}
            style={{ marginTop: 12 }}
          >
            应用推荐权重到滑块
          </Button>
        </>
      )}
    </Card>
  )
}

function SamplesPanel({ onSamplesChange }: { onSamplesChange: (samples: CalibrationSample[]) => void }) {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const { data: rawSamples = [] } = useQuery<CalibrationSample[]>({
    queryKey: ['calibration-samples'],
    queryFn: () => datumApi.calibrationSamples(),
  })

  const [localSamples, setLocalSamples] = useState<CalibrationSample[]>([])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    // 加载时按 configId 去重，防止重复添加导致 duplicate key
    const seen = new Set<number>()
    const deduped = rawSamples.filter(s => {
      if (seen.has(s.configId)) return false
      seen.add(s.configId)
      return true
    })
    setLocalSamples(deduped.map(s => ({ ...s })))
    setDirty(false)
    onSamplesChange(deduped)
  }, [rawSamples])

  const saveMutation = useMutation({
    mutationFn: () => datumApi.saveCalibrationSamples(localSamples),
    onSuccess: () => {
      message.success('校准样本已保存')
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ['calibration-samples'] })
    },
    onError: () => message.error('保存失败'),
  })

  // 当 localSamples 变化时通知父组件（用 useEffect 避免在 state updater 内部 setState）
  useEffect(() => {
    onSamplesChange(localSamples)
  }, [localSamples])

  const updateScore = (configId: number, score: number) => {
    setLocalSamples(prev => prev.map(s => s.configId === configId ? { ...s, subjectiveScore: score } : s))
    setDirty(true)
  }

  const removeSample = (configId: number) => {
    setLocalSamples(prev => prev.filter(s => s.configId !== configId))
    setDirty(true)
  }

  const ANCHOR_COLORS = ['#52c41a', '#faad14', '#ff4d4f']
  const anchorMarks = { 2: { style: { color: ANCHOR_COLORS[0] }, label: '简单' }, 5: { style: { color: ANCHOR_COLORS[1] }, label: '中等' }, 8: { style: { color: ANCHOR_COLORS[2] }, label: '困难' } }

  const columns = [
    {
      title: '名称', dataIndex: 'name', width: 120, ellipsis: true,
      render: (v: string, row: CalibrationSample) => (
        <Space size={4}>
          <Tag color={
            row.subjectiveScore <= 3 ? 'success' : row.subjectiveScore <= 6 ? 'warning' : 'error'
          } style={{ fontSize: 10, padding: '0 4px' }}>
            {row.subjectiveScore <= 3 ? '简单' : row.subjectiveScore <= 6 ? '中等' : '困难'}
          </Tag>
          <span style={{ fontSize: 12 }}>{v}</span>
        </Space>
      ),
    },
    {
      title: '主观评分（1-10）', key: 'score', width: 280,
      render: (_: any, row: CalibrationSample) => (
        <Row align="middle" gutter={8} wrap={false}>
          <Col flex="1">
            <Slider
              min={1} max={10} step={0.5}
              value={row.subjectiveScore}
              onChange={v => updateScore(row.configId, v)}
              marks={anchorMarks}
              tooltip={{ formatter: (v) => v?.toFixed(1) }}
              style={{ margin: '0 8px' }}
            />
          </Col>
          <Col>
            <InputNumber
              min={1} max={10} step={0.5} size="small"
              value={row.subjectiveScore}
              onChange={v => v != null && updateScore(row.configId, v)}
              style={{ width: 56 }}
            />
          </Col>
        </Row>
      ),
    },
    {
      title: 'EHP_norm', dataIndex: 'ehpNorm', width: 90,
      render: (v: number) => <span style={{ color: '#4e9af1', fontSize: 12 }}>{v.toFixed(3)}</span>,
    },
    {
      title: 'DPS_norm', dataIndex: 'dpsNorm', width: 90,
      render: (v: number) => <span style={{ color: '#f1924e', fontSize: 12 }}>{v.toFixed(3)}</span>,
    },
    {
      title: '操作', key: 'action', width: 60,
      render: (_: any, row: CalibrationSample) => (
        <Popconfirm title="确认删除此样本？" onConfirm={() => removeSample(row.configId)} okText="删除" cancelText="取消">
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <Card
      size="small"
      title={`校准样本（${localSamples.length} 条，建议 8-15 个）`}
      extra={
        <Space>
          {dirty && <Text type="warning" style={{ fontSize: 12 }}>有未保存的修改</Text>}
          <Button
            type="primary" size="small"
            icon={<SaveOutlined />}
            loading={saveMutation.isPending}
            disabled={!dirty}
            onClick={() => saveMutation.mutate()}
          >
            保存
          </Button>
        </Space>
      }
    >
      {localSamples.length === 0 ? (
        <Alert type="info" showIcon message="暂无校准样本" description="在「全量评估」页面点击怪物详情中的「添加到校准样本」按钮来添加" />
      ) : (
        <Table
          rowKey="configId"
          dataSource={localSamples}
          columns={columns}
          size="small"
          pagination={false}
          scroll={{ y: 320 }}
        />
      )}
    </Card>
  )
}
