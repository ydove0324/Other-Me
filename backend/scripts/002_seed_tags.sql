-- Seed: Tag Categories and Tags

-- Category 1: 性格特质
INSERT INTO tag_categories (name, display_name, description, sort_order) VALUES
('personality', '性格特质', '描述你的性格类型', 1)
ON CONFLICT (name) DO NOTHING;

INSERT INTO tags (category_id, name, display_name, sort_order) VALUES
((SELECT id FROM tag_categories WHERE name = 'personality'), 'romantic', '浪漫主义者', 1),
((SELECT id FROM tag_categories WHERE name = 'personality'), 'pragmatic', '实用主义者', 2),
((SELECT id FROM tag_categories WHERE name = 'personality'), 'emotional', '是个感性的人', 3),
((SELECT id FROM tag_categories WHERE name = 'personality'), 'rational', '理性派', 4),
((SELECT id FROM tag_categories WHERE name = 'personality'), 'adventurous', '冒险家', 5),
((SELECT id FROM tag_categories WHERE name = 'personality'), 'homebody', '恋家的人', 6),
((SELECT id FROM tag_categories WHERE name = 'personality'), 'hedonist', '享受主义者', 7),
((SELECT id FROM tag_categories WHERE name = 'personality'), 'perfectionist', '完美主义者', 8),
((SELECT id FROM tag_categories WHERE name = 'personality'), 'optimist', '乐观主义者', 9),
((SELECT id FROM tag_categories WHERE name = 'personality'), 'introvert', '内向但丰富', 10)
ON CONFLICT ON CONSTRAINT uq_tag_category_name DO NOTHING;

-- Category 2: 兴趣爱好
INSERT INTO tag_categories (name, display_name, description, sort_order) VALUES
('interests', '兴趣爱好', '你喜欢做什么', 2)
ON CONFLICT (name) DO NOTHING;

INSERT INTO tags (category_id, name, display_name, sort_order) VALUES
((SELECT id FROM tag_categories WHERE name = 'interests'), 'photography', '喜欢摄影', 1),
((SELECT id FROM tag_categories WHERE name = 'interests'), 'running', '喜欢跑步', 2),
((SELECT id FROM tag_categories WHERE name = 'interests'), 'music', '喜欢民族音乐', 3),
((SELECT id FROM tag_categories WHERE name = 'interests'), 'reading', '喜欢阅读', 4),
((SELECT id FROM tag_categories WHERE name = 'interests'), 'cooking', '喜欢烹饪', 5),
((SELECT id FROM tag_categories WHERE name = 'interests'), 'travel', '旅行爱好者', 6),
((SELECT id FROM tag_categories WHERE name = 'interests'), 'art', '喜欢艺术', 7),
((SELECT id FROM tag_categories WHERE name = 'interests'), 'sports', '喜欢运动', 8),
((SELECT id FROM tag_categories WHERE name = 'interests'), 'gaming', '游戏玩家', 9),
((SELECT id FROM tag_categories WHERE name = 'interests'), 'writing', '喜欢写作', 10)
ON CONFLICT ON CONSTRAINT uq_tag_category_name DO NOTHING;

-- Category 3: 生活方式
INSERT INTO tag_categories (name, display_name, description, sort_order) VALUES
('lifestyle', '生活方式', '你的日常是什么样的', 3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO tags (category_id, name, display_name, sort_order) VALUES
((SELECT id FROM tag_categories WHERE name = 'lifestyle'), 'night_owl', '夜猫子', 1),
((SELECT id FROM tag_categories WHERE name = 'lifestyle'), 'early_bird', '早起星人', 2),
((SELECT id FROM tag_categories WHERE name = 'lifestyle'), 'social', '社交达人', 3),
((SELECT id FROM tag_categories WHERE name = 'lifestyle'), 'solitude', '享受独处', 4),
((SELECT id FROM tag_categories WHERE name = 'lifestyle'), 'city_lover', '城市动物', 5),
((SELECT id FROM tag_categories WHERE name = 'lifestyle'), 'nature_lover', '向往田园', 6),
((SELECT id FROM tag_categories WHERE name = 'lifestyle'), 'late_night_emo', '经常深夜emo', 7),
((SELECT id FROM tag_categories WHERE name = 'lifestyle'), 'workaholic', '工作狂', 8),
((SELECT id FROM tag_categories WHERE name = 'lifestyle'), 'minimalist', '极简主义', 9),
((SELECT id FROM tag_categories WHERE name = 'lifestyle'), 'foodie', '美食爱好者', 10)
ON CONFLICT ON CONSTRAINT uq_tag_category_name DO NOTHING;

-- Category 4: 价值观
INSERT INTO tag_categories (name, display_name, description, sort_order) VALUES
('values', '价值观', '你最看重什么', 4)
ON CONFLICT (name) DO NOTHING;

INSERT INTO tags (category_id, name, display_name, sort_order) VALUES
((SELECT id FROM tag_categories WHERE name = 'values'), 'freedom', '自由至上', 1),
((SELECT id FROM tag_categories WHERE name = 'values'), 'security', '安全感第一', 2),
((SELECT id FROM tag_categories WHERE name = 'values'), 'family', '家庭最重要', 3),
((SELECT id FROM tag_categories WHERE name = 'values'), 'career', '事业为先', 4),
((SELECT id FROM tag_categories WHERE name = 'values'), 'experience', '体验大于拥有', 5),
((SELECT id FROM tag_categories WHERE name = 'values'), 'growth', '持续成长', 6),
((SELECT id FROM tag_categories WHERE name = 'values'), 'connection', '深度连接', 7),
((SELECT id FROM tag_categories WHERE name = 'values'), 'creativity', '创造力', 8)
ON CONFLICT ON CONSTRAINT uq_tag_category_name DO NOTHING;
