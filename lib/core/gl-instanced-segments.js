import { GlInstancedBase } from "./gl-instansedBase";
import {
  BufferGeometry,
  LineBasicMaterial,
  BufferAttribute,
  Box3,
  Sphere,
  Vector3,
} from 'three';

export class GlInstancedSegments extends GlInstancedBase {
  constructor(params) {
    super(params);

    params = params || {};
    this.geometry = params.geometry ? params.geometry : new BufferGeometry();
    this.material = params.material ? params.material : new LineBasicMaterial();

    this.isLine = true;
    this.isLineSegments = true;
    this.isGlInstancedSegments = true;
    this.type = 'GlInstancedSegments';

    this.__segmentsCount = 0;
  }

  setSegments(array) {
    // adjust a segment's coordinates as: [x0, y0, z0, x1, y1, z1]
    const coords = this.__validateCoordinates(array);
    if (coords && coords.length) {
      // now start adding segments
      if (this.geometry.attributes.position) {
        const xyz = this.geometry.attributes.position;
        const newPointsCount = coords.length / xyz.itemSize;
        const newSgmCount = Math.floor(0.5 * newPointsCount);

        if (2 * this.__segmentsCount + newPointsCount <= xyz.count) {
          const lastIdx = 2 * this.__segmentsCount;

          // add new points coordinates
          const start = 0;
          const end = start + newPointsCount * xyz.itemSize;
          for (let i = start; i < end; i += 3) {
            xyz.array[i] = coords[i - start];
            xyz.array[i + 1] = coords[i - start + 1];
            xyz.array[i + 2] = coords[i - start + 2];
          }
          this.__segmentsCount += newSgmCount;

          this.geometry.setDrawRange(0, this.__segmentsCount * 2);
          xyz.needsUpdate = true;

          this.geometry.computeBoundingSphere();
        } else {
          // the (position) BufferAttribute's size is not enough to add new
          // coordinates. Since the buffer size can't be changed in order
          // to re-size the BufferAttribute we'll create a new
          // BufferGeometry and dispose the current one
          this.__recreateBufferGeometry(coords);
        }
      } else {
        this.__recreateBufferGeometry(coords);
      }
    }
  }

  // -----------------------------------------------------
  // __validateCoordinates()
  // validate and adjust coordinates as:
  // [x0, y0, z0, x1, y1, z1]
  //
  // input coordinates can be: 
  //  an instance of GlLine3,
  //  or an array of GlLine3 instances: [obj1, obj2];
  //  or an array of points pairs: [pt1, pt2,... ptn-1, ptn]
  //  or an array of coords: [x1, y1, z1, x2, y2, z2, ...]
  //
  // This method converts coordinates from world to local
  // -----------------------------------------------------
  __validateCoordinates(coords) {
    if (!coords) return null;

    let retCoords = null;
    let error = '';
    if (coords instanceof Array) {
      if (coords[0] instanceof Array) {
        error = 'Ошибка: координаты заданы некорректно';
      } else if (typeof coords[0] === 'object') {
        if (coords[0].start && coords[0].end) {
          // we'll assume that the 'coords' is an array of GlLine3 objects: [obj1, obj2, ...]
          retCoords = Array(coords.length * 6).fill(0.0);
          for (let i = 0; i < coords.length; ++i) {
            const strt = coords[i].start;
            const end = coords[i].end;
            if (strt === undefined || end === undefined) {
              error = 'Ошибка: некоторые координаты заданы некорректно';
            } else {
              retCoords[i * 6] = strt.x;
              retCoords[i * 6 + 1] = strt.y;
              retCoords[i * 6 + 2] = strt.z;
              retCoords[i * 6 + 3] = end.x;
              retCoords[i * 6 + 4] = end.y;
              retCoords[i * 6 + 5] = end.z;
            }
          }

        } else {
          // we'll assume that the 'coords' is an array of point objects pairs: [point1, point2, ...]
          const segmentsCount = Math.floor(0.5 * coords.length);
          retCoords = Array(segmentsCount * 6).fill(0.0);
          for (let i = 0; i < segmentsCount * 2; ++i) {
            if (coords[i].x === undefined || coords[i].y === undefined || coords[i].z === undefined) {
              error = 'Ошибка: некоторые координаты заданы некорректно';
            } else {
              retCoords[i * 3] = coords[i].x;
              retCoords[i * 3 + 1] = coords[i].y;
              retCoords[i * 3 + 2] = coords[i].z;
            }
          }
        }

      } else {
        // we'll assume that the 'coords' are given as: [x0, y0, z0, x1, y1, z1]
        const segmentsCount = Math.floor(coords.length / 6);
        retCoords = Array(segmentsCount * 6).fill(0.0);
        for (let i = 0; i < segmentsCount * 6; ++i) {
          retCoords[i] = coords[i];
        }
      }
    } else {
      // we'll assume that the 'coords' is an instance of GlLine3
      if (coords.start === undefined || coords.end === undefined) {
        error = 'Ошибка: координаты заданы некорректно';
      } else {
        const strt = coords.start;
        const end = coords.end;
        retCoords = [strt.x, strt.y, strt.z, end.x, end.y, end.z];
      }
    }

    if (retCoords && retCoords.length) {
      // set an objects position if it's needed
      if (this.__segmentsCount === 0) {
        this.__m4.copy(this.matrixWorld).invert();
        this.pivotOffset.set(0, 0, 0);
        this.position.set(retCoords[0], retCoords[1], retCoords[2]);
        this.position.applyMatrix4(this.__m4);
        this.updateMatrixWorld();
      }

      this.__m4.copy(this.matrixWorld).invert();

      // convert coordinates from world to local
      for (let i = 0; i < retCoords.length; i += 3) {
        this.__v3.set(retCoords[i], retCoords[i + 1], retCoords[i + 2]);
        this.__v3.applyMatrix4(this.__m4);
        retCoords[i] = this.__v3.x;
        retCoords[i + 1] = this.__v3.y;
        retCoords[i + 2] = this.__v3.z;
      }
    }

    if (error) {
      console.log(error);
    }

    return retCoords;
  }

  // ----------------------------------------------------
  // __recreateBufferGeometry(coords)
  // 'coords' must be the type of Array and contain
  // local coordinates as: [x0, y0, z0, x1, y1, z1]
  // ----------------------------------------------------
  __recreateBufferGeometry(coords) {
    if (!(coords && coords instanceof Array)) return;

    const itemSize = 3;
    const pointsCount = 2 * this.__segmentsCount;
    const newPointsCount = Math.floor(coords.length / itemSize);

    // define the size of new attribute
    const newSize = (pointsCount + newPointsCount + 100) * itemSize;

    // create a new buffer for coordinates
    const newXYZ = new BufferAttribute(new Float32Array(newSize), itemSize);

    const lastIdx = pointsCount;

    // copy all existing coordinates from the current geometry to the new one
    let oldGeometry;
    if (this.geometry.attributes.position) {
      oldGeometry = this.geometry;
      for (let i = 0; i < lastIdx; ++i) {
        newXYZ.copyAt(i, this.geometry.attributes.position, i);
      }
    }

    // add new coordinates
    const start = lastIdx * itemSize;
    const end = start + newPointsCount * itemSize;
    for (let i = start; i < end; i += 3) {
      newXYZ.array[i] = coords[i - start];
      newXYZ.array[i + 1] = coords[i - start + 1];
      newXYZ.array[i + 2] = coords[i - start + 2];
    }

    this.__segmentsCount += (0.5 * newPointsCount);

    if (oldGeometry) {
      this.geometry = new BufferGeometry();
      oldGeometry.dispose();
    }
    this.geometry.computeBoundingBox = this.computeBoundingBox;
    this.geometry.computeBoundingSphere = this.computeBoundingSphere;

    this.geometry.setAttribute('position', newXYZ);

    newXYZ.needsUpdate = true;

    this.geometry.setDrawRange(0, this.__segmentsCount * 2);
    this.geometry.computeBoundingSphere();
  }

  // -------------------------------------
  // computeBoundingBox()
  // -------------------------------------
  computeBoundingBox() {
    // this function is intended to replace native 'computeBoundingBox'
    // of a geometry, so 'this' here refers to BufferGeometry
    const xyz = this.attributes.position;
    if (xyz) {
      if (!this.boundingBox) this.boundingBox = new Box3();

      if (this.drawRange.count) {
        const bb = this.boundingBox;

        let minX = +Infinity;
        let minY = +Infinity;
        let minZ = +Infinity;

        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (let i = 0, l = this.drawRange.count; i < l; i++) {
          const x = xyz.getX(i);
          const y = xyz.getY(i);
          const z = xyz.getZ(i);

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;

          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
        }

        bb.min.set(minX, minY, minZ);
        bb.max.set(maxX, maxY, maxZ);
      } else {
        this.boundingBox.makeEmpty();
      }
    }
  }

  // -------------------------------------
  // computeBoundingSphere()
  // -------------------------------------
  computeBoundingSphere() {
    // this function is intended to replace native 'computeBoundingSphere'
    // of a geometry, so 'this' here refers to BufferGeometry
    const xyz = this.attributes.position;
    if (xyz) {
      if (this.boundingSphere === null) this.boundingSphere = new Sphere();

      this.computeBoundingBox();
      if (this.boundingBox.isEmpty()) {
        this.boundingSphere.radius = 0;
        this.boundingSphere.center.set(0, 0, 0);
        return;
      }

      // first, find the center of the bounding sphere
      const center = this.boundingSphere.center;
      this.boundingBox.getCenter(center);

      // second, try to find a boundingSphere with a radius smaller than the
      // boundingSphere of the boundingBox: sqrt(3) smaller in the best case
      let maxRadiusSq = 0;
      const _vector = new Vector3();

      for (let i = 0, il = this.drawRange.count; i < il; i++) {
        _vector.fromBufferAttribute(xyz, i);
        maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector));
      }

      this.boundingSphere.radius = Math.sqrt(maxRadiusSq);

      if (isNaN(this.boundingSphere.radius)) {
        console.error('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.', this);
      }
    }
  }
}