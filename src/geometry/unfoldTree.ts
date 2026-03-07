import * as THREE from 'three'
import { buildAdjacency } from './adjacency'
import { applyMatrixToNormal, clamp, faceNormal, threeToVec3, vec3ToThree } from './math'
import { computeFaceMatrices } from './transforms'
import type { SolidDefinition, TreeEdge, UnfoldTree } from '../types'

interface Neighbor {
  face: number
  edge: [number, number]
}

interface ProjectedFace {
  points: THREE.Vector2[]
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

function computeTreeEdge(
  definition: SolidDefinition,
  parentFace: number,
  childFace: number,
  edge: [number, number],
): TreeEdge {
  const pivot = vec3ToThree(definition.vertices[edge[0]])
  const axis = vec3ToThree(definition.vertices[edge[1]]).sub(pivot).normalize()

  const parentNormal = faceNormal(definition, parentFace)
  const childNormal = faceNormal(definition, childFace)

  const angle = Math.acos(clamp(parentNormal.dot(childNormal), -1, 1))

  const positiveRotation = new THREE.Quaternion().setFromAxisAngle(axis, angle)
  const negativeRotation = new THREE.Quaternion().setFromAxisAngle(axis, -angle)

  const positiveScore = childNormal.clone().applyQuaternion(positiveRotation).dot(parentNormal)
  const negativeScore = childNormal.clone().applyQuaternion(negativeRotation).dot(parentNormal)

  const sign: 1 | -1 = positiveScore >= negativeScore ? 1 : -1

  return {
    parent: parentFace,
    child: childFace,
    edge,
    pivot: threeToVec3(pivot),
    axis: threeToVec3(axis),
    angle,
    sign,
  }
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function polygonSignedArea(points: THREE.Vector2[]): number {
  if (points.length < 3) {
    return 0
  }

  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }

  return area * 0.5
}

function ensureCounterClockwise(points: THREE.Vector2[]): THREE.Vector2[] {
  return polygonSignedArea(points) < 0 ? [...points].reverse() : points
}

function intersectLines(
  segmentStart: THREE.Vector2,
  segmentEnd: THREE.Vector2,
  clipStart: THREE.Vector2,
  clipEnd: THREE.Vector2,
): THREE.Vector2 {
  const segmentDirection = segmentEnd.clone().sub(segmentStart)
  const clipDirection = clipEnd.clone().sub(clipStart)
  const denominator = segmentDirection.x * clipDirection.y - segmentDirection.y * clipDirection.x

  if (Math.abs(denominator) < 0.0000001) {
    return segmentStart.clone().add(segmentEnd).multiplyScalar(0.5)
  }

  const offset = clipStart.clone().sub(segmentStart)
  const t = (offset.x * clipDirection.y - offset.y * clipDirection.x) / denominator
  return segmentStart.clone().add(segmentDirection.multiplyScalar(t))
}

function isInsideHalfPlane(
  point: THREE.Vector2,
  clipStart: THREE.Vector2,
  clipEnd: THREE.Vector2,
  epsilon: number,
): boolean {
  const edge = clipEnd.clone().sub(clipStart)
  const rel = point.clone().sub(clipStart)
  return edge.x * rel.y - edge.y * rel.x >= -epsilon
}

function clipConvexPolygon(
  subjectPolygon: THREE.Vector2[],
  clipPolygon: THREE.Vector2[],
  epsilon: number,
): THREE.Vector2[] {
  let output = [...subjectPolygon]

  for (let i = 0; i < clipPolygon.length; i += 1) {
    const clipStart = clipPolygon[i]
    const clipEnd = clipPolygon[(i + 1) % clipPolygon.length]
    const input = output
    output = []

    if (input.length === 0) {
      break
    }

    let previousPoint = input[input.length - 1]
    let previousInside = isInsideHalfPlane(previousPoint, clipStart, clipEnd, epsilon)

    input.forEach((currentPoint) => {
      const currentInside = isInsideHalfPlane(currentPoint, clipStart, clipEnd, epsilon)

      if (currentInside) {
        if (!previousInside) {
          output.push(intersectLines(previousPoint, currentPoint, clipStart, clipEnd))
        }
        output.push(currentPoint.clone())
      } else if (previousInside) {
        output.push(intersectLines(previousPoint, currentPoint, clipStart, clipEnd))
      }

      previousPoint = currentPoint
      previousInside = currentInside
    })
  }

  return output
}

function convexIntersectionArea(a: THREE.Vector2[], b: THREE.Vector2[]): number {
  if (a.length < 3 || b.length < 3) {
    return 0
  }

  const clipped = clipConvexPolygon(a, b, 0.000001)
  if (clipped.length < 3) {
    return 0
  }

  return Math.abs(polygonSignedArea(clipped))
}

function projectTreeFaces(definition: SolidDefinition, tree: UnfoldTree): ProjectedFace[] {
  const matrices = computeFaceMatrices(definition, tree, 1)
  const root = tree.root >= 0 && tree.root < definition.faces.length ? tree.root : 0
  const rootMatrix = matrices[root] ?? new THREE.Matrix4().identity()
  const rootNormal = applyMatrixToNormal(faceNormal(definition, root), rootMatrix).normalize()

  const helper = Math.abs(rootNormal.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const basisU = new THREE.Vector3().crossVectors(helper, rootNormal).normalize()
  const basisV = new THREE.Vector3().crossVectors(rootNormal, basisU).normalize()

  const rootFace = definition.faces[root] ?? []
  const rootOrigin = rootFace
    .reduce((sum, vertexIndex) => {
      const transformed = vec3ToThree(definition.vertices[vertexIndex]).applyMatrix4(rootMatrix)
      return sum.add(transformed)
    }, new THREE.Vector3())
    .multiplyScalar(rootFace.length > 0 ? 1 / rootFace.length : 1)

  return definition.faces.map((face, faceIndex) => {
    const matrix = matrices[faceIndex] ?? new THREE.Matrix4().identity()
    const points = ensureCounterClockwise(
      face.map((vertexIndex) => {
        const transformed = vec3ToThree(definition.vertices[vertexIndex]).applyMatrix4(matrix)
        const local = transformed.sub(rootOrigin)
        return new THREE.Vector2(local.dot(basisU), local.dot(basisV))
      }),
    )

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    points.forEach((point) => {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    })

    return {
      points,
      minX,
      maxX,
      minY,
      maxY,
    }
  })
}

export function computeTreeOverlapScore(definition: SolidDefinition, tree: UnfoldTree): number {
  const projectedFaces = projectTreeFaces(definition, tree)
  const hingePairs = new Set<string>()
  tree.treeEdges.forEach(({ parent, child }) => {
    hingePairs.add(pairKey(parent, child))
  })

  let score = 0
  for (let a = 0; a < projectedFaces.length; a += 1) {
    for (let b = a + 1; b < projectedFaces.length; b += 1) {
      if (hingePairs.has(pairKey(a, b))) {
        continue
      }

      const faceA = projectedFaces[a]
      const faceB = projectedFaces[b]

      if (faceA.maxX <= faceB.minX || faceB.maxX <= faceA.minX || faceA.maxY <= faceB.minY || faceB.maxY <= faceA.minY) {
        continue
      }

      const overlapArea = convexIntersectionArea(faceA.points, faceB.points)
      if (overlapArea > 0.000001) {
        score += overlapArea
      }
    }
  }

  return score
}

function buildRandomTreeFromRoot(
  definition: SolidDefinition,
  neighborsByFace: Neighbor[][],
  root: number,
  rng: () => number,
): UnfoldTree {
  const faceCount = definition.faces.length
  const parentByFace = Array.from({ length: faceCount }, () => -1)
  const treeEdges: TreeEdge[] = []

  const visited = new Set<number>([root])
  const stack = [root]

  while (stack.length > 0) {
    const currentFace = stack.pop() as number
    const randomizedNeighbors = shuffle(neighborsByFace[currentFace], rng)

    randomizedNeighbors.forEach(({ face: neighborFace, edge }) => {
      if (visited.has(neighborFace)) {
        return
      }

      visited.add(neighborFace)
      parentByFace[neighborFace] = currentFace
      treeEdges.push(computeTreeEdge(definition, currentFace, neighborFace, edge))
      stack.push(neighborFace)
    })
  }

  if (visited.size !== faceCount) {
    throw new Error('Failed to generate a connected unfold tree for the selected solid.')
  }

  return {
    root,
    treeEdges,
    parentByFace,
  }
}

function candidateAttemptCount(faceCount: number): number {
  if (faceCount <= 12) {
    return 70
  }

  if (faceCount <= 30) {
    return 45
  }

  if (faceCount <= 60) {
    return 25
  }

  return 14
}

export function generateRandomTree(definition: SolidDefinition, rng: () => number = Math.random): UnfoldTree {
  const faceCount = definition.faces.length
  const adjacency = buildAdjacency(definition)

  const neighborsByFace = Array.from({ length: faceCount }, () => [] as Neighbor[])
  adjacency.forEach(({ faceA, faceB, edge }) => {
    neighborsByFace[faceA].push({ face: faceB, edge })
    neighborsByFace[faceB].push({ face: faceA, edge })
  })

  const attempts = candidateAttemptCount(faceCount)
  let bestTree: UnfoldTree | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const root = Math.floor(rng() * faceCount)
    const candidateTree = buildRandomTreeFromRoot(definition, neighborsByFace, root, rng)
    const overlapScore = computeTreeOverlapScore(definition, candidateTree)

    if (overlapScore < bestScore) {
      bestTree = candidateTree
      bestScore = overlapScore
    }

    if (bestScore <= 0.000001) {
      break
    }
  }

  if (!bestTree) {
    throw new Error('Failed to generate a candidate unfold tree for the selected solid.')
  }

  return bestTree
}
