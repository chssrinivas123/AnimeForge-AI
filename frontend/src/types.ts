export type WorkflowStepId =
  | 'story'
  | 'characters'
  | 'storyboard'
  | 'scenes'
  | 'animation'
  | 'final-video'

export type Project = {
  id: string
  name: string
  description: string
  status: string
  genre: string
}

export type StoryOutlineItem = {
  title: string
  description: string
}

export type Story = {
  id: string
  project_id?: string | null
  title: string
  prompt: string
  genre: string
  art_style: string
  episode_duration: number
  character_count: number
  outline: StoryOutlineItem[]
}

export type Character = {
  id: string
  project_id?: string | null
  name: string
  role: string
  personality: string
  appearance: string
  description: string
  powers: string
  weapon: string
  reference_image?: string
}

export type Shot = {
  id: string
  scene_id: string
  title: string
  description: string
  camera_angle: string
  camera_movement: string
  duration: number
  character_involvement: string
  visual_effects: string
  ordering: number
}

export type Scene = {
  id: string
  project_id: string
  name: string
  description: string
  shots: Shot[]
}

export type GenerationJob = {
  id: string
  project_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  scene_url?: string
  error?: string
}

export type CharacterPayload = Omit<Character, 'id' | 'reference_image'>

export type ShotPayload = Omit<Shot, 'id' | 'scene_id'>

export const WORKFLOW_STEPS: { id: WorkflowStepId; label: string; caption: string }[] = [
  { id: 'story', label: 'Story', caption: '01' },
  { id: 'characters', label: 'Characters', caption: '02' },
  { id: 'storyboard', label: 'Storyboard', caption: '03' },
  { id: 'scenes', label: '3D Scenes', caption: '04' },
  { id: 'animation', label: 'Animation', caption: '05' },
  { id: 'final-video', label: 'Final Video', caption: '06' },
]
