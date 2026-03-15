-- User memories: factual summaries from fork points + story choices for future story generation
CREATE TABLE IF NOT EXISTS user_memories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fork_point_id INTEGER NOT NULL REFERENCES fork_points(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_memory_fork UNIQUE (user_id, fork_point_id)
);
CREATE INDEX IF NOT EXISTS ix_user_memories_user_id ON user_memories(user_id);
