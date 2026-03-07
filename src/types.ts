export type Vec3 = [number, number, number]

export type SolidId = 'tetrahedron' | 'cube' | 'octahedron' | 'dodecahedron' | 'icosahedron'

export interface SolidDefinition {
  id: SolidId
  vertices: Vec3[]
  faces: number[][]
}

export interface FaceAdjacency {
  faceA: number
  faceB: number
  edge: [number, number]
}

export interface TreeEdge {
  parent: number
  child: number
  edge: [number, number]
  axis: Vec3
  pivot: Vec3
  angle: number
  sign: 1 | -1
}

export interface UnfoldTree {
  root: number
  treeEdges: TreeEdge[]
  parentByFace: number[]
}

export type UnfoldPhase = 'folded' | 'unfolding' | 'unfolded' | 'folding'

export interface UnfoldSnapshot {
  phase: UnfoldPhase
  progress: number
  elapsedMs: number
  animating: boolean
  tree: UnfoldTree | null
}

declare global {
  interface Window {
    render_game_to_text?: () => string
    advanceTime?: (ms: number) => void
  }
}
