import { describe, expect, it } from 'vitest'
import { getSolid } from '../data/solids'
import { buildAdjacency } from '../geometry/adjacency'
import { faceNormal, applyMatrixToNormal } from '../geometry/math'
import { computeFaceMatrices } from '../geometry/transforms'
import { computeTreeOverlapScore, generateRandomTree } from '../geometry/unfoldTree'
import type { SolidId } from '../types'

const SOLIDS: SolidId[] = ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron']

const EXPECTED_ADJACENCY_COUNTS: Record<SolidId, number> = {
  tetrahedron: 6,
  cube: 12,
  octahedron: 12,
  dodecahedron: 30,
  icosahedron: 30,
}

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

describe('geometry adjacency', () => {
  SOLIDS.forEach((solidId) => {
    it(`${solidId} adjacency has expected edge count`, () => {
      const solid = getSolid(solidId)
      const adjacency = buildAdjacency(solid)
      expect(adjacency).toHaveLength(EXPECTED_ADJACENCY_COUNTS[solidId])
    })
  })
})

describe('random tree generation', () => {
  SOLIDS.forEach((solidId) => {
    it(`${solidId} random tree is connected with F-1 edges`, () => {
      const solid = getSolid(solidId)
      const tree = generateRandomTree(solid, () => 0.42)

      expect(tree.treeEdges).toHaveLength(solid.faces.length - 1)

      let parentCount = 0
      tree.parentByFace.forEach((parentFace, faceIndex) => {
        if (faceIndex === tree.root) {
          expect(parentFace).toBe(-1)
          return
        }

        expect(parentFace).toBeGreaterThanOrEqual(0)
        parentCount += 1
      })

      expect(parentCount).toBe(solid.faces.length - 1)
    })
  })
})

describe('unfold transform invariants', () => {
  SOLIDS.forEach((solidId) => {
    it(`${solidId} aligns all face normals with root at progress=1`, () => {
      const solid = getSolid(solidId)
      const tree = generateRandomTree(solid, () => 0.27)
      const matrices = computeFaceMatrices(solid, tree, 1)

      const rootNormal = applyMatrixToNormal(faceNormal(solid, tree.root), matrices[tree.root])

      matrices.forEach((matrix, faceIndex) => {
        const transformedNormal = applyMatrixToNormal(faceNormal(solid, faceIndex), matrix)
        const alignment = transformedNormal.dot(rootNormal)
        expect(alignment).toBeGreaterThan(0.999)
      })
    })
  })
})

describe('overlap-aware tree search', () => {
  SOLIDS.forEach((solidId, index) => {
    it(`${solidId} finds a low-overlap unfolded net candidate`, () => {
      const solid = getSolid(solidId)
      const tree = generateRandomTree(solid, seededRng(100 + index))
      const overlapScore = computeTreeOverlapScore(solid, tree)
      expect(overlapScore).toBeLessThan(0.0001)
    })
  })
})
