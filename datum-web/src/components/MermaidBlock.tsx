import { useEffect, useState, useRef } from 'react'

// Mermaid 代码块渲染组件（共享，AiChatDrawer / FormulaDoc 均可复用）
export default function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let cancelled = false
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          darkMode: true,
          background: '#0d1117',
          primaryColor: '#1f6feb',
          primaryTextColor: '#c9d1d9',
          primaryBorderColor: '#30363d',
          lineColor: '#484f58',
          secondaryColor: '#161b22',
          tertiaryColor: '#0d1117',
        },
      })
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      mermaid.render(id, code).then(({ svg: rendered }: { svg: string }) => {
        if (!cancelled) setSvg(rendered)
      }).catch(() => {})
    })
    return () => { cancelled = true }
  }, [code])

  if (!svg) return <pre style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 14, color: '#8b949e', fontSize: 12 }}>{code}</pre>
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} style={{ textAlign: 'center', margin: '8px 0' }} />
}
