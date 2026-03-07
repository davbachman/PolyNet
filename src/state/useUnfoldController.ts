import { useCallback, useMemo, useState } from 'react'
import { generateRandomTree } from '../geometry/unfoldTree'
import type { SolidDefinition, UnfoldPhase, UnfoldSnapshot, UnfoldTree } from '../types'

const ANIMATION_DURATION_MS = 1400

interface InternalSnapshot extends UnfoldSnapshot {
  modelKey: string
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
}

function createInitialSnapshot(modelKey: string): InternalSnapshot {
  return {
    modelKey,
    phase: 'folded',
    progress: 0,
    elapsedMs: 0,
    animating: false,
    tree: null,
  }
}

function normalizeSnapshot(snapshot: InternalSnapshot, modelKey: string): InternalSnapshot {
  return snapshot.modelKey === modelKey ? snapshot : createInitialSnapshot(modelKey)
}

export function useUnfoldController(solid: SolidDefinition, modelKey: string) {
  const [internalSnapshot, setInternalSnapshot] = useState<InternalSnapshot>(() =>
    createInitialSnapshot(modelKey),
  )

  const snapshot = useMemo(() => {
    return normalizeSnapshot(internalSnapshot, modelKey)
  }, [internalSnapshot, modelKey])

  const step = useCallback(
    (ms: number) => {
      if (!Number.isFinite(ms) || ms <= 0) {
        return
      }

      setInternalSnapshot((currentRaw) => {
        const current = normalizeSnapshot(currentRaw, modelKey)
        if (!current.animating) {
          return current
        }

        const elapsedMs = Math.min(current.elapsedMs + ms, ANIMATION_DURATION_MS)
        const t = Math.min(elapsedMs / ANIMATION_DURATION_MS, 1)
        const eased = easeInOutCubic(t)

        if (current.phase === 'unfolding') {
          if (t >= 1) {
            return {
              ...current,
              phase: 'unfolded',
              progress: 1,
              elapsedMs,
              animating: false,
            }
          }

          return {
            ...current,
            progress: eased,
            elapsedMs,
          }
        }

        if (current.phase === 'folding') {
          if (t >= 1) {
            return {
              ...current,
              phase: 'folded',
              progress: 0,
              elapsedMs,
              animating: false,
            }
          }

          return {
            ...current,
            progress: 1 - eased,
            elapsedMs,
          }
        }

        return current
      })
    },
    [modelKey],
  )

  const toggle = useCallback(() => {
    setInternalSnapshot((currentRaw) => {
      const current = normalizeSnapshot(currentRaw, modelKey)
      if (current.animating) {
        return current
      }

      if (current.phase === 'folded') {
        let tree: UnfoldTree | null = null
        try {
          tree = generateRandomTree(solid)
        } catch {
          return {
            ...current,
            phase: 'folded',
            progress: 0,
            elapsedMs: 0,
            animating: false,
            tree: null,
          }
        }

        return {
          modelKey,
          phase: 'unfolding',
          progress: 0,
          elapsedMs: 0,
          animating: true,
          tree,
        }
      }

      if (current.phase === 'unfolded') {
        return {
          ...current,
          phase: 'folding',
          elapsedMs: 0,
          animating: true,
        }
      }

      return current
    })
  }, [modelKey, solid])

  const buttonLabel = useMemo(() => {
    if (snapshot.phase === 'folded') {
      return 'Unfold'
    }

    if (snapshot.phase === 'unfolded') {
      return 'Fold'
    }

    if (snapshot.phase === 'unfolding') {
      return 'Unfolding...'
    }

    return 'Folding...'
  }, [snapshot.phase])

  return {
    snapshot,
    step,
    toggle,
    durationMs: ANIMATION_DURATION_MS,
    buttonLabel,
  }
}

export function isAnimatingPhase(phase: UnfoldPhase): boolean {
  return phase === 'unfolding' || phase === 'folding'
}
