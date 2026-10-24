import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const siteURL = 'https://guxy-code.github.io/90day-fitness/';
const actionsURL = 'https://github.com/guxy-code/90day-fitness/actions';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let stage = '检查仓库';
let temporary;
let worktree;
let worktreeAdded = false;
let pushed = false;

const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: 'inherit' });
const gitText = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

try {
  if (realpathSync(gitText(['rev-parse', '--show-toplevel'])) !== root) {
    throw new Error('请在独立的 90day-fitness Git 仓库中运行部署。');
  }
  const origin = gitText(['remote', 'get-url', 'origin']);
  if (!/^(?:https:\/\/github\.com\/|git@github\.com:)guxy-code\/90day-fitness(?:\.git)?\/?$/i.test(origin)) {
    throw new Error('origin 不是 guxy-code/90day-fitness；为避免发布到其他仓库，已停止。');
  }

  stage = '运行测试并构建';
  run(npm, ['run', 'check']);
  const dist = path.join(root, 'dist');
  for (const required of ['index.html', 'sw.js', 'manifest.webmanifest', '.nojekyll']) {
    if (!existsSync(path.join(dist, required))) throw new Error(`构建缺少 ${required}，已停止发布。`);
  }

  stage = '获取 gh-pages 分支';
  run('git', ['fetch', '--no-tags', 'origin', 'refs/heads/gh-pages:refs/remotes/origin/gh-pages']);
  const sourceSHA = gitText(['rev-parse', '--short', 'HEAD']);
  temporary = mkdtempSync(path.join(tmpdir(), '90day-publish-'));
  worktree = path.join(temporary, 'pages');

  stage = '创建隔离的发布工作区';
  run('git', ['worktree', 'add', '--detach', worktree, 'refs/remotes/origin/gh-pages']);
  worktreeAdded = true;

  stage = '准备静态文件';
  for (const name of readdirSync(worktree)) {
    if (name === '.git') continue;
    if (name === '.github' && statSync(path.join(worktree, name)).isDirectory()) continue;
    rmSync(path.join(worktree, name), { recursive: true, force: true });
  }
  for (const name of readdirSync(dist)) {
    cpSync(path.join(dist, name), path.join(worktree, name), { recursive: true });
  }
  run('git', ['add', '--all'], worktree);
  const difference = spawnSync('git', ['diff', '--cached', '--quiet', '--exit-code'], { cwd: worktree, stdio: 'inherit' });
  if (difference.error) throw difference.error;
  if (difference.status !== 0 && difference.status !== 1) throw new Error('无法检查发布文件变更。');

  if (difference.status === 0) {
    console.log('构建产物与远端 gh-pages 一致，无须推送。');
  } else {
    stage = '提交发布文件';
    const configured = key => {
      const result = spawnSync('git', ['config', '--get', key], { cwd: worktree, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (result.error) throw result.error;
      return result.status === 0 && result.stdout.trim().length > 0;
    };
    const identity = configured('user.name') && configured('user.email') ? [] : ['-c', 'user.name=90DAY Deploy', '-c', 'user.email=bot@users.noreply.github.com'];
    run('git', [...identity, 'commit', '-m', `Deploy 90 DAY (${sourceSHA})`], worktree);

    stage = '推送 gh-pages';
    // A concurrent publication is rejected as a non-fast-forward; never force-push.
    run('git', ['push', 'origin', 'HEAD:refs/heads/gh-pages'], worktree);
    pushed = true;
    console.log('已推送 gh-pages。GitHub Pages 将异步构建，尚未确认本次上线成功。');
  }
  console.log(`站点：${siteURL}`);
  console.log(`查看内置 Pages 构建状态：${actionsURL}（pages build and deployment）`);
} catch (error) {
  console.error(`发布失败：${stage}。`);
  if (error.status === undefined) console.error(error.message);
  if (stage.includes('分支') || stage.includes('推送')) {
    console.error('请检查网络、GitHub Git 凭据、仓库写入权限和 gh-pages 分支。并发发布导致非快进拒绝时，重新运行 npm run deploy；不要强制推送。');
  }
  process.exitCode = 1;
} finally {
  if (worktreeAdded) {
    try {
      // Only remove our generated temporary worktree, including failed staged files.
      // This flag affects local cleanup; the push above never uses force.
      run('git', ['worktree', 'remove', '--force', worktree]);
      worktreeAdded = false;
    } catch {
      console.error(`临时发布工作区清理失败，请检查：${worktree}`);
      if (pushed) console.error('gh-pages 推送已完成；清理失败不代表 Pages 构建结果。');
      process.exitCode = 1;
    }
  }
  if (temporary && !worktreeAdded) rmSync(temporary, { recursive: true, force: true });
}
