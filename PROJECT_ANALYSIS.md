# 「另一个我」(Other Me) — 项目全面解析

## 一、项目定位

BP 的核心理念（`BP.md`）：

> 你只需设定人生分岔点（比如"25岁那年我没辞职"），AI便会根据你给过的个人信息——你的性格、你在意的人、你说过的梦想——生成一个持续成长的数字分身。随着你一次次分享，他会越来越像"你"，记得你说过的话，了解你深藏的渴望。

简而言之：**用户设定人生分岔点 → AI 根据用户画像生成平行人生时间线 → 可逐个展开事件的第一人称叙事。**

---

## 二、技术架构

```
┌─────────────────┐     OAuth / JWT      ┌──────────────────┐
│   React 18      │ ◄──────────────────► │   FastAPI        │
│   + TypeScript  │     REST API         │   (async)        │
│   + Zustand     │                      │                  │
│   Port 6018     │                      │   Port 6016      │
└─────────────────┘                      └────────┬─────────┘
                                                  │
                                    ┌─────────────┼──────────────┐
                                    │             │              │
                              ┌─────▼─────┐ ┌────▼────┐  ┌─────▼──────┐
                              │ PostgreSQL│ │ OpenAI  │  │  Google    │
                              │ (asyncpg) │ │ API     │  │  OAuth     │
                              └───────────┘ └─────────┘  └────────────┘
```

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| **后端** | FastAPI + SQLAlchemy 2.0 (async) + asyncpg |
| **数据库** | PostgreSQL |
| **认证** | Google OAuth 2.0 + JWT |
| **AI** | OpenAI-compatible API (gpt-4o-mini) |
| **HTTP 客户端** | httpx（支持代理） |

---

## 三、目录结构

```
/cpfs01/huangxu/other_me/
├── README.md                        # 技术文档
├── BP.md                            # 产品蓝图
├── start.sh                         # 一键启动脚本
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI 入口
│   │   ├── database.py              # 异步 SQLAlchemy 引擎
│   │   ├── core/
│   │   │   ├── config.py            # 环境变量配置
│   │   │   ├── security.py          # JWT + 密码哈希
│   │   │   └── deps.py              # 依赖注入（鉴权）
│   │   ├── models/
│   │   │   ├── base.py              # 基类、枚举
│   │   │   ├── user.py              # User, OAuthAccount, RefreshToken
│   │   │   ├── profile.py           # Tags, Questions, Persona
│   │   │   ├── fork_point.py        # ForkPoint 模型
│   │   │   ├── life.py              # AlternativeLife, LifeTimelineEvent
│   │   │   └── ai_config.py         # PromptTemplate, GenerationTask
│   │   ├── routers/
│   │   │   ├── auth.py              # Google OAuth + JWT 刷新/登出
│   │   │   ├── profile.py           # 标签、问卷、画像生成
│   │   │   ├── fork_points.py       # 分岔点 CRUD
│   │   │   └── lives.py             # 平行人生生成 & 查询
│   │   ├── schemas/                 # Pydantic 请求/响应模型
│   │   └── services/ai/
│   │       ├── llm_gateway.py       # OpenAI API 调用封装
│   │       ├── prompt_engine.py     # Prompt 模板 & 渲染
│   │       └── pipeline.py          # 生成编排（核心业务）
│   ├── init_db.py                   # 数据库初始化
│   ├── reset_db.py                  # 数据库重置
│   └── requirements.txt             # Python 依赖
├── frontend/
│   ├── src/
│   │   ├── main.tsx                 # React 入口
│   │   ├── App.tsx                  # 路由配置
│   │   ├── components/onboarding/   # Onboarding 子组件
│   │   │   ├── TagSelector.tsx
│   │   │   ├── Questionnaire.tsx
│   │   │   └── PersonaSummary.tsx
│   │   ├── pages/
│   │   │   ├── Landing.tsx          # 登录页
│   │   │   ├── AuthCallback.tsx     # OAuth 回调
│   │   │   ├── Onboarding.tsx       # 三步建档
│   │   │   ├── Dashboard.tsx        # 分岔点列表
│   │   │   ├── CreateFork.tsx       # 创建分岔点
│   │   │   └── LifeView.tsx         # 时间线 + 事件详情
│   │   ├── services/api.ts          # Axios 实例（自动刷新 token）
│   │   ├── store/authStore.ts       # Zustand 认证状态
│   │   └── types/index.ts           # TypeScript 类型定义
│   └── package.json
```

---

## 四、核心数据模型

### 用户认证

- **User**：email, display_name, avatar_url, onboarding_completed, last_login_at
- **OAuthAccount**：Google OAuth 关联，存储原始 profile
- **RefreshToken**：token_hash, 过期时间, 撤销标记

### 画像建档（Onboarding）

- **TagCategory**：标签分类（性格、兴趣、生活方式、价值观）
- **Tag**：具体标签
- **UserTag**：用户选择的标签（多对多）
- **QuestionnaireQuestion**：问卷题目（选择题、开放题、量表）
- **QuestionnaireAnswer**：用户答案
- **UserPersona**：AI 生成的性格画像（带版本号），包含 persona_summary, personality_traits, values, life_context

### 分岔点 & 平行人生

- **ForkPoint**：人生分岔点
  - title, description, happened_at
  - actual_choice（实际选择）, alternative_choice（未走的路）
  - emotional_context (JSONB)
  - status: `draft → generating → completed → failed`

- **AlternativeLife**：生成的平行人生
  - fork_point_id, persona_snapshot_id（快照，画像更新不影响已有人生）
  - overview（一句话概述）
  - status: `generating → completed → failed`

- **LifeTimelineEvent**：时间线上的单个事件
  - event_date, title, summary
  - detailed_narrative（按需生成的详细叙事）
  - emotional_tone: `{primary, secondary, intensity}` (JSONB)
  - sort_order

### AI 配置 & 任务追踪

- **PromptTemplate**：数据库存储的 prompt 模板（支持热更新 + 版本控制）
- **GenerationTask**：每次 AI 调用的审计记录（类型、状态、token 用量、耗时）

---

## 五、核心业务流程 & 代码解读

### 流程 1：Google OAuth 登录

```
用户点击登录 → 重定向 Google → 回调拿到 code → 换取用户信息
→ 创建/关联用户 → 发放 JWT + refresh_token → 前端保存
```

**关键代码** `backend/app/routers/auth.py:135-250`：

```python
# OAuth callback 核心逻辑
token_response = await client.post(GOOGLE_TOKEN_URL, data={...})  # 用 code 换 token
userinfo_response = await client.get(GOOGLE_USERINFO_URL, ...)     # 拿用户信息

# 查找或创建用户
result = await session.execute(
    select(OAuthAccount).where(
        OAuthAccount.provider == OAuthProvider.google,
        OAuthAccount.provider_user_id == google_user_id,
    )
)
oauth_account = result.scalar_one_or_none()

if not oauth_account:
    # 新用户 → 创建 User + OAuthAccount
    user = User(email=email, display_name=name, avatar_url=picture)
    session.add(user)

# 生成 JWT + refresh token，重定向到前端
tokens = await _create_tokens(user, session)
return RedirectResponse(url=f"{frontend_url}/auth/callback?{redirect_params}")
```

---

### 流程 2：Onboarding（三步建档）

**前端** `frontend/src/pages/Onboarding.tsx:10-59`，三步走：

```tsx
const STEPS = ["选择标签", "回答问题", "你的画像"];
// Step 0: TagSelector   → 选择性格/兴趣/价值观标签
// Step 1: Questionnaire → 回答开放/选择/量表问题
// Step 2: PersonaSummary → AI 生成画像并展示
```

**后端画像生成** `backend/app/services/ai/pipeline.py:55-115`：

```python
async def generate_persona(user_id, session):
    tags = await _get_user_tags(user_id, session)       # 用户选的标签
    answers = await _get_user_answers(user_id, session)  # 用户的问卷回答

    template = await get_template("persona_generation", session)
    prompt = render_template(template, {"tags": ..., "answers": ...})

    # 调用 LLM，要求返回 JSON
    data, usage = await call_llm_json([
        {"role": "system", "content": "你是一位心理画像分析师。请用 JSON 格式回复。"},
        {"role": "user", "content": prompt},
    ], temperature=0.7)

    # 存入 UserPersona（带版本号）
    persona = UserPersona(
        user_id=user_id,
        persona_summary=data.get("persona_summary", ""),
        personality_traits=data.get("personality_traits"),
        version=new_version,
        ...
    )
```

LLM 返回的 JSON 结构（定义在 `prompt_engine.py:16-33` 的 fallback 模板中）：

```json
{
  "persona_summary": "200字人物画像，用'你'来写，像朋友一样温暖地描述",
  "personality_traits": ["特质1", "特质2"],
  "core_values": ["价值观1", "价值观2"],
  "life_stage": "当前人生阶段",
  "emotional_patterns": ["情绪模式1"],
  "key_relationships": "人际关系偏好",
  "dreams_and_fears": "内心渴望与恐惧"
}
```

---

### 流程 3：创建分岔点

**数据模型** `backend/app/models/fork_point.py:13-31`：

```python
class ForkPoint(Base, TimestampMixin):
    title: Mapped[str]                        # "25岁没辞职"
    description: Mapped[str | None]           # 背景描述
    happened_at: Mapped[date | None]          # 分岔时间
    actual_choice: Mapped[str]                # 实际的选择
    alternative_choice: Mapped[str]           # 未走的那条路
    emotional_context: Mapped[dict | None]    # 当时的情绪 (JSONB)
    status: Mapped[ForkPointStatus]           # draft → generating → completed → failed
```

---

### 流程 4：生成平行人生时间线（核心流程）

这是整个项目最核心的逻辑。

**后端** `backend/app/services/ai/pipeline.py:118-221`：

```python
async def generate_alternative_life(user_id, fork_point_id, session):
    fp = ...  # 获取分岔点
    fp.status = ForkPointStatus.generating

    persona = await _get_latest_persona(user_id, session)  # 获取最新画像

    # 渲染 prompt：persona + 分岔点详情 → 要求 AI 生成 10-15 个事件
    template = await get_template("life_timeline", session)
    prompt = render_template(template, {
        "persona": persona_text,
        "fork_date": str(fp.happened_at),
        "fork_title": fp.title,
        "actual_choice": fp.actual_choice,
        "alternative_choice": fp.alternative_choice,
        "current_year": str(datetime.now().year),
    })

    # 调用 LLM（temperature=0.85，鼓励创造性）
    data, usage = await call_llm_json([
        {"role": "system", "content": "你是一位叙事作家。请用 JSON 格式回复。"},
        {"role": "user", "content": prompt},
    ], temperature=0.85, max_tokens=8192)

    # 解析返回的 events 数组，逐个存入 LifeTimelineEvent
    life.overview = data.get("overview", "")
    events = data.get("events", [])
    for i, evt in enumerate(events):
        event = LifeTimelineEvent(
            alternative_life_id=life.id,
            title=evt.get("title"),
            summary=evt.get("summary"),
            emotional_tone=evt.get("emotional_tone"),  # {primary, secondary, intensity}
            sort_order=i,
        )
        session.add(event)

    fp.status = ForkPointStatus.completed
```

**Prompt 模板**要求 AI 输出的 JSON 格式（`prompt_engine.py:34-63`）：

```json
{
  "overview": "这条未选择之路的一句话概述",
  "events": [
    {
      "event_date": "YYYY-MM-DD",
      "title": "事件标题",
      "summary": "50-100字的事件摘要",
      "emotional_tone": {
        "primary": "主要情绪",
        "secondary": "次要情绪",
        "intensity": 0.8
      }
    }
  ]
}
```

---

### 流程 5：Lazy 加载事件详细叙事

用户点击时间线上的某个事件 → 前端调用 API → 后端检查 `detailed_narrative` 是否为空 → 若空则调用 LLM 生成 500-800 字第一人称叙事。

**后端路由** `backend/app/routers/lives.py:107-143`：

```python
@router.get("/lives/{life_id}/events/{event_id}")
async def get_event_detail(life_id, event_id, user, session):
    ...
    if not event.detailed_narrative:
        # 懒生成：第一次点击时才调用 AI
        from app.services.ai.pipeline import generate_event_detail
        event = await generate_event_detail(life_id, event_id, session)
```

**生成逻辑** `backend/app/services/ai/pipeline.py:224-315`：

```python
async def generate_event_detail(life_id, event_id, session):
    # 获取前序事件（最多 5 个）保持叙事连贯
    previous_events = [
        e for e in sorted(life.events, key=lambda e: e.sort_order)
        if e.sort_order < event.sort_order
    ]
    prev_text = "\n".join(
        f"- {e.event_date}: {e.title} — {e.summary}" for e in previous_events[-5:]
    )

    # 使用 event_detail 模板 → 第一人称叙事
    response = await call_llm([
        {"role": "system", "content": "你是一位细腻的第一人称叙事作家。"},
        {"role": "user", "content": prompt},
    ], temperature=0.9, max_tokens=2048)

    event.detailed_narrative = extract_content(response)  # 纯文本，非 JSON
```

**前端时间线视图** `frontend/src/pages/LifeView.tsx:189-294`：

```tsx
{/* 左侧时间线列表 */}
<div className="w-80 flex-shrink-0">
  {life.events.map((event) => (
    <button onClick={() => handleEventClick(event)} ...>
      <p>{event.event_date}</p>
      <p>{event.title}</p>
    </button>
  ))}
</div>

{/* 右侧详情面板 */}
<div className="flex-1">
  {loadingDetail ? (
    <span>AI 正在为你展开这段故事...</span>
  ) : selectedEvent.detailed_narrative ? (
    <div className="font-serif">{selectedEvent.detailed_narrative}</div>
  ) : (
    <button onClick={() => handleEventClick(selectedEvent)}>展开详细叙事 →</button>
  )}
</div>
```

---

### 流程 6：Prompt 模板系统

`backend/app/services/ai/prompt_engine.py` 实现了双层模板系统：

```python
# 1. 优先从数据库 prompt_templates 表查模板（支持热更新 + 版本控制）
result = await session.execute(
    select(PromptTemplate).where(
        PromptTemplate.name == name,
        PromptTemplate.is_active == True,
    ).order_by(PromptTemplate.version.desc()).limit(1)
)

# 2. 找不到就用代码内的 FALLBACK_TEMPLATES（共 3 套）
fallback = FALLBACK_TEMPLATES.get(name)

# 3. {{variable}} 占位符替换
def render_template(template, variables):
    return re.sub(r"\{\{(\w+)\}\}", replace_var, template)
```

三套模板：
- `persona_generation`：标签 + 问卷 → JSON 格式人物画像
- `life_timeline`：画像 + 分岔点 → JSON 格式 10-15 事件时间线
- `event_detail`：画像 + 上下文 + 前序事件 → 500-800 字第一人称纯文本叙事

---

### 流程 7：LLM 调用封装

`backend/app/services/ai/llm_gateway.py` 封装了对 OpenAI-compatible API 的调用：

```python
async def call_llm(messages, *, model=None, temperature=0.8, max_tokens=4096):
    """通用调用，返回原始 response dict"""
    proxy = settings.HTTPS_PROXY or settings.HTTP_PROXY or None
    async with httpx.AsyncClient(proxy=proxy, timeout=settings.AI_TIMEOUT_SECONDS) as client:
        resp = await client.post(f"{api_base}/chat/completions", json=payload, headers=headers)
    # 内置重试机制（AI_MAX_RETRIES 次）

async def call_llm_json(messages, ...):
    """调用 LLM 并解析 JSON 响应，返回 (parsed_data, usage_info)"""
    response = await call_llm(messages, response_format={"type": "json_object"}, ...)
    data = json.loads(extract_content(response))
    return data, extract_usage(response)
```

---

## 六、关键设计决策

| 决策 | 说明 |
|------|------|
| **全异步** | FastAPI + SQLAlchemy async + asyncpg，全链路非阻塞 |
| **画像版本化** | `UserPersona.version` + `AlternativeLife.persona_snapshot_id`，重新生成画像不影响已有人生 |
| **Lazy 事件详情** | 时间线生成只产出摘要，详细叙事按需生成，降低首次延迟和 token 消耗 |
| **Prompt 模板入库** | 支持热更新和 A/B 测试，无需重新部署 |
| **GenerationTask 审计** | 每次 AI 调用留痕，便于调试、计费和质量分析 |
| **代理支持** | 可配 HTTP/HTTPS 代理，适用于受限网络环境 |
| **Token 自动刷新** | 前端 Axios 拦截器遇 401 自动刷新 + 请求排队重试 |
| **JSONB 灵活字段** | emotional_context, emotional_tone 等用 JSONB 存储，方便扩展 |

---

## 七、API 端点清单

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/auth/oauth/{provider}/authorize` | 重定向到 Google OAuth |
| GET | `/api/v1/auth/oauth/{provider}/callback` | OAuth 回调，返回 tokens |
| POST | `/api/v1/auth/refresh` | 刷新 access token |
| POST | `/api/v1/auth/logout` | 撤销 refresh token |
| GET | `/api/v1/auth/me` | 获取当前用户信息 |

### 画像建档
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/profile/tags` | 获取标签分类和标签 |
| POST | `/api/v1/profile/tags` | 保存用户选择的标签 |
| GET | `/api/v1/profile/my-tags` | 获取用户已选标签 |
| GET | `/api/v1/profile/questions` | 获取问卷题目 |
| POST | `/api/v1/profile/answers` | 提交问卷答案 |
| POST | `/api/v1/profile/persona/generate` | 生成画像 |
| GET | `/api/v1/profile/persona` | 获取最新画像 |
| POST | `/api/v1/profile/complete-onboarding` | 标记 onboarding 完成 |

### 分岔点
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/fork-points` | 创建分岔点 |
| GET | `/api/v1/fork-points` | 列出用户所有分岔点 |
| GET | `/api/v1/fork-points/{id}` | 获取单个分岔点 |
| PUT | `/api/v1/fork-points/{id}` | 更新分岔点 |
| DELETE | `/api/v1/fork-points/{id}` | 删除分岔点 |

### 平行人生
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/fork-points/{id}/generate` | 生成平行人生时间线 |
| GET | `/api/v1/fork-points/{id}/life` | 获取已生成的时间线 |
| GET | `/api/v1/lives/{life_id}/events/{event_id}` | 获取/按需生成事件详情 |

---

## 八、结合 BP 的 TODO 分析

### TODO 1：「每日只言片语」—— 另一个我的日常消息

**BP 原文：**
> 每天，你会收到"另一个我"的只言片语：他在冰岛看极光时想家，她在埃及跳舞后算着余额住青旅。

**当前状态：** 完全未实现。现在只有一次性的时间线生成，没有每日推送/持续更新机制。

**需要实现：**
- 消息推送系统（WebSocket / 定时任务 + 通知）
- 新数据模型：`DailyMessage` 表
- AI 生成逻辑：基于已有时间线，按日期持续生成分身的日常碎片
- 前端消息流展示页面

---

### TODO 2：「留言互动」—— 与另一个我对话

**BP 原文：**
> 你可以给他留言、安慰他、听他说"其实我也羡慕你的安稳"——而他会记住你的每一句关心，在往后的日子里偶尔提起。

**当前状态：** 完全未实现。现在只有单向的叙事生成，没有对话/聊天功能。

**需要实现：**
- Chat 模块：`Conversation` / `Message` 数据模型
- 对话上下文管理（保持分身人设一致性）
- 前端聊天 UI 组件
- 消息记忆机制（分身记住用户说过的话，在后续生成中引用）

---

### TODO 3：「勇气激发引擎」(Courage Engine)

**BP 原文：**
> 最终，那个叫"勇气激发"的引擎会轻声问你："你羡慕他的自由？下周六，替你们两个去山顶看一次日出吧。"

**当前状态：** 完全未实现。

**需要实现：**
- 分析用户对平行人生的关注点和情绪反应
- 基于"两个自己"的差异点生成可操作的建议
- 新的 prompt 模板 + 推荐引擎
- 前端展示组件（轻柔引导式 UI）

---

### TODO 4：分身「持续成长」机制

**BP 原文：**
> 生成一个**持续成长**的数字分身。随着你一次次分享，他会越来越像"你"。

**当前状态：** 画像支持版本化（`UserPersona.version`），但时间线是一次性生成的，没有"随时间发展"的机制。

**需要实现：**
- 时间线随真实日期推进持续延伸新事件
- 用户新输入（对话、新标签、新分岔点）反哺画像自动更新
- 分身"记忆"系统（跨对话、跨时间线的记忆持久化）

---

### TODO 5：工程层面待完善

| 项目 | 当前状态 | 所在位置 | 说明 |
|------|----------|----------|------|
| **CORS 限制** | `allow_origins=["*"]` | `main.py:42` | 生产环境需收紧为具体域名 |
| **OAuth state 校验** | 生成了 state 但未在 callback 验证 | `auth.py:122` vs `auth.py:136` | 存在 CSRF 风险 |
| **GitHub OAuth** | 枚举定义了 `github` 但未实现 | `models/base.py` OAuthProvider | 只实现了 Google |
| **密码登录** | 有 hash/verify 工具但无路由 | `core/security.py` | 预留了但未接入 |
| **生成异步化** | 当前同步阻塞请求 | `routers/lives.py:39` | 大模型调用可能超时，应改为后台任务 + 轮询/WebSocket |
| **prompt_templates 初始化** | 表存在但无初始数据 | 全靠代码 fallback | 应提供 seed 脚本 |
| **测试** | 无任何测试代码 | — | 需补充单元测试和集成测试 |
| **调试日志清理** | 遗留 debug 写文件代码 | `auth.py` 写入 `.cursor/debug-*.log` | 需清理 |
| **前端错误处理** | 多处 `catch {}` 静默吞错误 | `LifeView.tsx:93`, `Dashboard.tsx:22` 等 | 用户无反馈 |

---

## 九、总结

### 已完成的 MVP 闭环

```
Google 登录 → 三步 Onboarding 建档 → 创建分岔点 → AI 生成平行人生时间线 → 点击查看事件详细叙事
```

这条主线已经跑通，用户可以完整体验从登录到查看平行人生叙事的全流程。

### BP 中未完成的三大核心功能

| 功能 | 产品价值 | 技术难度 |
|------|----------|----------|
| **每日消息推送** | 让分身"活起来"，从一次性工具变为日常陪伴 | 中（定时任务 + 消息流） |
| **对话互动** | 让分身"有温度"，双向情感连接 | 高（上下文管理 + 记忆系统） |
| **勇气激发引擎** | 从欣赏走向行动，产品核心差异化 | 高（行为分析 + 推荐算法） |

这三个功能正是 BP 中让产品从"一次性生成工具"变成"持续情感陪伴"的关键差异点。
