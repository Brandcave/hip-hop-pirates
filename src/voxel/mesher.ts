import * as THREE from 'three';
import type { Theme } from '../gfx/palette';
import type { FaceAtlas } from './atlas';
import { VOXEL, type VoxelWorld } from './grid';

/**
 * Building the world's geometry.
 *
 * The rule that makes a voxel world cheap is that you only ever emit the faces
 * you could actually see: a face is skipped whenever the neighbour beside it is
 * at least as tall, because it would be buried inside solid ground. On this map
 * that is the difference between six faces per column and barely more than one.
 *
 * Everything lands in ONE geometry with one draw call. Terrain identity travels
 * per-vertex — the UVs point into a row of the face atlas — so a single mesh can
 * carry grass, road, water and stone without splitting into materials.
 */

interface Builder {
  position: number[];
  normal: number[];
  uv: number[];
  index: number[];
  /** Baked ambient occlusion, per vertex. */
  shade: number[];
}

/** Sides are darkened against the top, which is most of the sense of a solid block. */
const SIDE_SHADE = { top: 1, north: 0.72, south: 0.86, east: 0.8, west: 0.66 };

function quad(
  b: Builder,
  corners: [number, number, number][],
  normal: [number, number, number],
  row: number,
  rows: number,
  shade: number,
) {
  const base = b.position.length / 3;
  const v0 = row / rows;
  const v1 = (row + 1) / rows;
  // A hair inside the row, so nearest sampling can never bleed the row above.
  const inset = 0.5 / (rows * 32);
  const uvs = [
    [0, v1 - inset],
    [1, v1 - inset],
    [1, v0 + inset],
    [0, v0 + inset],
  ];
  corners.forEach((c, i) => {
    b.position.push(c[0], c[1], c[2]);
    b.normal.push(normal[0], normal[1], normal[2]);
    b.uv.push(uvs[i][0], uvs[i][1]);
    b.shade.push(shade);
  });
  b.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export interface WorldMesh {
  mesh: THREE.Mesh;
  /** Height in world units of the top of a column, for standing things on it. */
  heightAt(x: number, y: number): number;
}

export function buildWorldMesh(
  world: VoxelWorld,
  atlas: FaceAtlas,
  theme: Theme,
): WorldMesh {
  const b: Builder = { position: [], normal: [], uv: [], index: [], shade: [] };

  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.cols; x++) {
      const col = world.at(x, y)!;
      const top = col.height * VOXEL;
      const row = atlas.row(col.terrain, col.variant);
      const x0 = x;
      const x1 = x + 1;
      const z0 = y;
      const z1 = y + 1;

      // Top face, always visible — nothing is ever stacked above a column.
      quad(
        b,
        [
          [x0, top, z1],
          [x1, top, z1],
          [x1, top, z0],
          [x0, top, z0],
        ],
        [0, 1, 0],
        row,
        atlas.rows,
        SIDE_SHADE.top,
      );

      // Sides, only where the neighbour is lower — the rest is buried.
      const sides: [number, number, [number, number, number], number][] = [
        [0, -1, [0, 0, -1], SIDE_SHADE.north],
        [0, 1, [0, 0, 1], SIDE_SHADE.south],
        [1, 0, [1, 0, 0], SIDE_SHADE.east],
        [-1, 0, [-1, 0, 0], SIDE_SHADE.west],
      ];

      for (const [dx, dy, normal, shade] of sides) {
        const neighbour = world.at(x + dx, y + dy);
        const under = neighbour ? neighbour.height * VOXEL : 0;
        if (under >= top) continue;

        const corners: [number, number, number][] =
          dx === 1
            ? [
                [x1, under, z1],
                [x1, under, z0],
                [x1, top, z0],
                [x1, top, z1],
              ]
            : dx === -1
              ? [
                  [x0, under, z0],
                  [x0, under, z1],
                  [x0, top, z1],
                  [x0, top, z0],
                ]
              : dy === 1
                ? [
                    [x0, under, z1],
                    [x1, under, z1],
                    [x1, top, z1],
                    [x0, top, z1],
                  ]
                : [
                    [x1, under, z0],
                    [x0, under, z0],
                    [x0, top, z0],
                    [x1, top, z0],
                  ];
        quad(b, corners, normal, row, atlas.rows, shade);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(b.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(b.normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  geometry.setAttribute('shade', new THREE.Float32BufferAttribute(b.shade, 1));
  geometry.setIndex(b.index);

  const material = new THREE.MeshLambertMaterial({ map: atlas.texture });
  // Fold the baked face shading into the lit result. Lambert alone flattens a
  // voxel world: every top face shares a normal, so nothing separates a wall
  // from the ground it stands on until the sides are darkened by hand.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float shade;\nvarying float vShade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShade = shade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vShade;')
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.rgb *= vShade;',
      );
  };

  void theme;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return {
    mesh,
    heightAt: (x, y) => (world.at(Math.floor(x), Math.floor(y))?.height ?? 0) * VOXEL,
  };
}
