import express from "express"
import path from "path"
import { createProxyMiddleware } from "http-proxy-middleware"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname } from "path"

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

// API 代理
app.use(
  "/api/",
  createProxyMiddleware({
    target: OPENAI_BASE_URL,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader("Authorization", `Bearer ${OPENAI_API_KEY}`)
      proxyReq.setHeader("Content-Type", "application/json")
    },
    ws: true,
  })
)

// SPA 路由支持
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"))
})

app.listen(PORT, () => {
  console.log(`Server running`)
})
