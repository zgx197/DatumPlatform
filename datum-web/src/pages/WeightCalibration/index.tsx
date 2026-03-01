import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Slider, Button, Typography, Space, Row, Col, Statistic, message, Table, Tag, Alert, Divider } from 'antd'
import { useState, useEffect, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { datumApi } from '../../api/datum'
import type { WeightConfig, EntityScore } from '../../types/datum'
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
  const queryClient = useQueryClient()
  const { data: weights } = useQuery<WeightConfig>({
    queryKey: ['weights'],
    queryFn: () => datumApi.weights(),
  })

  const [local, setLocal] = useState<WeightConfig | null>(null)
  const [previewScores, setPreviewScores] = useState<EntityScore[] | null>(null)

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
  })

  const totalWeight = local ? parseFloat((local.weightEHP + local.weightDPS + local.weightControl).toFixed(3)) : 0
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
          <WeightSlider label="EHP 权重（生存能力）" value={local.weightEHP}
            onChange={v => setLocal({ ...local, weightEHP: v })} />
        </Col>
        <Col span={8}>
          <WeightSlider label="DPS 权重（输出能力）" value={local.weightDPS}
            onChange={v => setLocal({ ...local, weightDPS: v })} />
        </Col>
        <Col span={8}>
          <WeightSlider label="控制权重（控场能力）" value={local.weightControl}
            onChange={v => setLocal({ ...local, weightControl: v })} />
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
    </Space>
  )
}
