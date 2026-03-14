-- Other Me: Database Schema
-- Run against the `other_me` database

-- Users & Auth
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url VARCHAR(500),
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS oauth_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    provider_name VARCHAR(255),
    provider_avatar_url VARCHAR(500),
    raw_profile JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_oauth_provider_uid UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS ix_oauth_accounts_user_id ON oauth_accounts(user_id);

-- Profile: Tags
CREATE TABLE IF NOT EXISTS tag_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES tag_categories(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tag_category_name UNIQUE (category_id, name)
);
CREATE INDEX IF NOT EXISTS ix_tags_category_id ON tags(category_id);

CREATE TABLE IF NOT EXISTS user_tags (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_tag UNIQUE (user_id, tag_id)
);
CREATE INDEX IF NOT EXISTS ix_user_tags_user_id ON user_tags(user_id);

-- Profile: Questionnaire
CREATE TABLE IF NOT EXISTS questionnaire_questions (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL,
    options JSONB,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questionnaire_answers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questionnaire_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    answer_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_question_answer UNIQUE (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS ix_questionnaire_answers_user_id ON questionnaire_answers(user_id);

-- Profile: Persona
CREATE TABLE IF NOT EXISTS user_personas (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_summary TEXT,
    personality_traits JSONB,
    "values" JSONB,
    life_context JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    raw_input_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_user_personas_user_id ON user_personas(user_id);

-- Fork Points
CREATE TABLE IF NOT EXISTS fork_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    happened_at DATE,
    actual_choice TEXT NOT NULL,
    alternative_choice TEXT NOT NULL,
    emotional_context JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_fork_points_user_id ON fork_points(user_id);

-- Alternative Lives
CREATE TABLE IF NOT EXISTS alternative_lives (
    id SERIAL PRIMARY KEY,
    fork_point_id INTEGER NOT NULL REFERENCES fork_points(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_snapshot_id INTEGER REFERENCES user_personas(id) ON DELETE SET NULL,
    overview TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'generating',
    generation_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_alternative_lives_fork_point_id ON alternative_lives(fork_point_id);
CREATE INDEX IF NOT EXISTS ix_alternative_lives_user_id ON alternative_lives(user_id);

-- Timeline Events
CREATE TABLE IF NOT EXISTS life_timeline_events (
    id SERIAL PRIMARY KEY,
    alternative_life_id INTEGER NOT NULL REFERENCES alternative_lives(id) ON DELETE CASCADE,
    event_date DATE,
    title VARCHAR(200) NOT NULL,
    summary TEXT NOT NULL,
    detailed_narrative TEXT,
    emotional_tone JSONB,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_life_timeline_events_life_id ON life_timeline_events(alternative_life_id);

-- AI Config: Prompt Templates
CREATE TABLE IF NOT EXISTS prompt_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    template TEXT NOT NULL,
    variables JSONB,
    model_config JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_prompt_templates_name ON prompt_templates(name);

-- AI Config: Generation Tasks
CREATE TABLE IF NOT EXISTS generation_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_type VARCHAR(30) NOT NULL,
    related_id INTEGER,
    prompt_template_id INTEGER REFERENCES prompt_templates(id) ON DELETE SET NULL,
    input_data JSONB,
    output_data JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    model_used VARCHAR(100),
    tokens_used JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_generation_tasks_user_id ON generation_tasks(user_id);
CREATE INDEX IF NOT EXISTS ix_generation_tasks_status ON generation_tasks(status);
