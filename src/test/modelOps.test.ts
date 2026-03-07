import { describe, expect, it } from 'vitest'
import { getSolid } from '../data/solids'
import { applyStellation, applyTruncation } from '../geometry/modelOps'
import { generateRandomTree } from '../geometry/unfoldTree'

describe('model operations', () => {
  it('stellation triangulates every base face', () => {
    const cube = getSolid('cube')
    const stellated = applyStellation(cube, 0.3)

    expect(stellated.faces).toHaveLength(24)
    stellated.faces.forEach((face) => {
      expect(face).toHaveLength(3)
    })
  })

  it('stellation supports negative values', () => {
    const cube = getSolid('cube')
    const stellated = applyStellation(cube, -0.25)
    expect(stellated.faces).toHaveLength(24)
  })

  it('stellation can be applied repeatedly', () => {
    const cube = getSolid('cube')
    const once = applyStellation(cube, 0.2)
    const twice = applyStellation(once, 0.2)

    expect(once.faces).toHaveLength(24)
    expect(twice.faces).toHaveLength(72)
  })

  it('truncation on cube creates 6 face-polygons plus 8 vertex caps', () => {
    const cube = getSolid('cube')
    const truncated = applyTruncation(cube, 0.2)
    expect(truncated.faces).toHaveLength(14)

    const facesBySize = truncated.faces.reduce((counts, face) => {
      counts.set(face.length, (counts.get(face.length) ?? 0) + 1)
      return counts
    }, new Map<number, number>())

    expect(facesBySize.get(8)).toBe(6)
    expect(facesBySize.get(3)).toBe(8)
  })

  it('truncation on tetrahedron creates 8 total faces', () => {
    const tetra = getSolid('tetrahedron')
    const truncated = applyTruncation(tetra, 0.22)
    expect(truncated.faces).toHaveLength(8)

    const facesBySize = truncated.faces.reduce((counts, face) => {
      counts.set(face.length, (counts.get(face.length) ?? 0) + 1)
      return counts
    }, new Map<number, number>())

    expect(facesBySize.get(6)).toBe(4)
    expect(facesBySize.get(3)).toBe(4)
  })

  it('truncation can be applied repeatedly', () => {
    const cube = getSolid('cube')
    const once = applyTruncation(cube, 0.3)
    const twice = applyTruncation(once, 0.3)

    expect(twice.faces.length).toBeGreaterThan(once.faces.length)
    expect(twice.vertices.length).toBeGreaterThan(once.vertices.length)
  })

  it('supports mixed operation sequences in order', () => {
    const base = getSolid('cube')
    const mixed = applyStellation(applyTruncation(applyStellation(base, 0.2), 0.1), -0.15)

    expect(mixed.faces.length).toBeGreaterThan(0)
    expect(mixed.vertices.length).toBeGreaterThan(0)
    mixed.vertices.forEach((vertex) => {
      vertex.forEach((coordinate) => {
        expect(Number.isFinite(coordinate)).toBe(true)
      })
    })
  })

  it('all generated vertices are finite numbers', () => {
    const base = getSolid('dodecahedron')
    const transformed = applyTruncation(applyStellation(base, 0.35), 0.15)

    transformed.vertices.forEach((vertex) => {
      vertex.forEach((coordinate) => {
        expect(Number.isFinite(coordinate)).toBe(true)
      })
    })
  })

  it('stellated models remain unfold-tree compatible', () => {
    const base = getSolid('cube')
    const transformed = applyStellation(base, 0.3)
    const tree = generateRandomTree(transformed, () => 0.41)
    expect(tree.treeEdges).toHaveLength(transformed.faces.length - 1)
  })
})
