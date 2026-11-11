import { type FormEvent, type ReactNode, useState } from 'react'
import { WORKFLOW_STEPS, type Project, type WorkflowStepId } from '../types'

export type StudioView = 'workflow' | 'account' | 'settings'

export type NewProjectPayload = Pick<Project, 'name' | 'description' | 'status' | 'genre'>

type StudioFrameProps = {
  projects: Project[]
  selectedProject: Project | null
  selectedProjectId: string
  currentStep: WorkflowStepId
  view: StudioView
  canNavigateToStep: (step: WorkflowStepId) => boolean
  canContinue: boolean
  nextLabel: string
  children: ReactNode
  onProjectSelect: (projectId: string) => void
  onProjectCreate: (payload: NewProjectPayload) => Promise<boolean>
  onProjectDelete: (projectId: string) => void
  onStepSelect: (step: WorkflowStepId) => void
  onViewSelect: (view: StudioView) => void
  onBack: () => void
  onContinue: () => void
}

export function StudioFrame({
  projects,
  selectedProject,
  selectedProjectId,
  currentStep,
  view,
  canNavigateToStep,
  canContinue,
  nextLabel,
  children,
  onProjectSelect,
  onProjectCreate,
  onProjectDelete,
  onStepSelect,
  onViewSelect,
  onBack,
  onContinue,
}: StudioFrameProps) {
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectGenre, setProjectGenre] = useState('Fantasy')
  const [creatingProject, setCreatingProject] = useState(false)

  const submitProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!projectName.trim()) return
    setCreatingProject(true)
    try {
      const created = await onProjectCreate({
        name: projectName.trim(),
        description: projectDescription.trim(),
        status: 'Concept',
        genre: projectGenre,
      })
      if (created) {
        setProjectName('')
        setProjectDescription('')
        setProjectGenre('Fantasy')
      }
    } finally {
      setCreatingProject(false)
    }
  }

  return (
    <div className="studio-app">
      <aside className="studio-sidebar">
        <a className="brand-lockup" href="/" aria-label="AnimeForge Studio home">
          <span className="brand-mark">AF</span>
          <span>
            <strong>AnimeForge</strong>
            <small>Production studio</small>
          </span>
        </a>

        <div className="sidebar-project">
          <label htmlFor="project-selector">Current project</label>
          <select
            id="project-selector"
            value={selectedProjectId}
            onChange={(event) => onProjectSelect(event.target.value)}
            disabled={projects.length === 0}
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>

        <details className="new-project-details">
          <summary>+ New project</summary>
          <form onSubmit={(event) => void submitProject(event)} className="sidebar-project-form">
            <label>
              Project name
              <input
                required
                minLength={3}
                maxLength={120}
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Untitled production"
              />
            </label>
            <label>
              Description
              <textarea
                rows={2}
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                placeholder="A short project brief"
              />
            </label>
            <label>
              Genre
              <select value={projectGenre} onChange={(event) => setProjectGenre(event.target.value)}>
                <option>Fantasy</option>
                <option>Sci-Fi</option>
                <option>Action</option>
                <option>Drama</option>
                <option>Romance</option>
              </select>
            </label>
            <button type="submit" className="sidebar-create-button" disabled={creatingProject}>
              {creatingProject ? 'Creating...' : 'Create project'}
            </button>
          </form>
        </details>

        <div className="recent-projects">
          <div className="sidebar-section-heading">
            <span>Recent projects</span>
            <span>{projects.length.toString().padStart(2, '0')}</span>
          </div>
          {projects.length === 0 ? (
            <p className="sidebar-empty">Your productions will appear here.</p>
          ) : (
            <ul>
              {projects.slice(0, 5).map((project) => (
                <li key={project.id} className={selectedProjectId === project.id ? 'is-selected' : ''}>
                  <button type="button" onClick={() => onProjectSelect(project.id)}>
                    <span className="recent-project-dot" />
                    <span>{project.name}</span>
                  </button>
                  <button
                    type="button"
                    className="project-remove-button"
                    aria-label={`Delete ${project.name}`}
                    title="Delete project"
                    onClick={() => onProjectDelete(project.id)}
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav className="sidebar-account-nav" aria-label="Account and settings">
          <button
            type="button"
            className={view === 'account' ? 'is-active' : ''}
            onClick={() => onViewSelect(view === 'account' ? 'workflow' : 'account')}
          >
            <span className="nav-glyph">A</span> Account
          </button>
          <button
            type="button"
            className={view === 'settings' ? 'is-active' : ''}
            onClick={() => onViewSelect(view === 'settings' ? 'workflow' : 'settings')}
          >
            <span className="nav-glyph">S</span> Settings
          </button>
        </nav>
      </aside>

      <main className="studio-main">
        <header className="studio-header">
          <div>
            <p className="eyebrow">Anime production workspace</p>
            <h1>{selectedProject?.name ?? 'Your next story starts here'}</h1>
          </div>
          <div className="studio-header-meta">
            <span className="status-indicator" />
            <span>{selectedProject ? selectedProject.genre : 'No project selected'}</span>
          </div>
        </header>

        <nav className="workflow-stepper" aria-label="Production workflow">
          {WORKFLOW_STEPS.map((step, index) => {
            const active = currentStep === step.id && view === 'workflow'
            const available = canNavigateToStep(step.id)
            return (
              <button
                type="button"
                key={step.id}
                className={`workflow-step ${active ? 'is-current' : ''} ${available ? 'is-available' : ''}`}
                aria-current={active ? 'step' : undefined}
                disabled={!available}
                onClick={() => {
                  onViewSelect('workflow')
                  onStepSelect(step.id)
                }}
              >
                <span className="workflow-step-number">{step.caption}</span>
                <span className="workflow-step-copy">
                  <strong>{step.label}</strong>
                  <small>{index < 3 ? 'Development' : 'Production'}</small>
                </span>
              </button>
            )
          })}
        </nav>

        <section className="workspace-content">
          {children}
        </section>

        {view === 'workflow' && (
          <footer className="workflow-footer">
            <button
              type="button"
              className="quiet-button"
              onClick={onBack}
              disabled={currentStep === 'story'}
            >
              Back
            </button>
            <div className="workflow-footer-step">
              <span>{WORKFLOW_STEPS.findIndex((step) => step.id === currentStep) + 1}</span>
              <span>of 6 steps</span>
            </div>
            {currentStep !== 'final-video' ? (
              <button
                type="button"
                className="primary-button"
                onClick={onContinue}
                disabled={!canContinue}
              >
                {nextLabel}
              </button>
            ) : <span className="workflow-finished">Production plan complete</span>}
          </footer>
        )}
      </main>
    </div>
  )
}
