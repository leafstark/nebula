#!/bin/bash

set -e

# 🚨 检查 Docker 是否启动
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker 未运行，请先启动 Docker Desktop 后再执行脚本！"
  exit 1
fi

# 获取 git 分支与 commit用于镜像标签
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)
TIME=$(date +%Y%m%d%H%M%S)
TAG="${BRANCH}-${COMMIT}-${TIME}"

IMAGE="aliheyuan-registry-vpc.cn-heyuan.cr.aliyuncs.com/app-ops/tigerai-hub:${TAG}"

echo "🧱 本地构建前端项目..."
pnpm install
pnpm build

echo "🚧 构建 amd64 镜像: ${IMAGE}"
docker buildx build --platform linux/amd64 -t "${IMAGE}" . --push

echo "📦 更新 K8s 部署镜像"
kubectl set image deployment/tigerai-hub-app tigerai-hub-app="${IMAGE}" -n ops-5

echo "✅ 等待部署完成"
kubectl rollout status deployment/tigerai-hub-app -n ops-5