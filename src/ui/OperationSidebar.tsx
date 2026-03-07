import type { SolidId } from '../types'

export type OperationType = 'stellate' | 'truncate'

export interface OperationStep {
  id: string
  type: OperationType
  amount: number
}

interface OperationSidebarProps {
  baseSolidId: SolidId
  steps: OperationStep[]
  onActivateStellate: () => void
  onActivateTruncate: () => void
  onStellateChange: (stepId: string, value: number) => void
  onTruncateChange: (stepId: string, value: number) => void
  onRemoveStep: (stepId: string) => void
}

function solidLabel(id: SolidId): string {
  switch (id) {
    case 'tetrahedron':
      return 'Tetrahedron'
    case 'cube':
      return 'Cube'
    case 'octahedron':
      return 'Octahedron'
    case 'dodecahedron':
      return 'Dodecahedron'
    case 'icosahedron':
      return 'Icosahedron'
    default:
      return id
  }
}

export default function OperationSidebar({
  baseSolidId,
  steps,
  onActivateStellate,
  onActivateTruncate,
  onStellateChange,
  onTruncateChange,
  onRemoveStep,
}: OperationSidebarProps) {
  return (
    <aside className="steps-sidebar">
      <p className="sidebar-heading">Add Operation</p>
      <div className="op-buttons">
        <button id="stellate-btn" type="button" className="op-btn" onClick={onActivateStellate}>
          <span className="op-btn-icon">+</span> Stellate
        </button>
        <button id="truncate-btn" type="button" className="op-btn" onClick={onActivateTruncate}>
          <span className="op-btn-icon">+</span> Truncate
        </button>
      </div>

      <p className="sidebar-heading">Pipeline</p>
      <ul className="step-list">
        <li className="step-item">
          <div className="step-header">
            <span className="step-badge step-badge-base">Base</span>
          </div>
          <div className="step-value">{solidLabel(baseSolidId)}</div>
        </li>

        {steps.map((step, index) => {
          const isStellate = step.type === 'stellate'
          return (
            <li className="step-item" key={step.id}>
              <div className="step-header">
                <span className={`step-badge ${isStellate ? 'step-badge-stellate' : 'step-badge-truncate'}`}>
                  <span className="step-number">{index + 1}.</span>
                  {isStellate ? 'Stellate' : 'Truncate'}
                </span>
                <button
                  type="button"
                  className="step-remove-btn"
                  title="Remove operation"
                  onClick={() => onRemoveStep(step.id)}
                >
                  &times;
                </button>
              </div>
              <div className="slider-wrap">
                <input
                  id={isStellate ? `stellate-slider-${step.id}` : `truncate-slider-${step.id}`}
                  type="range"
                  min={isStellate ? -1 : 0}
                  max={isStellate ? 1 : 0.49}
                  step={0.01}
                  value={step.amount}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (isStellate) {
                      onStellateChange(step.id, value)
                    } else {
                      onTruncateChange(step.id, value)
                    }
                  }}
                />
                <span className="slider-value">{step.amount.toFixed(2)}</span>
              </div>
            </li>
          )
        })}
      </ul>

      {steps.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">&#x25B3;</span>
          <span className="empty-state-text">
            Add a stellate or truncate<br />operation to transform the solid
          </span>
        </div>
      )}
    </aside>
  )
}
