import express from 'express'
import { fileURLToPath } from 'node:url'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.static('public'))

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`gonghao-numbers listening on port ${PORT}`)
  })
}

export { app }
