import * as THREE from 'three'
import { vec3ToThree } from './math'
import type { SolidDefinition, TreeEdge, UnfoldTree } from '../types'

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0
  }

  return Math.min(1, Math.max(0, progress))
}

function rotateAroundEdge(edge: TreeEdge, theta: number): THREE.Matrix4 {
  const pivot = vec3ToThree(edge.pivot)
  const axis = vec3ToThree(edge.axis).normalize()

  const translateToOrigin = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z)
  const rotate = new THREE.Matrix4().makeRotationAxis(axis, theta)
  const translateBack = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z)

  return new THREE.Matrix4().multiplyMatrices(translateBack, new THREE.Matrix4().multiplyMatrices(rotate, translateToOrigin))
}

export function createIdentityTree(definition: SolidDefinition): UnfoldTree {
  return {
    root: 0,
    treeEdges: [],
    parentByFace: Array.from({ length: definition.faces.length }, () => -1),
  }
}

export function computeFaceMatrices(
  definition: SolidDefinition,
  tree: UnfoldTree,
  progress: number,
): THREE.Matrix4[] {
  const clampedProgress = clampProgress(progress)
  const identity = new THREE.Matrix4().identity()
  const matrices = Array.from({ length: definition.faces.length }, () => identity.clone())

  if (tree.root < 0 || tree.root >= definition.faces.length) {
    return matrices
  }

  const childrenByFace = Array.from({ length: definition.faces.length }, () => [] as TreeEdge[])
  tree.treeEdges.forEach((treeEdge) => {
    childrenByFace[treeEdge.parent].push(treeEdge)
  })

  const visit = (face: number, parentMatrix: THREE.Matrix4): void => {
    matrices[face] = parentMatrix.clone()

    childrenByFace[face].forEach((treeEdge) => {
      const theta = treeEdge.sign * treeEdge.angle * clampedProgress
      const hingeTransform = rotateAroundEdge(treeEdge, theta)
      const childMatrix = parentMatrix.clone().multiply(hingeTransform)
      visit(treeEdge.child, childMatrix)
    })
  }

  visit(tree.root, identity)
  return matrices
}
