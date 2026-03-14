export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserInfo {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  onboarding_completed: boolean;
}

export interface TagCategory {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  sort_order: number;
  tags: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
}

export interface Question {
  id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'open_ended' | 'scale';
  options: { choices?: string[] } | null;
  category: string;
  sort_order: number;
}

export interface Persona {
  id: number;
  persona_summary: string | null;
  personality_traits: string[] | Record<string, unknown> | null;
  values: string[] | Record<string, unknown> | null;
  life_context: string[] | Record<string, unknown> | null;
  version: number;
}

export interface ForkPoint {
  id: number;
  title: string;
  description: string | null;
  happened_at: string | null;
  actual_choice: string;
  alternative_choice: string;
  emotional_context: Record<string, unknown> | null;
  status: 'draft' | 'generating' | 'completed' | 'failed';
  created_at: string;
  has_timeline: boolean;
  has_story: boolean;
}

export interface TimelineEvent {
  id: number;
  event_date: string | null;
  title: string;
  summary: string;
  detailed_narrative: string | null;
  emotional_tone: {
    primary?: string;
    secondary?: string;
    intensity?: number;
  } | null;
  sort_order: number;
}

export interface AlternativeLife {
  id: number;
  fork_point_id: number;
  overview: string | null;
  status: 'generating' | 'completed' | 'failed';
  content_type?: string;
  created_at: string;
  events: TimelineEvent[];
}

export interface StoryScene {
  id: number;
  scene_type: 'text' | 'image' | 'music' | 'video';
  title: string | null;
  content: string | null;
  media_url: string | null;
  metadata: Record<string, unknown> | null;
  sort_order: number;
}

export interface StoryContent {
  id: number;
  fork_point_id: number;
  story_title: string | null;
  story_markdown: string | null;
  status: 'generating' | 'completed' | 'failed';
  content_type: string;
  created_at: string;
  scenes: StoryScene[];
}

export interface BlockStreamEvent {
  type: 'block_start' | 'content' | 'block_end' | 'error';
  index?: number;
  title?: string;
  text?: string;
  message?: string;
}

export interface LifeBlock {
  index: number;
  title: string;
  content: string;
  status: 'pending' | 'streaming' | 'completed';
}

export interface StoryQuestion {
  id: string;
  question: string;
  hint?: string;
  options: string[];
}

export interface UserAnswer {
  question: string;
  answer: string;
}

export interface LifeBlocksData {
  id: number;
  fork_point_id: number;
  overview: string | null;
  status: 'generating' | 'completed' | 'failed';
  content_type: string;
  created_at: string;
  blocks: StoryScene[];
}
