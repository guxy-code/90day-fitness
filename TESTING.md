# 验证记录

日期：2026-10-24。验证针对当前仓库源码和生产构建，不代表 GitHub Pages 已发布。

## 已通过

- `npm test`：19 项领域、存储与 PWA 测试通过，0 失败。
- `npm run build`：生产构建成功，包含完整应用与内容版本化离线缓存。
- `python3 tests/e2e.py`：9 组真实 Chromium 浏览器验收通过，无未捕获页面错误。
- `git diff --check`：无空白错误。

浏览器验收覆盖：创建个人计划；饮水和饮食保存；体重、腰围、步数和睡眠记录；三个训练阶段和未来日期打卡保护；训练计时与打卡；刷新持久化；JSON 导出、导入及无效文件保护；390px 手机布局与导航；断网刷新、导航与记录。

环境：Node.js 24.19.0、Python Playwright 1.62.0、Chromium 154.0.8037.57。

## 修复的边界问题

- 开始日期、闰年、跨年与 DST 按日期计算。
- 第 90 天后的身体测量仍会进入趋势，训练统计限制在 90 天计划内。
- 无效和损坏的备份不会覆盖已有记录，损坏本地数据可下载原始备份。
- 极低代谢估算不产生极端低热量建议。
- 当前版本的页面与缓存脚本保持一致，防止更新期间版本混用。
- 手机阶段进度条不再引起横向溢出。

## 发布状态

源码已成功推送到 `main`，生产静态文件也已推送到 `gh-pages`。GitHub Actions 的 19 项单元/PWA 测试和 9 组浏览器验收全部通过。Pages 尚未上线，访问仍为 HTTP 404。

已验证的 CI 运行：https://github.com/guxy-code/90day-fitness/actions/runs/40114906192 。仅 deploy 作业失败：默认 `GITHUB_TOKEN` 首次创建 Pages 时返回 403。

安装仓库应用之前，已实际尝试的远程操作：

- GitHub 连接创建 blob 和文件：HTTP 403，`Resource not accessible by integration`。
- GitHub CLI 创建 blob：相同的 HTTP 403。
- HTTPS Git push：`Permission to guxy-code/90day-fitness.git denied to guxy-code`，HTTP 403。
- GitHub CLI 创建 Pages 站点：HTTP 403，`Resource not accessible by integration`。

仓库应用安装后，Git 推送已恢复正常。已核实 ChatGPT Codex Connector 的应用权限包含 contents / workflows 写入，但不含 Pages 管理权限。直接创建 Pages 仍返回 403；推送 `gh-pages` 分支也不会自动启用站点。

唯一剩余步骤：仓库管理员在 https://github.com/guxy-code/90day-fitness/settings/pages 将 Source 选择为 GitHub Actions。之后重新运行上方 CI 的失败 deploy 作业，即可使用已测试并上传的产物部署，无需重做开发。
