import type { FaceAdjacency, SolidDefinition } from '../types'

interface EdgeRecord {
  faceIndex: number
}

function canonicalEdgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function canonicalEdge(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a]
}

export function buildAdjacency(definition: SolidDefinition): FaceAdjacency[] {
  const edgeMap = new Map<string, EdgeRecord>()
  const adjacency: FaceAdjacency[] = []

  definition.faces.forEach((face, faceIndex) => {
    for (let i = 0; i < face.length; i += 1) {
      const a = face[i]
      const b = face[(i + 1) % face.length]
      const key = canonicalEdgeKey(a, b)
      const existing = edgeMap.get(key)

      if (!existing) {
        edgeMap.set(key, { faceIndex })
        continue
      }

      adjacency.push({
        faceA: existing.faceIndex,
        faceB: faceIndex,
        edge: canonicalEdge(a, b),
      })
    }
  })

  return adjacency
}
