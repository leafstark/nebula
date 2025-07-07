import express from "express"
import path from "path"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname } from "path"
import { OpenAI } from "openai"

// 兼容 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取环境变量
dotenv.config({ path: path.resolve(__dirname, ".env") })

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

// OpenAI SDK 实例化函数
function getOpenAIInstance({ apiKey, baseURL }) {
  return new OpenAI({
    apiKey,
    baseURL,
  })
}

// 支持流式和非流式的 chat completions
app.post(
  "/api/v1/chat/completions",
  express.json({ limit: "10mb" }),
  async (req, res) => {
    const { model, messages, stream, openaiBaseUrl } = req.body
    // 优先使用 header 里的 key，其次环境变量
    const apiKey = req.header("X-OPENAI-API-KEY") || OPENAI_API_KEY
    const baseURL = openaiBaseUrl || OPENAI_BASE_URL
    if (!apiKey) {
      return res.status(400).json({ error: "缺少 OpenAI API Key" })
    }
    const openai = getOpenAIInstance({ apiKey, baseURL })
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
      // 返回详细错误信息
      res.status(500).json({ error: err?.message || "OpenAI API 调用失败" })
    }
  }
)

// SPA 路由支持
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"))
})

app.listen(PORT, () => {
  console.log(`Server running`)
})
