#!/bin/zsh
branch=$(git symbolic-ref --short HEAD)
echo "当前分支: $branch"
git push origin $branch
git push github $branch
