import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { getSolid } from '../data/solids'
import { buildObjText } from '../export/modelExport'

describe('model export', () => {
  it('buildObjText emits a vertex for each exported face corner and a face line per face', () => {
    const cube = getSolid('cube')
    const matrices = cube.faces.map(() => new THREE.Matrix4().identity())
    const objText = buildObjText(cube, matrices)

    const lines = objText.trim().split('\n')
    const vertexLines = lines.filter((line) => line.startsWith('v '))
    const faceLines = lines.filter((line) => line.startsWith('f '))

    const expectedVertexCount = cube.faces.reduce((sum, face) => sum + face.length, 0)

    expect(vertexLines).toHaveLength(expectedVertexCount)
    expect(faceLines).toHaveLength(cube.faces.length)
  })

  it('buildObjText applies provided face matrices', () => {
    const cube = getSolid('cube')
    const matrices = cube.faces.map((_, faceIndex) => new THREE.Matrix4().makeTranslation(faceIndex + 1, 0, 0))
    const objText = buildObjText(cube, matrices)

    const firstVertexLine = objText
      .split('\n')
      .find((line) => line.startsWith('v '))

    expect(firstVertexLine).toBeTruthy()

    const parts = (firstVertexLine ?? '').trim().split(/\s+/)
    const exportedX = Number(parts[1])
    const baseX = cube.vertices[cube.faces[0][0]][0]
    expect(exportedX).toBeCloseTo(baseX + 1, 5)
  })
})
