import { type FormEvent, useEffect, useState } from 'react'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000'
const STORAGE_KEY = 'animeforge-ui'

type Project = {
  id: string
  name: string
  description: string
  status: string
  genre: string
}

type Story = {
  id: string
  title: string
  prompt: string
  genre: string
  art_style: string
  episode_duration: number
  character_count: number
  outline: { title: string; description: string }[]
}

type Character = {
  id: string
  name: string
  role: string
  personality: string
  appearance: string
  powers: string
  reference_image?: string
}

type ActivityItem = {
  title: string
  detail: string
  time: string
}

type DashboardData = {
  totalProjects: number
  totalCharacters: number
  totalScenes: number
  completedRenders: number
  activity: ActivityItem[]
}

const initialDashboard: DashboardData = {
  totalProjects: 0,
  totalCharacters: 0,
  totalScenes: 0,
  completedRenders: 0,
  activity: [
    { title: 'Storyboard approved', detail: 'Episode 02 used the cinematic dev preview.', time: '2h ago' },
    { title: 'New character unlocked', detail: 'Ari Sol was added to the prototype cast.', time: '5h ago' },
    { title: 'Render queued', detail: 'Final shot package is waiting on GPU approval.', time: '1d ago' },
  ],
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [dashboard, setDashboard] = useState<DashboardData>(initialDashboard)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectStatus, setProjectStatus] = useState('Concept')
  const [projectGenre, setProjectGenre] = useState('Fantasy')

  const [prompt, setPrompt] = useState('A young guardian must restore a shattered moon to save an island kingdom from a cursed eclipse.')
  const [genre, setGenre] = useState('Fantasy')
  const [artStyle, setArtStyle] = useState('Cinematic 3D Anime')
  const [episodeDuration, setEpisodeDuration] = useState(24)
  const [characterCount, setCharacterCount] = useState(4)

  const [characterName, setCharacterName] = useState('')
  const [characterRole, setCharacterRole] = useState('Hero')
  const [characterPersonality, setCharacterPersonality] = useState('Driven')
  const [characterAppearance, setCharacterAppearance] = useState('')
  const [characterPowers, setCharacterPowers] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          projects?: Project[]
          characters?: Character[]
          stories?: Story[]
        }
        if (parsed.projects) setProjects(parsed.projects)
        if (parsed.characters) setCharacters(parsed.characters)
        if (parsed.stories) setStories(parsed.stories)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, characters, stories }))
  }, [projects, characters, stories])

  const loadDashboard = async () => {
    try {
      const [dashboardResponse, projectsResponse, charactersResponse, storiesResponse] = await Promise.all([
        fetch(`${API_BASE}/api/dashboard`),
        fetch(`${API_BASE}/api/projects`),
        fetch(`${API_BASE}/api/characters`),
        fetch(`${API_BASE}/api/stories`),
      ])

      if (!dashboardResponse.ok || !projectsResponse.ok || !charactersResponse.ok || !storiesResponse.ok) {
        throw new Error('Backend API unavailable')
      }

      const dashboardData = await dashboardResponse.json()
      const projectData = await projectsResponse.json()
      const characterData = await charactersResponse.json()
      const storyData = await storiesResponse.json()

      setDashboard({
        totalProjects: dashboardData.totalProjects ?? projectData.length,
        totalCharacters: dashboardData.totalCharacters ?? characterData.length,
        totalScenes: dashboardData.totalScenes ?? 0,
        completedRenders: dashboardData.completedRenders ?? 0,
        activity: dashboardData.activity ?? initialDashboard.activity,
      })
      setProjects(projectData)
      setCharacters(characterData)
      setStories(storyData)
      setErrorMessage(null)
    } catch {
      setDashboard((current) => ({ ...current, totalProjects: current.totalProjects || projects.length || 1 }))
      setErrorMessage('Backend is unavailable; showing locally persisted data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!projectName.trim()) return

    const payload = {
      name: projectName.trim(),
      description: projectDescription.trim() || 'New production concept awaiting story development.',
      status: projectStatus,
      genre: projectGenre,
    }

    try {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Project creation failed')
      }

      const createdProject = await response.json()
      setProjects((current) => [createdProject, ...current])
      setDashboard((current) => ({ ...current, totalProjects: current.totalProjects + 1 }))
      setStatusMessage('Project saved to backend.')
      setProjectName('')
      setProjectDescription('')
      setProjectStatus('Concept')
      setProjectGenre('Fantasy')
    } catch {
      const fallback: Project = {
        id: `proj-${Date.now()}`,
        name: payload.name,
        description: payload.description,
        status: payload.status,
        genre: payload.genre,
      }
      setProjects((current) => [fallback, ...current])
      setDashboard((current) => ({ ...current, totalProjects: current.totalProjects + 1 }))
      setStatusMessage('Project saved locally while the backend is offline.')
      setErrorMessage('Backend unreachable. Local persistence remains active.')
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Delete failed')
      }
      setProjects((current) => current.filter((project) => project.id !== projectId))
      setDashboard((current) => ({ ...current, totalProjects: Math.max(0, current.totalProjects - 1) }))
      setStatusMessage('Project deleted from backend.')
    } catch {
      setProjects((current) => current.filter((project) => project.id !== projectId))
      setStatusMessage('Project removed from local view.')
      setErrorMessage('Backend unreachable. Local data was updated instead.')
    }
  }

  const handleGenerateStory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!prompt.trim()) return

    const payload = {
      prompt: prompt.trim(),
      genre,
      art_style: artStyle,
      episode_duration: episodeDuration,
      character_count: characterCount,
    }

    try {
      const response = await fetch(`${API_BASE}/api/stories/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Story generation failed')
      }

      const createdStory = await response.json()
      setStories((current) => [createdStory, ...current])
      setStatusMessage('Story generated and saved to the backend.')
      setPrompt('')
    } catch {
      const fallbackStory: Story = {
        id: `story-${Date.now()}`,
        title: payload.prompt.split(' ').slice(0, 5).join(' ') || 'New Story',
        prompt: payload.prompt,
        genre: payload.genre,
        art_style: payload.art_style,
        episode_duration: payload.episode_duration,
        character_count: payload.character_count,
        outline: [
          { title: 'Opening Hook', description: `The story opens with a cinematic reveal in a ${payload.genre.toLowerCase()} world.` },
          { title: 'Character Arc', description: `${payload.character_count} characters navigate conflict and identity.` },
          { title: 'Crescendo', description: `A ${payload.episode_duration}-minute finale resolves the central arc.` },
        ],
      }
      setStories((current) => [fallbackStory, ...current])
      setStatusMessage('Story saved locally while the backend is offline.')
      setErrorMessage('Story generation fell back to local storage.')
    }
  }

  const handleCreateCharacter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!characterName.trim()) return

    const payload = {
      name: characterName.trim(),
      role: characterRole,
      personality: characterPersonality,
      appearance: characterAppearance || 'Anime-inspired silhouette with cinematic lighting',
      powers: characterPowers || 'Signature ability pending development',
      reference_image: '',
    }

    try {
      const response = await fetch(`${API_BASE}/api/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Character creation failed')
      }

      const createdCharacter = await response.json()
      setCharacters((current) => [createdCharacter, ...current])
      setDashboard((current) => ({ ...current, totalCharacters: current.totalCharacters + 1 }))
      setStatusMessage('Character saved to backend.')
      setCharacterName('')
      setCharacterRole('Hero')
      setCharacterPersonality('Driven')
      setCharacterAppearance('')
      setCharacterPowers('')
    } catch {
      const fallbackCharacter: Character = {
        id: `char-${Date.now()}`,
        name: payload.name,
        role: payload.role,
        personality: payload.personality,
        appearance: payload.appearance,
        powers: payload.powers,
        reference_image: payload.reference_image,
      }
      setCharacters((current) => [fallbackCharacter, ...current])
      setDashboard((current) => ({ ...current, totalCharacters: current.totalCharacters + 1 }))
      setStatusMessage('Character saved locally while the backend is offline.')
      setErrorMessage('Character API is unreachable; local persistence is active.')
    }
  }

  const latestStory = stories[0]

  return (
    <div className="studio-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AnimeForge AI</p>
          <h1>Production command center</h1>
        </div>
        <button type="button" className="primary-button">Create project</button>
      </header>

      {(statusMessage || errorMessage) && (
        <div className="notice-stack">
          {statusMessage && <div className="notice success">{statusMessage}</div>}
          {errorMessage && <div className="notice error">{errorMessage}</div>}
        </div>
      )}

      <main className="page-grid">
        <section className="panel hero-panel">
          <div className="hero-copy">
            <p className="eyebrow accent">Studio overview</p>
            <h2>Turn prompts into cinematic anime production workflows.</h2>
            <p>
              Draft stories, build reusable character sheets, stage shots, and track production readiness without
              relying on paid AI services.
            </p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span>Total projects</span>
              <strong>{loading ? '…' : dashboard.totalProjects}</strong>
            </div>
            <div className="stat-card">
              <span>Total characters</span>
              <strong>{loading ? '…' : dashboard.totalCharacters}</strong>
            </div>
            <div className="stat-card">
              <span>Total scenes</span>
              <strong>{loading ? '…' : dashboard.totalScenes}</strong>
            </div>
            <div className="stat-card">
              <span>Completed renders</span>
              <strong>{loading ? '…' : dashboard.completedRenders}</strong>
            </div>
          </div>
        </section>

        <div className="content-columns">
          <section className="panel">
            <div className="section-header">
              <h3>Recent projects</h3>
              <span>Live list</span>
            </div>
            <div className="project-list">
              {projects.length === 0 ? <p className="empty-state">No projects yet.</p> : projects.map((project) => (
                <article className="project-card" key={project.id}>
                  <div>
                    <div className="project-heading">
                      <h4>{project.name}</h4>
                      <span className="badge">{project.status}</span>
                    </div>
                    <p>{project.description}</p>
                  </div>

                  <div className="project-meta">
                    <span>{project.genre}</span>
                    <button type="button" onClick={() => void handleDeleteProject(project.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-header">
              <h3>Recent activity</h3>
              <span>Live</span>
            </div>
            <ul className="activity-list">
              {dashboard.activity.map((item) => (
                <li key={`${item.title}-${item.time}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <span>{item.time}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="workspace-grid">
          <section className="panel">
            <div className="section-header">
              <h3>New project</h3>
              <span>Backend sync</span>
            </div>

            <form className="stack-form" onSubmit={(event) => void handleCreateProject(event)}>
              <label>
                Project name
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Neon Ember" />
              </label>
              <label>
                Description
                <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="What kind of story or production is this?" rows={4} />
              </label>
              <div className="inline-fields">
                <label>
                  Status
                  <select value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)}>
                    <option>Concept</option>
                    <option>Storyboarding</option>
                    <option>In Progress</option>
                    <option>Ready</option>
                  </select>
                </label>
                <label>
                  Genre
                  <select value={projectGenre} onChange={(event) => setProjectGenre(event.target.value)}>
                    <option>Fantasy</option>
                    <option>Sci-Fi</option>
                    <option>Action</option>
                    <option>Romance</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="primary-button">Save project</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-header">
              <h3>Story generator</h3>
              <span>Demo generator</span>
            </div>

            <form className="stack-form" onSubmit={(event) => void handleGenerateStory(event)}>
              <label>
                Story prompt
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
              </label>
              <div className="inline-fields">
                <label>
                  Genre
                  <select value={genre} onChange={(event) => setGenre(event.target.value)}>
                    <option>Fantasy</option>
                    <option>Sci-Fi</option>
                    <option>Action</option>
                    <option>Drama</option>
                  </select>
                </label>
                <label>
                  Art style
                  <select value={artStyle} onChange={(event) => setArtStyle(event.target.value)}>
                    <option>Cinematic 3D Anime</option>
                    <option>Moody Studio Anime</option>
                    <option>Action Shonen</option>
                    <option>Lighthearted Slice of Life</option>
                  </select>
                </label>
              </div>
              <div className="inline-fields">
                <label>
                  Duration
                  <input type="number" min={6} max={60} value={episodeDuration} onChange={(event) => setEpisodeDuration(Number(event.target.value))} />
                </label>
                <label>
                  Characters
                  <input type="number" min={1} max={12} value={characterCount} onChange={(event) => setCharacterCount(Number(event.target.value))} />
                </label>
              </div>
              <button type="submit" className="primary-button">Generate story</button>
            </form>

            {latestStory ? (
              <div className="story-preview">
                <h4>{latestStory.title}</h4>
                <p>{latestStory.prompt}</p>
                <ul>
                  {latestStory.outline.map((item) => (
                    <li key={item.title}>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <div className="workspace-grid">
          <section className="panel">
            <div className="section-header">
              <h3>Character studio</h3>
              <span>Reusable cast</span>
            </div>

            <form className="stack-form" onSubmit={(event) => void handleCreateCharacter(event)}>
              <label>
                Character name
                <input value={characterName} onChange={(event) => setCharacterName(event.target.value)} placeholder="Aoi Kisaragi" />
              </label>
              <div className="inline-fields">
                <label>
                  Role
                  <select value={characterRole} onChange={(event) => setCharacterRole(event.target.value)}>
                    <option>Hero</option>
                    <option>Mentor</option>
                    <option>Villain</option>
                    <option>Supporting</option>
                  </select>
                </label>
                <label>
                  Personality
                  <input value={characterPersonality} onChange={(event) => setCharacterPersonality(event.target.value)} />
                </label>
              </div>
              <label>
                Appearance
                <input value={characterAppearance} onChange={(event) => setCharacterAppearance(event.target.value)} placeholder="Blue hair, layered coat, glowing eyes" />
              </label>
              <label>
                Powers and abilities
                <input value={characterPowers} onChange={(event) => setCharacterPowers(event.target.value)} placeholder="Starlight blade" />
              </label>
              <button type="submit" className="primary-button">Save character</button>
            </form>

            <div className="character-list">
              {characters.length === 0 ? <p className="empty-state">No characters yet.</p> : characters.map((character) => (
                <article key={character.id} className="character-card">
                  <h4>{character.name}</h4>
                  <p>{character.role}</p>
                  <span>{character.personality}</span>
                  <small>{character.appearance}</small>
                  <small>{character.powers}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-header">
              <h3>3D production studio</h3>
              <span>Blender status</span>
            </div>

            <div className="status-stack">
              <div className="status-item">
                <span>Blender</span>
                <strong>Not detected</strong>
              </div>
              <div className="status-item">
                <span>Environment pack</span>
                <strong>6 ready</strong>
              </div>
              <div className="status-item">
                <span>Render queue</span>
                <strong>3 frames pending</strong>
              </div>
              <div className="status-item">
                <span>Output format</span>
                <strong>MP4 / 1080p</strong>
              </div>
            </div>
          </section>
        </div>

        <section className="panel settings-panel">
          <div className="section-header">
            <h3>Settings</h3>
            <span>System health</span>
          </div>

          <div className="settings-grid">
            <div>
              <span>Backend</span>
              <strong>Healthy</strong>
            </div>
            <div>
              <span>Database</span>
              <strong>SQLAlchemy / MySQL</strong>
            </div>
            <div>
              <span>Theme</span>
              <strong>Dark anime studio</strong>
            </div>
            <div>
              <span>AI services</span>
              <strong>Local demo only</strong>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
