import * as THREE from 'three'
import type { SolidDefinition, SolidId, Vec3 } from '../types'

const PHI = (1 + Math.sqrt(5)) / 2
const ICOSA_VERTICES: Vec3[] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1],
]

const ICOSA_FACES: [number, number, number][] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
]

function toVector3(point: Vec3): THREE.Vector3 {
  return new THREE.Vector3(point[0], point[1], point[2])
}

function fromVector3(point: THREE.Vector3): Vec3 {
  return [point.x, point.y, point.z]
}

function normalizeFaceWindings(definition: SolidDefinition): SolidDefinition {
  const centroid = definition.vertices
    .reduce((sum, point) => sum.add(toVector3(point)), new THREE.Vector3())
    .multiplyScalar(1 / definition.vertices.length)

  const normalizedFaces = definition.faces.map((face) => {
    if (face.length < 3) {
      return [...face]
    }

    const a = toVector3(definition.vertices[face[0]])
    const b = toVector3(definition.vertices[face[1]])
    const c = toVector3(definition.vertices[face[2]])
    const faceCenter = face
      .reduce((sum, index) => sum.add(toVector3(definition.vertices[index])), new THREE.Vector3())
      .multiplyScalar(1 / face.length)

    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize()

    const outwardHint = new THREE.Vector3().subVectors(faceCenter, centroid)
    if (normal.dot(outwardHint) < 0) {
      return [...face].reverse()
    }

    return [...face]
  })

  return {
    id: definition.id,
    vertices: definition.vertices.map((point) => [...point] as Vec3),
    faces: normalizedFaces,
  }
}

function buildDodecahedron(): SolidDefinition {
  const faceCenters = ICOSA_FACES.map(([a, b, c]) => {
    const va = toVector3(ICOSA_VERTICES[a])
    const vb = toVector3(ICOSA_VERTICES[b])
    const vc = toVector3(ICOSA_VERTICES[c])
    return va.add(vb).add(vc).multiplyScalar(1 / 3)
  })

  const incidentFacesByVertex = Array.from({ length: ICOSA_VERTICES.length }, () => [] as number[])
  ICOSA_FACES.forEach((face, faceIndex) => {
    for (const vertexIndex of face) {
      incidentFacesByVertex[vertexIndex].push(faceIndex)
    }
  })

  const dodecaFaces = incidentFacesByVertex.map((incidentFaceIndices, vertexIndex) => {
    const axis = toVector3(ICOSA_VERTICES[vertexIndex]).normalize()
    const helper = Math.abs(axis.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
    const basisU = new THREE.Vector3().crossVectors(helper, axis).normalize()
    const basisV = new THREE.Vector3().crossVectors(axis, basisU).normalize()

    return [...incidentFaceIndices].sort((leftFaceIndex, rightFaceIndex) => {
      const leftPoint = faceCenters[leftFaceIndex]
      const rightPoint = faceCenters[rightFaceIndex]

      const leftProjected = leftPoint.clone().sub(axis.clone().multiplyScalar(leftPoint.dot(axis)))
      const rightProjected = rightPoint.clone().sub(axis.clone().multiplyScalar(rightPoint.dot(axis)))

      const leftAngle = Math.atan2(leftProjected.dot(basisV), leftProjected.dot(basisU))
      const rightAngle = Math.atan2(rightProjected.dot(basisV), rightProjected.dot(basisU))
      return leftAngle - rightAngle
    })
  })

  const definition: SolidDefinition = {
    id: 'dodecahedron',
    vertices: faceCenters.map(fromVector3),
    faces: dodecaFaces,
  }

  return normalizeFaceWindings(definition)
}

const CUBE: SolidDefinition = normalizeFaceWindings({
  id: 'cube',
  vertices: [
    [-1, -1, -1],
    [1, -1, -1],
    [-1, 1, -1],
    [1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [-1, 1, 1],
    [1, 1, 1],
  ],
  faces: [
    [0, 1, 3, 2],
    [4, 6, 7, 5],
    [0, 2, 6, 4],
    [1, 5, 7, 3],
    [0, 4, 5, 1],
    [2, 3, 7, 6],
  ],
})

const TETRAHEDRON: SolidDefinition = normalizeFaceWindings({
  id: 'tetrahedron',
  vertices: [
    [1, 1, 1],
    [-1, -1, 1],
    [-1, 1, -1],
    [1, -1, -1],
  ],
  faces: [
    [0, 1, 2],
    [0, 3, 1],
    [0, 2, 3],
    [1, 3, 2],
  ],
})

const OCTAHEDRON: SolidDefinition = normalizeFaceWindings({
  id: 'octahedron',
  vertices: [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ],
  faces: [
    [0, 2, 4],
    [2, 1, 4],
    [1, 3, 4],
    [3, 0, 4],
    [2, 0, 5],
    [1, 2, 5],
    [3, 1, 5],
    [0, 3, 5],
  ],
})

const ICOSAHEDRON: SolidDefinition = normalizeFaceWindings({
  id: 'icosahedron',
  vertices: ICOSA_VERTICES,
  faces: ICOSA_FACES.map((face) => [...face]),
})

const DODECAHEDRON = buildDodecahedron()

const SOLID_MAP: Record<SolidId, SolidDefinition> = {
  tetrahedron: TETRAHEDRON,
  cube: CUBE,
  octahedron: OCTAHEDRON,
  dodecahedron: DODECAHEDRON,
  icosahedron: ICOSAHEDRON,
}

export function getSolid(id: SolidId): SolidDefinition {
  const selected = SOLID_MAP[id]
  return {
    id: selected.id,
    vertices: selected.vertices.map((point) => [...point] as Vec3),
    faces: selected.faces.map((face) => [...face]),
  }
}

export function getSolidOptions(): Array<{ id: SolidId; label: string }> {
  return [
    { id: 'tetrahedron', label: 'Tetrahedron' },
    { id: 'cube', label: 'Cube' },
    { id: 'octahedron', label: 'Octahedron' },
    { id: 'dodecahedron', label: 'Dodecahedron' },
    { id: 'icosahedron', label: 'Icosahedron' },
  ]
}
