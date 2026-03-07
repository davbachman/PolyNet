import { getSolidOptions } from '../data/solids'
import type { SolidId } from '../types'

interface SolidSelectorProps {
  value: SolidId
  onChange: (solidId: SolidId) => void
}

export default function SolidSelector({ value, onChange }: SolidSelectorProps) {
  return (
    <label className="control-group" htmlFor="solid-select">
      <span className="control-label">Base Polyhedron</span>
      <select
        id="solid-select"
        className="control-select"
        value={value}
        onChange={(event) => onChange(event.target.value as SolidId)}
      >
        {getSolidOptions().map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
