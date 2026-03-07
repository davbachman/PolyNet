import * as THREE from 'three'
import { applyMatrixToNormal, faceNormal, vec3ToThree } from '../geometry/math'
import { computeFaceMatrices } from '../geometry/transforms'
import type { SolidDefinition, UnfoldTree } from '../types'

const FACE_COLORS = ['#20639b', '#3caea3', '#f6d55c', '#ed553b', '#173f5f', '#58a4b0', '#f08a5d']

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6) : '0.000000'
}

function slugify(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return cleaned.length > 0 ? cleaned : 'model'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function buildObjText(solid: SolidDefinition, matrices: THREE.Matrix4[]): string {
  const lines: string[] = ['# PolyNet OBJ export']
  let nextVertexIndex = 1
  const identity = new THREE.Matrix4().identity()

  solid.faces.forEach((face, faceIndex) => {
    const matrix = matrices[faceIndex] ?? identity
    const faceIndices: number[] = []

    face.forEach((vertexIndex) => {
      const transformed = vec3ToThree(solid.vertices[vertexIndex]).applyMatrix4(matrix)
      lines.push(`v ${formatNumber(transformed.x)} ${formatNumber(transformed.y)} ${formatNumber(transformed.z)}`)
      faceIndices.push(nextVertexIndex)
      nextVertexIndex += 1
    })

    lines.push(`f ${faceIndices.join(' ')}`)
  })

  return `${lines.join('\n')}\n`
}

export function exportObjFile(solid: SolidDefinition, matrices: THREE.Matrix4[], filenameBase: string): void {
  const text = buildObjText(solid, matrices)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  downloadBlob(blob, `${slugify(filenameBase)}.obj`)
}

interface ProjectedFace {
  points: Array<[number, number]>
  color: string
}

interface ProjectionResult {
  faces: ProjectedFace[]
  minU: number
  maxU: number
  minV: number
  maxV: number
}

function projectUnfoldedFaces(solid: SolidDefinition, tree: UnfoldTree): ProjectionResult {
  const matrices = computeFaceMatrices(solid, tree, 1)
  const identity = new THREE.Matrix4().identity()
  const rootIndex = tree.root >= 0 && tree.root < solid.faces.length ? tree.root : 0
  const rootMatrix = matrices[rootIndex] ?? identity
  const rootNormal = applyMatrixToNormal(faceNormal(solid, rootIndex), rootMatrix).normalize()

  const helper = Math.abs(rootNormal.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const basisU = new THREE.Vector3().crossVectors(helper, rootNormal).normalize()
  const basisV = new THREE.Vector3().crossVectors(rootNormal, basisU).normalize()

  const rootFace = solid.faces[rootIndex] ?? []
  const origin = rootFace
    .reduce((sum, vertexIndex) => {
      const matrix = matrices[rootIndex] ?? identity
      return sum.add(vec3ToThree(solid.vertices[vertexIndex]).applyMatrix4(matrix))
    }, new THREE.Vector3())
    .multiplyScalar(rootFace.length > 0 ? 1 / rootFace.length : 1)

  let minU = Number.POSITIVE_INFINITY
  let maxU = Number.NEGATIVE_INFINITY
  let minV = Number.POSITIVE_INFINITY
  let maxV = Number.NEGATIVE_INFINITY

  const faces: ProjectedFace[] = solid.faces.map((face, faceIndex) => {
    const matrix = matrices[faceIndex] ?? identity
    const points = face.map((vertexIndex) => {
      const worldPoint = vec3ToThree(solid.vertices[vertexIndex]).applyMatrix4(matrix)
      const local = worldPoint.sub(origin)
      const u = local.dot(basisU)
      const v = local.dot(basisV)
      minU = Math.min(minU, u)
      maxU = Math.max(maxU, u)
      minV = Math.min(minV, v)
      maxV = Math.max(maxV, v)
      return [u, v] as [number, number]
    })

    return {
      points,
      color: FACE_COLORS[faceIndex % FACE_COLORS.length],
    }
  })

  if (!Number.isFinite(minU) || !Number.isFinite(maxU) || !Number.isFinite(minV) || !Number.isFinite(maxV)) {
    minU = 0
    maxU = 1
    minV = 0
    maxV = 1
  }

  return { faces, minU, maxU, minV, maxV }
}

export async function exportUnfoldedPng(solid: SolidDefinition, tree: UnfoldTree, filenameBase: string): Promise<void> {
  const projection = projectUnfoldedFaces(solid, tree)
  const rangeU = Math.max(projection.maxU - projection.minU, 0.001)
  const rangeV = Math.max(projection.maxV - projection.minV, 0.001)
  const margin = 80
  const targetMaxDrawable = 1700
  const scale = targetMaxDrawable / Math.max(rangeU, rangeV)
  const canvasWidth = Math.max(600, Math.ceil(rangeU * scale + margin * 2))
  const canvasHeight = Math.max(600, Math.ceil(rangeV * scale + margin * 2))

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Unable to create a canvas context for PNG export.')
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvasWidth, canvasHeight)
  context.lineWidth = 2
  context.strokeStyle = '#111827'

  projection.faces.forEach((face) => {
    if (face.points.length < 3) {
      return
    }

    context.beginPath()
    face.points.forEach(([u, v], pointIndex) => {
      const x = margin + (u - projection.minU) * scale
      const y = canvasHeight - (margin + (v - projection.minV) * scale)
      if (pointIndex === 0) {
        context.moveTo(x, y)
      } else {
        context.lineTo(x, y)
      }
    })
    context.closePath()
    context.fillStyle = face.color
    context.fill()
    context.stroke()
  })

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode PNG.'))
        return
      }

      resolve(blob)
    }, 'image/png')
  })

  downloadBlob(pngBlob, `${slugify(filenameBase)}.png`)
}
