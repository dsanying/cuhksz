#!/bin/sh

# 一键同步课程资料索引并推送。请先在 Firefox 登录蓝奏云后台。
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"
exec npm run course:publish
