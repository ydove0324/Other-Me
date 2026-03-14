-- Seed: Questionnaire Questions

INSERT INTO questionnaire_questions (question_text, question_type, options, category, sort_order) VALUES
(
    '你最受不了哪种人？',
    'multiple_choice',
    '{"choices": ["A. 逻辑混乱还爱说教的", "B. 固执己见拒绝新事物的", "C. 满脑子只有利益没点情怀的", "D. 永远在抱怨却从不行动的"]}',
    'personality',
    1
),
(
    '如果给你一个月的假期和无限预算，你第一件想做的事是？',
    'multiple_choice',
    '{"choices": ["A. 一个人背包环游世界", "B. 找个安静的地方写点什么/创作", "C. 和最重要的人一起去某个特别的地方", "D. 学一项全新的技能"]}',
    'values',
    2
),
(
    '深夜睡不着的时候，你脑子里转的最多的是什么？',
    'multiple_choice',
    '{"choices": ["A. 对过去某个决定的反复复盘", "B. 对未来的期待或焦虑", "C. 某个重要的人", "D. 生命意义之类的大问题"]}',
    'personality',
    3
),
(
    '你觉得什么时候的自己最有魅力？',
    'multiple_choice',
    '{"choices": ["A. 全神贯注做某件事的时候", "B. 和朋友们在一起放声大笑的时候", "C. 一个人安安静静的时候", "D. 帮助别人解决问题的时候"]}',
    'personality',
    4
),
(
    '你现在的生活状态，用一个词形容是？',
    'open_ended',
    NULL,
    'life_context',
    5
),
(
    '如果必须放弃一样，你选择放弃什么？',
    'multiple_choice',
    '{"choices": ["A. 社交媒体", "B. 旅行的自由", "C. 稳定的收入", "D. 独处的时间"]}',
    'values',
    6
),
(
    '你最近一次觉得「人生真好」是什么时候？简单描述一下。',
    'open_ended',
    NULL,
    'life_context',
    7
),
(
    '面对一个重大决定，你通常怎么做？',
    'multiple_choice',
    '{"choices": ["A. 列清单分析利弊", "B. 跟着直觉走", "C. 问身边信任的人的意见", "D. 拖到最后一刻再决定"]}',
    'personality',
    8
),
(
    '你心里有没有一件「一直想做但还没做」的事？可以说说看。',
    'open_ended',
    NULL,
    'dreams',
    9
),
(
    '你觉得「成功」对你来说意味着什么？',
    'multiple_choice',
    '{"choices": ["A. 财务自由，不用为钱发愁", "B. 做着自己真正热爱的事", "C. 身边有深爱的人和被爱的人", "D. 对世界产生了一些正面影响"]}',
    'values',
    10
)
ON CONFLICT DO NOTHING;
