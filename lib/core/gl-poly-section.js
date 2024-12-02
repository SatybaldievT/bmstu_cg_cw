/* eslint-disable no-undef */
import {GlLine3} from '../math/gl-line3';
import {GlPointAction} from './gl-constants';
import {GlSegments} from './gl-segments';
import {
  Vector3,
  Plane,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
} from 'three';

export class GlPolySection extends GlSegments {
  constructor(params, fromJSON) {
    params = params || {};
    super(params, fromJSON);

    this.isGlPolySection = true;
    this.type = 'GlPolySection';

    this.EPS4 = 1e-4;

    // for internal use only
    this.__pt1 = new Vector3();
    this.__pt2 = new Vector3();
    this.__pt3 = new Vector3();
    this.__pt4 = new Vector3();
    this.__axisX = new Vector3();
    this.__axisY = new Vector3();
    this.__axisZ = new Vector3();
    this.__lPlane = new Plane();
    this.__rPlane = new Plane();
    this.__lPlane2 = new Plane();
    this.__rPlane2 = new Plane();
    this.__segment1 = new GlLine3();
    this.__segment2 = new GlLine3();
  }

  // ----------------------------------------------------
  // __validateNormals()
  // validate and adjust normals as:
  // [x0, y0, z0, x1, y1, z1]
  // -----------------------------------------------------
  __validateNormals(normals) {
    if (!normals) return null;

    let retNormals = null;
    let error = '';
    if (normals instanceof Array) {
      if (normals[0] instanceof Array) {
        // we'll assum that the 'normals' is an array of arrays: [[x0, y0, z0], [x1, y1, z1], ...]
        retNormals = Array(normals.length * 3).fill(0.0);

        for (let i = 0; i < normals.length; ++i) {
          if (normals[i][0] === undefined || normals[i][1] === undefined || normals[i][2] === undefined ||
            normals[i][0] === null || normals[i][1] === null || normals[i][2] === null) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retNormals[i * 3] = normals[i][0];
            retNormals[i * 3 + 1] = normals[i][1];
            retNormals[i * 3 + 2] = normals[i][2];
          }
        }
      } else if (typeof normals[0] === 'object') {
        // we'll assume that the 'normals' is an array of objects: [point1, point2, ...]
        retNormals = Array(normals.length * 3).fill(0.0);

        for (let i = 0; i < normals.length; ++i) {
          if (normals[i].x === undefined || normals[i].y === undefined ||
            normals[i].z === undefined) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retNormals[i * 3] = normals[i].x;
            retNormals[i * 3 + 1] = normals[i].y;
            retNormals[i * 3 + 2] = normals[i].z;
          }
        }
      } else {
        // we'll assume that the 'normals' are given as: [x0, y0, z0, x1, y1, z1]
        const ptCount = Math.floor(normals.length / 3);
        const arrLen = ptCount * 3;
        retNormals = Array(arrLen).fill(0.0);
        for (let i = 0; i < arrLen; ++i) {
          retNormals[i] = normals[i];
        }
      }
    } else {
      // we'll assume that the 'normals' is an object
      if (normals.x === undefined || normals.y === undefined || normals.z === undefined) {
        error = 'Ошибка: координаты заданы некорректно';
      } else {
        retNormals = [normals.x, normals.y, normals.z];
      }
    }

    if (error) {
      console.log(error);
    }

    return retNormals;
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

    // define the size of new attributes
    const allPtsCount = pointsCount + newPointsCount + 50;
    const normalsCount = Math.floor(allPtsCount * 0.5);
    const newPointsSize = allPtsCount * itemSize;
    const newNormalsSize = normalsCount * itemSize;
    const newConstraintsSize = normalsCount * itemSize * 4;
    const newMatricesSize = normalsCount * itemSize * 4;

    // create a new buffer for coordinates
    const newXYZ = new BufferAttribute(new Float32Array(newPointsSize), itemSize);
    const newNormals = new BufferAttribute(new Float32Array(newNormalsSize), itemSize);
    const newConstraints = new BufferAttribute(new Float32Array(newConstraintsSize), itemSize);
    const newMatrices = new BufferAttribute(new Float32Array(newMatricesSize), itemSize);

    const lastIdx = pointsCount;

    // copy all existing attributes data from the current geometry to the new one
    let oldGeometry;
    if (this.geometry.attributes.position) {
      oldGeometry = this.geometry;
      for (let i = 0; i < lastIdx; ++i) {
        newXYZ.copyAt(i, this.geometry.attributes.position, i);
      }

      const size = this.__segmentsCount - 1;
      const normals = this.geometry.attributes.sectionNormals;
      if (normals) {
        for (let i = 0; i < size; ++i) {
          newNormals.copyAt(i, normals, i);
        }
      }

      const constraints = this.geometry.attributes.constraints;
      if (constraints) {
        for (let i = 0; i < size * 4; ++i) {
          newConstraints.copyAt(i, constraints, i);
        }
      }

      const matrices = this.geometry.attributes.matrices;
      if (matrices) {
        for (let i = 0; i < size * 4; ++i) {
          newMatrices.copyAt(i, matrices, i);
        }
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

    this.__segmentsCount += Math.floor(0.5 * newPointsCount);

    if (oldGeometry) {
      this.geometry = new BufferGeometry();
      if (this.pointObjects) {
        this.pointObjects.geometry = this.geometry;
      }
      oldGeometry.dispose();
    }
    this.geometry.computeBoundingBox = this.computeBoundingBox;
    this.geometry.computeBoundingSphere = this.computeBoundingSphere;

    this.geometry.setAttribute('position', newXYZ);
    this.geometry.setAttribute('sectionNormals', newNormals);
    this.geometry.setAttribute('constraints', newConstraints);
    this.geometry.setAttribute('matrices', newMatrices);

    newXYZ.needsUpdate = true;

    if (this.__segmentLabelsExist) {
      this.__changeSegmentLabels(this.__segmentsCount - (0.5 * newPointsCount), (0.5 * newPointsCount), GlPointAction.Add);
    }

    this.geometry.setDrawRange(0, this.__segmentsCount * 2);
    this.geometry.computeBoundingSphere();
  }

  // -------------------------------------
  // __computeSectionsAttributes
  // -------------------------------------
  __computeSectionsAttributes(startSegment, endSegment) {
    if (!this.__isValidIndex(startSegment)) {
      console.log('Ошибка: задан некорректный начальный сегмент');
      return;
    }
    if (!this.__isValidIndex(endSegment)) {
      console.log('Ошибка: задан некорректный конечный сегмент');
      return;
    }
    if (startSegment >= endSegment) {
      console.log('Ошибка: начальный сегмент должен быть < конечного сегмента');
      return;
    }

    const xyz = this.geometry.attributes.position;
    const normals = this.geometry.attributes.sectionNormals;
    const edgePlanes = this.geometry.attributes.constraints;
    const matrices = this.geometry.attributes.matrices;

    if (xyz && normals && edgePlanes && matrices) {
      const start = 2 * startSegment * xyz.itemSize;
      const end = 2 * (endSegment + 1) * xyz.itemSize;
      let nPos = startSegment;
      let ePos = startSegment * 4;
      let mPos = startSegment * 4;
      let firstPass = true;

      for (let i = start; i < end; i += 6) {
        this.__pt1.set(xyz.array[i], xyz.array[i + 1], xyz.array[i + 2]);
        this.__pt1.applyMatrix4(this.matrixWorld);

        this.__pt2.set(xyz.array[i + 3], xyz.array[i + 4], xyz.array[i + 5]);
        this.__pt2.applyMatrix4(this.matrixWorld);

        if (firstPass) {
          this.__segment1.set(this.__pt1, this.__pt2);
          firstPass = false;
          continue;
        }

        this.__segment2.set(this.__pt1, this.__pt2);

        // compute orientation matrices
        this.__axisX.subVectors(this.__segment2.start, this.__segment1.start).normalize();
        if (this.__axisX.length() < 0.1) this.__axisX.set(1, 0, 0);
        this.__axisZ.subVectors(this.__segment2.start, this.__segment2.end).normalize();
        if (this.__axisZ.length() < 0.1) this.__axisZ.set(0, 0, 1);
        this.__axisY.crossVectors(this.__axisZ, this.__axisX).normalize();
        this.__axisX.crossVectors(this.__axisY, this.__axisZ).normalize();

        // compute constraints
        this.__pt1.subVectors(this.__segment1.start, this.position);
        this.__pt2.subVectors(this.__segment2.start, this.position);

        // start writing results to the appropriate attributes
        edgePlanes.setXYZ(ePos++, this.__axisX.x, this.__axisX.y, this.__axisX.z);
        edgePlanes.setXYZ(ePos++, this.__pt1.x, this.__pt1.y, this.__pt1.z);
        edgePlanes.setXYZ(ePos++, this.__axisX.x, this.__axisX.y, this.__axisX.z);
        edgePlanes.setXYZ(ePos++, this.__pt2.x, this.__pt2.y, this.__pt2.z);

        matrices.setXYZ(mPos++, this.__axisX.x, this.__axisX.y, this.__axisX.z);
        matrices.setXYZ(mPos++, this.__axisY.x, this.__axisY.y, this.__axisY.z);
        matrices.setXYZ(mPos++, this.__axisZ.x, this.__axisZ.y, this.__axisZ.z);

        this.__pt1.subVectors(this.__segment1.start, this.position);
        matrices.setXYZ(mPos++, this.__pt1.x, this.__pt1.y, this.__pt1.z);

        this.__axisY.negate();
        normals.setXYZ(nPos++, this.__axisY.x, this.__axisY.y, this.__axisY.z);

        this.__segment1.set(this.__segment2.start, this.__segment2.end);
      }

      normals.needsUpdate = true;
      edgePlanes.needsUpdate = true;
      matrices.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------
  // setNormals()
  // ---------------------------------------------------------
  setNormals(index, array) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    const secNormals = this.geometry.attributes.sectionNormals;
    const matrices = this.geometry.attributes.matrices;
    const edgePlanes = this.geometry.attributes.constraints;
    if (secNormals && matrices && edgePlanes) {
      // adjust normals as: [x0, y0, z0, x1, y1, z1]
      const normals = this.__validateNormals(array);
      if (normals && normals.length) {
        let nPos = index;
        let ePos = index * 4;
        let mStart = index * 4 * matrices.itemSize;

        for (let i = 0, cnt = normals.length; i < cnt; i += 3) {
          this.__v3.set(normals[i], normals[i + 1], normals[i + 2]);

          // get a section's matrices
          const arr = matrices.array;
          this.__axisX.set(arr[mStart], arr[mStart + 1], arr[mStart + 2]);
          this.__axisZ.set(arr[mStart + 6], arr[mStart + 7], arr[mStart + 8]);
          mStart += 12;

          // compute new matrices and section constraints
          const dot = this.__axisZ.dot(this.__v3);
          const dot1 = this.__axisX.dot(this.__v3);
          if (1 - Math.abs(dot) < 1.e-2 || 1 - Math.abs(dot1) < 1.e-2) {
            nPos++;
            ePos += 4;
            continue;
          }

          this.__pt1.copy(this.__v3).negate();
          this.__axisX.crossVectors(this.__pt1, this.__axisZ).normalize();

          // start writing results to the appropriate attributes
          secNormals.setXYZ(nPos++, this.__v3.x, this.__v3.y, this.__v3.z);

          edgePlanes.setXYZ(ePos, this.__axisX.x, this.__axisX.y, this.__axisX.z);
          ePos += 2;
          edgePlanes.setXYZ(ePos, this.__axisX.x, this.__axisX.y, this.__axisX.z);
          ePos += 2;
        }

        secNormals.needsUpdate = true;
        edgePlanes.needsUpdate = true;
      }
    }
  }

  mapPointsToSections(object, isSectionsUnfolded) {
    if (!object) return null;

    const isPoint = object.isVector3;
    let isPointsArray = !isPoint && object instanceof Array;
    if (isPointsArray) isPointsArray = object.length > 0 && object[0].isVector3;

    let ptCount = 0;
    if (isPoint) ptCount = 1;
    else if (isPointsArray) ptCount = object.length;
    else if (object.getPointsCount) ptCount = object.getPointsCount();
    if (ptCount === 0) return null;

    const secNormals = this.geometry.attributes.sectionNormals;
    const edgePlanes = this.geometry.attributes.constraints;
    const matrices = this.geometry.attributes.matrices;
    if (secNormals && edgePlanes && matrices) {
      let points;
      if (isPoint) points = [object];
      else if (isPointsArray) points = object;
      else points = object.getPoints(0, ptCount - 1);

      const localPoints = [];
      const mappedTo = Array(points.length).fill(-1);
      const notHandled = Array(points.length).fill(-1);
      for (let i = 0, cnt = notHandled.length; i < cnt; i++) {
        notHandled[i] = i;
        localPoints.push(new Vector3());
      }

      const origin = new Vector3();
      const upDir = new Vector3();
      const trMatrix = new Matrix4();

      let secPos = -1;
      let handled = 0;
      const arr = edgePlanes.array;
      const arrM = matrices.array;
      const arrN = secNormals.array;
      const count = (this.__segmentsCount - 1) * 4 * edgePlanes.itemSize;
      for (let i = 0, j = 0; i < count; i += 12) {
        secPos++;

        // get a section's normal
        this.__v3.set(arrN[j], arrN[j + 1], arrN[j + 2]);
        j += 3;

        // get a section's constraints
        this.__lPlane.setComponents(arr[i], arr[i + 1], arr[i + 2], 0);
        this.__pt1.set(arr[i + 3], arr[i + 4], arr[i + 5]);
        this.__pt1.add(this.position);
        this.__lPlane.constant = - this.__pt1.dot(this.__lPlane.normal);

        this.__rPlane.setComponents(arr[i + 6], arr[i + 7], arr[i + 8], 0);
        upDir.set(arr[i + 9], arr[i + 10], arr[i + 11]);
        upDir.add(this.position);
        this.__rPlane.constant = - upDir.dot(this.__rPlane.normal);
        upDir.sub(this.__pt1).normalize();

        // get a section's matrices
        trMatrix.set(arrM[i], arrM[i + 3], arrM[i + 6], arrM[i + 9],
                     arrM[i + 1], arrM[i + 4], arrM[i + 7], arrM[i + 10],
                     arrM[i + 2], arrM[i + 5], arrM[i + 8], arrM[i + 11],
                     0, 0, 0, 1);
        this.__axisX.setFromMatrixColumn(trMatrix, 0);
        this.__axisY.setFromMatrixColumn(trMatrix, 1).negate();
        origin.setFromMatrixColumn(trMatrix, 3);
        origin.add(this.position);
        trMatrix.setPosition(origin);
        trMatrix.invert();

        const D_Y = - origin.dot(this.__axisY);
        let angle = this.__axisY.angleTo(this.__v3);
        const needAdjustFloor = Math.abs(angle) > this.EPS;
        let cosFloor = Math.cos(angle);
        if (Math.abs(cosFloor) < this.EPS) cosFloor = 1;

        const D_X = - origin.dot(this.__axisX);
        angle = this.__axisX.angleTo(upDir);
        const needAdjustWall = Math.abs(angle) > this.EPS;
        let cosWall = Math.cos(angle);
        if (Math.abs(cosWall) < this.EPS) cosWall = 1;

        let newInd = 0;
        const size = notHandled.length - handled;
        for (let k = 0; k < size; k++) {
          const ptIdx = notHandled[k];
          const point = points[ptIdx];

          if (this.__rPlane.distanceToPoint(point) <= this.EPS4) {
            if (this.__lPlane.distanceToPoint(point) >= -this.EPS4) {
              if (!isSectionsUnfolded) {
                if (needAdjustFloor) {
                  // project 'point' onto axisY
                  const dist = -(this.__axisY.dot(point) + D_Y);
                  this.__pt1.copy(this.__axisY).multiplyScalar(dist).add(point);
                  // get a diff vector
                  this.__pt2.subVectors(point, this.__pt1);
                  let len = this.__pt2.length()
                  if (len > this.EPS) {
                    len = len / cosFloor;
                    this.__pt2.normalize().multiplyScalar(len);
                    this.__pt1.copy(this.__v3).negate().multiplyScalar(len);
                    point.add(this.__pt1).add(this.__pt2);
                  }
                }

                if (needAdjustWall) {
                  // project 'point' onto __axisX
                  const dist = -(this.__axisX.dot(point) + D_X);
                  this.__pt1.copy(this.__axisX).multiplyScalar(dist).add(point);
                  // get a diff vector
                  this.__pt2.subVectors(point, this.__pt1);
                  let len = this.__pt2.length()
                  if (len > this.EPS) {
                    len = len / cosWall;
                    this.__pt2.normalize().multiplyScalar(len);
                    this.__pt1.copy(upDir).negate().multiplyScalar(len);
                    point.add(this.__pt1).add(this.__pt2);
                  }
                }
              }
              mappedTo[ptIdx] = secPos;
              localPoints[ptIdx].copy(point).applyMatrix4(trMatrix);
              handled++;
              continue;
            }
          }
          notHandled[newInd++] = ptIdx;
        }
      }
      return {mappedTo, localPoints};
    }

    return null;
  }

  mapPointsToSectionsWW(object, isSectionsUnfolded, width) {
    if (!object) return null;

    const isPoint = object.isVector3;
    let isPointsArray = !isPoint && object instanceof Array;
    if (isPointsArray) isPointsArray = object.length > 0 && object[0].isVector3;

    let ptCount = 0;
    if (isPoint) ptCount = 1;
    else if (isPointsArray) ptCount = object.length;
    else if (object.getPointsCount) ptCount = object.getPointsCount();
    if (ptCount === 0) return null;

    const secNormals = this.geometry.attributes.sectionNormals;
    const edgePlanes = this.geometry.attributes.constraints;
    const matrices = this.geometry.attributes.matrices;
    if (secNormals && edgePlanes && matrices) {
      let points;
      if (isPoint) points = [object];
      else if (isPointsArray) points = object;
      else points = object.getPoints(0, ptCount - 1);

      const localPoints = [];
      const mappedTo = Array(points.length).fill(-1);
      const notHandled = Array(points.length).fill(-1);
      for (let i = 0, cnt = notHandled.length; i < cnt; i++) {
        notHandled[i] = i;
        localPoints.push(new Vector3());
      }

      const origin = new Vector3();
      const upDir = new Vector3();
      const trMatrix = new Matrix4();

      let secPos = -1;
      let handled = 0;
      const arr = edgePlanes.array;
      const arrM = matrices.array;
      const arrN = secNormals.array;
      const count = (this.__segmentsCount - 1) * 4 * edgePlanes.itemSize;
      for (let i = 0, j = 0; i < count; i += 12) {
        secPos++;

        // get a section's normal
        this.__v3.set(arrN[j], arrN[j + 1], arrN[j + 2]);
        j += 3;

        // get a section's constraints
        this.__lPlane.setComponents(arr[i], arr[i + 1], arr[i + 2], 0);
        this.__pt1.set(arr[i + 3], arr[i + 4], arr[i + 5]);
        this.__pt1.add(this.position);
        const point1 = this.__pt1.clone();
        this.__lPlane.constant = - this.__pt1.dot(this.__lPlane.normal);

        this.__rPlane.setComponents(arr[i + 6], arr[i + 7], arr[i + 8], 0);
        upDir.set(arr[i + 9], arr[i + 10], arr[i + 11]);
        upDir.add(this.position);
        const point2 = upDir.clone();
        this.__rPlane.constant = - upDir.dot(this.__rPlane.normal);
        upDir.sub(this.__pt1).normalize();

        const pointRight = point2.sub(point1);
        const unitZ = new Vector3(0, 0, 1);

        const normal = unitZ.cross(pointRight).normalize();
        this.__rPlane2.setFromNormalAndCoplanarPoint(normal, point1);
        this.__rPlane2.constant = - point1.dot(this.__rPlane2.normal);

        const pointLeft = normal.clone();
        pointLeft.negate().setLength(width).add(point1);
        this.__lPlane2.setFromNormalAndCoplanarPoint(normal, pointLeft);
        this.__lPlane2.constant = - pointLeft.dot(this.__lPlane2.normal);

        // get a section's matrices
        trMatrix.set(arrM[i], arrM[i + 3], arrM[i + 6], arrM[i + 9],
                     arrM[i + 1], arrM[i + 4], arrM[i + 7], arrM[i + 10],
                     arrM[i + 2], arrM[i + 5], arrM[i + 8], arrM[i + 11],
                     0, 0, 0, 1);
        this.__axisX.setFromMatrixColumn(trMatrix, 0);
        this.__axisY.setFromMatrixColumn(trMatrix, 1).negate();
        origin.setFromMatrixColumn(trMatrix, 3);
        origin.add(this.position);
        trMatrix.setPosition(origin);
        trMatrix.invert();

        const D_Y = - origin.dot(this.__axisY);
        let angle = this.__axisY.angleTo(this.__v3);
        const needAdjustFloor = Math.abs(angle) > this.EPS;
        let cosFloor = Math.cos(angle);
        if (Math.abs(cosFloor) < this.EPS) cosFloor = 1;

        const D_X = - origin.dot(this.__axisX);
        angle = this.__axisX.angleTo(upDir);
        const needAdjustWall = Math.abs(angle) > this.EPS;
        let cosWall = Math.cos(angle);
        if (Math.abs(cosWall) < this.EPS) cosWall = 1;

        let newInd = 0;
        const size = notHandled.length - handled;
        for (let k = 0; k < size; k++) {
          const ptIdx = notHandled[k];
          const point = points[ptIdx];

          if (this.__rPlane.distanceToPoint(point) <= this.EPS4 && this.__rPlane2.distanceToPoint(point) <= this.EPS4) {
            if (this.__lPlane.distanceToPoint(point) >= -this.EPS4 && this.__lPlane2.distanceToPoint(point) >= -this.EPS4) {
              if (!isSectionsUnfolded) {
                if (needAdjustFloor) {
                  // project 'point' onto axisY
                  const dist = -(this.__axisY.dot(point) + D_Y);
                  this.__pt1.copy(this.__axisY).multiplyScalar(dist).add(point);
                  // get a diff vector
                  this.__pt2.subVectors(point, this.__pt1);
                  let len = this.__pt2.length();
                  if (len > this.EPS) {
                    len = len / cosFloor;
                    this.__pt2.normalize().multiplyScalar(len);
                    this.__pt1.copy(this.__v3).negate().multiplyScalar(len);
                    point.add(this.__pt1).add(this.__pt2);
                  }
                }

                if (needAdjustWall) {
                  // project 'point' onto __axisX
                  const dist = -(this.__axisX.dot(point) + D_X);
                  this.__pt1.copy(this.__axisX).multiplyScalar(dist).add(point);
                  // get a diff vector
                  this.__pt2.subVectors(point, this.__pt1);
                  let len = this.__pt2.length()
                  if (len > this.EPS) {
                    len = len / cosWall;
                    this.__pt2.normalize().multiplyScalar(len);
                    this.__pt1.copy(upDir).negate().multiplyScalar(len);
                    point.add(this.__pt1).add(this.__pt2);
                  }
                }
              }
              mappedTo[ptIdx] = secPos;
              localPoints[ptIdx].copy(point).applyMatrix4(trMatrix);
              handled++;
              continue;
            }
          }
          notHandled[newInd++] = ptIdx;
        }
      }
      return {mappedTo, localPoints};
    }

    return null;
  }


  adjustPointsToSections(object, mappedPoints, isSectionsUnfolded) {
    if (!object) return null;

    const isPoint = object.isVector3;
    let isPointsArray = !isPoint && object instanceof Array;
    if (isPointsArray) isPointsArray = object.length > 0 && object[0].isVector3;

    let ptCount = 0;
    if (isPoint) ptCount = 1;
    else if (isPointsArray) ptCount = object.length;
    else if (object.getPointsCount) ptCount = object.getPointsCount();
    if (ptCount === 0) return null;

    if (!(mappedPoints.mappedTo && mappedPoints.mappedTo.length)) return;

    const matrices = this.geometry.attributes.matrices;
    const secNormals = this.geometry.attributes.sectionNormals;
    const edgePlanes = this.geometry.attributes.constraints;
    if (matrices && secNormals && edgePlanes) {
      const notHandled = Array(ptCount).fill(-1);
      for (let i = 0, cnt = notHandled.length; i < cnt; i++) {
        notHandled[i] = i;
      }

      const upDir = new Vector3();
      const origin = new Vector3();
      const trMatrix = new Matrix4();

      let secPos = -1;
      let handled = 0;
      const arr = edgePlanes.array;
      const arrM = matrices.array;
      const arrN = secNormals.array;
      const count = (this.__segmentsCount - 1) * 4 * matrices.itemSize;
      for (let i = 0, j = 0; i < count; i += 12) {
        secPos++;

        // get a section's normal
        this.__v3.set(arrN[j], arrN[j + 1], arrN[j + 2]);
        j += 3;

        // get a section's constraints
        this.__lPlane.setComponents(arr[i], arr[i + 1], arr[i + 2], 0);
        this.__pt1.set(arr[i + 3], arr[i + 4], arr[i + 5]);
        this.__pt1.add(this.position);
        this.__lPlane.constant = - this.__pt1.dot(this.__lPlane.normal);

        this.__rPlane.setComponents(arr[i + 6], arr[i + 7], arr[i + 8], 0);
        upDir.set(arr[i + 9], arr[i + 10], arr[i + 11]);
        upDir.add(this.position);
        this.__rPlane.constant = - upDir.dot(this.__rPlane.normal);
        upDir.sub(this.__pt1).normalize();

        // get a section's matrices
        trMatrix.set(arrM[i], arrM[i + 3], arrM[i + 6], arrM[i + 9],
                     arrM[i + 1], arrM[i + 4], arrM[i + 7], arrM[i + 10],
                     arrM[i + 2], arrM[i + 5], arrM[i + 8], arrM[i + 11],
                     0, 0, 0, 1);
        this.__axisX.setFromMatrixColumn(trMatrix, 0);
        this.__axisY.setFromMatrixColumn(trMatrix, 1).negate();
        origin.setFromMatrixColumn(trMatrix, 3);
        origin.add(this.position);
        trMatrix.setPosition(origin);

        const D_Y = - origin.dot(this.__axisY);
        let dot = this.__axisY.dot(this.__v3);
        const needAdjustFloor = 1 - Math.abs(dot) > this.EPS;

        const D_X = - origin.dot(this.__axisX);
        dot = this.__axisX.dot(upDir);
        const needAdjustWall = 1 - Math.abs(dot) > this.EPS;

        let newInd = 0;
        const size = notHandled.length - handled;
        for (let k = 0; k < size; k++) {
          const ptIdx = notHandled[k];
          if (mappedPoints.mappedTo[ptIdx] === secPos) {
            const point = mappedPoints.localPoints[ptIdx];
            point.applyMatrix4(trMatrix);
            if (!isSectionsUnfolded) {
              if (needAdjustFloor || needAdjustWall) {
                // project 'point' onto axisY
                const dist = -(this.__axisY.dot(point) + D_Y);
                this.__pt1.copy(this.__axisY).multiplyScalar(dist).add(point);
                // get a diff vector
                this.__pt2.subVectors(point, this.__pt1);
                const len = this.__pt2.length()

                if (needAdjustWall) {
                  // project 'this.__pt1' onto axisX
                  const dist1 = -(this.__axisX.dot(this.__pt1) + D_X);
                  this.__pt3.copy(this.__axisX).multiplyScalar(dist1).add(this.__pt1);
                  // get a diff vector
                  this.__pt4.subVectors(this.__pt1, this.__pt3);
                  const len1 = this.__pt4.length()
                  if (len1 > this.EPS) {
                    this.__pt4.copy(upDir).multiplyScalar(len1);
                    point.addVectors(this.__pt3, this.__pt4);
                    this.__pt1.copy(point);
                  }
                }

                if (needAdjustFloor && len > this.EPS) {
                  this.__pt2.copy(this.__v3).multiplyScalar(len);
                  point.addVectors(this.__pt1, this.__pt2);
                }
              }
            }

            if (isPoint) object.copy(point);
            else if (isPointsArray) object[ptIdx].copy(point);
            else object.setPoint(ptIdx, point);

            handled++;
            continue;
          }
          notHandled[newInd++] = ptIdx;
        }
      }
    }
  }

  // ---------------------------------------------------------
  // addSegments()
  //  Override the GlSemgents 'addSegments' method
  // ---------------------------------------------------------
  addSegments(array) {
    // adjust a segment's coordinates as: [x0, y0, z0, x1, y1, z1]
    const coords = this.__validateCoordinates(array);
    if (coords && coords.length) {
      // now start adding segments
      if (this.geometry.attributes.position) {
        const xyz = this.geometry.attributes.position;
        const newPointsCount = coords.length / xyz.itemSize;
        const newSgmCount = Math.floor(0.5 * newPointsCount);
        let startInd = this.__segmentsCount ? this.__segmentsCount - 1 : 0;
        let endInd = startInd + newSgmCount;
        if (this.__segmentsCount === 0) endInd--;

        if (2 * this.__segmentsCount + newPointsCount <= xyz.count) {
          const lastIdx = 2 * this.__segmentsCount;

          // add new points coordinates
          const start = lastIdx * xyz.itemSize;
          const end = start + newPointsCount * xyz.itemSize;
          for (let i = start; i < end; i += 3) {
            xyz.array[i] = coords[i - start];
            xyz.array[i + 1] = coords[i - start + 1];
            xyz.array[i + 2] = coords[i - start + 2];
          }
          this.__segmentsCount += newSgmCount;

          this.geometry.setDrawRange(0, this.__segmentsCount * 2);
          xyz.needsUpdate = true;

          if (this.__segmentLabelsExist) {
            this.__changeSegmentLabels(this.__segmentsCount - newSgmCount, newSgmCount, GlPointAction.Add);
          }

          this.geometry.computeBoundingSphere();

          if (endInd > 0) this.__computeSectionsAttributes(startInd, endInd);
        } else {
          // the (position) BufferAttribute's size is not enough to add new
          // coordinates. Since the buffer size can't be changed in order
          // to re-size the BufferAttribute we'll create a new
          // BufferGeometry and dispose the current one
          this.__recreateBufferGeometry(coords);

          if (endInd > 0) this.__computeSectionsAttributes(startInd, endInd);
        }
      } else {
        this.__recreateBufferGeometry(coords);

        const newSgmCount = Math.floor(coords.length / 6) - 1;
        if (newSgmCount > 0) this.__computeSectionsAttributes(0, newSgmCount);
      }
    }
  }
}
