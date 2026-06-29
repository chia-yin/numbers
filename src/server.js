import express from 'express'
import { fileURLToPath } from 'node:url'

// 載入 .env(若存在):提供 FET_ACCOUNT/FET_PASSWORD、LLM 設定等
try { process.loadEnvFile() } catch { /* 無 .env 略過 */ }
import { router as analyzeRouter } from './routes/analyze.js'
import { router as crawlRouter } from './routes/crawl.js'
import { router as rankRouter } from './routes/rank.js'
import { router as sourcesRouter } from './routes/sources.js'
import { router as authRouter } from './routes/auth.js'
import { router as payRouter } from './routes/pay.js'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.json({ limit: '10mb' }))
app.use('/api/analyze', analyzeRouter)
app.use('/api/crawl', crawlRouter)
app.use('/api/rank', rankRouter)
app.use('/api/sources', sourcesRouter)
app.use('/api/auth', authRouter)
app.use('/api/pay', payRouter)
// 前端據此決定要不要顯示 AI 區(LLM_PROVIDER=none 即關閉,部署/送人版純淨無 AI)
app.get('/api/config', (req, res) => {
  res.json({
    ai: (process.env.LLM_PROVIDER ?? 'cli') !== 'none',
    paywall: process.env.PAYWALL === '1',
  })
})
app.use(express.static('public'))

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`gonghao-numbers listening on port ${PORT}`)
  })
}

export { app }
