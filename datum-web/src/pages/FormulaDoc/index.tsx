import { useEffect, useState, useCallback } from 'react'
import { Typography, Spin, Alert } from 'antd'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import MermaidBlock from '../../components/MermaidBlock'

const { Title } = Typography

const DOC_URL = '/docs/Datum_Formula_Reference.md'

const mdStyle = `
.datum-doc {
  max-width: 880px;
  margin: 0 auto;
  color: #c9d1d9;
  line-height: 1.75;
  font-size: 14px;
}
.datum-doc h1 { color: #e6edf3; font-size: 22px; border-bottom: 1px solid #21262d; padding-bottom: 8px; margin-top: 32px; }
.datum-doc h2 { color: #e6edf3; font-size: 17px; border-bottom: 1px solid #21262d; padding-bottom: 6px; margin-top: 28px; }
.datum-doc h3 { color: #d2a679; font-size: 14px; margin-top: 20px; }
.datum-doc p  { margin: 8px 0; }
.datum-doc pre {
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 6px;
  padding: 14px 16px;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.65;
  font-family: 'Consolas', 'Fira Code', monospace;
}
.datum-doc code {
  background: #1c2128;
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 12.5px;
  font-family: 'Consolas', 'Fira Code', monospace;
  color: #79c0ff;
}
.datum-doc pre code {
  background: transparent;
  padding: 0;
  color: #c9d1d9;
}

/* GFM 表格 */
.datum-doc table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  font-size: 13px;
  display: table;
}
.datum-doc thead th {
  background: #161b22;
  color: #8b949e;
  text-align: left;
  padding: 8px 12px;
  border: 1px solid #30363d;
  font-weight: 600;
}
.datum-doc tbody td {
  padding: 6px 12px;
  border: 1px solid #21262d;
  color: #c9d1d9;
}
.datum-doc tbody tr:nth-child(even) td { background: #0d1117; }
.datum-doc tbody tr:hover td { background: #1c2128; }

/* KaTeX 暗色适配 */
.datum-doc .katex { color: #e6edf3; font-size: 1.05em; }
.datum-doc .katex-display { margin: 16px 0; overflow-x: auto; }
.datum-doc .katex-display > .katex { text-align: left; padding-left: 16px; }

.datum-doc blockquote {
  border-left: 3px solid #4e9af1;
  margin: 12px 0;
  padding: 6px 16px;
  background: #131920;
  border-radius: 0 6px 6px 0;
  color: #8b949e;
}
.datum-doc ul, .datum-doc ol { padding-left: 24px; margin: 6px 0; }
.datum-doc li { margin: 3px 0; }
.datum-doc hr { border: none; border-top: 1px solid #21262d; margin: 24px 0; }
.datum-doc a { color: #4e9af1; text-decoration: none; }
.datum-doc a:hover { text-decoration: underline; }
.datum-doc strong { color: #e6edf3; }
`

export default function FormulaDoc() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(DOC_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then(text => { setContent(text); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  // 自定义代码块：mermaid 走 Mermaid 渲染，其余走默认
  const codeComponent = useCallback(
    (props: any) => {
      const { children, className, ...rest } = props
      const match = /language-(\w+)/.exec(className || '')
      if (match && match[1] === 'mermaid') {
        return <MermaidBlock code={String(children).trim()} />
      }
      return <code className={className} {...rest}>{children}</code>
    },
    [],
  )

  return (
    <div style={{ padding: '0 4px' }}>
      <style>{mdStyle}</style>
      <Title level={4} style={{ margin: '0 0 16px 0' }}>系统设计文档</Title>
      {loading && (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#8b949e', fontSize: 13 }}>加载文档中...</div>
        </div>
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          message="文档加载失败"
          description={`无法加载 ${DOC_URL}：${error}。请确认文档已复制到 public/docs/ 目录。`}
        />
      )}
      {!loading && !error && (
        <div className="datum-doc">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, { strict: false }]]}
            components={{ code: codeComponent }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
