/* eslint-disable no-undef */
import {GlPointsBase} from './gl-points-base';
import {GlNormals} from '../objects/gl-normals';
import {
  Vector3,
  BufferAttribute,
} from 'three';

export class GlPoints extends GlPointsBase {
  constructor(params, fromJSON) {
    params = params || {};

    super(params, fromJSON);

    this.isGlPoints = true;
    this.type = 'GlPoints';

    // pointsNormals
    this.__pointsNormalsColor = 0xff0000;
    this.__pointsNormalsExist = false;
    this.pointsNormals = new GlNormals({color: this.__pointsNormalsColor});
    
  }

  // -------------------------------------
  // showNormals()
  // -------------------------------------
  showNormals(flag, length) {
    if (flag) {
      // CREATE NORMALS
      const visAttr = this.geometry.attributes.visibility;
      const posAttr = this.geometry.attributes.position;
      const normalAttr  = this.geometry.attributes.normals;
      if (!normalAttr) return;

      this.pointsNormals.count = this.__pointsCount;
      this.pointsNormals.setArrowGeometry(length);

      this.__m4.identity();

      const unitX = new Vector3(1, 0, 0);
      const unitY = new Vector3(0, 1, 0);
      const axisX = new Vector3();
      const axisY = new Vector3();
      for (let i = 0; i < this.__pointsCount; i++) {
        if (visAttr.getX(i)) {
          const pos = new Vector3().set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
          const normal = new Vector3().set(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i));

          normal.normalize();
          let refAxis = unitX;
          if (normal.dot(refAxis) >= 0.9) refAxis = unitY;

          axisY.crossVectors(normal, refAxis).normalize();
          axisX.crossVectors(axisY, normal).normalize();

          this.__m4.makeBasis(axisX, axisY, normal);
          this.__m4.setPosition(pos.x, pos.y, pos.z);
          this.pointsNormals.setMatrixAt(i, this.__m4);
        }
      }
      this.add(this.pointsNormals);
      if (this.pointsNormals.getSegmentsCount()) this.__pointsNormalsExist = true;

    } else {

      // DELETE NORMALS
      this.pointsNormals.deleteAllSegments();
      this.remove(this.pointsNormals);
      this.pointsNormals.updateWorldMatrix()
      this.pointsNormals.length = 0;
      this.__pointsNormalsExist = false;
    }
  }

  // -------------------------------------
  // addNormals()
  // -------------------------------------
  addNormals(array) {
    // adjust normals as: [x0, y0, z0, x1, y1, z1]
    const normals = this.validateCoordinates(array);
    if (normals && normals.length) {
      const normLen = normals.length;

      const xyz = this.geometry.attributes.position;
      if (xyz) {
        let nrmls = this.geometry.attributes.normals;
        if (!nrmls) {
          const xyzSize = xyz.itemSize * xyz.count;
          nrmls = new BufferAttribute(new Float32Array(xyzSize), xyz.itemSize);
          this.geometry.setAttribute('normals', nrmls);
        }
  
        // now start adding normals
        let normalsCnt = normLen / nrmls.itemSize;
        if (this.__pointsCount < normalsCnt) normalsCnt = this.__pointsCount;
        let end = normalsCnt * nrmls.itemSize;
        for (let i = 0; i < end; i += 3) {
          nrmls.array[i] = normals[i];
          nrmls.array[i + 1] = normals[i + 1];
          nrmls.array[i + 2] = normals[i + 2];
        }

        if (normalsCnt < this.__pointsCount) {
          let start = end;
          end = this.__pointsCount * nrmls.itemSize;
          for (let i = start; i < end; i += 3) {
            nrmls.array[i] = 0;
            nrmls.array[i + 1] = 0;
            nrmls.array[i + 2] = 1;
          }

        }
      } else {
        console.log('Points coordinates are missing');
      }
    }
  }

  // -------------------------------------
  // getNormalAt()
  // -------------------------------------
  getNormalAt(index, asFlatArray) {
    if (this.__isValidIndex(index)) {
      const normals = this.geometry.attributes.normals;
      if (normals) {
        const point = asFlatArray ? [] : new Vector3();
        const start = index * normals.itemSize;
        if (asFlatArray) {
          this.__v3.set(normals.array[start], normals.array[start + 1], normals.array[start + 2]);
          point.push(this.__v3.x, this.__v3.y, this.__v3.z);
        } else {
          point.set(normals.array[start], normals.array[start + 1], normals.array[start + 2]);
        }
        return point;
      }
      return null;
    }

    console.log('Ошибка: задан некорректный индекс');
    return null;
  }

  // -------------------------------------
  // getNormals()
  // -------------------------------------
  getNormals(startIndex, endIndex, asFlatArray) {
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

    const normals = this.geometry.attributes.normals;
    if (normals) {
      const start = startIndex * normals.itemSize;
      const end = (endIndex + 1) * normals.itemSize;
      for (let i = start; i < end; i += 3) {
        this.__v3.set(normals.array[i], normals.array[i + 1], normals.array[i + 2]);
        if (asFlatArray) {
          result.push(this.__v3.x, this.__v3.y, this.__v3.z);
        } else {
          result.push(new Vector3(this.__v3.x, this.__v3.y, this.__v3.z));
        }
      }
    }
    return result;
  }
}
