import express from 'express'
import { fileURLToPath } from 'node:url'
import { router as analyzeRouter } from './routes/analyze.js'
import { router as crawlRouter } from './routes/crawl.js'
import { router as rankRouter } from './routes/rank.js'
import { router as sourcesRouter } from './routes/sources.js'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.json({ limit: '10mb' }))
app.use('/api/analyze', analyzeRouter)
app.use('/api/crawl', crawlRouter)
app.use('/api/rank', rankRouter)
app.use('/api/sources', sourcesRouter)
// 前端據此決定要不要顯示 AI 區(LLM_PROVIDER=none 即關閉,部署/送人版純淨無 AI)
app.get('/api/config', (req, res) => {
  res.json({ ai: (process.env.LLM_PROVIDER ?? 'cli') !== 'none' })
})
app.use(express.static('public'))

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`gonghao-numbers listening on port ${PORT}`)
  })
}

export { app }
