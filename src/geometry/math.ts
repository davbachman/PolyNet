import * as THREE from 'three'
import type { SolidDefinition, Vec3 } from '../types'

export interface BoundingSphereData {
  center: Vec3
  radius: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function vec3ToThree(point: Vec3): THREE.Vector3 {
  return new THREE.Vector3(point[0], point[1], point[2])
}

export function threeToVec3(point: THREE.Vector3): Vec3 {
  return [point.x, point.y, point.z]
}

export function faceNormal(definition: SolidDefinition, faceIndex: number): THREE.Vector3 {
  const face = definition.faces[faceIndex]
  if (face.length < 3) {
    return new THREE.Vector3(0, 0, 1)
  }

  const a = vec3ToThree(definition.vertices[face[0]])
  const b = vec3ToThree(definition.vertices[face[1]])
  const c = vec3ToThree(definition.vertices[face[2]])

  return new THREE.Vector3()
    .subVectors(b, a)
    .cross(new THREE.Vector3().subVectors(c, a))
    .normalize()
}

export function applyMatrixToNormal(normal: THREE.Vector3, matrix: THREE.Matrix4): THREE.Vector3 {
  const normalMatrix = new THREE.Matrix3().setFromMatrix4(matrix)
  return normal.clone().applyMatrix3(normalMatrix).normalize()
}

export function solidRadius(definition: SolidDefinition): number {
  return definition.vertices.reduce((maxRadius, point) => {
    const radius = vec3ToThree(point).length()
    return Math.max(maxRadius, radius)
  }, 0)
}

export function solidCentroid(definition: SolidDefinition): Vec3 {
  if (definition.vertices.length === 0) {
    return [0, 0, 0]
  }

  const sum = definition.vertices.reduce((acc, point) => {
    acc[0] += point[0]
    acc[1] += point[1]
    acc[2] += point[2]
    return acc
  }, [0, 0, 0] as Vec3)

  return [sum[0] / definition.vertices.length, sum[1] / definition.vertices.length, sum[2] / definition.vertices.length]
}

export function computeFaceCloudBoundingSphere(
  definition: SolidDefinition,
  matrices: THREE.Matrix4[],
): BoundingSphereData {
  const identity = new THREE.Matrix4().identity()
  const points: THREE.Vector3[] = []
  const box = new THREE.Box3()

  definition.faces.forEach((face, faceIndex) => {
    const transform = matrices[faceIndex] ?? identity
    face.forEach((vertexIndex) => {
      const transformed = vec3ToThree(definition.vertices[vertexIndex]).applyMatrix4(transform)
      points.push(transformed)
      box.expandByPoint(transformed)
    })
  })

  if (points.length === 0) {
    return { center: [0, 0, 0], radius: 0 }
  }

  const center = box.getCenter(new THREE.Vector3())
  let radius = 0
  points.forEach((point) => {
    radius = Math.max(radius, point.distanceTo(center))
  })

  return { center: threeToVec3(center), radius }
}
