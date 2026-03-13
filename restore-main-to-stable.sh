#!/bin/bash
# 恢复 main 分支到 restore-full-stable 状态
# 在 Git Bash 中运行: bash restore-main-to-stable.sh

cd "$(dirname "$0")"

echo "========================================"
echo "恢复 main 分支到 restore-full-stable 状态"
echo "========================================"
echo

echo "[1/3] 切换到 main 分支..."
git checkout main || exit 1

echo
echo "[2/3] 用 restore-full-stable 的所有文件覆盖 main..."
git checkout restore-full-stable -- .
git add -A

echo
echo "[3/3] 提交恢复..."
git commit -m "restore main to match restore-full-stable" || echo "注意: 若无变更则无需提交"

echo
echo "========================================"
echo "完成。main 已与 restore-full-stable 一致。"
echo "========================================"
git log -1 --oneline
