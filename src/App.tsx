import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { getSolid } from './data/solids'
import { exportObjFile, exportUnfoldedPng } from './export/modelExport'
import { computeFaceCloudBoundingSphere, faceNormal, solidCentroid, solidRadius, threeToVec3 } from './geometry/math'
import { applyStellation, applyTruncation } from './geometry/modelOps'
import { createIdentityTree, computeFaceMatrices } from './geometry/transforms'
import { generateRandomTree } from './geometry/unfoldTree'
import { isAnimatingPhase, useUnfoldController } from './state/useUnfoldController'
import SolidScene from './scene/SolidScene'
import OperationSidebar, { type OperationStep, type OperationType } from './ui/OperationSidebar'
import SolidSelector from './ui/SolidSelector'
import UnfoldButton from './ui/UnfoldButton'
import type { SolidId } from './types'

function makeIdentityMatrices(faceCount: number): THREE.Matrix4[] {
  return Array.from({ length: faceCount }, () => new THREE.Matrix4().identity())
}

function exportTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

export default function App() {
  const [solidId, setSolidId] = useState<SolidId>('cube')
  const [operationSteps, setOperationSteps] = useState<OperationStep[]>([])
  const nextOperationIdRef = useRef(1)

  const baseSolid = useMemo(() => getSolid(solidId), [solidId])

  const solid = useMemo(() => {
    return operationSteps.reduce((current, step) => {
      if (step.type === 'stellate') {
        return applyStellation(current, step.amount)
      }

      return applyTruncation(current, step.amount)
    }, baseSolid)
  }, [baseSolid, operationSteps])

  const modelKey = useMemo(() => {
    return JSON.stringify({
      base: solidId,
      steps: operationSteps.map((step) => [step.id, step.type, Number(step.amount.toFixed(3))]),
    })
  }, [solidId, operationSteps])

  const modelNamePrefix = useMemo(() => {
    const stepTokens = operationSteps.map((step, index) => `${index + 1}-${step.type}-${step.amount.toFixed(2)}`)
    return stepTokens.length > 0 ? `${solidId}-${stepTokens.join('_')}` : solidId
  }, [operationSteps, solidId])

  const { snapshot, buttonLabel, step, toggle } = useUnfoldController(solid, modelKey)

  const activeTree = useMemo(() => {
    return snapshot.tree ?? createIdentityTree(solid)
  }, [snapshot.tree, solid])

  const matrices = useMemo(() => {
    if (!snapshot.tree && snapshot.progress === 0) {
      return makeIdentityMatrices(solid.faces.length)
    }

    return computeFaceMatrices(solid, activeTree, snapshot.progress)
  }, [activeTree, snapshot.progress, snapshot.tree, solid])

  const headOnNormal = useMemo(() => {
    if (!snapshot.tree) {
      return null
    }

    return threeToVec3(faceNormal(solid, snapshot.tree.root))
  }, [snapshot.tree, solid])

  const foldedBounds = useMemo(() => {
    return {
      center: solidCentroid(solid),
      radius: solidRadius(solid),
    }
  }, [solid])

  const unfoldedBounds = useMemo(() => {
    if (!snapshot.tree) {
      return null
    }

    const finalMatrices = computeFaceMatrices(solid, activeTree, 1)
    return computeFaceCloudBoundingSphere(solid, finalMatrices)
  }, [activeTree, snapshot.tree, solid])

  useEffect(() => {
    window.render_game_to_text = () => {
      return JSON.stringify({
        solidId,
        state: snapshot.phase,
        progress: Number(snapshot.progress.toFixed(4)),
        animating: snapshot.animating,
        rootFace: snapshot.tree ? snapshot.tree.root : -1,
        treeEdgesCount: snapshot.tree ? snapshot.tree.treeEdges.length : 0,
        steps: operationSteps,
      })
    }

    window.advanceTime = (ms: number) => {
      if (!Number.isFinite(ms) || ms <= 0) {
        return
      }

      const fixedStepMs = 1000 / 60
      const steps = Math.max(1, Math.round(ms / fixedStepMs))
      for (let i = 0; i < steps; i += 1) {
        step(fixedStepMs)
      }
    }

    return () => {
      delete window.render_game_to_text
      delete window.advanceTime
    }
  }, [operationSteps, snapshot.animating, snapshot.phase, snapshot.progress, snapshot.tree, solidId, step])

  const animating = isAnimatingPhase(snapshot.phase)

  const appendOperation = (operationType: OperationType): void => {
    setOperationSteps((currentSteps) => {
      const amount = operationType === 'stellate' ? 0.25 : 0.2
      return [
        ...currentSteps,
        {
          id: `op-${nextOperationIdRef.current++}`,
          type: operationType,
          amount,
        },
      ]
    })
  }

  const handleActivateStellate = (): void => {
    appendOperation('stellate')
  }

  const handleActivateTruncate = (): void => {
    appendOperation('truncate')
  }

  const handleStellateChange = (stepId: string, value: number): void => {
    setOperationSteps((currentSteps) =>
      currentSteps.map((step) =>
        step.id === stepId && step.type === 'stellate' ? { ...step, amount: Math.min(1, Math.max(-1, value)) } : step,
      ),
    )
  }

  const handleTruncateChange = (stepId: string, value: number): void => {
    setOperationSteps((currentSteps) =>
      currentSteps.map((step) =>
        step.id === stepId && step.type === 'truncate'
          ? { ...step, amount: Math.min(0.49, Math.max(0, value)) }
          : step,
      ),
    )
  }

  const handleRemoveStep = (stepId: string): void => {
    setOperationSteps((currentSteps) => currentSteps.filter((s) => s.id !== stepId))
  }

  const handleExportObj = (): void => {
    const filename = `${modelNamePrefix}-${snapshot.phase}-${exportTimestamp()}`
    exportObjFile(solid, matrices, filename)
  }

  const handleExportUnfoldedPng = async (): Promise<void> => {
    let tree = snapshot.tree

    if (!tree) {
      try {
        tree = generateRandomTree(solid)
      } catch {
        tree = createIdentityTree(solid)
      }
    }

    const filename = `${modelNamePrefix}-unfolded-${exportTimestamp()}`
    try {
      await exportUnfoldedPng(solid, tree, filename)
    } catch (error) {
      console.error('PNG export failed.', error)
    }
  }

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div className="toolbar-brand">
          <h1>PolyNet</h1>
          <p className="subtitle">Transform &amp; unfold polyhedra</p>
        </div>
        <SolidSelector value={solidId} onChange={setSolidId} />
        <div className="controls-row">
          <UnfoldButton label={buttonLabel} disabled={animating} onClick={toggle} />
          <span className="controls-divider" />
          <button id="export-obj-btn" type="button" className="btn btn-secondary" disabled={animating} onClick={handleExportObj}>
            Export OBJ
          </button>
          <button
            id="export-png-btn"
            type="button"
            className="btn btn-secondary"
            disabled={animating}
            onClick={() => {
              void handleExportUnfoldedPng()
            }}
          >
            Export PNG
          </button>
        </div>
      </header>

      <div className="content-shell">
        <OperationSidebar
          baseSolidId={solidId}
          steps={operationSteps}
          onActivateStellate={handleActivateStellate}
          onActivateTruncate={handleActivateTruncate}
          onStellateChange={handleStellateChange}
          onTruncateChange={handleTruncateChange}
          onRemoveStep={handleRemoveStep}
        />

        <main className="scene-shell">
          <SolidScene
            solid={solid}
            matrices={matrices}
            onTick={step}
            unfoldProgress={snapshot.progress}
            headOnNormal={headOnNormal}
            controlsEnabled={snapshot.phase === 'folded'}
            snapHeadOn={snapshot.phase === 'unfolded'}
            foldedBounds={foldedBounds}
            unfoldedBounds={unfoldedBounds}
          />
        </main>
      </div>
    </div>
  )
}
