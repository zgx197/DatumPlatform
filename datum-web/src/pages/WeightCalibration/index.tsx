import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Slider, Button, Typography, Space, Row, Col, Statistic, message } from 'antd'
import { useState, useEffect } from 'react'
import { api } from '../../api/client'

const { Title, Text } = Typography

interface WeightConfig {
  baselineAtk: number
  baselineDef: number
  baselineHP: number
  weightEHP: number
  weightDPS: number
  weightControl: number
  powerMeanAlpha: number
}

export default function WeightCalibration() {
  const queryClient = useQueryClient()
  const { data: weights } = useQuery<WeightConfig>({
    queryKey: ['weights'],
    queryFn: () => api.get('/weights').then(r => r.data),
  })

  const [local, setLocal] = useState<WeightConfig | null>(null)
  useEffect(() => { if (weights) setLocal({ ...weights }) }, [weights])

  const saveMutation = useMutation({
    mutationFn: (w: WeightConfig) => api.put('/weights', w),
    onSuccess: () => {
      message.success('权重已保存并重新计算评分')
      queryClient.invalidateQueries({ queryKey: ['scores'] })
    },
  })

  const recalcMutation = useMutation({
    mutationFn: (w: WeightConfig) => api.post('/scores/recalc', w).then(r => r.data),
  })

  if (!local) return null

  const totalWeight = (local.weightEHP + local.weightDPS + local.weightControl).toFixed(2)

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Title level={4} style={{ margin: 0 }}>权重校准</Title>

      <Row gutter={16}>
        <Col span={8}>
          <Card title="EHP 权重" size="small">
            <Slider
              min={0} max={1} step={0.01}
              value={local.weightEHP}
              onChange={v => setLocal({ ...local, weightEHP: v })}
            />
            <Statistic value={(local.weightEHP * 100).toFixed(0)} suffix="%" />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="DPS 权重" size="small">
            <Slider
              min={0} max={1} step={0.01}
              value={local.weightDPS}
              onChange={v => setLocal({ ...local, weightDPS: v })}
            />
            <Statistic value={(local.weightDPS * 100).toFixed(0)} suffix="%" />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="控制权重" size="small">
            <Slider
              min={0} max={1} step={0.01}
              value={local.weightControl}
              onChange={v => setLocal({ ...local, weightControl: v })}
            />
            <Statistic value={(local.weightControl * 100).toFixed(0)} suffix="%" />
          </Card>
        </Col>
      </Row>

      <Text type={parseFloat(totalWeight) === 1.0 ? 'success' : 'warning'}>
        权重总和：{totalWeight}（应为 1.00）
      </Text>

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
        >
          保存权重
        </Button>
      </Space>
    </Space>
  )
}
