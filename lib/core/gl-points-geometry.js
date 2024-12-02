import {MathUtils} from '../utils/math-utils';
import {
  BufferGeometry,
  Matrix4,
  Vector3,
} from 'three';

export class GlPointsGeometry extends BufferGeometry {
  constructor() {
    super();
    this.type = "GlPointsGeometry";
    this.isGlPointsGeometry = true;

    // for internal use only
    this.__m4 = new Matrix4();
    this.__v3 = new Vector3();

    this._pointsCount = 0;
  }

  // addPoints
  addPoints(coords) {
    if (!coords || (coords && coords.length <3)) return;
    const newPointsCount = coords.length / 3;
    const xyz = this.attributes.position;
    if (xyz && this._pointsCount + newPointsCount <= xyz.count) {
      // add new points coordinates and colors
      const start = this._pointsCount * 3;
      const end = start + (newPointsCount - 1) * 3;
      for (let i = start, j = 0; i <= end; i += 3, j += 3) {
        xyz.array[i] = coords[j];
        xyz.array[i + 1] = coords[j + 1];
        xyz.array[i + 2] = coords[j + 2];
      }

      this._pointsCount += newPointsCount;
      xyz.updateRange.count = this._pointsCount * 3;
      xyz.needsUpdate = true;
      // set the maximum instance to render
      this.setDrawRange(0, this._pointsCount);
    }
  }

  // setPoints
  setPoints(index, coords) {
    const xyz = this.attributes.position;
    if (xyz) {
      const ptCount = coords.length / 3;
      const last = index + ptCount > this._pointsCount ? this._pointsCount : index + ptCount;
      for (let i = index, j = 0; i < last; i++, j+=3) {
        const pos = i * 3;
        xyz.array[pos] = coords[j];
        xyz.array[pos + 1] = coords[j + 1];
        xyz.array[pos + 2] = coords[j + 2];
      }
    }

    xyz.needsUpdate = true;
  }

  // insertPoints
  insertPoints(index, coords) {
    if (!coords.length) return;

    if (index === this._pointsCount) {
      this.addPoints(coords);
      return;
    }

    const xyz = this.attributes.position;
    const ptCount = coords.length / 3;
    const front = index * 3 + coords.length;
    // move trace
    for (let back = (this._pointsCount) * 3 + coords.length - 1; back > front; back -= 3) {
      xyz.array[back] = xyz.array[back - coords.length];
      xyz.array[back - 1] = xyz.array[back - coords.length - 1];
      xyz.array[back - 2] = xyz.array[back - coords.length - 2];
    }

    const last = index + ptCount > this._pointsCount ? this._pointsCount : index + ptCount;
    for (let i = index, j = 0; i < last; ++i, j += 3) {
      xyz.setXYZ(i, coords[j], coords[j + 1], coords[j + 2]);
    }

    this._pointsCount = this._pointsCount + ptCount;
    xyz.updateRange.count = this._pointsCount * 3;
    xyz.needsUpdate = true;
    this.setDrawRange(0, this._pointsCount);
  }

  // removePoint
  removePoint(index) {
    const xyz = this.attributes.position;
    for (let start = index; start < this._pointsCount; start++) {
      xyz.setXYZ(start, xyz.getX(start + 1), xyz.getY(start + 1), xyz.getZ(start + 1));
    }
    this._pointsCount--;
    xyz.needsUpdate = true;
    this.setDrawRange(0, this._pointsCount);
  }

  // deletePoints
  deletePoints(startIndex, endIndex) {
    const xyz = this.attributes.position;
    if (xyz) {
      let start = (endIndex + 1) * 6;
      let end = (this._pointsCount - 1) * 6;
      let delCount = (endIndex - startIndex + 1) * 6;

      // move the position coordinates
      start = (endIndex + 1) * 3;
      end = this._pointsCount * 3;
      delCount = (endIndex - startIndex + 1) * 3;
      for (let i = start; i < end; ++i) {
        xyz.array[i - delCount] = xyz.array[i];
      }

      this._pointsCount -= endIndex - startIndex + 1;
      xyz.updateRange.count = this._pointsCount * 3;
      xyz.needsUpdate = true;

      // set the maximum instance to render
      this.setDrawRange(0, this._pointsCount);
    }
  }

  // deleteAllPoints
  deleteAllPoints() {
    const xyz = this.attributes.position;
    if (xyz) {

      // set the trace points count to 0
      this._pointsCount = 0;

      xyz.updateRange.count = 0;
      xyz.needsUpdate = true;

      // set the maximum instance to render
      this.setDrawRange(0, 6);
    }
  }

  // -------------------------------------
  // getPointsCount()
  // -------------------------------------
  getPointsCount() {
    return this._pointsCount;
  }

  // -------------------------------------
  // getPointAt()
  // -------------------------------------
  getPointAt(index, matrixWorld, asFlatArray) {
    if (this.__isValidIndex(index)) {
      const xyz = this.attributes.position;
      if (xyz) {
        const point = asFlatArray ? [] : new Vector3();
        const start = index * xyz.itemSize;
        if (asFlatArray) {
          this.__v3.set(xyz.array[start], xyz.array[start + 1], xyz.array[start + 2]);
          if (matrixWorld) this.__v3.applyMatrix4(matrixWorld);
          point.push(this.__v3.x, this.__v3.y, this.__v3.z);
        } else {
          point.set(xyz.array[start], xyz.array[start + 1], xyz.array[start + 2]);
          if (matrixWorld) point.applyMatrix4(matrixWorld);
        }
        return point;
      }
      return null;
    }

    console.log('Ошибка: задан некорректный индекс');
    return null;
  }

  // -------------------------------------
  // calculate the plane of a geometry in
  // terms of a world coordinates
  // -------------------------------------
  getPlane(matrixWorld) {
    const plane = this.__getPlane();
    if (plane) {
      plane.centroid.add(matrixWorld);
    }

    return plane;
  }

  // ----------------------------------------
  // calculate the plane of a geometry
  // in terms of offset coordinates
  // ----------------------------------------
  __getPlane() {
    const xyz = this.attributes.position;
    if (xyz && this._pointsCount > 0) {
      // calculate centroid of the geometry
      const centroid = new Vector3();
      const point = new Vector3();
      for (let i = 0; i < this._pointsCount; i++) {
        point.fromBufferAttribute(xyz, i);
        centroid.add(point);
      }
      centroid.divideScalar(this._pointsCount);

      // create matrix
      const A = new Float64Array(9).fill(0);
      for (let i = 0; i < this._pointsCount; i++) {
        point.fromBufferAttribute(xyz, i);
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


  // -------------------------------------
  // getPoints()
  // -------------------------------------
  getPoints(startIndex, endIndex, matrixWorld, asFlatArray) {
    const result = [];
    if (!this.__isValidIndex(startIndex)) {
      console.log('Ошибка: задан некорректный начальный индекс');
      return result;
    }
    if (!this.__isValidIndex(endIndex)) {
      console.log('Ошибка: задан некорректный конечный индекс');
      return result;
    }
    if (startIndex > endIndex) {
      console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
      return result;
    }

    const xyz = this.attributes.position;
    if (xyz) {
      const start = startIndex * xyz.itemSize;
      const end = (endIndex + 1) * xyz.itemSize;
      for (let i = start; i < end; i += 3) {
        this.__v3.set(xyz.array[i], xyz.array[i + 1], xyz.array[i + 2]);
        if (matrixWorld) this.__v3.applyMatrix4(matrixWorld);

        if (asFlatArray) {
          result.push(this.__v3.x, this.__v3.y, this.__v3.z);
        } else {
          result.push(new Vector3(this.__v3.x, this.__v3.y, this.__v3.z));
        }
      }
    }
    return result;
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

  // get trace length
  // -------------------------------------
  getLength(index) {

    let length = 0;
    const xyz = this.attributes.position;
    if (xyz && this._pointsCount > 1) {
      let x = xyz.getX(0);
      let y = xyz.getY(0);
      let z = xyz.getZ(0);
      let x1;
      let y1;
      let z1;
      for (let i = 1; i < this._pointsCount; i++) {
        x1 = xyz.getX(i);
        y1 = xyz.getY(i);
        z1 = xyz.getZ(i);
        length += Math.sqrt(((x - x1) * (x - x1)) + ((y - y1) * (y - y1)) + ((z - z1) * (z - z1)));
        x = x1;
        y = y1;
        z = z1;
      }
    }
    return length;
  }

}
