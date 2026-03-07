interface UnfoldButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
}

export default function UnfoldButton({ label, disabled, onClick }: UnfoldButtonProps) {
  return (
    <button id="unfold-btn" type="button" className="btn btn-primary" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  )
}
