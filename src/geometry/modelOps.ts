import * as THREE from 'three'
import { clamp, vec3ToThree } from './math'
import type { SolidDefinition, Vec3 } from '../types'

function cloneDefinition(definition: SolidDefinition): SolidDefinition {
  return {
    id: definition.id,
    vertices: definition.vertices.map((point) => [...point] as Vec3),
    faces: definition.faces.map((face) => [...face]),
  }
}

function normalizeFaceWindings(definition: SolidDefinition): SolidDefinition {
  const centroid = definition.vertices
    .reduce((sum, point) => sum.add(vec3ToThree(point)), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(definition.vertices.length, 1))

  const faces = definition.faces.map((face) => {
    if (face.length < 3) {
      return [...face]
    }

    const a = vec3ToThree(definition.vertices[face[0]])
    const b = vec3ToThree(definition.vertices[face[1]])
    const c = vec3ToThree(definition.vertices[face[2]])
    const faceCenter = face
      .reduce((sum, index) => sum.add(vec3ToThree(definition.vertices[index])), new THREE.Vector3())
      .multiplyScalar(1 / face.length)

    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize()

    return normal.dot(new THREE.Vector3().subVectors(faceCenter, centroid)) < 0 ? [...face].reverse() : [...face]
  })

  return {
    id: definition.id,
    vertices: definition.vertices.map((point) => [...point] as Vec3),
    faces,
  }
}

function averageEdgeLength(definition: SolidDefinition): number {
  const uniqueEdgeKeys = new Set<string>()
  let edgeCount = 0
  let lengthSum = 0

  definition.faces.forEach((face) => {
    for (let i = 0; i < face.length; i += 1) {
      const a = face[i]
      const b = face[(i + 1) % face.length]
      const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`
      if (uniqueEdgeKeys.has(edgeKey)) {
        continue
      }

      uniqueEdgeKeys.add(edgeKey)
      const length = vec3ToThree(definition.vertices[a]).distanceTo(vec3ToThree(definition.vertices[b]))
      lengthSum += length
      edgeCount += 1
    }
  })

  return edgeCount > 0 ? lengthSum / edgeCount : 1
}

export function applyStellation(definition: SolidDefinition, rawAmount: number): SolidDefinition {
  if (!Number.isFinite(rawAmount) || Math.abs(rawAmount) < 0.000001) {
    return cloneDefinition(definition)
  }

  const amount = clamp(rawAmount, -1, 1)
  const edgeLength = averageEdgeLength(definition)
  const height = amount * edgeLength * 0.75

  const vertices = definition.vertices.map((point) => [...point] as Vec3)
  const faces: number[][] = []

  definition.faces.forEach((face) => {
    if (face.length < 3) {
      return
    }

    const centroid = face
      .reduce((sum, index) => sum.add(vec3ToThree(definition.vertices[index])), new THREE.Vector3())
      .multiplyScalar(1 / face.length)

    const a = vec3ToThree(definition.vertices[face[0]])
    const b = vec3ToThree(definition.vertices[face[1]])
    const c = vec3ToThree(definition.vertices[face[2]])
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize()

    const apex = centroid.add(normal.multiplyScalar(height))
    const apexIndex = vertices.push([apex.x, apex.y, apex.z]) - 1

    for (let i = 0; i < face.length; i += 1) {
      const left = face[i]
      const right = face[(i + 1) % face.length]
      faces.push([left, right, apexIndex])
    }
  })

  return normalizeFaceWindings({
    id: definition.id,
    vertices,
    faces,
  })
}

export function applyTruncation(definition: SolidDefinition, rawAmount: number): SolidDefinition {
  if (!Number.isFinite(rawAmount) || rawAmount <= 0.000001) {
    return cloneDefinition(definition)
  }

  const amount = clamp(rawAmount, 0, 0.49)
  const epsilon = 0.000001

  interface Incidence {
    prev: number
    next: number
  }

  interface CutPlane {
    normal: THREE.Vector3
    point: THREE.Vector3
    vertexDistance: number
    neighbors: number[]
  }

  const incidentByVertex = Array.from({ length: definition.vertices.length }, () => [] as Incidence[])
  const neighborSetsByVertex = Array.from({ length: definition.vertices.length }, () => new Set<number>())

  definition.faces.forEach((face) => {
    for (let i = 0; i < face.length; i += 1) {
      const current = face[i]
      const prev = face[(i - 1 + face.length) % face.length]
      const next = face[(i + 1) % face.length]
      incidentByVertex[current].push({ prev, next })
      neighborSetsByVertex[current].add(prev)
      neighborSetsByVertex[current].add(next)
    }
  })

  const solidCentroid = definition.vertices
    .reduce((sum, point) => sum.add(vec3ToThree(point)), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(definition.vertices.length, 1))

  const cutPlaneByVertex = new Map<number, CutPlane>()

  definition.vertices.forEach((vertex, vertexIndex) => {
    const neighbors = [...neighborSetsByVertex[vertexIndex]]
    if (neighbors.length < 3) {
      return
    }

    const vertexPoint = vec3ToThree(vertex)
    const directionSum = new THREE.Vector3()
    let minIncidentEdgeLength = Number.POSITIVE_INFINITY

    neighbors.forEach((neighborIndex) => {
      const neighborPoint = vec3ToThree(definition.vertices[neighborIndex])
      const incoming = vertexPoint.clone().sub(neighborPoint)
      const edgeLength = incoming.length()

      minIncidentEdgeLength = Math.min(minIncidentEdgeLength, edgeLength)
      if (edgeLength > epsilon) {
        directionSum.add(incoming.multiplyScalar(1 / edgeLength))
      }
    })

    if (directionSum.lengthSq() <= epsilon || !Number.isFinite(minIncidentEdgeLength)) {
      return
    }

    const normal = directionSum.normalize()
    if (normal.dot(vertexPoint.clone().sub(solidCentroid)) < 0) {
      normal.multiplyScalar(-1)
    }

    const planeDistance = amount * minIncidentEdgeLength
    if (planeDistance <= epsilon) {
      return
    }

    const planePoint = vertexPoint.clone().addScaledVector(normal, -planeDistance)
    const vertexDistance = normal.dot(vertexPoint.clone().sub(planePoint))

    let isConvex = true
    for (const incident of incidentByVertex[vertexIndex]) {
      const prevDistance = normal.dot(vec3ToThree(definition.vertices[incident.prev]).sub(planePoint))
      const nextDistance = normal.dot(vec3ToThree(definition.vertices[incident.next]).sub(planePoint))
      if (prevDistance > epsilon || nextDistance > epsilon) {
        isConvex = false
        break
      }
    }

    if (!isConvex) {
      return
    }

    for (const neighborIndex of neighbors) {
      const neighborDistance = normal.dot(vec3ToThree(definition.vertices[neighborIndex]).sub(planePoint))
      const denominator = vertexDistance - neighborDistance
      if (neighborDistance > -epsilon || denominator <= epsilon) {
        isConvex = false
        break
      }

      const t = vertexDistance / denominator
      if (!Number.isFinite(t) || t <= epsilon || t >= 1 - epsilon) {
        isConvex = false
        break
      }
    }

    if (!isConvex) {
      return
    }

    cutPlaneByVertex.set(vertexIndex, {
      normal,
      point: planePoint,
      vertexDistance,
      neighbors,
    })
  })

  if (cutPlaneByVertex.size === 0) {
    return cloneDefinition(definition)
  }

  const vertices = definition.vertices.map((point) => [...point] as Vec3)
  const edgePointByKey = new Map<string, number>()

  function edgeKey(start: number, end: number): string {
    return `${start}|${end}`
  }

  function getEdgePointIndex(start: number, end: number): number {
    const key = edgeKey(start, end)
    const existing = edgePointByKey.get(key)
    if (existing !== undefined) {
      return existing
    }

    const cutPlane = cutPlaneByVertex.get(start)
    if (!cutPlane) {
      edgePointByKey.set(key, start)
      return start
    }

    const startPoint = vec3ToThree(definition.vertices[start])
    const endPoint = vec3ToThree(definition.vertices[end])
    const endDistance = cutPlane.normal.dot(endPoint.clone().sub(cutPlane.point))
    const denominator = cutPlane.vertexDistance - endDistance

    if (denominator <= epsilon) {
      edgePointByKey.set(key, start)
      return start
    }

    const t = cutPlane.vertexDistance / denominator
    if (!Number.isFinite(t) || t < 0 || t > 1) {
      edgePointByKey.set(key, start)
      return start
    }

    const point = startPoint.clone().lerp(endPoint, t)
    const index = vertices.push([point.x, point.y, point.z]) - 1
    edgePointByKey.set(key, index)
    return index
  }

  function cleanPolygonIndices(face: number[]): number[] {
    const deduped: number[] = []
    face.forEach((index) => {
      const last = deduped[deduped.length - 1]
      if (last !== index) {
        deduped.push(index)
      }
    })

    if (deduped.length > 1 && deduped[0] === deduped[deduped.length - 1]) {
      deduped.pop()
    }

    return deduped
  }

  const faces: number[][] = []

  definition.faces.forEach((face) => {
    if (face.length < 3) {
      return
    }

    const rebuilt: number[] = []
    for (let i = 0; i < face.length; i += 1) {
      const current = face[i]
      const prev = face[(i - 1 + face.length) % face.length]
      const next = face[(i + 1) % face.length]

      if (cutPlaneByVertex.has(current)) {
        rebuilt.push(getEdgePointIndex(current, prev))
        rebuilt.push(getEdgePointIndex(current, next))
      } else {
        rebuilt.push(current)
      }
    }

    const cleaned = cleanPolygonIndices(rebuilt)
    if (cleaned.length >= 3) {
      faces.push(cleaned)
    }
  })

  cutPlaneByVertex.forEach((cutPlane, vertexIndex) => {
    const capIndices = Array.from(
      new Set(cutPlane.neighbors.map((neighborIndex) => getEdgePointIndex(vertexIndex, neighborIndex))),
    )

    if (capIndices.length < 3) {
      return
    }

    const axis = cutPlane.normal.clone().normalize()
    const helper = Math.abs(axis.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
    const basisU = new THREE.Vector3().crossVectors(helper, axis).normalize()
    const basisV = new THREE.Vector3().crossVectors(axis, basisU).normalize()

    const sorted = [...capIndices].sort((leftIndex, rightIndex) => {
      const leftLocal = vec3ToThree(vertices[leftIndex]).sub(cutPlane.point)
      const rightLocal = vec3ToThree(vertices[rightIndex]).sub(cutPlane.point)
      const leftAngle = Math.atan2(leftLocal.dot(basisV), leftLocal.dot(basisU))
      const rightAngle = Math.atan2(rightLocal.dot(basisV), rightLocal.dot(basisU))
      return leftAngle - rightAngle
    })

    const cleaned = cleanPolygonIndices(sorted)
    if (cleaned.length < 3) {
      return
    }

    const p0 = vec3ToThree(vertices[cleaned[0]])
    const p1 = vec3ToThree(vertices[cleaned[1]])
    const p2 = vec3ToThree(vertices[cleaned[2]])
    const polygonNormal = new THREE.Vector3()
      .subVectors(p1, p0)
      .cross(new THREE.Vector3().subVectors(p2, p0))
      .normalize()

    faces.push(polygonNormal.dot(axis) < 0 ? [...cleaned].reverse() : cleaned)
  })

  const usedVertexIndices = new Set<number>()
  faces.forEach((face) => {
    face.forEach((index) => usedVertexIndices.add(index))
  })

  const sortedUsedVertexIndices = [...usedVertexIndices].sort((a, b) => a - b)
  const remap = new Map<number, number>()
  const compactVertices = sortedUsedVertexIndices.map((oldIndex, newIndex) => {
    remap.set(oldIndex, newIndex)
    return [...vertices[oldIndex]] as Vec3
  })

  const compactFaces = faces.map((face) => face.map((oldIndex) => remap.get(oldIndex) ?? 0))

  return normalizeFaceWindings({
    id: definition.id,
    vertices: compactVertices,
    faces: compactFaces,
  })
}
