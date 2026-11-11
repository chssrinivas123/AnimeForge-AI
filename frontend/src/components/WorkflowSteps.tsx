import { type FormEvent, useEffect, useState } from 'react'
import type {
  Character,
  CharacterPayload,
  GenerationJob,
  Project,
  Scene,
  Shot,
  ShotPayload,
  Story,
  StoryOutlineItem,
} from '../types'

type StoryStepProps = {
  project: Project | null
  story: Story | null
  title: string
  prompt: string
  genre: string
  tone: string
  artStyle: string
  episodeDuration: number
  characterCount: number
  generating: boolean
  saving: boolean
  storyIsSaved: boolean
  isApproved: boolean
  onTitleChange: (value: string) => void
  onPromptChange: (value: string) => void
  onGenreChange: (value: string) => void
  onToneChange: (value: string) => void
  onArtStyleChange: (value: string) => void
  onEpisodeDurationChange: (value: number) => void
  onCharacterCountChange: (value: number) => void
  onGenerate: (event: FormEvent<HTMLFormElement>) => void
  onStoryChange: (story: Story) => void
  onSave: () => void
  onApprove: () => void
}

export function StoryStep(props: StoryStepProps) {
  const {
    project, story, title, prompt, genre, tone, artStyle, episodeDuration, characterCount,
    generating, saving, storyIsSaved, isApproved,
  } = props

  const updateOutline = (index: number, patch: Partial<StoryOutlineItem>) => {
    if (!story) return
    const outline = story.outline.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    props.onStoryChange({ ...story, outline })
  }

  return (
    <div className="step-page">
      <StepHeading
        kicker="01 / Story development"
        title="Find the heart of the episode."
        description="Shape the premise, then refine the generated outline before moving into production."
      />
      <div className="story-layout">
        <form className="studio-form story-form" onSubmit={props.onGenerate}>
          <label>
            Anime title
            <input
              required
              minLength={1}
              maxLength={180}
              value={title}
              onChange={(event) => props.onTitleChange(event.target.value)}
              placeholder="The Last Lantern"
            />
          </label>
          <label>
            Story description
            <textarea
              required
              minLength={10}
              maxLength={1500}
              rows={7}
              value={prompt}
              onChange={(event) => props.onPromptChange(event.target.value)}
              placeholder="Describe the world, the protagonist, and what they stand to lose."
            />
          </label>
          <div className="form-grid-two">
            <label>
              Genre
              <select value={genre} onChange={(event) => props.onGenreChange(event.target.value)}>
                <option>Fantasy</option>
                <option>Sci-Fi</option>
                <option>Action</option>
                <option>Drama</option>
                <option>Romance</option>
              </select>
            </label>
            <label>
              Tone
              <select value={tone} onChange={(event) => props.onToneChange(event.target.value)}>
                <option>Dramatic</option>
                <option>Hopeful</option>
                <option>Dark</option>
                <option>Lighthearted</option>
                <option>Melancholic</option>
              </select>
            </label>
            <label>
              Art direction
              <select value={artStyle} onChange={(event) => props.onArtStyleChange(event.target.value)}>
                <option>Cinematic 3D Anime</option>
                <option>Moody Studio Anime</option>
                <option>Action Shonen</option>
                <option>Lighthearted Slice of Life</option>
              </select>
            </label>
            <label>
              Episode length
              <select value={episodeDuration} onChange={(event) => props.onEpisodeDurationChange(Number(event.target.value))}>
                {[12, 18, 24, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
              </select>
            </label>
          </div>
          <label>
            Core cast size
            <select value={characterCount} onChange={(event) => props.onCharacterCountChange(Number(event.target.value))}>
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} characters</option>)}
            </select>
          </label>
          <button type="submit" className="primary-button" disabled={!project || generating}>
            {generating ? 'Building outline...' : story ? 'Generate another outline' : 'Generate story outline'}
          </button>
          {!project && <p className="form-hint">Create or select a project before drafting a story.</p>}
        </form>

        <section className="story-output" aria-live="polite">
          <div className="output-label">
            <span className="small-rule" />
            <span>{story ? 'Working draft' : 'Story canvas'}</span>
          </div>
          {!story ? (
            <div className="empty-workspace">
              <span className="empty-index">01</span>
              <h3>Your outline will live here.</h3>
              <p>Generated story beats appear after the existing story service returns a saved outline.</p>
            </div>
          ) : (
            <>
              <div className="story-draft-heading">
                <p className="eyebrow">{story.genre} / {project?.name}</p>
                <h3>{story.title}</h3>
                <p className="story-draft-prompt">{story.prompt}</p>
              </div>
              <div className="outline-list">
                {story.outline.map((item, index) => (
                  <article className="outline-item" key={`${story.id}-${index}`}>
                    <span className="outline-index">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <input
                        aria-label={`Outline beat ${index + 1} title`}
                        value={item.title}
                        onChange={(event) => updateOutline(index, { title: event.target.value })}
                      />
                      <textarea
                        aria-label={`Outline beat ${index + 1} description`}
                        rows={3}
                        value={item.description}
                        onChange={(event) => updateOutline(index, { description: event.target.value })}
                      />
                    </div>
                  </article>
                ))}
              </div>
              <div className="story-actions">
                <span className={isApproved ? 'approval-state is-approved' : 'approval-state'}>
                  {isApproved ? 'Approved for production' : storyIsSaved ? 'Draft saved' : 'Unsaved edits'}
                </span>
                <button type="button" className="secondary-button" onClick={props.onSave} disabled={saving || storyIsSaved}>
                  {saving ? 'Saving...' : 'Save edits'}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={props.onApprove}
                  disabled={!storyIsSaved || isApproved}
                >
                  {isApproved ? 'Story approved' : 'Approve story'}
                </button>
              </div>
              <p className="field-note">Story outline editing is saved to this project. Approval is stored in this browser's workflow progress.</p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

type CharacterStepProps = {
  characters: Character[]
  draft: CharacterPayload
  selectedCharacterId: string | null
  saving: boolean
  onDraftChange: (draft: CharacterPayload) => void
  onSelect: (character: Character) => void
  onNew: () => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
}

export function CharactersStep(props: CharacterStepProps) {
  const { characters, draft, selectedCharacterId, saving } = props
  return (
    <div className="step-page">
      <StepHeading
        kicker="02 / Character design"
        title="Build a cast with a point of view."
        description="Create consistent text-based character sheets. 3D character models are not generated by this prototype."
      />
      <div className="character-layout">
        <section className="roster-panel">
          <div className="section-subheading">
            <span>Project cast</span>
            <span>{characters.length.toString().padStart(2, '0')}</span>
          </div>
          {characters.length === 0 ? (
            <div className="empty-workspace compact">
              <h3>No characters yet.</h3>
              <p>Create the first character profile for this production.</p>
            </div>
          ) : (
            <div className="roster-list">
              {characters.map((character, index) => (
                <button
                  type="button"
                  key={character.id}
                  className={`roster-row ${selectedCharacterId === character.id ? 'is-selected' : ''}`}
                  onClick={() => props.onSelect(character)}
                >
                  <span className="roster-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="roster-copy">
                    <strong>{character.name}</strong>
                    <small>{character.role} / {character.personality}</small>
                  </span>
                  <span className="roster-arrow">&gt;</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" className="text-button" onClick={props.onNew}>+ Add character profile</button>
        </section>

        <form className="studio-form character-form" onSubmit={props.onSave}>
          <div className="form-heading-row">
            <div>
              <p className="eyebrow">Character sheet</p>
              <h3>{selectedCharacterId ? 'Edit profile' : 'New profile'}</h3>
            </div>
            <span className="text-only-label">Text profile only</span>
          </div>
          <label>
            Name
            <input required minLength={2} maxLength={80} value={draft.name} onChange={(event) => props.onDraftChange({ ...draft, name: event.target.value })} />
          </label>
          <div className="form-grid-two">
            <label>
              Role
              <select value={draft.role} onChange={(event) => props.onDraftChange({ ...draft, role: event.target.value })}>
                <option>Hero</option>
                <option>Mentor</option>
                <option>Villain</option>
                <option>Supporting</option>
              </select>
            </label>
            <label>
              Personality
              <input value={draft.personality} onChange={(event) => props.onDraftChange({ ...draft, personality: event.target.value })} />
            </label>
          </div>
          <label>
            Appearance
            <textarea rows={2} value={draft.appearance} onChange={(event) => props.onDraftChange({ ...draft, appearance: event.target.value })} />
          </label>
          <label>
            Character description
            <textarea rows={2} value={draft.description} onChange={(event) => props.onDraftChange({ ...draft, description: event.target.value })} />
          </label>
          <div className="form-grid-two">
            <label>
              Powers
              <input value={draft.powers} onChange={(event) => props.onDraftChange({ ...draft, powers: event.target.value })} />
            </label>
            <label>
              Weapon
              <input value={draft.weapon} onChange={(event) => props.onDraftChange({ ...draft, weapon: event.target.value })} />
            </label>
          </div>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving profile...' : selectedCharacterId ? 'Save character changes' : 'Save character profile'}
          </button>
          <p className="field-note">Description and weapon are stored in the existing character text fields; no model schema change is required.</p>
        </form>
      </div>
    </div>
  )
}

type StoryboardStepProps = {
  scenes: Scene[]
  selectedSceneId: string
  onSelectScene: (sceneId: string) => void
  onCreateScene: (name: string, description: string) => Promise<boolean>
  onUpdateScene: (sceneId: string, name: string, description: string) => Promise<void>
  onDeleteScene: (sceneId: string) => Promise<void>
  onCreateShot: (sceneId: string, payload: ShotPayload) => Promise<boolean>
  onUpdateShot: (shotId: string, payload: ShotPayload) => Promise<boolean>
  onDeleteShot: (shotId: string) => Promise<void>
}

const EMPTY_SHOT: ShotPayload = {
  title: '',
  description: '',
  camera_angle: 'Wide',
  camera_movement: 'Static',
  duration: 6,
  character_involvement: '',
  visual_effects: '',
  ordering: 1,
}

export function StoryboardStep(props: StoryboardStepProps) {
  const selectedScene = props.scenes.find((scene) => scene.id === props.selectedSceneId) ?? null
  const [newSceneName, setNewSceneName] = useState('')
  const [newSceneDescription, setNewSceneDescription] = useState('')
  const [sceneName, setSceneName] = useState('')
  const [sceneDescription, setSceneDescription] = useState('')
  const [newShot, setNewShot] = useState<ShotPayload>(EMPTY_SHOT)
  const [editingShotId, setEditingShotId] = useState<string | null>(null)
  const [editingShot, setEditingShot] = useState<ShotPayload>(EMPTY_SHOT)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSceneName(selectedScene?.name ?? '')
    setSceneDescription(selectedScene?.description ?? '')
    setEditingShotId(null)
  }, [selectedScene?.id, selectedScene?.name, selectedScene?.description])

  const submitNewScene = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newSceneName.trim()) return
    setSaving(true)
    try {
      const created = await props.onCreateScene(newSceneName.trim(), newSceneDescription.trim())
      if (created) {
        setNewSceneName('')
        setNewSceneDescription('')
      }
    } finally {
      setSaving(false)
    }
  }

  const submitShot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedScene || !newShot.title.trim()) return
    setSaving(true)
    try {
      const created = await props.onCreateShot(selectedScene.id, newShot)
      if (created) setNewShot({ ...EMPTY_SHOT, ordering: selectedScene.shots.length + 1 })
    } finally {
      setSaving(false)
    }
  }

  const saveShotEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingShotId) return
    setSaving(true)
    try {
      const updated = await props.onUpdateShot(editingShotId, editingShot)
      if (updated) setEditingShotId(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="step-page">
      <StepHeading
        kicker="03 / Storyboard"
        title="Sequence the episode, shot by shot."
        description="Organize scene beats and camera direction. This view contains text and production data, not generated images."
      />
      <div className="storyboard-layout">
        <section className="scene-sequence">
          <div className="section-subheading"><span>Scene sequence</span><span>{props.scenes.length.toString().padStart(2, '0')}</span></div>
          {props.scenes.length === 0 ? (
            <div className="empty-workspace compact">
              <h3>The storyboard is clear.</h3>
              <p>Add the opening scene to begin arranging the sequence.</p>
            </div>
          ) : (
            <ol className="scene-list">
              {props.scenes.map((scene, index) => (
                <li key={scene.id}>
                  <button
                    type="button"
                    className={`scene-list-item ${scene.id === selectedScene?.id ? 'is-selected' : ''}`}
                    onClick={() => props.onSelectScene(scene.id)}
                  >
                    <span className="outline-index">{String(index + 1).padStart(2, '0')}</span>
                    <span><strong>{scene.name}</strong><small>{scene.shots.length} shots</small></span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <form className="inline-create-form" onSubmit={(event) => void submitNewScene(event)}>
            <label>
              New scene
              <input value={newSceneName} onChange={(event) => setNewSceneName(event.target.value)} placeholder="The glass bridge" required />
            </label>
            <textarea rows={2} value={newSceneDescription} onChange={(event) => setNewSceneDescription(event.target.value)} placeholder="Scene beat" />
            <button type="submit" className="secondary-button" disabled={saving}>Add scene</button>
          </form>
        </section>

        <section className="storyboard-editor">
          {!selectedScene ? (
            <div className="empty-workspace"><h3>Select a scene to edit.</h3></div>
          ) : (
            <>
              <form className="scene-edit-form" onSubmit={(event) => {
                event.preventDefault()
                void props.onUpdateScene(selectedScene.id, sceneName, sceneDescription)
              }}>
                <div className="form-heading-row">
                  <div><p className="eyebrow">Scene {String(props.scenes.findIndex((scene) => scene.id === selectedScene.id) + 1).padStart(2, '0')}</p><h3>Scene direction</h3></div>
                  <button type="button" className="danger-text-button" onClick={() => void props.onDeleteScene(selectedScene.id)}>Delete scene</button>
                </div>
                <label>Scene name<input value={sceneName} onChange={(event) => setSceneName(event.target.value)} /></label>
                <label>Scene description<textarea rows={3} value={sceneDescription} onChange={(event) => setSceneDescription(event.target.value)} /></label>
                <button type="submit" className="text-button">Save scene details</button>
              </form>

              <div className="shot-sequence">
                <div className="section-subheading"><span>Shot sequence</span><span>{selectedScene.shots.length.toString().padStart(2, '0')}</span></div>
                {selectedScene.shots.length === 0 ? (
                  <p className="empty-inline">No shots yet. Add the first camera beat below.</p>
                ) : selectedScene.shots.map((shot, index) => (
                  <article className="shot-row" key={shot.id}>
                    <span className="outline-index">{String(index + 1).padStart(2, '0')}</span>
                    <div className="shot-row-copy">
                      <strong>{shot.title}</strong>
                      <p>{shot.description || 'No description provided.'}</p>
                      <small>{shot.camera_angle} / {shot.camera_movement} / {shot.duration}s</small>
                    </div>
                    <button
                      type="button"
                      className="text-button compact-button"
                      onClick={() => {
                        setEditingShotId(shot.id)
                        setEditingShot(shotToPayload(shot))
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="danger-text-button" onClick={() => void props.onDeleteShot(shot.id)}>Remove</button>
                  </article>
                ))}
              </div>

              <form className="shot-form" onSubmit={(event) => void (editingShotId ? saveShotEdit(event) : submitShot(event))}>
                <p className="eyebrow">{editingShotId ? 'Edit shot' : 'Add shot'}</p>
                <div className="form-grid-two">
                  <label>Shot title<input required value={editingShotId ? editingShot.title : newShot.title} onChange={(event) => editingShotId ? setEditingShot({ ...editingShot, title: event.target.value }) : setNewShot({ ...newShot, title: event.target.value })} /></label>
                  <label>Camera angle<select value={editingShotId ? editingShot.camera_angle : newShot.camera_angle} onChange={(event) => editingShotId ? setEditingShot({ ...editingShot, camera_angle: event.target.value }) : setNewShot({ ...newShot, camera_angle: event.target.value })}><option>Wide</option><option>Medium</option><option>Close-up</option><option>Low</option><option>Overhead</option></select></label>
                  <label>Camera movement<select value={editingShotId ? editingShot.camera_movement : newShot.camera_movement} onChange={(event) => editingShotId ? setEditingShot({ ...editingShot, camera_movement: event.target.value }) : setNewShot({ ...newShot, camera_movement: event.target.value })}><option>Static</option><option>Tracking</option><option>Pan</option><option>Dolly</option><option>Handheld</option></select></label>
                  <label>Duration (seconds)<input type="number" min={1} max={600} value={editingShotId ? editingShot.duration : newShot.duration} onChange={(event) => editingShotId ? setEditingShot({ ...editingShot, duration: Number(event.target.value) }) : setNewShot({ ...newShot, duration: Number(event.target.value) })} /></label>
                </div>
                <label>Description<textarea rows={2} value={editingShotId ? editingShot.description : newShot.description} onChange={(event) => editingShotId ? setEditingShot({ ...editingShot, description: event.target.value }) : setNewShot({ ...newShot, description: event.target.value })} /></label>
                <div className="form-grid-two">
                  <label>Characters in shot<input value={editingShotId ? editingShot.character_involvement : newShot.character_involvement} onChange={(event) => editingShotId ? setEditingShot({ ...editingShot, character_involvement: event.target.value }) : setNewShot({ ...newShot, character_involvement: event.target.value })} /></label>
                  <label>Visual effects notes<input value={editingShotId ? editingShot.visual_effects : newShot.visual_effects} onChange={(event) => editingShotId ? setEditingShot({ ...editingShot, visual_effects: event.target.value }) : setNewShot({ ...newShot, visual_effects: event.target.value })} /></label>
                </div>
                <div className="shot-form-actions">
                  {editingShotId && <button type="button" className="quiet-button" onClick={() => setEditingShotId(null)}>Cancel edit</button>}
                  <button type="submit" className="secondary-button" disabled={saving}>{saving ? 'Saving...' : editingShotId ? 'Save shot changes' : 'Add shot to sequence'}</button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

type SceneGenerationStepProps = {
  scenes: Scene[]
  selectedSceneId: string
  prompt: string
  job: GenerationJob | null
  generating: boolean
  opening: boolean
  onSceneSelect: (id: string) => void
  onPromptChange: (value: string) => void
  onGenerate: (event: FormEvent<HTMLFormElement>) => void
  onOpenScene: () => void
  apiBase: string
}

export function SceneGenerationStep(props: SceneGenerationStepProps) {
  const selectedScene = props.scenes.find((scene) => scene.id === props.selectedSceneId) ?? null
  return (
    <div className="step-page">
      <StepHeading
        kicker="04 / Environment generation"
        title="Give the scene its ground and atmosphere."
        description="Generate a procedural Godot scene file from the selected storyboard beat and your environment notes."
      />
      <div className="scene-generation-layout">
        <form className="studio-form" onSubmit={props.onGenerate}>
          <label>
            Storyboard scene
            <select required value={props.selectedSceneId} onChange={(event) => props.onSceneSelect(event.target.value)} disabled={props.scenes.length === 0}>
              <option value="">Select a scene</option>
              {props.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
            </select>
          </label>
          {selectedScene && <p className="context-note">{selectedScene.description || 'No scene description yet.'}</p>}
          <label>
            Environment prompt
            <textarea
              required
              minLength={10}
              maxLength={1200}
              rows={7}
              value={props.prompt}
              onChange={(event) => props.onPromptChange(event.target.value)}
              placeholder="Describe the battlefield's atmosphere, terrain, and set dressing."
            />
          </label>
          <button type="submit" className="primary-button" disabled={!selectedScene || props.generating}>
            {props.generating ? 'Submitting job...' : 'Generate Godot scene'}
          </button>
          <p className="field-note">The prototype currently produces a fixed low-poly battlefield layout and saves your prompt as scene metadata. Prompt-specific layout interpretation is not implemented.</p>
        </form>

        <section className="scene-job-panel" aria-live="polite">
          <div className="output-label"><span className="small-rule" /><span>Generation job</span></div>
          {!props.job ? (
            <div className="empty-workspace">
              <span className="empty-index">04</span>
              <h3>No scene job for this project yet.</h3>
              <p>Job status and scene file information will appear here after submission.</p>
            </div>
          ) : (
            <div className="scene-job-detail">
              <p className="eyebrow">Job {props.job.id.slice(0, 8)}</p>
              <h3 className={`job-status status-${props.job.status}`}>{props.job.status}</h3>
              {props.job.status === 'failed' && <p className="error-copy">{props.job.error ?? 'Scene generation failed.'}</p>}
              {props.job.status === 'completed' && (
                <>
                  <div className="generated-file-block">
                    <span className="file-mark">.tscn</span>
                    <span><strong>battlefield.tscn</strong><small>Generated scene file / Godot project artifact</small></span>
                  </div>
                  <p className="field-note">This is a scene file, not an in-app visual preview. Open it in Godot to inspect the rendered scene.</p>
                  <div className="scene-job-actions">
                    <button type="button" className="primary-button" onClick={props.onOpenScene} disabled={props.opening}>
                      {props.opening ? 'Opening Godot...' : 'Open Generated Scene'}
                    </button>
                    {props.job.scene_url && (
                      <a className="text-link" href={`${props.apiBase}${props.job.scene_url}`} target="_blank" rel="noreferrer">
                        Download scene file
                      </a>
                    )}
                  </div>
                </>
              )}
              {(props.job.status === 'queued' || props.job.status === 'running') && (
                <p className="field-note">Waiting for the local Godot process. No progress estimate is available.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

type AnimationStepProps = {
  scenes: Scene[]
  characters: Character[]
}

export function AnimationStep({ scenes, characters }: AnimationStepProps) {
  return (
    <div className="step-page">
      <StepHeading
        kicker="05 / Animation"
        title="Prepare the performance, not a fake render."
        description="Scene and character references are available for planning. Character animation generation is not connected yet."
      />
      <div className="prototype-layout">
        <section className="prototype-section">
          <p className="eyebrow">Available production context</p>
          <h3>{scenes.length} scenes / {characters.length} character profiles</h3>
          <div className="context-list">
            {scenes.map((scene, index) => <div key={scene.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{scene.name}</strong><small>{scene.shots.length} storyboard shots</small></div>)}
            {characters.map((character) => <div key={character.id}><span>Cast</span><strong>{character.name}</strong><small>{character.role}</small></div>)}
            {scenes.length === 0 && characters.length === 0 && <p className="empty-inline">Add storyboard and character data in earlier steps.</p>}
          </div>
        </section>
        <section className="prototype-section action-planning">
          <p className="eyebrow">Action planning</p>
          <h3>Animation controls</h3>
          <label>
            Planned action
            <select disabled defaultValue="">
              <option value="">Choose an action (coming soon)</option>
              <option>Idle / coming soon</option>
              <option>Walk / coming soon</option>
              <option>Attack / coming soon</option>
            </select>
          </label>
          <label>
            Motion notes
            <textarea disabled rows={4} placeholder="Animation generation is not available yet." />
          </label>
          <span className="availability-tag">Coming soon / no animation output is generated</span>
        </section>
      </div>
    </div>
  )
}

type FinalVideoStepProps = {
  project: Project | null
  story: Story | null
  characters: Character[]
  scenes: Scene[]
}

export function FinalVideoStep({ project, story, characters, scenes }: FinalVideoStepProps) {
  const shotCount = scenes.reduce((total, scene) => total + scene.shots.length, 0)
  return (
    <div className="step-page">
      <StepHeading
        kicker="06 / Final video"
        title="Review the production plan."
        description="The storyboard and generated scene are tracked above. Rendering and video export are not available in this backend yet."
      />
      <div className="final-summary">
        <section className="summary-editorial">
          <p className="eyebrow">Production summary</p>
          <h3>{project?.name ?? 'No project selected'}</h3>
          <p>{story?.prompt ?? 'No approved story is attached to this project yet.'}</p>
        </section>
        <dl className="summary-counts">
          <div><dt>Story</dt><dd>{story?.title ?? 'Not created'}</dd></div>
          <div><dt>Character profiles</dt><dd>{characters.length}</dd></div>
          <div><dt>Storyboard scenes</dt><dd>{scenes.length}</dd></div>
          <div><dt>Storyboard shots</dt><dd>{shotCount}</dd></div>
        </dl>
      </div>
      <section className="unavailable-panel">
        <div>
          <p className="eyebrow">Render and export</p>
          <h3>Video rendering is not connected.</h3>
          <p>No render-job API, video preview, or export endpoint is currently available. No render status or preview is being simulated.</p>
        </div>
        <div className="render-options">
          <label>Resolution<select disabled><option>Unavailable</option></select></label>
          <label>Frame rate<select disabled><option>Unavailable</option></select></label>
          <span className="availability-tag">Coming soon</span>
        </div>
      </section>
    </div>
  )
}

export function AuxiliaryStep({ view }: { view: 'account' | 'settings' }) {
  return (
    <div className="step-page auxiliary-page">
      <StepHeading
        kicker={view === 'account' ? 'Studio / Account' : 'Studio / Settings'}
        title={view === 'account' ? 'Account' : 'Workspace settings'}
        description={view === 'account'
          ? 'Authentication controls are not connected in the current frontend.'
          : 'Workspace preferences and rendering settings are not available yet.'}
      />
      <p className="field-note">Existing backend authentication endpoints are unchanged; this screen does not imply a signed-in account.</p>
    </div>
  )
}

function StepHeading({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return (
    <header className="step-heading">
      <p className="eyebrow">{kicker}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  )
}

function shotToPayload(shot: Shot): ShotPayload {
  return {
    title: shot.title,
    description: shot.description,
    camera_angle: shot.camera_angle,
    camera_movement: shot.camera_movement,
    duration: shot.duration,
    character_involvement: shot.character_involvement,
    visual_effects: shot.visual_effects,
    ordering: shot.ordering,
  }
}
