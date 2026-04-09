---
name: "github-security-check"
description: "检查项目是否包含敏感信息，确保GitHub上传安全。Invoke when user wants to push to GitHub or asks to check for sensitive data leaks."
---

# GitHub 安全检查技能

## 触发条件
- 用户执行 `git push` 前
- 用户要求检查敏感信息
- 用户准备开源项目到 GitHub

## 检查清单

### 1. 凭据与密钥 (Credentials & Secrets)
- [ ] API 密钥 (OpenAI, Google Maps, AWS Access Keys 等)
- [ ] SSH 私钥 (`id_rsa`, `.pem`, `.key`)
- [ ] 数据库密码
- [ ] 个人访问令牌 (PAT)
- [ ] Webhook 地址

### 2. 配置文件 (Configuration Files)
- [ ] `.env` 文件（必须在 `.gitignore` 中）
- [ ] `.env.local`, `.env.*.local`
- [ ] 本地 IDE 配置 (`.vscode/`, `.idea/`)
- [ ] 数据库连接字符串（含密码）

### 3. 依赖包与构建产物
- [ ] `node_modules/`（必须在 `.gitignore` 中）
- [ ] `dist/`, `build/`, `out/`
- [ ] `*.exe`, `*.jar`, `*.pyc`
- [ ] `*.log` 文件

### 4. 个人隐私与敏感数据
- [ ] 测试数据（真实用户姓名、邮箱、电话）
- [ ] 备份文件 (`*.bak`, `*.old`)
- [ ] `.DS_Store`, `Thumbs.db`

## 执行步骤

1. **检查 `.gitignore`**
   - 确保包含所有敏感文件模式
   - 参考 gitignore.io 生成模板

2. **扫描敏感文件**
   ```bash
   # 检查是否包含敏感关键词
   grep -r "API_KEY\|SECRET\|PASSWORD\|TOKEN" --include="*.ts" --include="*.tsx" --include="*.js" src/
   
   # 检查 .env 文件
   find . -name ".env*" -type f
   
   # 检查私钥文件
   find . -name "*.pem" -o -name "*.key" -o -name "id_rsa"
   ```

3. **检查 Git 状态**
   ```bash
   git status
   ```
   确认没有敏感文件被标记为 `Changes to be committed`

4. **验证环境变量使用**
   - 代码中应使用 `import.meta.env` 或 `process.env` 读取密钥
   - 不应有硬编码的密钥字符串

## 如果已上传敏感信息

1. **立即撤销/更换密钥**
   - 假设密钥已泄露，第一时间重置

2. **从 Git 历史中彻底删除**
   ```bash
   # 使用 BFG Repo-Cleaner
   bfg --delete-files .env
   
   # 或使用 git filter-repo
   git filter-repo --path .env --invert-paths
   ```

3. **强制推送清理后的历史**
   ```bash
   git push origin main --force
   ```

## 安全上传流程

```
1. git status                    # 检查待提交文件
2. 运行本安全检查               # 扫描敏感信息
3. 确认 .gitignore 完整          # 包含所有敏感模式
4. git add .                     # 添加文件
5. git commit -m "xxx"           # 提交
6. git push origin main          # 推送到远程
```

## 推荐工具

- **git-secrets**: 自动拦截包含密钥的提交
- **BFG Repo-Cleaner**: 从历史中删除敏感文件
- **gitignore.io**: 生成 .gitignore 模板

---
*版本: v1.0 | 用于保护 GitHub 仓库安全*
