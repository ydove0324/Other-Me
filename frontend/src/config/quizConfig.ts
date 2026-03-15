export interface QuizOption {
  id: string;
  label: string;
  children?: QuizQuestion[];
  allowCustomText?: boolean;
  /** 点击后弹出文本输入框（而非长按） */
  isCustomInput?: boolean;
  /** 跨部分条件：仅当指定问题的答案匹配时才显示此选项 */
  showIf?: { questionId: string; values: string[] };
}

export interface QuizQuestion {
  id: string;
  title: string;
  type: 'single' | 'multi' | 'text';
  required?: boolean;
  options?: QuizOption[];
  maxSelections?: number;
  minSelections?: number;
  showIf?: { questionId: string; values: string[] };
}

export interface QuizSection {
  id: string;
  title: string;
  subtitle?: string;
  questions: QuizQuestion[];
  /** 整个部分可跳过 */
  skippable?: boolean;
}

export const quizConfig: QuizSection[] = [
  // ─── 第一部分：基础坐标 ───
  {
    id: 'basics',
    title: '基础坐标',
    subtitle: '先简单了解一下你',
    questions: [
      {
        id: 'gender',
        title: '你的性别？',
        type: 'single',
        required: true,
        options: [
          { id: 'male', label: '男' },
          { id: 'female', label: '女' },
          { id: 'prefer_not', label: '不想透露' },
        ],
      },
      {
        id: 'orientation',
        title: '你的性取向？',
        type: 'single',
        required: true,
        options: [
          { id: 'or_male', label: '男' },
          { id: 'or_female', label: '女' },
          { id: 'or_prefer_not', label: '不想透露' },
        ],
      },
      {
        id: 'life_stage',
        title: '你现在的阶段？',
        type: 'single',
        required: true,
        options: [
          { id: 'studying', label: '还在读书' },
          { id: 'new_job', label: '刚工作不久' },
          { id: 'working_years', label: '工作几年了' },
          { id: 'transition', label: '过渡期（考研/考公/待业/转行）' },
        ],
      },
      {
        id: 'city_tier',
        title: '你现在的城市？',
        type: 'single',
        required: true,
        options: [
          { id: 'tier1', label: '一线/新一线' },
          { id: 'tier2', label: '二线省会' },
          { id: 'tier34', label: '三四线小城' },
          { id: 'hometown', label: '老家/县城' },
          { id: 'overseas', label: '不在国内' },
        ],
      },
      {
        id: 'living_situation',
        title: '你的居住状态？',
        type: 'single',
        required: true,
        options: [
          { id: 'alone', label: '独居' },
          { id: 'with_family', label: '和家人住' },
          { id: 'with_partner', label: '和伴侣住' },
          { id: 'with_roommates', label: '和室友合租' },
          {
            id: 'with_pet',
            label: '和宠物一起',
            children: [
              {
                id: 'pet_type',
                title: '宠物是什么？',
                type: 'single',
                options: [
                  { id: 'dog', label: '狗' },
                  { id: 'cat', label: '猫' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ─── 第二部分：关系底色 ───
  {
    id: 'relationships',
    title: '关系底色',
    subtitle: '你心里最牵挂谁？',
    questions: [
      {
        id: 'care_about',
        title: '你最牵挂谁？（可选 1-2 个）',
        type: 'multi',
        required: true,
        minSelections: 1,
        maxSelections: 2,
        options: [
          {
            id: 'family',
            label: '父母/家人',
            children: [
              {
                id: 'family_relation',
                title: '和家人的关系……',
                type: 'single',
                options: [
                  { id: 'family_good', label: '经常联系，关系挺好' },
                  { id: 'family_distant', label: '偶尔打电话，报喜不报忧' },
                  { id: 'family_together', label: '住在一起，偶尔小摩擦' },
                  {
                    id: 'family_knot',
                    label: '心里有个结',
                    children: [
                      {
                        id: 'family_knot_detail',
                        title: '是什么样的结？',
                        type: 'single',
                    options: [
                      { id: 'communication', label: '沟通问题，互相不理解' },
                      { id: 'life_choice', label: '人生选择上的分歧' },
                      { id: 'missed_moment', label: '错过了某个重要时刻' },
                    ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'partner',
            label: '伴侣',
            children: [
              {
                id: 'partner_status',
                title: '你们现在的状态……',
                type: 'single',
                options: [
                  { id: 'partner_good', label: '很好，很安心' },
                  { id: 'partner_adjusting', label: '有点波动，在磨合' },
                  { id: 'partner_ldr', label: '异地中，有时想念' },
                  {
                    id: 'partner_thinking',
                    label: '正在考虑"要不要继续"',
                    children: [
                      {
                        id: 'partner_conflict',
                        title: '核心矛盾出现在哪？',
                        type: 'single',
                        options: [
                          { id: 'personality_comm', label: '性格/沟通' },
                          { id: 'future_plan', label: '未来规划' },
                          { id: 'trust_issue', label: '信任问题' },
                  // 具体矛盾也可以用题目后的 ✍🏻 自由补充
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'best_friend',
            label: '最好的朋友',
            children: [
              {
                id: 'friend_status',
                title: '你们现在……',
                type: 'single',
                options: [
                  { id: 'friend_often', label: '经常见面' },
                  { id: 'friend_online', label: '网上聊得多' },
                  { id: 'friend_different_city', label: '不在一个城市' },
                  {
                    id: 'friend_lost',
                    label: '好久没联系',
                    children: [
                      {
                        id: 'friend_first_words',
                        title: '如果见到 ta，第一句话想说什么？',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'my_pet',
            label: '我的毛孩子',
            showIf: { questionId: 'living_situation', values: ['with_pet'] },
            children: [
              {
                id: 'pet_name',
                title: '它叫什么名字？',
                type: 'text',
              },
            ],
          },
          {
            id: 'child',
            label: '孩子',
          },
          {
            id: 'myself',
            label: '我自己',
            children: [
              {
                id: 'self_focus',
                title: '最近在关注自己的什么？',
                type: 'single',
                options: [
                  { id: 'emotion', label: '情绪' },
                  { id: 'health', label: '健康' },
                  { id: 'growth', label: '成长' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ─── 第三部分：内心种子 ───
  {
    id: 'inner_seed',
    title: '内心种子',
    subtitle: '这是最核心的一题',
    questions: [
      {
        id: 'alter_wish',
        title: '希望另一个你……（选一个）',
        type: 'single',
        required: true,
        options: [
          {
            id: 'missed_city',
            label: '去了你没去成的城市',
            children: [
              {
                id: 'which_city',
                title: '哪个城市？（可跳过）',
                type: 'text',
              },
            ],
          },
          {
            id: 'undone_thing',
            label: '做了你没敢做的事',
            children: [
              {
                id: 'undone_category',
                title: '是哪类事？',
                type: 'single',
                options: [
                  { id: 'adventure', label: '冒险类（跳伞/潜水/徒步）' },
                  { id: 'expression', label: '表达类（告白/演讲/唱歌）' },
                  { id: 'change', label: '改变类（辞职/转行/出国）' },
                ],
              },
            ],
          },
          {
            id: 'with_that_person',
            label: '和那个人在一起了',
            children: [
              {
                id: 'that_person',
                title: '那个人是……',
                type: 'text',
              },
            ],
          },
          { id: 'more_relaxed', label: '活得更松弛' },
          {
            id: 'kept_dream',
            label: '坚持了半途而废的梦想',
            children: [
              {
                id: 'which_dream',
                title: '是什么梦想？',
                type: 'text',
              },
            ],
          },
          {
            id: 'different_path',
            label: '选了完全不同的路',
            children: [
              {
                id: 'what_path',
                title: '什么样的路？',
                type: 'text',
              },
            ],
          },
          // 其他没说到的愿望，可以用题目后的 ✍🏻 自由写
        ],
      },
    ],
  },

  // ─── 第四部分：日常质感 & 自我标签（可跳过） ───
  {
    id: 'daily_texture',
    title: '日常质感 & 自我标签',
    subtitle: '轻松可选，随意作答',
    skippable: true,
    questions: [
      {
        id: 'weekend_morning',
        title: '周末早上最理想的第一个动作？',
        type: 'single',
        options: [
          {
            id: 'coffee_tea',
            label: '慢慢喝咖啡/茶发呆',
            children: [
              {
                id: 'coffee_where',
                title: '在哪喝？',
                type: 'single',
                options: [
                  { id: 'home_pajama', label: '在家穿睡衣' },
                  { id: 'cafe_watch', label: '去咖啡馆看人' },
                  { id: 'either', label: '都行' },
                ],
              },
            ],
          },
          { id: 'stay_bed', label: '赖床刷手机' },
          {
            id: 'go_eat',
            label: '起床出门吃顿好的',
            children: [
              {
                id: 'eat_what',
                title: '吃什么？',
                type: 'single',
                options: [
                  { id: 'warm_food', label: '包子馄饨热乎的' },
                  { id: 'brunch', label: 'Brunch 拍好看' },
                  { id: 'noodle', label: '面馆呼噜吃完' },
                  { id: 'decide_later', label: '到了再看' },
                ],
              },
            ],
          },
          { id: 'clean_up', label: '收拾屋子' },
          { id: 'exercise', label: '出门运动/散步' },
          { id: 'no_idea', label: '没想过' },
        ],
      },
      {
        id: 'shower_thoughts',
        title: '洗澡时在想什么？',
        type: 'single',
        options: [
          {
            id: 'shower_music',
            label: '脑子里放歌',
            children: [
              {
                id: 'shower_song',
                title: '最近洗澡单曲循环？',
                type: 'single',
                options: [
                  { id: 'just_melody', label: '不记得，就旋律' },
                ],
              },
            ],
          },
          {
            id: 'review_day',
            label: '回想今天的事',
            children: [
              {
                id: 'review_mood',
                title: '回想的感觉……',
                type: 'single',
                options: [
                  { id: 'happy_more', label: '开心的事多' },
                  { id: 'awkward_more', label: '尴尬瞬间多' },
                  { id: 'both', label: '都有' },
                ],
              },
            ],
          },
          { id: 'mental_dialog', label: '脑补对话' },
          { id: 'blank', label: '放空' },
          { id: 'hurry_phone', label: '想快点洗完看手机' },
        ],
      },
      {
        id: 'food_memory',
        title: '哪种食物让你想起某人或某地？',
        type: 'single',
        options: [
          {
            id: 'home_taste',
            label: '家里做的味道',
            children: [
              { id: 'food_dish', title: '那道菜是什么？', type: 'text' },
              {
                id: 'food_feeling',
                title: '想起时的感觉？',
                type: 'single',
                options: [
                  { id: 'warm', label: '温暖' },
                  { id: 'sad', label: '难过' },
                  { id: 'complicated', label: '复杂' },
                ],
              },
            ],
          },
          {
            id: 'city_taste',
            label: '某个城市吃到的',
            children: [
              { id: 'food_dish_city', title: '那道菜是什么？', type: 'text' },
              {
                id: 'food_feeling_city',
                title: '想起时的感觉？',
                type: 'single',
                options: [
                  { id: 'warm', label: '温暖' },
                  { id: 'sad', label: '难过' },
                  { id: 'complicated', label: '复杂' },
                ],
              },
            ],
          },
          {
            id: 'someone_cooked',
            label: '某人给我做的',
            children: [
              { id: 'food_dish_someone', title: '那道菜是什么？', type: 'text' },
              {
                id: 'food_feeling_someone',
                title: '想起时的感觉？',
                type: 'single',
                options: [
                  { id: 'warm', label: '温暖' },
                  { id: 'sad', label: '难过' },
                  { id: 'complicated', label: '复杂' },
                ],
              },
            ],
          },
          { id: 'no_food_memory', label: '没有' },
        ],
      },
      {
        id: 'insomnia',
        title: '深夜睡不着做什么？',
        type: 'single',
        options: [
          { id: 'scroll_phone', label: '刷手机' },
          {
            id: 'listen',
            label: '听点东西',
            children: [
              {
                id: 'listen_what',
                title: '听什么？',
                type: 'single',
                options: [
                  { id: 'podcast', label: '播客' },
                  { id: 'quiet_song', label: '安静的歌' },
                  { id: 'white_noise', label: '白噪音' },
                ],
              },
            ],
          },
          { id: 'read_book', label: '看书' },
          {
            id: 'stare_think',
            label: '睁眼想事情',
            children: [
              {
                id: 'think_what',
                title: '想什么？',
                type: 'single',
                options: [
                  { id: 'think_past', label: '想过去' },
                  { id: 'think_future', label: '想未来' },
                  { id: 'think_random', label: '乱想没方向' },
                ],
              },
            ],
          },
          { id: 'deep_breath', label: '深呼吸' },
          { id: 'accept_it', label: '习惯了不挣扎' },
        ],
      },
      {
        id: 'earphones',
        title: '走路戴耳机吗？',
        type: 'single',
        options: [
          {
            id: 'always_earphones',
            label: '基本都戴',
            children: [
              {
                id: 'earphone_content',
                title: '听什么多？',
                type: 'single',
                options: [
                  { id: 'music_more', label: '听歌多' },
                  { id: 'podcast_more', label: '听播客多' },
                  { id: 'mix', label: '换着来' },
                ],
              },
            ],
          },
          { id: 'depends_mood', label: '看心情' },
          {
            id: 'rarely_earphones',
            label: '很少戴',
            children: [
              {
                id: 'no_earphone_reason',
                title: '为什么？',
                type: 'single',
                options: [
                  { id: 'notice_sounds', label: '会注意周围声音' },
                  { id: 'in_thoughts', label: '自己在想事情' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'self_labels',
        title: '你觉得自己更像哪种人？（可多选）',
        type: 'multi',
        options: [
          {
            id: 'optimist',
            label: '乐观主义者',
            children: [
              {
                id: 'optimist_detail',
                title: '这样的你，通常会做什么？',
                type: 'single',
                options: [
                  { id: 'solve_first', label: '遇到困难先想解决办法' },
                  { id: 'find_bright', label: '经常从坏事里找好的一面' },
                  { id: 'encourage', label: '喜欢鼓励朋友' },
                  { id: 'believe_tmr', label: '相信明天会更好' },
                ],
              },
            ],
          },
          {
            id: 'emotional',
            label: '感性的人',
            children: [
              {
                id: 'emotional_detail',
                title: '感性的表现？',
                type: 'single',
                options: [
                  { id: 'cry_movie', label: '看电影容易哭' },
                  { id: 'moved_easily', label: '容易被小事打动' },
                  { id: 'care_feelings', label: '很在意别人感受' },
                  { id: 'decide_feel', label: '常凭感觉做决定' },
                ],
              },
            ],
          },
          {
            id: 'romantic',
            label: '浪漫主义者',
            children: [
              {
                id: 'romantic_detail',
                title: '浪漫的表现？',
                type: 'single',
                options: [
                  { id: 'sunset_stars', label: '喜欢看日落/星空' },
                  { id: 'surprise', label: '会为特别的日子准备惊喜' },
                  { id: 'fate', label: '相信命中注定' },
                  { id: 'write_journal', label: '喜欢写东西/记录心情' },
                ],
              },
            ],
          },
          {
            id: 'pragmatist',
            label: '实用主义者',
            children: [
              {
                id: 'pragmatist_detail',
                title: '实用的表现？',
                type: 'single',
                options: [
                  { id: 'cost_perf', label: '买东西先看性价比' },
                  { id: 'whats_use', label: '做事先想"有什么用"' },
                  { id: 'no_abstract', label: '不太信虚无缥缈的东西' },
                  { id: 'efficiency', label: '解决问题最看重效率' },
                ],
              },
            ],
          },
          {
            id: 'rational',
            label: '理性的人',
            children: [
              {
                id: 'rational_detail',
                title: '理性的表现？',
                type: 'single',
                options: [
                  { id: 'analyze_pros', label: '做决定前先分析利弊' },
                  { id: 'not_emotional', label: '不容易情绪化' },
                  { id: 'logic', label: '喜欢逻辑清晰的事' },
                  { id: 'called_calm', label: '常被人说"冷静"' },
                ],
              },
            ],
          },
          {
            id: 'hedonist',
            label: '享受主义',
            children: [
              {
                id: 'hedonist_detail',
                title: '享受的表现？',
                type: 'single',
                options: [
                  { id: 'yolo', label: '人生苦短，及时行乐' },
                  { id: 'food_travel', label: '喜欢美食/旅行/舒服的事' },
                  { id: 'easy_self', label: '不太为难自己' },
                  { id: 'live_now', label: '活在当下' },
                ],
              },
            ],
          },
          {
            id: 'night_owl',
            label: '夜猫子',
            children: [
              {
                id: 'night_owl_detail',
                title: '夜猫子的日常？',
                type: 'single',
                options: [
                  { id: 'night_efficient', label: '晚上效率高' },
                  { id: 'more_awake', label: '越夜越精神' },
                  { id: 'stay_up', label: '经常熬夜' },
                  { id: 'love_quiet', label: '喜欢深夜的安静' },
                ],
              },
            ],
          },
          {
            id: 'morning_person',
            label: '晨型人',
            children: [
              {
                id: 'morning_detail',
                title: '早起的感觉？',
                type: 'single',
                options: [
                  { id: 'earned', label: '早起感觉赚到了' },
                  { id: 'morning_time', label: '喜欢清晨的时光' },
                  { id: 'morning_energy', label: '上午做事最有劲' },
                  { id: 'sleepy_night', label: '晚上容易困' },
                ],
              },
            ],
          },
          {
            id: 'introvert',
            label: '内向的人',
            children: [
              {
                id: 'introvert_detail',
                title: '内向的表现？',
                type: 'single',
                options: [
                  { id: 'recharge_alone', label: '独处是在充电' },
                  { id: 'tired_social', label: '社交后会累' },
                  { id: 'deep_talk', label: '喜欢深度对话' },
                  { id: 'no_crowd', label: '不太爱凑热闹' },
                ],
              },
            ],
          },
          {
            id: 'extrovert',
            label: '外向的人',
            children: [
              {
                id: 'extrovert_detail',
                title: '外向的表现？',
                type: 'single',
                options: [
                  { id: 'energy_people', label: '和人待着就有能量' },
                  { id: 'love_bustle', label: '喜欢热闹' },
                  { id: 'easy_connect', label: '容易和人熟起来' },
                  { id: 'bored_alone', label: '一个人太久会闷' },
                ],
              },
            ],
          },
          {
            id: 'adventurer',
            label: '冒险家',
            children: [
              {
                id: 'adventurer_detail',
                title: '冒险的表现？',
                type: 'single',
                options: [
                  { id: 'try_new', label: '喜欢尝试没做过的事' },
                  { id: 'no_fear', label: '不怕未知' },
                  { id: 'plan_random', label: '旅行爱做计划也爱随机' },
                  { id: 'safe_boring', label: '觉得安全区无聊' },
                ],
              },
            ],
          },
          {
            id: 'stable',
            label: '安稳派',
            children: [
              {
                id: 'stable_detail',
                title: '安稳的表现？',
                type: 'single',
                options: [
                  { id: 'certain_life', label: '喜欢确定的生活' },
                  { id: 'think_risk', label: '做决定前会想风险' },
                  { id: 'familiar_comfy', label: '熟悉的东西最舒服' },
                  { id: 'no_thrill', label: '不太追求刺激' },
                ],
              },
            ],
          },
          // 自我标签的自由发挥交给每题后的 ✍🏻
        ],
      },
      {
        id: 'anonymous_place',
        title: '如果完全没人认识你，想去哪待一天？（选择1-3个）',
        type: 'multi',
        minSelections: 1,
        maxSelections: 3,
        options: [
          {
            id: 'seaside',
            label: '海边看浪',
            children: [
              {
                id: 'seaside_detail',
                title: '会下水吗？',
                type: 'single',
                options: [
                  { id: 'swim_yes', label: '会下水' },
                  { id: 'swim_no', label: '不会，岸上待着' },
                  { id: 'swim_depends', label: '看天气' },
                ],
              },
            ],
          },
          { id: 'mountain', label: '山里走路' },
          { id: 'strange_city', label: '陌生城市闲逛' },
          {
            id: 'stay_home',
            label: '在家待着',
            children: [
              {
                id: 'home_activity',
                title: '在家做什么？',
                type: 'single',
                options: [
                  { id: 'binge_watch', label: '追剧/电影' },
                  { id: 'cook', label: '做吃的' },
                  { id: 'read', label: '看书' },
                  { id: 'lie_down', label: '躺着' },
                ],
              },
            ],
          },
          { id: 'window_cafe', label: '落地窗咖啡馆' },
          { id: 'rooftop', label: '楼顶看城市' },
        ],
      },
      {
        id: 'useless_habit',
        title: '有没有"没用但喜欢"的习惯？（选择1-3个）',
        type: 'multi',
        minSelections: 1,
        maxSelections: 3,
        options: [
          {
            id: 'collect_boxes',
            label: '攒包装盒/袋子',
            children: [
              {
                id: 'collect_what',
                title: '攒什么？',
                type: 'single',
                options: [
                  { id: 'nice_bags', label: '好看纸袋' },
                  { id: 'delivery_box', label: '快递盒' },
                  { id: 'tags_labels', label: '吊牌/标签' },
                  { id: 'bottles', label: '瓶子罐子' },
                ],
              },
            ],
          },
          { id: 'journaling', label: '写手帐/乱记' },
          { id: 'detour_home', label: '绕远路回家' },
          { id: 'arrange_pillow', label: '摆弄枕头' },
          { id: 'save_last_bite', label: '吃东西留最后一口' },
          {
            id: 'talk_self',
            label: '自己跟自己说话',
            children: [
              {
                id: 'talk_self_when',
                title: '什么时候？',
                type: 'single',
                options: [
                  { id: 'walking', label: '走路时' },
                  { id: 'before_sleep', label: '睡前' },
                  { id: 'in_shower', label: '洗澡时' },
                  { id: 'between_tasks', label: '做事间隙' },
                ],
              },
            ],
          },
          { id: 'shy_habit', label: '有但不好意思说' },
          { id: 'no_habit', label: '好像没有' },
        ],
      },
      {
        id: 'no_phone_day',
        title: '手机突然没电一整天？',
        type: 'single',
        options: [
          { id: 'panic', label: '有点慌' },
          {
            id: 'relax_blank',
            label: '正好放空',
            children: [
              {
                id: 'blank_real',
                title: '真的能放空吗？',
                type: 'single',
                options: [
                  { id: 'yes_blank', label: '真的能放空' },
                  { id: 'more_messy', label: '更乱，担心有人找' },
                  { id: 'depends_mood2', label: '看心情' },
                ],
              },
            ],
          },
          { id: 'find_book', label: '找书或纸笔' },
          {
            id: 'go_walk',
            label: '出门走走',
            children: [
              {
                id: 'walk_where',
                title: '去哪？',
                type: 'single',
                options: [
                  { id: 'park', label: '去公园' },
                  { id: 'convenience', label: '去便利店' },
                  { id: 'random_bus', label: '随便上公交' },
                  { id: 'wander', label: '附近乱逛' },
                ],
              },
            ],
          },
          { id: 'sleep_it', label: '睡觉' },
          { id: 'borrow_charger', label: '想办法借充电宝' },
        ],
      },
      {
        id: 'lottery',
        title: '中彩票第一个做的事？',
        type: 'single',
        options: [
          { id: 'sleep_3days', label: '先睡三天' },
          {
            id: 'buy_ticket',
            label: '立刻买票去个地方',
            children: [
              { id: 'lottery_where', title: '去哪？', type: 'text' },
            ],
          },
          {
            id: 'buy_house',
            label: '给家人/自己买房',
            children: [
              {
                id: 'buy_for_whom',
                title: '给谁？',
                type: 'single',
                options: [
                  { id: 'for_mom', label: '妈妈' },
                  { id: 'for_dad', label: '爸爸' },
                  { id: 'for_grandparents', label: '爷爷奶奶/外公外婆' },
                ],
              },
            ],
          },
          { id: 'pay_debt', label: '还债/存起来' },
          { id: 'nice_meal', label: '吃顿平时舍不得的' },
          { id: 'gift_someone', label: '给重要的人买礼物' },
          { id: 'never_thought', label: '没想过' },
        ],
      },
    ],
  },

  // ─── 第五部分：收尾 ───
  {
    id: 'closing',
    title: '收尾',
    subtitle: '最后几个问题',
    questions: [
      {
        id: 'ask_alter_self',
        title: '你想问另一个自己什么？（选 1-3 个）',
        type: 'multi',
        required: true,
        minSelections: 1,
        maxSelections: 3,
        options: [
          { id: 'q_happy', label: '你现在过得开心吗？' },
          { id: 'q_regret', label: '你后悔当初的选择吗？' },
          { id: 'q_care', label: '你那边有牵挂的人吗？' },
          { id: 'q_tell', label: '你最想告诉我的一件事？' },
          { id: 'q_lonely', label: '你孤独时怎么办？' },
          { id: 'q_miss', label: '有没有想念"这边的我"？' },
          { id: 'q_worry', label: '你最大的烦恼是什么？' },
          { id: 'q_advice', label: '给我一句建议？' },
          // 想问的别的问题用题目后的 ✍🏻 写下来
        ],
      },
      {
        id: 'nickname',
        title: '给自己取个昵称吧',
        type: 'text',
      },
      {
        id: 'birth_year_month',
        title: '出生年月日（可不填）',
        type: 'text',
      },
    ],
  },
];
