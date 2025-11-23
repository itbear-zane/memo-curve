# MemoCurve

一个基于 React + TypeScript + Vite 构建的艾宾浩斯记忆曲线应用，帮助你科学高效地记忆和管理知识点。

## 🌟 特性

- **艾宾浩斯记忆曲线**：基于科学的遗忘曲线理论，自动安排复习计划
- **多平台支持**：支持 GitHub Pages 和 Gitee Pages 双平台部署
- **分类管理**：灵活的分类系统，支持不同学科的知识点管理
- **图片支持**：支持上传和压缩图片，制作图文并茂的学习笔记
- **本地存储**：使用 IndexedDB 大容量本地存储，数据安全可靠
- **响应式设计**：完美适配手机端和桌面端
- **PWA 支持**：可安装为桌面应用，离线可用

## 🆕 New Feats

### 多图片上传功能
- **批量图片上传**：支持一次选择多张图片上传，提高添加图片笔记的效率
- **批量图片处理**：所有选中的图片会按顺序压缩并添加到笔记中
- **多图片显示**：在笔记中正确显示所有上传的图片
- **保持删除功能**：仍然支持单独删除不需要的图片

### 图片查看与编辑功能增强
- **图片缩略图预览**：在笔记列表中显示图片缩略图，直观识别包含图片的笔记
- **完整的图片管理**：在笔记编辑器中可以查看、添加、删除图片
- **图片编辑支持**：支持在现有笔记中修改图片内容
- **图片压缩优化**：自动压缩上传的图片，确保存储效率

### 用户体验改进
- **视觉反馈**：通过缩略图快速识别图片笔记
- **操作便捷**：点击笔记即可查看和编辑所有图片
- **一致性**：图片管理功能与创建新笔记时的体验保持一致

### 表单状态保持优化
- **智能表单状态保持**：添加笔记时上传的图片会在页面刷新或导航后自动恢复
- **防止数据丢失**：当标题验证失败时，已上传的图片不会丢失
- **临时状态存储**：使用sessionStorage临时保存表单状态，提升用户体验
- **自动清理**：成功保存笔记后自动清理临时状态，确保下次创建笔记时表单干净

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建部署

```bash
# 部署到 GitHub Pages
npm run deploy

# 部署到 GitLab Pages
npm run deploy:gitlab
```

## 📱 在线体验

- **GitHub Pages**: [https://itbear-zane.github.io/memo-curve](https://itbear-zane.github.io/memo-curve)
- **GitLab Pages**: [https://itbear-zane.gitlab.io/memo-curve](https://itbear-zane.gitlab.io/memo-curve)

## 🛠️ 技术栈

- **前端框架**：React 19 + TypeScript
- **构建工具**：Vite
- **UI 组件**：Tailwind CSS
- **图标库**：Lucide React
- **数据存储**：IndexedDB
- **部署平台**：GitHub Pages + GitLab Pages

## 📖 使用说明

### 1. 创建笔记
- 点击底部的 "+" 按钮
- 选择分类和复习策略
- 输入标题和内容
- 可选择添加图片

### 2. 复习功能
- 系统会根据艾宾浩斯曲线自动计算复习时间
- 点击"开始复习"进入复习模式
- 根据记忆情况选择"记得"或"忘记了"

### 3. 分类管理
- 在分类管理页面可以添加、删除分类
- 每个分类有独立的颜色标识
- 支持查看分类下的所有笔记

### 4. 个性化设置
- 可以自定义复习曲线间隔
- 开启/关闭复习通知
- 导出/备份数据

## 🔧 开发

### 项目结构

```
memo-curve/
├── src/
│   ├── App.tsx          # 主应用组件
│   ├── index.css        # 全局样式
│   └── ...             # 其他组件和文件
├── scripts/            # 部署脚本
│   └── deploy-gitlab.js # GitLab Pages 部署脚本
├── dist/               # 构建输出目录
└── package.json        # 项目配置
```

### 可用脚本

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run preview      # 预览构建结果
npm run lint         # 代码检查
npm run deploy       # 部署到 GitHub Pages
npm run deploy:gitlab # 部署到 GitLab Pages
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

Made with ❤️ using React + TypeScript + Vite