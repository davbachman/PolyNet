import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { vec3ToThree, type BoundingSphereData } from '../geometry/math'
import type { SolidDefinition } from '../types'
import PolyhedronMesh from './PolyhedronMesh'

interface SolidSceneProps {
  solid: SolidDefinition
  matrices: THREE.Matrix4[]
  onTick: (ms: number) => void
  unfoldProgress: number
  headOnNormal: [number, number, number] | null
  controlsEnabled: boolean
  snapHeadOn: boolean
  foldedBounds: BoundingSphereData
  unfoldedBounds: BoundingSphereData | null
}

interface FrameTickerProps {
  onTick: (ms: number) => void
  controlsRef: RefObject<OrbitControlsImpl | null>
  unfoldProgress: number
  headOnNormal: [number, number, number] | null
  snapHeadOn: boolean
  controlsEnabled: boolean
  foldedBounds: BoundingSphereData
  unfoldedBounds: BoundingSphereData | null
}

const FOLDED_DIRECTION = new THREE.Vector3(1, 1, 1).normalize()

function fitDistanceForRadius(radius: number, fovDegrees: number, aspect: number, padding: number): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const clampedRadius = Math.max(radius, 0.001)
  const verticalHalfFov = THREE.MathUtils.degToRad(fovDegrees) / 2
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * safeAspect)
  const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov)
  return (clampedRadius * padding) / Math.sin(Math.max(limitingHalfFov, 0.001))
}

function FrameTicker({
  onTick,
  controlsRef,
  unfoldProgress,
  headOnNormal,
  snapHeadOn,
  controlsEnabled,
  foldedBounds,
  unfoldedBounds,
}: FrameTickerProps) {
  useFrame(({ camera, size }, deltaSeconds) => {
    onTick(deltaSeconds * 1000)

    const controls = controlsRef.current
    const blend = THREE.MathUtils.clamp(unfoldProgress, 0, 1)
    const foldedTarget = vec3ToThree(foldedBounds.center)

    const perspectiveCamera = camera as THREE.PerspectiveCamera
    const aspect = size.height > 0 ? size.width / size.height : 1
    const foldedDistance = fitDistanceForRadius(foldedBounds.radius, perspectiveCamera.fov, aspect, 1.27)

    if (controlsEnabled && blend <= 0.001) {
      controls?.target.lerp(foldedTarget, 0.2)
      camera.lookAt(controls ? controls.target : foldedTarget)
      controls?.update()
      return
    }

    const unfoldedTarget = unfoldedBounds ? vec3ToThree(unfoldedBounds.center) : foldedTarget
    const unfoldedDistance = unfoldedBounds
      ? fitDistanceForRadius(unfoldedBounds.radius, perspectiveCamera.fov, aspect, 1.49)
      : foldedDistance

    const headOnDirection = headOnNormal
      ? new THREE.Vector3(headOnNormal[0], headOnNormal[1], headOnNormal[2]).normalize()
      : FOLDED_DIRECTION.clone()

    const desiredDirection = FOLDED_DIRECTION.clone().lerp(headOnDirection, blend)
    if (desiredDirection.lengthSq() < 0.000001) {
      desiredDirection.copy(FOLDED_DIRECTION)
    }
    desiredDirection.normalize()

    const desiredTarget = foldedTarget.clone().lerp(unfoldedTarget, blend)
    const desiredDistance = THREE.MathUtils.lerp(foldedDistance, unfoldedDistance, blend)
    const desiredPosition = desiredTarget.clone().add(desiredDirection.multiplyScalar(desiredDistance))

    if (snapHeadOn && blend >= 0.999) {
      camera.position.copy(desiredPosition)
      controls?.target.copy(desiredTarget)
    } else {
      camera.position.lerp(desiredPosition, 0.22)
      controls?.target.lerp(desiredTarget, 0.22)
    }

    camera.lookAt(controls ? controls.target : desiredTarget)
    controls?.update()
  })

  return null
}

export default function SolidScene({
  solid,
  matrices,
  onTick,
  unfoldProgress,
  headOnNormal,
  controlsEnabled,
  snapHeadOn,
  foldedBounds,
  unfoldedBounds,
}: SolidSceneProps) {
  const radius = useMemo(() => Math.max(foldedBounds.radius, 0.001), [foldedBounds.radius])
  const initialDistance = radius * 3.6

  const initialPosition = useMemo(() => {
    const center = vec3ToThree(foldedBounds.center)
    return center.add(FOLDED_DIRECTION.clone().multiplyScalar(initialDistance))
  }, [foldedBounds.center, initialDistance])

  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  return (
    <Canvas
      camera={{
        position: [initialPosition.x, initialPosition.y, initialPosition.z],
        fov: 45,
        near: 0.1,
        far: 100,
      }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#eef3f8']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 6, 4]} intensity={1.05} />
      <directionalLight position={[-4, -3, -5]} intensity={0.45} />

      <FrameTicker
        onTick={onTick}
        controlsRef={controlsRef}
        unfoldProgress={unfoldProgress}
        headOnNormal={headOnNormal}
        snapHeadOn={snapHeadOn}
        controlsEnabled={controlsEnabled}
        foldedBounds={foldedBounds}
        unfoldedBounds={unfoldedBounds}
      />
      <PolyhedronMesh solid={solid} matrices={matrices} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={foldedBounds.center}
        enabled={controlsEnabled}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={radius * 1.1}
        maxDistance={radius * 14}
      />
    </Canvas>
  )
}
