/* eslint-disable no-undef */
import {MathUtils} from '../utils/math-utils';
import {
  InstancedBufferGeometry,
  Matrix4,
  Vector3,
  Float32BufferAttribute,
  Box3,
  Sphere,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  DynamicDrawUsage,
  Color,
} from 'three';

export class GlIntervalGeometry extends InstancedBufferGeometry {
  constructor() {
    super();
    this.type = 'GlIntervalGeometry';
    this.isGlIntervalGeometry = true;

    this.maxIntervals = 200;
    this._pointsCount = 0;

    // for internal use only
    this.__m4 = new Matrix4();
    this.__v3 = new Vector3();

    const segmentPositions = [-1, 2, 0, 1, 2, 0, -1, 1, 0, 1, 1, 0, -1, 0, 0, 1, 0, 0, -1, -1, 0, 1, -1, 0];
    const segmentUvs = [-1, 2, 1, 2, -1, 1, 1, 1, -1, -1, 1, -1, -1, -2, 1, -2];
    const index = [0, 2, 1, 2, 3, 1, 2, 4, 3, 4, 5, 3, 4, 6, 5, 6, 7, 5];

    this.setIndex(index);
    this.setAttribute('segmentPosition', new Float32BufferAttribute(segmentPositions, 3));
    this.setAttribute('segmentUv', new Float32BufferAttribute(segmentUvs, 2));
  }

  clone() {
    const clone = new this.constructor();
    clone.copy(this);
    clone._pointsCount = this._pointsCount;
    clone._maxInstanceCount = this._maxInstanceCount;

    return clone;
  }

  // -------------------------------------
  // computeBoundingBox
  // -------------------------------------
  computeBoundingBox() {
    if (this.boundingBox === null) {
      this.boundingBox = new Box3();
    }

    const start = this.attributes.instanceStart;
    const end = this.attributes.instanceEnd;
    const len = this._pointsCount - 1;
    if (start !== undefined && end !== undefined && len > 0) {
      let minX = +Infinity;
      let minY = +Infinity;
      let minZ = +Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;

      for (let i = 0; i < len; i++) {
        const x = start.getX(i);
        const y = start.getY(i);
        const z = start.getZ(i);

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }

      // get the last point
      const x = end.getX(len - 1);
      const y = end.getY(len - 1);
      const z = end.getZ(len - 1);

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;

      this.boundingBox.min.set(minX, minY, minZ);
      this.boundingBox.max.set(maxX, maxY, maxZ);
    } else {
      this.boundingBox.makeEmpty();
    }
  }

  // -------------------------------------
  // computeBoundingSphere
  // -------------------------------------
  computeBoundingSphere() {
    const vector = new Vector3();

    if (this.boundingSphere === null) this.boundingSphere = new Sphere();

    this.computeBoundingBox();
    if (this.boundingBox.isEmpty()) {
      this.boundingSphere.radius = 0;
      this.boundingSphere.center.set(0, 0, 0);
      return;
    }

    const start = this.attributes.instanceStart;
    const end = this.attributes.instanceEnd;
    const len = this._pointsCount - 1;
    if (start !== undefined && end !== undefined && len > 0) {
      const center = this.boundingSphere.center;
      this.boundingBox.getCenter(center);

      let maxRadiusSq = 0;
      for (let i = 0, il = len; i < il; i++) {
        vector.fromBufferAttribute(start, i);
        maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(vector));

        vector.fromBufferAttribute(end, i);
        maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(vector));
      }

      this.boundingSphere.radius = Math.sqrt(maxRadiusSq);
      if (isNaN(this.boundingSphere.radius)) {
        console.error('GlIntervalGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.', this);
      }
    }
  }

  // -------------------------------------
  // computeLineDistances
  // -------------------------------------
  computeLineDistances() {
    // prepare the distance attributes
    if (this.attributes.instanceDistanceStart === undefined) {
      const instanceDistanceBuffer = new InstancedInterleavedBuffer(new Float32Array(2 * this.maxIntervals), 2, 1); // d0, d1

      this.setAttribute('instanceDistanceStart', new InterleavedBufferAttribute(instanceDistanceBuffer, 1, 0)); // d0
      this.setAttribute('instanceDistanceEnd', new InterleavedBufferAttribute(instanceDistanceBuffer, 1, 1)); // d1
      this.attributes.instanceDistanceStart.data.setDynamic(true);
      // this.attributes.instanceDistanceStart.data.setUsage(DynamicDrawUsage);
    }

    const lineDistances = this.attributes.instanceDistanceStart.data;

    const start = new Vector3();
    const end = new Vector3();

    const instanceStart = this.attributes.instanceStart;
    const instanceEnd = this.attributes.instanceEnd;

    for (let i = 0, j = 0; i < this._pointsCount - 1; i++, j += 2) {
      start.fromBufferAttribute(instanceStart, i);
      end.fromBufferAttribute(instanceEnd, i);

      lineDistances.array[j] = (j === 0) ? 0 : lineDistances.array[j - 1];
      lineDistances.array[j + 1] = lineDistances.array[j] + start.distanceTo(end);
    }

    // notify webgl to update buffers
    lineDistances.updateRange.count = (this._pointsCount - 1) * 2;
    lineDistances.needsUpdate = true;

    return this;
  }

  // ------------------
  // applyMatrix4
  // ------------------
  applyMatrix4(matrix) {
    const start = this.attributes.instanceStart;
    const end = this.attributes.instanceEnd;

    if (start !== undefined) {
      start.applyMatrix4(matrix);
      end.applyMatrix4(matrix);
      start.data.needsUpdate = true;
    }

    if (this.boundingBox !== null) {
      this.computeBoundingBox();
    }

    if (this.boundingSphere !== null) {
      this.computeBoundingSphere();
    }

    return this;
  }

  // ------------------
  // applyMatrix
  // ------------------
  applyMatrix(matrix) {
    const start = this.attributes.instanceStart;
    const end = this.attributes.instanceEnd;

    if (start !== undefined) {
      matrix.applyToBufferAttribute(start);
      matrix.applyToBufferAttribute(end);
      start.data.needsUpdate = true;
    }

    if (this.boundingBox !== null) {
      this.computeBoundingBox();
    }

    if (this.boundingSphere !== null) {
      this.computeBoundingSphere();
    }

    return this;
  }

  // ----------------------------------------------------
  // setColorInRange(startIndex,endIndex,color)
  // 'coords' must be the type of Array and contain
  // offsetted coordinates as: [r, g, b]
  // ----------------------------------------------------

  setColorInRange(startIndex, endIndex, color) {
    const bStart = this.attributes.instanceColorStart;
    const bEnd = this.attributes.instanceColorEnd;

    if (startIndex === null || startIndex === undefined || endIndex === null || endIndex === undefined) {
      console.log("Ошибка: не задан индекс");
      return;
    }

    for (let i = startIndex; i < endIndex; i++) {
      bStart.setXYZ(i, color[0], color[1], color[2]);
      bEnd.setXYZ(i, color[0], color[1], color[2]);
    }

    const length = (this._pointsCount) * 3;

    bStart.data.needsUpdate = true;
    bEnd.data.needsUpdate = true;
    bStart.data.updateRange.count = length*2;
    bEnd.data.updateRange.count = length*2;
  }

  // ----------------------------------------------------
  // inserPoints(index,coords)
  // 'coords' must be the type of Array and contain
  // offsetted coordinates as: [x0, y0, z0, x1, y1, z1]
  // ----------------------------------------------------
  insertPoints(index, coords) {
    if (!coords.length) return;

    if (index === this._pointsCount) {
      this.addPoints(coords);
      return;
    }

    const buffer = this.attributes.instanceStart.data;
    const color = this.attributes.instanceColorStart.data;
    const ptCount = coords.length / 3;

    // move start and end points
    // move colors
    const front = index * 6 + coords.length * 2;
    for (let back = (this._pointsCount - 1) * 6 + coords.length * 2 - 1; back > front; back -= 3) {
      buffer.array[back] = buffer.array[back - coords.length * 2];
      buffer.array[back - 1] = buffer.array[back - coords.length * 2 - 1];
      buffer.array[back - 2] = buffer.array[back - coords.length * 2 - 2];

      color.array[back] = color.array[back - coords.length * 2];
      color.array[back - 1] = color.array[back - coords.length * 2 - 1];
      color.array[back - 2] = color.array[back - coords.length * 2 - 2];
    }

    // * insert coord into specific index
    // set new coordinates
    const last = index + ptCount > this._pointsCount ? this._pointsCount : index + ptCount;
    for (let i = index, j = 0; i < last; ++i, j += 3) {
      const pos = i * 6;

      if (i === 0) {
        // segment's start point
        buffer.array[pos] = coords[j];
        buffer.array[pos + 1] = coords[j + 1];
        buffer.array[pos + 2] = coords[j + 2];

        buffer.array[pos + 3] = buffer.array[3 + 3];
        buffer.array[pos + 4] = buffer.array[4 + 3];
        buffer.array[pos + 5] = buffer.array[5 + 3];

      } else if (i < this._pointsCount - 1) {
        // for the last point to insert it set's end of it
        // takes the start from first point after insertion
        if (i == last - 1) {
          buffer.array[(last - 1) * 6 + 3] = buffer.array[last * 6];
          buffer.array[(last - 1) * 6 + 4] = buffer.array[last * 6 + 1];
          buffer.array[(last - 1) * 6 + 5] = buffer.array[last * 6 + 2];
        }

        // previous segment's end point
        buffer.array[pos - 3] = coords[j];
        buffer.array[pos - 2] = coords[j + 1];
        buffer.array[pos - 1] = coords[j + 2];

        // segment's start point
        buffer.array[pos] = coords[j];
        buffer.array[pos + 1] = coords[j + 1];
        buffer.array[pos + 2] = coords[j + 2];
      } else if ( i == this._pointsCount - 1) {
        buffer.array[pos + 3] = buffer.array[pos - 3];
        buffer.array[pos + 4] = buffer.array[pos - 2];
        buffer.array[pos + 5] = buffer.array[pos - 1];

        buffer.array[pos - 3] = coords[j];
        buffer.array[pos - 2] = coords[j + 1];
        buffer.array[pos - 1] = coords[j + 2];

        buffer.array[pos] = coords[j];
        buffer.array[pos + 1] = coords[j + 1];
        buffer.array[pos + 2] = coords[j + 2];
      }
    }
    const length = (this._pointsCount) * 3;

    // this.setColors(index,colors);
    this._pointsCount = this._pointsCount + ptCount;
    buffer.needsUpdate = true;
    buffer.updateRange.count = length * 2;
    color.needsUpdate = true;
    this.computeBoundingSphere();
    this.setMaxInstanceToRender();
  }

  setMaxInstanceToRender() {
    // set the maximum instance to render
    if (this._pointsCount < 6) {
      this.setDrawRange(0, 6 * 3);
      this.instanceCount = 6;
    } else {
      this.setDrawRange(0, this._pointsCount * 3);
      this.instanceCount = this._pointsCount;
    }
  }

  // removePoint
  removePoint(index) {
    const buffer = this.attributes.instanceStart.data;
    const color = this.attributes.instanceColorStart.data;

    let start = (index === this._pointsCount - 1) ? index * 6 - 6 : index * 6 - 3;
    // eliminate last point because it stored as end point on the previous
    // since we are starting with -3 which is end point eliminate as well
    for (start; start <= (this._pointsCount - 1) * 6 - 3; start += 6) {
      for (let j = 0; j < 6; j++) {
        buffer.array[start + j] = buffer.array[start + j + 6];
        color.array[start + j] = color.array[start + j + 6];
      }
    }

    this._pointsCount--;
    buffer.needsUpdate = true;
    color.needsUpdate = true;
    this.computeBoundingSphere();
    this.setMaxInstanceToRender();
  }

  // ----------------------------------------------------
  // addPoints(coords)
  // 'coords' must be the type of Array and contain
  // offsetted coordinates as: [x0, y0, z0, x1, y1, z1]
  // ----------------------------------------------------
  addPoints(coords) {
    if (!coords || (coords && coords.length < 3)) return;

    const newPointsCount = coords.length / 3;
    const buffer = this.attributes.instanceStart.data;
    const colors = this.attributes.instanceColorStart.data;
    if (this._pointsCount + newPointsCount <= buffer.count) {
      // set the geometry segments' default color
      const white = new Color();
      white.setRGB(255, 255, 255);

      // add new points coordinates and colors
      let start = this._pointsCount * 3;
      const end = start + (newPointsCount - 1) * 3;

      if (newPointsCount === 1) {
        const lastIndex = (this._pointsCount - 1) * 6;
        coords = [
          buffer.array[lastIndex - 3],
          buffer.array[lastIndex - 2],
          buffer.array[lastIndex - 1],
          coords[0],
          coords[1],
          coords[2]
        ];
        white.r = colors.array[0];
        white.g = colors.array[1];
        white.b = colors.array[2];
        start -= 3;
      }

      for (let i = start, j = 0; i < end; i += 3, j += 3) {
        // coordinates
        buffer.array[2 * i] = coords[j];
        buffer.array[2 * i + 1] = coords[j + 1];
        buffer.array[2 * i + 2] = coords[j + 2];

        buffer.array[2 * i + 3] = coords[j + 3];
        buffer.array[2 * i + 4] = coords[j + 4];
        buffer.array[2 * i + 5] = coords[j + 5];

        // colors
        colors.array[2 * i] = white.r;
        colors.array[2 * i + 1] = white.g;
        colors.array[2 * i + 2] = white.b;

        colors.array[2 * i + 3] = white.r;
        colors.array[2 * i + 4] = white.g;
        colors.array[2 * i + 5] = white.b;
      }

      this._pointsCount += newPointsCount;
      const length = (this._pointsCount) * 3;

      // notify webgl to update buffers
      buffer.updateRange.count = length * 2;
      buffer.needsUpdate = true;
      colors.updateRange.count = length * 2;
      colors.needsUpdate = true;
      this.computeBoundingSphere();
      this.setMaxInstanceToRender();
    }
  }

  // -----------------------------------------------------
  // setPoints(index, coords)
  // 'coords' must be the type of Array and contain
  // offsetted coordinates as: [x0, y0, z0, x1, y1, z1]
  // -----------------------------------------------------
  setPoints(index, coords) {
    const attrib = this.attributes.instanceStart;
    if (attrib) {
      const ptCount = coords.length / 3;
      const buffer = attrib.data;
      // set new coordinates
      const last = index + ptCount > this._pointsCount ? this._pointsCount : index + ptCount;
      for (let i = index, j = 0; i < last; ++i, j += 3) {
        const pos = i * 6;

        if (i === 0) {
          // segment's start point
          buffer.array[pos] = coords[j];
          buffer.array[pos + 1] = coords[j + 1];
          buffer.array[pos + 2] = coords[j + 2];

        } else if (i < this._pointsCount - 1) {
          // previous segment's end point
          buffer.array[pos - 3] = coords[j];
          buffer.array[pos - 2] = coords[j + 1];
          buffer.array[pos - 1] = coords[j + 2];

          // segment's start point
          buffer.array[pos] = coords[j];
          buffer.array[pos + 1] = coords[j + 1];
          buffer.array[pos + 2] = coords[j + 2];

        } else {
          // previous segment's end point
          buffer.array[pos - 3] = coords[j];
          buffer.array[pos - 2] = coords[j + 1];
          buffer.array[pos - 1] = coords[j + 2];
        }

      }
      buffer.needsUpdate = true;

      this.computeBoundingSphere();
    }
  }

  // -----------------------------------------------------
  // setColors(index, colors)
  // 'colors' must be the type of Array and contain
  // colors as: [r0, g0, b0, r1, g1, b1]
  // -----------------------------------------------------
  setColors(index, colors) {
    const attrib = this.attributes.instanceColorStart;
    if (attrib) {
      const buffer = attrib.data;

      if (index === undefined || index === null) {
        // set new colors

        const last = this._pointsCount;
        for (let i = 0; i < last; ++i) {
          const pos = i * 6;

          if (i === 0) {
            // segment's start point
            buffer.array[pos] = colors.r;
            buffer.array[pos + 1] = colors.g;
            buffer.array[pos + 2] = colors.b;

          } else if (i < this._pointsCount - 1) {
            // previous segment's end point
            buffer.array[pos - 3] = colors.r;
            buffer.array[pos - 2] = colors.g;
            buffer.array[pos - 1] = colors.b;

            // segment's start point
            buffer.array[pos] = colors.r;
            buffer.array[pos + 1] = colors.g;
            buffer.array[pos + 2] = colors.b;

          } else {
            // previous segment's end point
            buffer.array[pos - 3] = colors.r;
            buffer.array[pos - 2] = colors.g;
            buffer.array[pos - 1] = colors.b;
          }
        }
      } else {
        const colorCount = colors.length / 3;

        // set new colors
        const last = index + colorCount > this._pointsCount ?
          this._pointsCount : index + colorCount;
        for (let i = index, j = 0; i < last; ++i, j += 3) {
          const pos = i * 6;

          if (i === 0) {
            // segment's start point
            buffer.array[pos] = colors[j];
            buffer.array[pos + 1] = colors[j + 1];
            buffer.array[pos + 2] = colors[j + 2];

          } else if (i < this._pointsCount - 1) {
            // previous segment's end point
            buffer.array[pos - 3] = colors[j];
            buffer.array[pos - 2] = colors[j + 1];
            buffer.array[pos - 1] = colors[j + 2];

            // segment's start point
            buffer.array[pos] = colors[j];
            buffer.array[pos + 1] = colors[j + 1];
            buffer.array[pos + 2] = colors[j + 2];

          } else {
            // previous segment's end point
            buffer.array[pos - 3] = colors[j];
            buffer.array[pos - 2] = colors[j + 1];
            buffer.array[pos - 1] = colors[j + 2];
          }
        }
      }

      buffer.needsUpdate = true;
    }
  }

  // -------------------------------------
  // deletePoints()
  // -------------------------------------
  deletePoints(startIndex, endIndex) {
    const attrib = this.attributes.instanceStart;
    if (attrib) {
      // get the trace points coordinates and colors buffers
      const coords = attrib.data;
      const colors = this.attributes.instanceColorStart.data;
      // move the segments' coordinates and colors
      const start = (endIndex + 1) * 6;
      const end = (this._pointsCount - 1) * 6;
      const delCount = (endIndex - startIndex + 1) * 6;
      for (let i = start; i < end; ++i) {
        coords.array[i - delCount] = coords.array[i];
        colors.array[i - delCount] = colors.array[i];
      }

      // set a new trace points count
      this._pointsCount -= endIndex - startIndex + 1;
      const length = (this._pointsCount - 1) * 3;

      // notify webgl to update buffers
      coords.updateRange.count = length * 2;
      coords.needsUpdate = true;
      colors.updateRange.count = length * 2;
      colors.needsUpdate = true;
      this.setMaxInstanceToRender();
      this.computeBoundingSphere();
    }
  }

  // -------------------------------------
  // getPointsCount()
  // -------------------------------------
  getPointsCount() {
    return this._pointsCount;
  }

  getLength() {
    let length = 0;
    const start = this.attributes.instanceStart;
    const end = this.attributes.instanceEnd;
    if (start && this._pointsCount > 1) {
      let x;
      let y;
      let z;
      let x1;
      let y1;
      let z1;
      for (let i = 0; i < this._pointsCount; i++) {
        x = start.getX(i);
        y = start.getY(i);
        z = start.getZ(i);
        x1 = end.getX(i);
        y1 = end.getY(i);
        z1 = end.getZ(i);
        length += Math.sqrt(((x - x1) * (x - x1)) + ((y - y1) * (y - y1)) + ((z - z1) * (z - z1)));
      }
    }
    return length;
  }

  // ----------------------------------------
  // calculate the plane of a geometry
  // in terms of local coordinates
  // ----------------------------------------

  getPlane(matrixWorld) {
    const plane = this.__getPlane();

    this.__v3.set(plane.centroid.x, plane.centroid.y, plane.centroid.z);
    if (matrixWorld) this.__v3.applyMatrix4(matrixWorld);

    if (plane) {
      plane.centroid.add(this.__v3);
    }
    return plane;
  }

  __getPlane() {
    const bufferStart = this.attributes.instanceStart;
    const bufferEnd = this.attributes.instanceEnd;
    if (bufferStart && this._pointsCount > 0) {
      // calculate centroid of the geometry
      const centroid = new Vector3();
      const point = new Vector3();
      for (let i = 0; i <= this._pointsCount; i++) {
        if (i == this._pointsCount) {
          point.fromBufferAttribute(bufferEnd, i - 2);
        } else {
          point.fromBufferAttribute(bufferStart, i);
        }
        centroid.add(point);
      }
      centroid.divideScalar(this._pointsCount);

      // create matrix
      const A = new Float64Array(9).fill(0);
      for (let i = 0; i <= this._pointsCount; i++) {
        if (i == this._pointsCount) {
          point.fromBufferAttribute(bufferEnd, i - 2);
        } else {
          point.fromBufferAttribute(bufferStart, i);
        }
        point.sub(centroid);
        A[0] += point.x * point.x;
        A[1] += point.x * point.y;
        A[2] += point.x * point.z;
        A[4] += point.y * point.y;
        A[5] += point.y * point.z;
        A[8] += point.z * point.z;
      }
      A[3] = A[1];
      A[6] = A[2];
      A[7] = A[5];

      // calculate eigenvalues and eigenvectors
      const result = MathUtils.eigen_decompose(A);

      if (result) {
        const eVectors = result.eigenvectors;
        const eValues = result.eigenvalues;

        let minInd = eValues[0] < eValues[1] ? 0 : 1;
        minInd = eValues[minInd] < eValues[2] ? minInd : 2;

        return {
          normal: new Vector3(eVectors[minInd], eVectors[3 + minInd], eVectors[6 + minInd]),
          centroid,
          error: eValues[minInd],
        };
      }
    }

    return null;
  }

  getPointAt(index, matrixWorld, asFlatArray) {
    if (this.__isValidIndex(index)) {
      const buffer = this.attributes.instanceStart.data;
      const actualIndex = index * 6;
      if (buffer) {
        const point = asFlatArray ? [] : new Vector3();
        const j = (actualIndex == (this._pointsCount - 1) * 6 ) ? actualIndex - 3 : actualIndex;
        if (asFlatArray) {
          this.__v3.set(buffer.array[j], buffer.array[j + 1], buffer.array[j + 2]);
          if (matrixWorld) this.__v3.applyMatrix4(matrixWorld);
          point.push(this.__v3.x, this.__v3.y, this.__v3.z);
        } else {
          point.set(buffer.array[j], buffer.array[j + 1], buffer.array[j + 2]);
          if (matrixWorld) point.applyMatrix4(matrixWorld);
        }
        return point;
      }
      return null;
    }

    console.log('Ошибка: задан некорректный индекс');
    return null;
  }

  getPoints(startIndex, endIndex, matrixWorld, asFlatArray) {
    const result = [];
    const start = this.attributes.instanceStart.data;
    const itemSize = this.attributes.instanceStart.itemSize;
    let j;

    for (let i = (startIndex * itemSize) * 2; i < ((endIndex + 1) * itemSize) * 2; i+=6) {
      // if the point is last we have to take from end
      j = (i == (this._pointsCount - 1) * 6) ? i - 3 : i;
      this.__v3.set(start.array[j], start.array[j + 1], start.array[j+ 2]);
      if (matrixWorld) this.__v3.applyMatrix4(matrixWorld);

      if (asFlatArray) {
        result.push(this.__v3.x, this.__v3.y, this.__v3.z);
      } else {
        result.push(new Vector3(this.__v3.x, this.__v3.y, this.__v3.z));
      }
    }
    return result;
  }

  getPointsAsArray(startIndex, endIndex, matrixWorld) {
    const result = [];
    const start = this.attributes.instanceStart.data;
    const itemSize = this.attributes.instanceStart.itemSize;
    let j;

    for (let i = (startIndex * itemSize) * 2; i < ((endIndex + 1) * itemSize) * 2; i+=6) {
      // if the point is last we have to take from end
      j = (i == (this._pointsCount - 1) * 6) ? i - 3 : i;
      this.__v3.set(start.array[j], start.array[j + 1], start.array[j+ 2]);
      if (matrixWorld) this.__v3.applyMatrix4(matrixWorld);
      result.push([this.__v3.x, this.__v3.y, this.__v3.z]);
    }
    return result;
  }

  // -------------------------------------
  // deleteAllPoints()
  // -------------------------------------
  deleteAllPoints() {
    const attrib = this.attributes.instanceStart;
    if (attrib) {
      // get the trace points coordinates and colors buffers
      const coords = attrib.data;
      const colors = this.attributes.instanceColorStart.data;

      // set the trace points count to 0
      this._pointsCount = 0;

      // notify webgl to update buffers
      coords.updateRange.count = 0;
      coords.needsUpdate = true;
      colors.updateRange.count = 0;
      colors.needsUpdate = true;
      this.setMaxInstanceToRender();

      this.computeBoundingSphere();
    }
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (index !== undefined && index !== null &&
      index >= 0 && index < this._pointsCount) {
      return true;
    }
    return false;
  }

  // ------------------------
  // toJSON
  // ------------------------
  toJSON() {

    const data = {
      metadata: {
        version: 4.5,
        type: 'GlIntervalGeometry',
        generator: 'GlIntervalGeometry.toJSON'
      }
    };

    // standard GlIntervalGeometry serialization
    data.uuid = this.uuid;
    data.type = this.type;

    if (this.name !== '') {
      data.name = this.name;
    }

    data.data = {
      attributes: {}
    };

    const attributes = this.attributes;
    for (const key in attributes) {
      if (key === 'position' || key === 'color') {
        const attribute = attributes[key];

        const array = Array.prototype.slice.call(attribute.array);

        data.data.attributes[key] = {
          itemSize: attribute.itemSize,
          type: attribute.array.constructor.name,
          array: array,
          normalized: attribute.normalized
        };
      }
    }

    return data;
  }
}