import express from 'express'
import { fileURLToPath } from 'node:url'
import { router as analyzeRouter } from './routes/analyze.js'
import { router as crawlRouter } from './routes/crawl.js'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.json())
app.use('/api/analyze', analyzeRouter)
app.use('/api/crawl', crawlRouter)
app.use(express.static('public'))

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`gonghao-numbers listening on port ${PORT}`)
  })
}

export { app }
