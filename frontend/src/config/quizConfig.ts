export interface QuizOption {
  id: string;
  label: string;
  children?: QuizQuestion[];
  allowCustomText?: boolean;
}

export interface QuizQuestion {
  id: string;
  title: string;
  type: 'single' | 'multi' | 'text';
  required?: boolean;
  options?: QuizOption[];
  maxSelections?: number;
  showIf?: { questionId: string; values: string[] };
}

export interface QuizSection {
  id: string;
  title: string;
  subtitle?: string;
  questions: QuizQuestion[];
}

export const quizConfig: QuizSection[] = [
  {
    id: 'personality',
    title: '你是什么样的人？',
    subtitle: '选择最贴近你的描述',
    questions: [
      {
        id: 'personality_type',
        title: '社交场合中，你更倾向于……',
        type: 'single',
        required: true,
        options: [
          { id: 'introvert', label: '安静观察，享受独处' },
          { id: 'extrovert', label: '活跃社交，人群中充电' },
          { id: 'ambivert', label: '看心情，两者之间切换' },
          { id: 'personality_type_custom', label: '其实我 ____', allowCustomText: true },
        ],
      },
      {
        id: 'decision_style',
        title: '做重大决定时，你更依赖……',
        type: 'single',
        required: true,
        options: [
          { id: 'rational', label: '理性分析利弊' },
          { id: 'intuition', label: '跟着直觉走' },
          { id: 'others', label: '听听身边人的建议' },
          { id: 'mixed', label: '分析 + 直觉，看情况' },
          { id: 'decision_style_custom', label: '其实我 ____', allowCustomText: true },
        ],
      },
      {
        id: 'personality_traits',
        title: '以下哪些词最能形容你？（可多选）',
        type: 'multi',
        required: true,
        maxSelections: 5,
        options: [
          { id: 'adventurous', label: '爱冒险' },
          { id: 'cautious', label: '谨慎稳重' },
          { id: 'creative', label: '有创造力' },
          { id: 'empathetic', label: '共情力强' },
          { id: 'ambitious', label: '有野心' },
          { id: 'easygoing', label: '随遇而安' },
          { id: 'perfectionist', label: '追求完美' },
          { id: 'independent', label: '独立自主' },
          { id: 'romantic', label: '浪漫主义' },
          { id: 'practical', label: '务实接地气' },
          { id: 'personality_traits_custom', label: '其实我 ____', allowCustomText: true },
        ],
      },
    ],
  },
  {
    id: 'values',
    title: '什么对你最重要？',
    subtitle: '了解你的价值观',
    questions: [
      {
        id: 'life_priority',
        title: '如果只能选一个，你最看重……',
        type: 'single',
        required: true,
        options: [
          { id: 'freedom', label: '自由' },
          { id: 'stability', label: '稳定' },
          { id: 'love', label: '爱与被爱' },
          { id: 'achievement', label: '成就感' },
          { id: 'growth', label: '成长与体验' },
          { id: 'life_priority_custom', label: '其实我 ____', allowCustomText: true },
        ],
      },
      {
        id: 'career_attitude',
        title: '工作对你来说意味着……',
        type: 'single',
        required: true,
        options: [
          {
            id: 'passion',
            label: '热爱与使命',
            children: [
              {
                id: 'passion_field',
                title: '你热爱的领域是？',
                type: 'text',
              },
            ],
          },
          { id: 'livelihood', label: '养家糊口的工具' },
          { id: 'identity', label: '身份认同的来源' },
          { id: 'social', label: '社交和归属感' },
          { id: 'career_attitude_custom', label: '其实我 ____', allowCustomText: true },
        ],
      },
      {
        id: 'relationship_style',
        title: '在感情中，你更偏向……',
        type: 'single',
        options: [
          { id: 'deep_bond', label: '深度连接，一生一人' },
          { id: 'free_spirit', label: '保持距离，彼此独立' },
          { id: 'companionship', label: '细水长流的陪伴' },
          { id: 'exploring', label: '还在探索中' },
          { id: 'relationship_style_custom', label: '其实我 ____', allowCustomText: true },
        ],
      },
    ],
  },
  {
    id: 'life_context',
    title: '你的人生现在在哪个阶段？',
    subtitle: '帮助 AI 更好地理解你',
    questions: [
      {
        id: 'age_range',
        title: '你的年龄段是？',
        type: 'single',
        required: true,
        options: [
          { id: '18-22', label: '18-22 学生时代' },
          { id: '23-28', label: '23-28 初入社会' },
          { id: '29-35', label: '29-35 而立之年' },
          { id: '36-45', label: '36-45 中流砥柱' },
          { id: '46+', label: '46+ 丰盈人生' },
          { id: 'age_range_custom', label: '其实我 ____', allowCustomText: true },
        ],
      },
      {
        id: 'current_mood',
        title: '最近的状态是……',
        type: 'single',
        options: [
          { id: 'content', label: '平静满足' },
          { id: 'anxious', label: '有点焦虑' },
          { id: 'confused', label: '迷茫困惑' },
          { id: 'excited', label: '充满期待' },
          { id: 'tired', label: '疲惫但坚持' },
          { id: 'current_mood_custom', label: '其实我 ____', allowCustomText: true },
        ],
      },
      {
        id: 'life_wish',
        title: '如果可以改变一件事，你最想改变什么？',
        type: 'text',
      },
    ],
  },
];
