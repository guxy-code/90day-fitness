# 90 DAY · 90 天减脂塑形

中文、移动端优先的 90 天健康管理 PWA。纯静态应用，无第三方运行依赖，适合部署在 GitHub Pages 的 `/90day-fitness/` 路径下。

## 功能

- 90 天循序渐进训练计划，包含适应、进阶、巩固阶段，以及恢复日。
- 今日任务与训练打卡、动作说明、训练计时和进度查看。
- 饮食、饮水、体重与围度记录，查看个人变化。
- 个人资料和目标设置，以及按个人资料估算的营养建议。
- 数据保存在当前浏览器；支持 JSON 备份和恢复。
- 可安装到手机主屏幕；首次成功加载后可离线使用。

应用面向成年人日常健康管理。热量和运动建议是估算值，不能替代医生或营养师的个性化建议。有伤病、孕产期或其他特殊健康状况时，先寻求专业建议；运动时出现疼痛、眩晕或胸部不适应立即停止。

## 本地开发与验证

需要 Node.js 24 或更新版本。无须安装 npm 依赖。

```bash
npm test
npm run build
npm run preview
```

打开 `http://localhost:4173/90day-fitness/`。生产预览包含完整的 Service Worker 和离线缓存。修改源码后重新构建并刷新，更新已安装的应用时接受页面的更新提示。`npm run dev` 提供源码开发预览；完整 PWA 验证请使用构建后的 `npm run preview`。

```bash
node scripts/serve.mjs --dir dist --port 8080 --base /90day-fitness/
```

浏览器验收覆盖资料创建、打卡与计时、饮食饮水、身体记录、备份恢复、手机布局和离线刷新。先启动上方生产预览，再在另一终端执行：

```bash
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/e2e.py
```

可用 `CHROMIUM_PATH` 指定本机 Chromium。截图与测试报告写入 `test-results/`。CI 会运行相同的浏览器验收。

## GitHub Pages 部署

仓库包含 `.github/workflows/deploy.yml`：

1. `main` 分支推送后，运行 Node 内置测试并生成 `dist/`。
2. 将 `dist/` 作为 Pages artifact 上传。
3. 使用 GitHub 官方 Actions 发布到 Pages；部署状态和实际网址见 Actions 中的 `deploy` 作业。

默认项目地址：`https://guxy-code.github.io/90day-fitness/`。此地址只有在 Pages 部署成功后才可访问。

工作流通过 `actions/configure-pages` 的 `enablement: true` 尝试自动启用 Pages。如果新仓库尚未启用 Pages，且默认 `GITHUB_TOKEN` 没有创建 Pages 站点所需的权限，仓库管理员需要在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，再在 Actions 页面重新运行工作流。工作流部署需要 `pages: write` 和 `id-token: write`，这些权限已在部署作业配置。

拉取请求只测试和构建，不执行部署。部署日志、状态和站点可访问性才代表完成发布；仓库中存在工作流不代表站点已经上线。

## 安装与离线

- Android / Chrome：打开部署后的 HTTPS 页面，使用浏览器“安装应用”或“添加到主屏幕”。
- iPhone / iPad：使用 Safari 打开，点“分享 → 添加到主屏幕”。
- 完整打开一次应用后再离线；首次安装缓存需要联网成功。
- Service Worker 只处理本应用目录中的 GET 请求，预缓存应用壳、脚本、样式、清单与图标。
- 每次构建按照文件内容生成缓存版本，避免更新遗漏。新版本激活后清理本应用的旧缓存。

## 数据与隐私

健康记录保存在当前设备、当前浏览器的本地存储，不上传到服务器；项目不包含分析追踪或第三方 CDN 资源。不同设备和浏览器之间不会自动同步。清理浏览器数据、使用无痕模式或更换访问域名可能造成记录丢失，请定期导出 JSON 备份，并妥善保管其中的健康数据。

## 目录

```text
index.html                 页面入口
src/app.js                 页面与交互
src/styles.css             响应式样式
src/domain.js              90 天计划与健康计算
src/storage.js             本地数据与备份校验
public/                    PWA 清单、Service Worker 和图标
scripts/build.mjs          静态构建与内容版本缓存
scripts/serve.mjs          本地项目子路径预览
tests/                    Node 测试
.github/workflows/deploy.yml GitHub Pages CI/CD
```
