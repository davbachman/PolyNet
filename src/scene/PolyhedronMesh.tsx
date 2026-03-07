import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { SolidDefinition } from '../types'

interface PolyhedronMeshProps {
  solid: SolidDefinition
  matrices: THREE.Matrix4[]
}

const FACE_COLORS = ['#20639b', '#3caea3', '#f6d55c', '#ed553b', '#173f5f', '#58a4b0', '#f08a5d']

function buildFaceGeometry(vertices: SolidDefinition['vertices'], face: number[]): THREE.BufferGeometry {
  const trianglePositions: number[] = []

  for (let i = 1; i < face.length - 1; i += 1) {
    const a = vertices[face[0]]
    const b = vertices[face[i]]
    const c = vertices[face[i + 1]]

    trianglePositions.push(a[0], a[1], a[2])
    trianglePositions.push(b[0], b[1], b[2])
    trianglePositions.push(c[0], c[1], c[2])
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(trianglePositions, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildEdgeGeometry(vertices: SolidDefinition['vertices'], face: number[]): THREE.BufferGeometry {
  const edgePositions: number[] = []
  face.forEach((vertexIndex) => {
    const vertex = vertices[vertexIndex]
    edgePositions.push(vertex[0], vertex[1], vertex[2])
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3))
  return geometry
}

export default function PolyhedronMesh({ solid, matrices }: PolyhedronMeshProps) {
  const faceGeometries = useMemo(() => {
    return solid.faces.map((face) => buildFaceGeometry(solid.vertices, face))
  }, [solid])

  const edgeGeometries = useMemo(() => {
    return solid.faces.map((face) => buildEdgeGeometry(solid.vertices, face))
  }, [solid])

  useEffect(() => {
    return () => {
      faceGeometries.forEach((geometry) => geometry.dispose())
      edgeGeometries.forEach((geometry) => geometry.dispose())
    }
  }, [edgeGeometries, faceGeometries])

  return (
    <group>
      {solid.faces.map((_, faceIndex) => (
        <group key={`${solid.id}-face-${faceIndex}`}>
          <mesh geometry={faceGeometries[faceIndex]} matrix={matrices[faceIndex]} matrixAutoUpdate={false}>
            <meshStandardMaterial
              color={FACE_COLORS[faceIndex % FACE_COLORS.length]}
              side={THREE.DoubleSide}
              roughness={0.42}
              metalness={0.06}
            />
          </mesh>
          <lineLoop geometry={edgeGeometries[faceIndex]} matrix={matrices[faceIndex]} matrixAutoUpdate={false}>
            <lineBasicMaterial color="#111827" transparent opacity={0.85} />
          </lineLoop>
        </group>
      ))}
    </group>
  )
}
