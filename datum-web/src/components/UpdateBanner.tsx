import { useQuery } from '@tanstack/react-query'
import { Button, Space, Tag } from 'antd'
import { api } from '../api/client'

interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  releaseNotes?: string
  downloadUrl?: string
}

export default function UpdateBanner() {
  const { data } = useQuery<UpdateCheckResult>({
    queryKey: ['update-check'],
    queryFn: () => api.get('/update/check').then(r => r.data),
    staleTime: 1000 * 60 * 30,
    retry: false,
  })

  if (!data) return <span style={{ color: '#484f58', fontSize: 12 }}>Datum Platform</span>

  if (!data.hasUpdate) {
    return (
      <Space>
        <span style={{ color: '#484f58', fontSize: 12 }}>Datum Platform</span>
        <Tag color="default" style={{ fontSize: 11 }}>v{data.currentVersion}</Tag>
      </Space>
    )
  }

  const handleUpdate = async () => {
    if (!data.downloadUrl) return
    await api.post('/update/apply', { downloadUrl: data.downloadUrl })
  }

  return (
    <Space>
      <Tag color="blue">v{data.currentVersion}</Tag>
      <span style={{ color: '#4e9af1', fontSize: 12 }}>
        发现新版本 v{data.latestVersion}：{data.releaseNotes}
      </span>
      <Button size="small" type="primary" onClick={handleUpdate}>
        立即更新
      </Button>
    </Space>
  )
}
