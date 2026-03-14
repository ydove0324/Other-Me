# 另一个我 — Other Me

> 「你有没有想过，那个没考公、没回老家、没分手的自己，现在正过着怎样的人生？」

一个帮助用户与未选择的自己重逢的 Web 应用。用户设定人生分岔点，AI 基于用户画像生成平行人生，呈现为混合格式的时间线+详细叙事。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | FastAPI + SQLAlchemy 2.0 (async) + asyncpg |
| **前端** | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| **数据库** | PostgreSQL (阿里云 RDS) |
| **认证** | Google OAuth 2.0 + JWT |
| **AI** | OpenAI-compatible API (支持多上游) |

---

## 快速开始

### 1. 环境准备

```bash
# 后端环境
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 前端环境
cd frontend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写：

```bash
# 数据库
DB_HOST=your-rds-host
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=other_me

# JWT
JWT_SECRET_KEY=your-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_REDIRECT_URI=http://localhost:6016/api/v1/auth/oauth/google/callback

# AI
AI_OPENAI_API_KEY=your-api-key
AI_DEFAULT_MODEL=gpt-4o-mini
```

### 3. 初始化数据库

```sql
psql -h $DB_HOST -U $DB_USER -d other_me -f backend/scripts/001_init_schema.sql
psql -h $DB_HOST -U $DB_USER -d other_me -f backend/scripts/002_seed_tags.sql
psql -h $DB_HOST -U $DB_USER -d other_me -f backend/scripts/003_seed_questions.sql
psql -h $DB_HOST -U $DB_USER -d other_me -f backend/scripts/004_seed_prompts.sql
```

### 4. 启动服务

```bash
# 后端 (端口 6016)
cd backend
./start.sh

# 前端 (端口 6018)
cd frontend
npm run dev
```

访问 http://localhost:6018

---

## 核心功能流程

```
Google登录 → Onboarding画像构建 → Dashboard → 创建分岔点 → AI生成 → 时间线展示
```

### 1. Onboarding 画像构建

- **标签选择**：气泡式标签选择器，分类展示性格/兴趣/生活方式/价值观
- **问卷问答**：AI驱动的选择题+开放式问题
- **画像生成**：AI 综合分析生成结构化性格画像

### 2. 创建分岔点

用户输入：
- 转折时刻标题
- 背景描述
- 实际做出的选择
- 未走的那条路

### 3. AI 生成 Pipeline

**分步生成策略：**

1. **Step 1**: 编译用户画像 (标签 + 问卷答案)
2. **Step 2**: 生成时间线概览 (10-15个事件节点)
3. **Step 3**: 按需生成事件详情 (点击时触发)

**Prompt 模板**存储在数据库，支持热更新。

---

## 项目结构

```
other_me/
├── backend/
│   ├── app/
│   │   ├── core/           # 配置、安全、依赖注入
│   │   ├── models/         # SQLAlchemy 模型
│   │   ├── routers/        # API 路由
│   │   ├── schemas/        # Pydantic 模型
│   │   ├── services/       # 业务逻辑
│   │   │   └── ai/         # LLM Gateway, Prompt Engine, Pipeline
│   │   ├── database.py
│   │   └── main.py
│   ├── scripts/            # SQL 初始化脚本
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   ├── store/          # Zustand store
│   │   └── services/       # API 客户端
│   └── package.json
└── README.md
```

---

## API 概览

| 端点 | 说明 |
|------|------|
| `GET /auth/oauth/google/authorize` | Google OAuth 授权跳转 |
| `GET /auth/oauth/google/callback` | OAuth 回调 |
| `POST /auth/refresh` | 刷新 Access Token |
| `GET /auth/me` | 获取当前用户 |
| `GET /profile/tags` | 获取可选标签列表 |
| `POST /profile/tags` | 保存用户标签 |
| `GET /profile/questions` | 获取问卷题目 |
| `POST /profile/answers` | 提交问卷答案 |
| `POST /profile/persona/generate` | AI 生成用户画像 |
| `GET /profile/persona` | 获取当前画像 |
| `POST /fork-points` | 创建分岔点 |
| `GET /fork-points` | 获取分岔点列表 |
| `POST /fork-points/:id/generate` | 触发生成平行人生 |
| `GET /fork-points/:id/life` | 获取时间线 |
| `GET /lives/:id/events/:event_id` | 获取/生成事件详情 |

---

## 数据库模型

### 核心表

- **users**: 用户基本信息
- **oauth_accounts**: OAuth 绑定
- **tag_categories / tags**: 标签体系
- **user_tags**: 用户选择的标签
- **questionnaire_questions / answers**: 问卷
- **user_personas**: AI 生成的画像（版本化）
- **fork_points**: 人生分岔点
- **alternative_lives**: 平行人生
- **life_timeline_events**: 时间线事件（支持按需生成详细叙事）
- **prompt_templates**: Prompt 模板（热更新）
- **generation_tasks**: AI 生成任务追踪

---

## 可扩展性设计

1. **Prompt 模板 DB 化**：无需改代码即可调整 AI 行为，支持 A/B 测试
2. **Persona 版本化**：用户更新画像不影响已生成的平行人生
3. **Generation Task 追踪**：所有 AI 调用有完整记录，方便调试和计费
4. **Tag/Question 种子数据**：通过 SQL 脚本管理，易于扩展
5. **AI Gateway 多上游**：支持 OpenAI / Claude / 国产模型切换
6. **未来扩展预留**：数据库结构已为"每日消息"、"对话聊天"、"勇气引擎"留好扩展点

---

## 部署建议

1. **数据库**：使用阿里云 RDS PostgreSQL，确保开启 SSL
2. **后端**：Docker 容器化部署，使用 gunicorn + uvicorn worker
3. **前端**：静态文件托管到 CDN 或 Vercel/Netlify
4. **环境变量**：生产环境使用 secrets manager 管理敏感信息
5. **Google OAuth**：回调地址需配置为生产域名

---

## 相关文档

- 产品设计文档: [BP.md](./BP.md)
- 架构方案: [plan.md](./.cursor/plans/other_me_architecture_95926e93.plan.md)

---

## License

MIT
