import { useEffect, useState } from 'react'
import './App.css'

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
}

type ActivityItem = {
  title: string
  detail: string
  time: string
}

const initialProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Moonlit Vanguard',
    description: 'A rogue squad of celestial guardians protects a city suspended above the storm roof.',
    status: 'In Progress',
    genre: 'Sci-Fi',
  },
  {
    id: 'proj-2',
    name: 'Skybound Archive',
    description: 'A fallen archivist recovers memories hidden inside floating ruins.',
    status: 'Storyboarding',
    genre: 'Fantasy',
  },
]

const initialStories: Story[] = [
  {
    id: 'story-1',
    title: 'Moonlit Vanguard',
    prompt: 'A young pilot learns to control a celestial mech to save a city drifting above the clouds.',
    genre: 'Sci-Fi',
    art_style: 'Cinematic 3D Anime',
    episode_duration: 24,
    character_count: 5,
    outline: [
      { title: 'Act I', description: 'The city begins to lose gravity and the pilot is recruited for a risky rescue.' },
      { title: 'Act II', description: 'A hidden rebellion reveals the mechanical heart power source of the city.' },
      { title: 'Act III', description: 'The pilot sacrifices their freedom to protect the city and its citizens.' },
    ],
  },
]

const initialCharacters: Character[] = [
  {
    id: 'char-1',
    name: 'Ari Sol',
    role: 'Hero',
    personality: 'Driven and stubborn',
    appearance: 'Silver hair, cyan visor, layered combat coat',
    powers: 'Stellar pulse dash',
  },
]

const defaultDashboard = {
  totalProjects: initialProjects.length,
  totalCharacters: initialCharacters.length,
  totalScenes: 18,
  completedRenders: 7,
  activity: [
    { title: 'Storyboard approved', detail: 'Episode 02 used the cinematic dev preview.', time: '2h ago' },
    { title: 'New character unlocked', detail: 'Ari Sol was added to the prototype cast.', time: '5h ago' },
    { title: 'Render queued', detail: 'Final shot package is waiting on GPU approval.', time: '1d ago' },
  ] as ActivityItem[],
}

function App() {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [stories, setStories] = useState<Story[]>(initialStories)
  const [characters, setCharacters] = useState<Character[]>(initialCharacters)
  const [dashboard, setDashboard] = useState(defaultDashboard)

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
    fetch('http://127.0.0.1:8000/api/dashboard')
      .then((response) => response.json())
      .then((data) => {
        if (data && typeof data.totalProjects === 'number') {
          setDashboard({
            totalProjects: data.totalProjects,
            totalCharacters: data.totalCharacters,
            totalScenes: data.totalScenes,
            completedRenders: data.completedRenders,
            activity: data.activity ?? defaultDashboard.activity,
          })
        }
      })
      .catch(() => {
        // Demo mode defaults remain active when the backend is not running.
      })
  }, [])

  const handleCreateProject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!projectName.trim()) return

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: projectName.trim(),
      description: projectDescription.trim() || 'New production concept awaiting story development.',
      status: projectStatus,
      genre: projectGenre,
    }

    setProjects((current) => [newProject, ...current])
    setDashboard((current) => ({
      ...current,
      totalProjects: current.totalProjects + 1,
    }))
    setProjectName('')
    setProjectDescription('')
    setProjectStatus('Concept')
    setProjectGenre('Fantasy')
  }

  const handleGenerateStory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!prompt.trim()) return

    const generatedStory: Story = {
      id: `story-${Date.now()}`,
      title: prompt.trim().split(' ').slice(0, 5).join(' ').replace(/\s+/g, ' ').trim() || 'New Story',
      prompt: prompt.trim(),
      genre,
      art_style: artStyle,
      episode_duration: episodeDuration,
      character_count: characterCount,
      outline: [
        { title: 'Opening Hook', description: `The story opens with a cinematic reveal in a ${genre.toLowerCase()} world where the central conflict quickly escalates.` },
        { title: 'Character Arc', description: `${characterCount} core characters navigate identity, loyalty, and sacrifice while the ${artStyle.toLowerCase()} direction remains consistent.` },
        { title: 'Crescendo', description: `A ${episodeDuration}-minute finale explodes into a high-stakes climax that resolves the emotional and visual threads.` },
      ],
    }

    setStories((current) => [generatedStory, ...current])
    setPrompt('')
  }

  const handleCreateCharacter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!characterName.trim()) return

    const newCharacter: Character = {
      id: `char-${Date.now()}`,
      name: characterName.trim(),
      role: characterRole,
      personality: characterPersonality,
      appearance: characterAppearance || 'Anime-inspired silhouette with cinematic lighting',
      powers: characterPowers || 'Signature ability pending development',
    }

    setCharacters((current) => [newCharacter, ...current])
    setDashboard((current) => ({
      ...current,
      totalCharacters: current.totalCharacters + 1,
    }))
    setCharacterName('')
    setCharacterRole('Hero')
    setCharacterPersonality('Driven')
    setCharacterAppearance('')
    setCharacterPowers('')
  }

  const handleDeleteProject = (projectId: string) => {
    setProjects((current) => current.filter((project) => project.id !== projectId))
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
              <strong>{dashboard.totalProjects}</strong>
            </div>
            <div className="stat-card">
              <span>Total characters</span>
              <strong>{dashboard.totalCharacters}</strong>
            </div>
            <div className="stat-card">
              <span>Total scenes</span>
              <strong>{dashboard.totalScenes}</strong>
            </div>
            <div className="stat-card">
              <span>Completed renders</span>
              <strong>{dashboard.completedRenders}</strong>
            </div>
          </div>
        </section>

        <div className="content-columns">
          <section className="panel">
            <div className="section-header">
              <h3>Recent projects</h3>
              <span>Demo backlog</span>
            </div>
            <div className="project-list">
              {projects.map((project) => (
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
                    <button type="button" onClick={() => handleDeleteProject(project.id)}>
                      Delete
                    </button>
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
              <span>Prototype</span>
            </div>

            <form className="stack-form" onSubmit={handleCreateProject}>
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

            <form className="stack-form" onSubmit={handleGenerateStory}>
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

            <form className="stack-form" onSubmit={handleCreateCharacter}>
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
              {characters.map((character) => (
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
              <strong>Demo memory mode</strong>
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
