import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AnimationStep,
  AuxiliaryStep,
  CharactersStep,
  FinalVideoStep,
  SceneGenerationStep,
  StoryStep,
  StoryboardStep,
} from './components/WorkflowSteps'
import { StudioFrame } from './components/StudioFrame'
import './App.css'
import type {
  Character,
  CharacterPayload,
  GenerationJob,
  Project,
  Scene,
  Shot,
  ShotPayload,
  Story,
  WorkflowStepId,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const CACHE_KEY = 'animeforge-studio-cache-v1'
const WORKFLOW_KEY = 'animeforge-workflow-v1'
const STEPS: WorkflowStepId[] = ['story', 'characters', 'storyboard', 'scenes', 'animation', 'final-video']
const STEP_LABELS: Record<WorkflowStepId, string> = {
  story: 'Story',
  characters: 'Characters',
  storyboard: 'Storyboard',
  scenes: '3D Scenes',
  animation: 'Animation',
  'final-video': 'Final Video',
}

type StudioCache = {
  projects: Project[]
  stories: Story[]
  characters: Character[]
}

type WorkflowPreferences = {
  selectedProjectId: string
  stepsByProject: Record<string, WorkflowStepId>
  approvedStoryByProject: Record<string, string>
  generationJobByProject: Record<string, string>
}

const EMPTY_CACHE: StudioCache = { projects: [], stories: [], characters: [] }
const EMPTY_PREFERENCES: WorkflowPreferences = {
  selectedProjectId: '',
  stepsByProject: {},
  approvedStoryByProject: {},
  generationJobByProject: {},
}

const EMPTY_CHARACTER: CharacterPayload = {
  name: '',
  role: 'Hero',
  appearance: '',
  personality: '',
  powers: '',
  description: '',
  weapon: '',
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback
  } catch {
    return fallback
  }
}

const initialCache = readStorage(CACHE_KEY, EMPTY_CACHE)
const initialPreferences = readStorage(WORKFLOW_KEY, EMPTY_PREFERENCES)

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body: { detail?: string; message?: string } = await response.json()
      detail = body.detail ?? body.message ?? detail
    } catch {
      // Keep the HTTP status as the actionable error when the response is not JSON.
    }
    throw new Error(detail)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(initialCache.projects)
  const [selectedProjectId, setSelectedProjectId] = useState(initialPreferences.selectedProjectId)
  const [currentStep, setCurrentStep] = useState<WorkflowStepId>(
    initialPreferences.stepsByProject[initialPreferences.selectedProjectId] ?? 'story',
  )
  const [view, setView] = useState<'workflow' | 'account' | 'settings'>('workflow')
  const [stories, setStories] = useState<Story[]>(initialCache.stories)
  const [characters, setCharacters] = useState<Character[]>(initialCache.characters)
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  const [storyTitle, setStoryTitle] = useState('')
  const [storyPrompt, setStoryPrompt] = useState('')
  const [genre, setGenre] = useState('Fantasy')
  const [tone, setTone] = useState('Dramatic')
  const [artStyle, setArtStyle] = useState('Cinematic 3D Anime')
  const [episodeDuration, setEpisodeDuration] = useState(24)
  const [characterCount, setCharacterCount] = useState(3)
  const [storySaved, setStorySaved] = useState(true)
  const [storyGenerating, setStoryGenerating] = useState(false)
  const [storySaving, setStorySaving] = useState(false)
  const [characterDraft, setCharacterDraft] = useState<CharacterPayload>(EMPTY_CHARACTER)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [characterSaving, setCharacterSaving] = useState(false)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState('')
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [generationJob, setGenerationJob] = useState<GenerationJob | null>(null)
  const [generationSubmitting, setGenerationSubmitting] = useState(false)
  const [openingScene, setOpeningScene] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState('')
  const [preferences, setPreferences] = useState(initialPreferences)

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const projectCharacters = characters.filter((character) => character.project_id === selectedProjectId)
  const isApproved = Boolean(
    selectedProjectId && activeStory && preferences.approvedStoryByProject[selectedProjectId] === activeStory.id,
  )

  useEffect(() => {
    localStorage.setItem(CACHE_KEY, jsonBody({ projects, stories, characters }))
  }, [projects, stories, characters])

  useEffect(() => {
    localStorage.setItem(WORKFLOW_KEY, jsonBody(preferences))
  }, [preferences])

  useEffect(() => {
    let disposed = false
    requestJson<Project[]>('/api/projects')
      .then((result) => {
        if (disposed) return
        setProjects(result)
        const preferredId = initialPreferences.selectedProjectId
        const nextId = result.some((project) => project.id === preferredId)
          ? preferredId
          : result[0]?.id ?? ''
        setSelectedProjectId(nextId)
        setPreferences((current) => ({ ...current, selectedProjectId: nextId }))
        setCurrentStep(initialPreferences.stepsByProject[nextId] ?? 'story')
      })
      .catch((error: unknown) => {
        if (disposed) return
        setPageError(`Could not load projects from the backend: ${getErrorMessage(error)}`)
      })
      .finally(() => {
        if (!disposed) setProjectsLoading(false)
      })
    return () => { disposed = true }
  }, [])

  useEffect(() => {
    if (!selectedProjectId) {
      setStories([])
      setCharacters([])
      setScenes([])
      setActiveStory(null)
      setGenerationJob(null)
      setStoryTitle('')
      setStoryPrompt('')
      setGenre('Fantasy')
      setArtStyle('Cinematic 3D Anime')
      setEpisodeDuration(24)
      setCharacterCount(3)
      setStorySaved(true)
      setSelectedCharacterId(null)
      setCharacterDraft(EMPTY_CHARACTER)
      setSelectedSceneId('')
      setGenerationPrompt('')
      setWorkspaceLoading(false)
      return
    }

    let disposed = false
    setWorkspaceLoading(true)
    setPageError('')
    setStories([])
    setCharacters([])
    setScenes([])
    setActiveStory(null)
    setGenerationJob(null)

    const queryProject = `?project_id=${encodeURIComponent(selectedProjectId)}`
    Promise.all([
      requestJson<Story[]>(`/api/stories${queryProject}`),
      requestJson<Character[]>(`/api/characters${queryProject}`),
      requestJson<Scene[]>(`/api/projects/${encodeURIComponent(selectedProjectId)}/scenes`),
    ])
      .then(([loadedStories, loadedCharacters, loadedScenes]) => {
        if (disposed) return
        setStories(loadedStories)
        setCharacters(loadedCharacters)
        setScenes(loadedScenes)
        const selectedStory = loadedStories[0] ?? null
        setActiveStory(selectedStory)
        setStoryTitle(selectedStory?.title ?? '')
        setStoryPrompt(selectedStory?.prompt ?? '')
        setGenre(selectedStory?.genre ?? 'Fantasy')
        setArtStyle(selectedStory?.art_style ?? 'Cinematic 3D Anime')
        setEpisodeDuration(selectedStory?.episode_duration ?? 24)
        setCharacterCount(selectedStory?.character_count ?? 3)
        setStorySaved(true)
        setSelectedCharacterId(null)
        setCharacterDraft(EMPTY_CHARACTER)
        setSelectedSceneId(loadedScenes[0]?.id ?? '')
      })
      .catch((error: unknown) => {
        if (!disposed) setPageError(`Could not load this project's production data: ${getErrorMessage(error)}`)
      })
      .finally(() => {
        if (!disposed) setWorkspaceLoading(false)
      })

    const jobId = preferences.generationJobByProject[selectedProjectId]
    if (jobId) {
      requestJson<GenerationJob>(`/api/generation-jobs/${encodeURIComponent(jobId)}`)
        .then((job) => {
          if (!disposed) setGenerationJob(job)
        })
        .catch((error: unknown) => {
          if (!disposed) setPageError(`Could not retrieve the saved scene-generation job: ${getErrorMessage(error)}`)
        })
    }

    return () => { disposed = true }
  }, [selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId || !generationJob || generationJob.project_id !== selectedProjectId) return
    if (generationJob.status !== 'queued' && generationJob.status !== 'running') return

    let disposed = false
    const timer = window.setTimeout(() => {
      requestJson<GenerationJob>(`/api/generation-jobs/${encodeURIComponent(generationJob.id)}`)
        .then((job) => {
          if (!disposed) setGenerationJob(job)
        })
        .catch((error: unknown) => {
          if (!disposed) setPageError(`Could not refresh scene-generation status: ${getErrorMessage(error)}`)
        })
    }, 1400)
    return () => {
      disposed = true
      window.clearTimeout(timer)
    }
  }, [selectedProjectId, generationJob])

  useEffect(() => {
    if (!selectedProjectId) return
    setPreferences((current) => ({
      ...current,
      selectedProjectId,
      stepsByProject: { ...current.stepsByProject, [selectedProjectId]: currentStep },
    }))
  }, [selectedProjectId, currentStep])

  const setError = useCallback((message: string) => {
    setNotice('')
    setPageError(message)
  }, [])

  const updateStory = useCallback((updatedStory: Story) => {
    setActiveStory(updatedStory)
    setStoryTitle(updatedStory.title)
    setStoryPrompt(updatedStory.prompt)
    setStorySaved(false)
    if (selectedProjectId) {
      setPreferences((current) => {
        const approved = { ...current.approvedStoryByProject }
        delete approved[selectedProjectId]
        return { ...current, approvedStoryByProject: approved }
      })
    }
  }, [selectedProjectId])

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId)
    setCurrentStep(preferences.stepsByProject[projectId] ?? 'story')
    setView('workflow')
    setPageError('')
  }

  const handleCreateProject = async (payload: Pick<Project, 'name' | 'description' | 'status' | 'genre'>) => {
    setPageError('')
    try {
      const project = await requestJson<Project>('/api/projects', {
        method: 'POST',
        body: jsonBody(payload),
      })
      setProjects((current) => [project, ...current])
      setSelectedProjectId(project.id)
      setCurrentStep('story')
      setView('workflow')
      setNotice(`Project "${project.name}" created.`)
      return true
    } catch (error) {
      setError(`Could not create project: ${getErrorMessage(error)}`)
      return false
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    setPageError('')
    try {
      await requestJson<void>(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' })
      const remaining = projects.filter((project) => project.id !== projectId)
      setProjects(remaining)
      if (projectId === selectedProjectId) {
        const nextId = remaining[0]?.id ?? ''
        setSelectedProjectId(nextId)
        setCurrentStep('story')
      }
      setNotice('Project deleted.')
    } catch (error) {
      setError(`Could not delete project: ${getErrorMessage(error)}`)
    }
  }

  const handleGenerateStory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProjectId) return
    setStoryGenerating(true)
    setPageError('')
    setNotice('')
    try {
      const story = await requestJson<Story>('/api/stories/generate', {
        method: 'POST',
        body: jsonBody({
          title: storyTitle.trim(),
          prompt: storyPrompt.trim(),
          genre,
          tone,
          art_style: artStyle,
          episode_duration: episodeDuration,
          character_count: characterCount,
          project_id: selectedProjectId,
        }),
      })
      setStories((current) => [story, ...current.filter((item) => item.id !== story.id)])
      setActiveStory(story)
      setStoryTitle(story.title)
      setStoryPrompt(story.prompt)
      setStorySaved(true)
      setPreferences((current) => {
        const approved = { ...current.approvedStoryByProject }
        delete approved[selectedProjectId]
        return { ...current, approvedStoryByProject: approved }
      })
      setNotice('Story outline generated and saved to this project.')
    } catch (error) {
      setError(`Story generation failed: ${getErrorMessage(error)}`)
    } finally {
      setStoryGenerating(false)
    }
  }

  const handleSaveStory = async () => {
    if (!activeStory) return
    setStorySaving(true)
    setPageError('')
    try {
      const saved = await requestJson<Story>(`/api/stories/${encodeURIComponent(activeStory.id)}`, {
        method: 'PUT',
        body: jsonBody({
          title: activeStory.title,
          prompt: activeStory.prompt,
          genre: activeStory.genre,
          art_style: activeStory.art_style,
          episode_duration: activeStory.episode_duration,
          character_count: activeStory.character_count,
          outline: activeStory.outline,
        }),
      })
      setActiveStory(saved)
      setStories((current) => current.map((story) => story.id === saved.id ? saved : story))
      setStorySaved(true)
      setNotice('Story edits saved.')
    } catch (error) {
      setError(`Could not save story edits: ${getErrorMessage(error)}`)
    } finally {
      setStorySaving(false)
    }
  }

  const handleApproveStory = () => {
    if (!activeStory || !selectedProjectId || !storySaved) return
    setPreferences((current) => ({
      ...current,
      approvedStoryByProject: {
        ...current.approvedStoryByProject,
        [selectedProjectId]: activeStory.id,
      },
    }))
    setNotice('Story approved for this browser workflow.')
  }

  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacterId(character.id)
    setCharacterDraft({
      name: character.name,
      role: character.role,
      appearance: character.appearance,
      personality: character.personality,
      powers: character.powers,
      description: character.description,
      weapon: character.weapon,
      project_id: selectedProjectId,
    })
  }

  const handleNewCharacter = () => {
    setSelectedCharacterId(null)
    setCharacterDraft({ ...EMPTY_CHARACTER, project_id: selectedProjectId })
  }

  const handleSaveCharacter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProjectId) return
    setCharacterSaving(true)
    setPageError('')
    try {
      const payload = { ...characterDraft, project_id: selectedProjectId }
      const character = await requestJson<Character>(
        selectedCharacterId
          ? `/api/characters/${encodeURIComponent(selectedCharacterId)}`
          : '/api/characters',
        {
          method: selectedCharacterId ? 'PUT' : 'POST',
          body: jsonBody(payload),
        },
      )
      setCharacters((current) => selectedCharacterId
        ? current.map((item) => item.id === character.id ? character : item)
        : [...current, character])
      setSelectedCharacterId(character.id)
      setNotice(selectedCharacterId ? 'Character profile updated.' : 'Character profile created.')
    } catch (error) {
      setError(`Could not save character profile: ${getErrorMessage(error)}`)
    } finally {
      setCharacterSaving(false)
    }
  }

  const handleCreateScene = async (name: string, description: string) => {
    if (!selectedProjectId) return false
    try {
      const scene = await requestJson<Scene>(`/api/projects/${encodeURIComponent(selectedProjectId)}/scenes`, {
        method: 'POST',
        body: jsonBody({ name, description }),
      })
      setScenes((current) => [...current, scene])
      setSelectedSceneId(scene.id)
      setNotice('Storyboard scene added.')
      return true
    } catch (error) {
      setError(`Could not add scene: ${getErrorMessage(error)}`)
      return false
    }
  }

  const handleUpdateScene = async (sceneId: string, name: string, description: string) => {
    try {
      const updated = await requestJson<Scene>(`/api/scenes/${encodeURIComponent(sceneId)}`, {
        method: 'PUT',
        body: jsonBody({ name, description }),
      })
      setScenes((current) => current.map((scene) => scene.id === updated.id ? updated : scene))
      setNotice('Scene details saved.')
    } catch (error) {
      setError(`Could not save scene details: ${getErrorMessage(error)}`)
    }
  }

  const handleDeleteScene = async (sceneId: string) => {
    try {
      await requestJson<void>(`/api/scenes/${encodeURIComponent(sceneId)}`, { method: 'DELETE' })
      const remaining = scenes.filter((scene) => scene.id !== sceneId)
      setScenes(remaining)
      setSelectedSceneId(remaining[0]?.id ?? '')
      setNotice('Scene removed from the storyboard.')
    } catch (error) {
      setError(`Could not delete scene: ${getErrorMessage(error)}`)
    }
  }

  const handleCreateShot = async (sceneId: string, payload: ShotPayload) => {
    try {
      const shot = await requestJson<Shot>(`/api/scenes/${encodeURIComponent(sceneId)}/shots`, {
        method: 'POST',
        body: jsonBody(payload),
      })
      setScenes((current) => current.map((scene) => scene.id === shot.scene_id
        ? { ...scene, shots: [...scene.shots, shot].sort((a, b) => a.ordering - b.ordering) }
        : scene))
      setNotice('Shot added to the storyboard.')
      return true
    } catch (error) {
      setError(`Could not add shot: ${getErrorMessage(error)}`)
      return false
    }
  }

  const handleUpdateShot = async (shotId: string, payload: ShotPayload) => {
    try {
      const shot = await requestJson<Shot>(`/api/shots/${encodeURIComponent(shotId)}`, {
        method: 'PUT',
        body: jsonBody(payload),
      })
      setScenes((current) => current.map((scene) => scene.id === shot.scene_id
        ? { ...scene, shots: scene.shots.map((item) => item.id === shot.id ? shot : item).sort((a, b) => a.ordering - b.ordering) }
        : scene))
      setNotice('Shot changes saved.')
      return true
    } catch (error) {
      setError(`Could not save shot changes: ${getErrorMessage(error)}`)
      return false
    }
  }

  const handleDeleteShot = async (shotId: string) => {
    const sceneId = scenes.find((scene) => scene.shots.some((shot) => shot.id === shotId))?.id
    try {
      await requestJson<{ message: string; id: string }>(`/api/shots/${encodeURIComponent(shotId)}`, { method: 'DELETE' })
      if (sceneId) {
        setScenes((current) => current.map((scene) => scene.id === sceneId
          ? { ...scene, shots: scene.shots.filter((shot) => shot.id !== shotId) }
          : scene))
      }
      setNotice('Shot removed from the sequence.')
    } catch (error) {
      setError(`Could not remove shot: ${getErrorMessage(error)}`)
    }
  }

  const handleGenerateScene = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProjectId || !selectedSceneId) return
    const selectedScene = scenes.find((scene) => scene.id === selectedSceneId)
    setGenerationSubmitting(true)
    setPageError('')
    setNotice('')
    try {
      const prompt = `${generationPrompt.trim()}\nStoryboard scene: ${selectedScene?.name ?? ''}`.trim()
      const job = await requestJson<GenerationJob>(
        `/api/projects/${encodeURIComponent(selectedProjectId)}/generation-jobs`,
        { method: 'POST', body: jsonBody({ prompt }) },
      )
      setGenerationJob(job)
      setPreferences((current) => ({
        ...current,
        generationJobByProject: {
          ...current.generationJobByProject,
          [selectedProjectId]: job.id,
        },
      }))
      setNotice('Scene-generation job submitted.')
    } catch (error) {
      setError(`Could not submit Godot scene-generation job: ${getErrorMessage(error)}`)
    } finally {
      setGenerationSubmitting(false)
    }
  }

  const handleOpenScene = async () => {
    if (!generationJob) return
    setOpeningScene(true)
    setPageError('')
    try {
      await requestJson<{ message: string }>(`/api/generation-jobs/${encodeURIComponent(generationJob.id)}/open`, {
        method: 'POST',
      })
      setNotice('The generated scene was sent to Godot.')
    } catch (error) {
      setError(`Could not open the generated scene: ${getErrorMessage(error)}`)
    } finally {
      setOpeningScene(false)
    }
  }

  const stepComplete = useMemo(() => ({
    story: Boolean(activeStory && storySaved && isApproved),
    characters: projectCharacters.length > 0,
    storyboard: scenes.length > 0 && scenes.some((scene) => scene.shots.length > 0),
    scenes: generationJob?.project_id === selectedProjectId && generationJob.status === 'completed',
    animation: true,
    'final-video': true,
  }), [activeStory, storySaved, isApproved, projectCharacters.length, scenes, generationJob, selectedProjectId])

  const stepIndex = STEPS.indexOf(currentStep)
  const canContinue = stepComplete[currentStep]
  const canNavigateTo = (target: WorkflowStepId) => {
    const targetIndex = STEPS.indexOf(target)
    if (targetIndex <= stepIndex) return true
    return STEPS.slice(0, targetIndex).every((step) => stepComplete[step])
  }

  const handleContinue = () => {
    if (!canContinue || stepIndex >= STEPS.length - 1) return
    setCurrentStep(STEPS[stepIndex + 1])
    setPageError('')
  }

  const handleStepSelect = (step: WorkflowStepId) => {
    if (!canNavigateTo(step)) return
    setCurrentStep(step)
    setView('workflow')
    setPageError('')
  }

  const stepProps = {
    projects,
    selectedProject,
    selectedProjectId,
    currentStep,
    onProjectSelect: handleProjectSelect,
    onProjectCreate: handleCreateProject,
    onProjectDelete: handleDeleteProject,
    canNavigateToStep: canNavigateTo,
    onStepSelect: handleStepSelect,
    canContinue,
    nextLabel: stepIndex < STEPS.length - 1 ? `Continue to ${STEP_LABELS[STEPS[stepIndex + 1]]}` : 'Continue',
    onContinue: handleContinue,
    onBack: () => setCurrentStep(STEPS[Math.max(stepIndex - 1, 0)]),
    view,
    onViewSelect: setView,
  }

  return (
    <StudioFrame {...stepProps}>
      <div className="studio-main-content">
        <div className="workspace-topline">
          <div className="workspace-project">
            <span className="project-signal" />
            <span>{STEP_LABELS[currentStep]} / {STEP_LABELS[currentStep] === '3D Scenes' ? 'ENVIRONMENT' : 'DEVELOPMENT'}</span>
          </div>
          <span className="workspace-context">{view === 'workflow' ? 'PRODUCTION WORKSPACE' : 'STUDIO PREFERENCES'}</span>
        </div>

        {(pageError || notice) && (
          <div className={`feedback-banner ${pageError ? 'is-error' : 'is-success'}`} role={pageError ? 'alert' : 'status'}>
            <span>{pageError || notice}</span>
            <button type="button" className="feedback-dismiss" onClick={() => { setPageError(''); setNotice('') }} aria-label="Dismiss message">x</button>
          </div>
        )}

        {projectsLoading || workspaceLoading ? (
          <div className="loading-workspace">
            <span className="loading-mark" />
            <p>{projectsLoading ? 'Loading projects from the backend...' : 'Loading project production data...'}</p>
          </div>
        ) : (
          <>
            <div className="workflow-step-content" hidden={view !== 'workflow'} key={selectedProjectId}>
              <div hidden={currentStep !== 'story'}>
                <StoryStep
                  project={selectedProject}
                  story={activeStory}
                  title={storyTitle}
                  prompt={storyPrompt}
                  genre={genre}
                  tone={tone}
                  artStyle={artStyle}
                  episodeDuration={episodeDuration}
                  characterCount={characterCount}
                  generating={storyGenerating}
                  saving={storySaving}
                  storyIsSaved={storySaved}
                  isApproved={isApproved}
                  onTitleChange={(value) => {
                    setStoryTitle(value)
                    if (activeStory) updateStory({ ...activeStory, title: value })
                  }}
                  onPromptChange={(value) => {
                    setStoryPrompt(value)
                    if (activeStory) updateStory({ ...activeStory, prompt: value })
                  }}
                  onGenreChange={(value) => {
                    setGenre(value)
                    if (activeStory) updateStory({ ...activeStory, genre: value })
                  }}
                  onToneChange={setTone}
                  onArtStyleChange={(value) => {
                    setArtStyle(value)
                    if (activeStory) updateStory({ ...activeStory, art_style: value })
                  }}
                  onEpisodeDurationChange={(value) => {
                    setEpisodeDuration(value)
                    if (activeStory) updateStory({ ...activeStory, episode_duration: value })
                  }}
                  onCharacterCountChange={(value) => {
                    setCharacterCount(value)
                    if (activeStory) updateStory({ ...activeStory, character_count: value })
                  }}
                  onGenerate={handleGenerateStory}
                  onStoryChange={updateStory}
                  onSave={handleSaveStory}
                  onApprove={handleApproveStory}
                />
              </div>
              <div hidden={currentStep !== 'characters'}>
                <CharactersStep
                  characters={projectCharacters}
                  draft={characterDraft}
                  selectedCharacterId={selectedCharacterId}
                  saving={characterSaving}
                  onDraftChange={setCharacterDraft}
                  onSelect={handleCharacterSelect}
                  onNew={handleNewCharacter}
                  onSave={handleSaveCharacter}
                />
              </div>
              <div hidden={currentStep !== 'storyboard'}>
                <StoryboardStep
                  scenes={scenes}
                  selectedSceneId={selectedSceneId}
                  onSelectScene={setSelectedSceneId}
                  onCreateScene={handleCreateScene}
                  onUpdateScene={handleUpdateScene}
                  onDeleteScene={handleDeleteScene}
                  onCreateShot={handleCreateShot}
                  onUpdateShot={handleUpdateShot}
                  onDeleteShot={handleDeleteShot}
                />
              </div>
              <div hidden={currentStep !== 'scenes'}>
                <SceneGenerationStep
                  scenes={scenes}
                  selectedSceneId={selectedSceneId}
                  prompt={generationPrompt}
                  job={generationJob}
                  generating={generationSubmitting}
                  opening={openingScene}
                  onSceneSelect={setSelectedSceneId}
                  onPromptChange={setGenerationPrompt}
                  onGenerate={handleGenerateScene}
                  onOpenScene={handleOpenScene}
                  apiBase={API_BASE}
                />
              </div>
              <div hidden={currentStep !== 'animation'}>
                <AnimationStep scenes={scenes} characters={projectCharacters} />
              </div>
              <div hidden={currentStep !== 'final-video'}>
                <FinalVideoStep project={selectedProject} story={activeStory} characters={projectCharacters} scenes={scenes} />
              </div>
            </div>
            {view !== 'workflow' && <AuxiliaryStep view={view} />}
          </>
        )}
      </div>
    </StudioFrame>
  )
}
