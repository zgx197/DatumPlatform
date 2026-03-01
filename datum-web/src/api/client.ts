import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// 统一错误处理
api.interceptors.response.use(
  res => res,
  err => {
    console.error('[API Error]', err.response?.status, err.message)
    return Promise.reject(err)
  }
)
