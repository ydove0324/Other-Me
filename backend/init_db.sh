#!/usr/bin/env bash
# 初始化阿里云 RDS PostgreSQL 数据库

set -e

# 从 .env 读取配置
DB_HOST=$(grep DB_HOST .env | cut -d= -f2)
DB_USER=$(grep DB_USER .env | cut -d= -f2)
DB_NAME=$(grep DB_NAME .env | cut -d= -f2)
DB_PASSWORD=$(grep DB_PASSWORD .env | cut -d= -f2)

echo "Connecting to RDS: $DB_HOST as $DB_USER"

# 1. 创建数据库（如果不存在）
echo "Creating database if not exists..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"

# 2. 运行初始化脚本
echo "Running schema initialization..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f scripts/001_init_schema.sql

echo "Seeding tags..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f scripts/002_seed_tags.sql

echo "Seeding questions..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f scripts/003_seed_questions.sql

echo "Seeding prompts..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f scripts/004_seed_prompts.sql

echo "✅ Database initialization complete!"
