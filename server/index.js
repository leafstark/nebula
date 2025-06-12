import express from "express"
import path from "path"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname } from "path"
import { OpenAI } from "openai"
import { Readable } from "stream"

// 兼容 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取环境变量
dotenv.config({ path: path.resolve(__dirname, '.env') })

const app = express()
const PORT = process.env.PORT || 80
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// 静态资源服务
const distPath = path.join(__dirname, "../dist")
app.use(
  express.static(distPath, {
    maxAge: "1y",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate")
      }
    },
  })
)

// OpenAI SDK 初始化
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
})

// 支持流式和非流式的 chat completions
app.post("/api/v1/chat/completions", express.json(), async (req, res) => {
  const { model, messages, stream } = req.body
  try {
    if (stream) {
      // 流式输出
      res.setHeader("Content-Type", "text/event-stream")
      res.setHeader("Cache-Control", "no-cache")
      res.setHeader("Connection", "keep-alive")
      const completion = await openai.chat.completions.create({
        model,
        messages,
        stream: true,
      })
      for await (const chunk of completion) {
        res.write(`data: ${JSON.stringify(chunk)}\n`)
      }
      res.write("data: [DONE]\n")
      res.end()
    } else {
      // 非流式
      const completion = await openai.chat.completions.create({
        model,
        messages,
        stream: false,
      })
      res.json(completion)
    }
  } catch (err) {
    res.status(500).send(err?.message || "OpenAI API 调用失败")
  }
})

// SPA 路由支持
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"))
})

app.listen(PORT, () => {
  console.log(`Server running`)
})
