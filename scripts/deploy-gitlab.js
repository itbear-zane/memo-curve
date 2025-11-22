#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';

console.log('🚀 开始部署到 GitLab Pages...');

try {
  // 检查 dist 目录是否存在
  if (!existsSync('dist')) {
    console.error('❌ dist 目录不存在，请先构建项目');
    process.exit(1);
  }

  // 检查是否已配置 GitLab 远程
  let gitlabRemote = '';
  try {
    gitlabRemote = execSync('git remote get-url gitlab', { encoding: 'utf8' }).trim();
    console.log(`✅ 找到 GitLab 远程: ${gitlabRemote}`);
  } catch (e) {
    console.log('⚠️  未找到 GitLab 远程仓库');
    console.log('');
    console.log('🔧 请先添加 GitLab 远程仓库：');
    console.log('   git remote add gitlab https://gitlab.com/your-username/memo-curve.git');
    console.log('   (请将 your-username 替换为你的 GitLab 用户名)');
    console.log('');
    process.exit(1);
  }

  // 读取 package.json 获取项目信息
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const projectName = packageJson.name;

  console.log('📦 正在部署到 GitLab Pages...');

  // 清理旧的 public 目录
  if (existsSync('public')) {
    console.log('🗑️  清理旧的 public 目录...');
    execSync('rm -rf public', { stdio: 'ignore' });
  }

  // 复制 dist 到 public（GitLab Pages 需要使用 public 目录）
  console.log('📋 创建 public 目录并复制构建文件...');
  execSync('mkdir public', { stdio: 'ignore' });

  const copyFiles = (src, dest) => {
    const files = readdirSync(src);
    files.forEach(file => {
      const srcPath = join(src, file);
      const destPath = join(dest, file);

      execSync(`cp -r "${srcPath}" "${destPath}"`, { stdio: 'ignore' });
    });
  };

  copyFiles('dist', 'public');

  // 创建 .gitlab-ci.yml 文件用于 GitLab CI/CD
  const gitlabCiContent = `# GitLab CI/CD 配置文件
# 用于自动部署到 GitLab Pages

stages:
  - deploy

pages:
  stage: deploy
  script:
    - echo 'Deploying to GitLab Pages...'
  artifacts:
    paths:
      - public
  only:
    - main
`;

  execSync(`echo '${gitlabCiContent}' > .gitlab-ci.yml`, { stdio: 'ignore' });

  // 提交更改到当前分支
  console.log('💾 提交更改...');
  execSync('git add public .gitlab-ci.yml', { stdio: 'ignore' });

  try {
    execSync('git diff --staged --quiet', { stdio: 'ignore' });
    console.log('ℹ️  没有更改需要提交');
  } catch (e) {
    // 有更改需要提交
    execSync(`git commit -m "Deploy ${projectName} to GitLab Pages - ${new Date().toISOString()}"`, {
      stdio: 'ignore'
    });
  }

  // 推送到 GitLab 的 main 分支
  console.log('🚀 推送到 GitLab...');
  execSync('git push gitlab main', { stdio: 'inherit' });

  console.log('');
  console.log('🎉 部署成功！');
  console.log('📱 GitLab Pages 可能的访问地址：');
  console.log('   - 主要地址: https://itbear-zane.gitlab.io/memo-curve');
  console.log('   - 实际地址: https://memo-curve-d2ecad.gitlab.io/memo-curve');
  console.log('');
  console.log('⚠️  注意事项：');
  console.log('1. GitLab Pages 可能需要几分钟时间来构建');
  console.log('2. GitLab CI/CD 会自动处理 Pages 部署');
  console.log('3. 请确保在 GitLab 项目设置中启用了 Pages 功能');
  console.log('4. 构建完成后，可以在项目设置中的 Pages 查看部署状态');
  console.log('5. 如果有重复的项目名，GitLab 会添加唯一标识符');
  console.log('6. 请访问 GitLab 项目的 Settings > Pages 查看实际 URL');

} catch (error) {
  console.error('❌ 部署失败:', error.message);

  // 提供更详细的错误信息
  console.log('');
  console.log('💡 可能的解决方案：');
  console.log('1. 确认 GitLab 仓库地址是否正确');
  console.log('2. 检查网络连接和 GitLab 访问权限');
  console.log('3. 确认已配置 Git 用户信息: git config --global user.name "Your Name"');
  console.log('4. 确认已配置 Git 邮箱: git config --global user.email "your@email.com"');
  console.log('5. 确保 GitLab 项目启用了 Pages 功能');
  console.log('6. 检查 GitLab CI/CD 配置是否正确');

  process.exit(1);
}