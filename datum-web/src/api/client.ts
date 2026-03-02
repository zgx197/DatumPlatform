import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// 统一错误处理：结构化输出，便于调试面板解析
api.interceptors.response.use(
  res => res,
  err => {
    const res = err.response
    const req = err.config
    // 构造结构化的 API 错误对象，挂载到 err 上供调试面板读取
    const apiError = {
      type: 'API_ERROR' as const,
      method: req?.method?.toUpperCase() ?? '?',
      url: req?.url ?? '?',
      status: res?.status ?? 0,
      statusText: res?.statusText ?? err.message,
      // 后端返回的具体错误消息（ASP.NET Core Problem Details 格式）
      detail: res?.data?.detail ?? res?.data?.title ?? res?.data?.message ?? null,
      // 后端返回的完整 body（截断）
      body: res?.data ? JSON.stringify(res.data).slice(0, 300) : null,
    }
    ;(err as any).apiError = apiError
    console.error(
      `[API] ${apiError.method} ${apiError.url} → ${apiError.status || 'NETWORK_ERR'}` +
      (apiError.detail ? ` | ${apiError.detail}` : '') +
      (apiError.statusText && !apiError.detail ? ` | ${apiError.statusText}` : '')
    )
    return Promise.reject(err)
  }
)
