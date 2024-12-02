/* eslint-disable no-undef */
import { GlBase } from './gl-base';
import { GlLabel } from './gl-label';
import { MathUtils } from '../utils/math-utils';
import { GlLine3 } from '../math/gl-line3';
import { GlPointAction, GlSnapMode, Primitive_Type } from './gl-constants';
import { GlText } from './gl-text';
import { GlUtils } from '../utils/gl-utils';
import { GlRay } from './gl-ray';
import {
  BufferGeometry,
  LineBasicMaterial,
  Matrix4,
  Vector3,
  Float32BufferAttribute,
  BufferAttribute,
  PointsMaterial,
  Points,
  Box3,
  Sphere,
  Ray,
} from 'three';
import { mergeTextsIntoInstancedText } from '../troika/troika-three-text/InstancedText';

export class GlSegments extends GlBase {
  constructor(params, fromJSON) {
    super();

    params = params || {};
    const isFromJson = fromJSON && fromJSON.geometry ? true : false;
    const geometry = isFromJson ? fromJSON.geometry : params.geometry ? params.geometry : undefined;
    const material = params.material ? params.material : undefined;

    this.geometry = geometry ? geometry : new BufferGeometry();
    this.material = material ? material : new LineBasicMaterial();

    this.isLine = true;         // this is needed to render this object via WebGlRenderer correctly
    this.isLineSegments = true; // this is needed to render this object via WebGlRenderer correctly
    this.isGlSegments = true;
    this.type = 'GlSegments';
    this.name = params.name || "";
    if (params.uuid) this.uuid = params.uuid;

    this.EPS = 1e-8;
    this.__changesCount = 0;

    // selection
    this.selectable = true;
    this.snappable = true;

    // deletion
    this.nonRemovable = false;

    // line's params
    this.lineColor = 0x000000;
    if (params.color) this.lineColor = params.color;
    if (!material) {
      this.material.color.setHex(this.lineColor);
    } else if (material && material.color) {
      this.lineColor = material.color.getHex();
    }

    // point objects
    this.pointObjects = null;
    this.pointObjectsColor = 0x000000;

    // segments' labels
    this.segmentLabels = [];
    this.segmentLabelsColor = 0x0000FF;
    this.segmentLabelsFont = '';
    this.__segmentLabelsExist = false;

    if (isFromJson) {
      if (fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    } else {
      this.__segmentsCount = 0;
      this.geometry.setDrawRange(0, this.__segmentsCount * 2);
    }
  }

  // ------------------------------------------------
  // initialize an object from JSON
  // ------------------------------------------------
  __initFromJson(fromJSON) {
    //uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.n) this.name = fromJSON.n;

    //objectType
    if (fromJSON.oT) this.objectType = fromJSON.oT;
    if (fromJSON.aT) {
      this.attachedText = new GlText({}, fromJSON.aT.object);
      this.attachedText.sync(this.handleLabel());
      this.add(this.attachedText);
    }

    // segments' count
    this.__segmentsCount = fromJSON.sCt;
    this.geometry.setDrawRange(0, this.__segmentsCount * 2);

    // line's params
    this.lineColor = fromJSON.lC;
    this.material.color.setHex(this.lineColor);

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;

    this.geometry.computeBoundingBox = this.computeBoundingBox;
    this.geometry.computeBoundingSphere = this.computeBoundingSphere;
    this.geometry.computeBoundingSphere();

    // point objects
    this.pointObjectsColor = fromJSON.pOС;

    // segments' labels
    this.segmentLabelsFont = fromJSON.sLF;
    this.segmentLabelsColor = fromJSON.sLC;
    if (fromJSON.sLE) this.showSegmentLabels(true);
  }

  // ------------------------------------------------
  // initialize an object from JSON_v1
  // ------------------------------------------------
  __initFromJson_v4_5(fromJSON) {
    // uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.name) this.name = fromJSON.name;

    //objectType
    if (fromJSON.objectType) this.objectType = fromJSON.objectType;
    if (fromJSON.attachedText) {
      this.attachedText = new GlText({}, fromJSON.attachedText.object);
      this.attachedText.sync(this.handleLabel());
      this.add(this.attachedText);
    }

    // segments' count
    this.__segmentsCount = fromJSON.segmentsCount;
    this.geometry.setDrawRange(0, this.__segmentsCount * 2);

    // line's params
    this.lineColor = fromJSON.lineColor;
    this.material.color.setHex(this.lineColor);

    if (fromJSON.matrix !== undefined) {
      this.matrix.fromArray(fromJSON.matrix);
      if (fromJSON.matrixAutoUpdate !== undefined) this.matrixAutoUpdate = fromJSON.matrixAutoUpdate;
      if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);
    } else {
      if (fromJSON.position !== undefined) this.position.fromArray(fromJSON.position);
      if (fromJSON.rotation !== undefined) this.rotation.fromArray(fromJSON.rotation);
      if (fromJSON.quaternion !== undefined) this.quaternion.fromArray(fromJSON.quaternion);
      if (fromJSON.scale !== undefined) this.scale.fromArray(fromJSON.scale);
    }

    if (fromJSON.renderOrder) this.renderOrder = fromJSON.renderOrder;

    this.geometry.computeBoundingBox = this.computeBoundingBox;
    this.geometry.computeBoundingSphere = this.computeBoundingSphere;
    this.geometry.computeBoundingSphere();

    // point objects
    this.pointObjectsColor = fromJSON.pointObjectsColor;

    // segments' labels
    this.segmentLabelsFont = fromJSON.segmentLabelsFont;
    this.segmentLabelsColor = fromJSON.segmentLabelsColor;
    if (fromJSON.segmentLabelsExist) this.showSegmentLabels(true);
  }

  // ------------------------------------------------
  // clone the current segments and return it
  // ------------------------------------------------
  clone(keepUuid, keepParent) {
    const clone = new this.constructor();

    const oldGeom = clone.geometry;
    clone.geometry = this.geometry.clone();
    if (oldGeom) oldGeom.dispose();
    clone.geometry.computeBoundingBox = clone.computeBoundingBox;
    clone.geometry.computeBoundingSphere = clone.computeBoundingSphere;
    clone.__segmentsCount = this.__segmentsCount;

    if (typeof keepUuid === 'boolean' && keepUuid) clone.uuid = this.uuid;
    clone.name = this.name;
    if (this.objectType) clone.objectType = this.objectType;
    clone.selectable = this.selectable;
    clone.snappable = this.snappable;

    clone.frustumCulled = this.frustumCulled;

    clone.position.copy(this.position);
    clone.rotation.order = this.rotation.order;
    clone.quaternion.copy(this.quaternion);
    clone.scale.copy(this.scale);
    clone.pivotOffset.copy(this.pivotOffset);

    clone.matrix.copy(this.matrix);
    clone.matrixWorld.copy(this.matrixWorld);
    if (this.parent && !this.parent.isScene) {
      // since the pivot offset is integrated into an object's
      // local matrix we need to compute actual matrixWorld of parents
      let scope = this;
      const parents = [];
      while (scope.parent && scope.parent.matrixWorld && !scope.parent.isScene) {
        parents.push(scope.parent);
        scope = scope.parent;
      }
      const m4 = new Matrix4();
      for (let i = parents.length - 1; i >= 0; i--) {
        const p = parents[i];
        if (i === parents.length - 1) {
          m4.compose(p.position, p.quaternion, p.scale);
        } else {
          this.__m4.compose(p.position, p.quaternion, p.scale);
          m4.multiply(this.__m4);
        }
      }
      clone.matrix.compose(this.position, this.quaternion, this.scale);
      clone.matrixWorld.multiplyMatrices(m4, clone.matrix);
      if (!keepParent)
        clone.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
    }
    clone.matrixAutoUpdate = this.matrixAutoUpdate;
    clone.matrixWorldNeedsUpdate = this.matrixWorldNeedsUpdate;

    clone.layers.mask = this.layers.mask;
    clone.visible = this.visible;

    clone.renderOrder = this.renderOrder;
    clone.userData = JSON.parse(JSON.stringify(this.userData));

    clone.setPointsColor(this.pointObjectsColor);
    clone.setLineColor(this.lineColor);
    if (this.pointObjects && this.pointObjects.length) clone.showPoints(true);

    if (this.isSelected) clone.deselect();
    clone.isSelected = false;

    return clone;
  }

  // ---------------
  // copy()
  // ---------------
  copy(source) {
    super.copy(source, recursive);
    this.material = source.material;
    this.geometry = source.geometry;

    return this;
  }

  // -------------------------------------
  // computeLineDistances()
  // -------------------------------------
  computeLineDistances() {
    const geometry = this.geometry;

    // we assume non-indexed geometry
    if (geometry.index === null) {
      const _start = new Vector3();
      const _end = new Vector3();
      const positionAttribute = geometry.attributes.position;
      const lineDistances = [];

      for (let i = 0, l = positionAttribute.count; i < l; i += 2) {
        _start.fromBufferAttribute(positionAttribute, i);
        _end.fromBufferAttribute(positionAttribute, i + 1);

        lineDistances[i] = (i === 0) ? 0 : lineDistances[i - 1];
        lineDistances[i + 1] = lineDistances[i] + _start.distanceTo(_end);
      }
      geometry.setAttribute('lineDistance', new Float32BufferAttribute(lineDistances, 1));
    } else {
      console.warn('GlSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.');
    }

    return this;
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
      if (this.pointObjects) {
        this.pointObjects.geometry = this.geometry;
      }
      oldGeometry.dispose();
    }
    this.geometry.computeBoundingBox = this.computeBoundingBox;
    this.geometry.computeBoundingSphere = this.computeBoundingSphere;

    this.geometry.setAttribute('position', newXYZ);

    newXYZ.needsUpdate = true;

    if (this.__segmentLabelsExist) {
      this.__changeSegmentLabels(this.__segmentsCount - (0.5 * newPointsCount), (0.5 * newPointsCount), GlPointAction.Add);
    }

    this.geometry.setDrawRange(0, this.__segmentsCount * 2);
    this.geometry.computeBoundingSphere();
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (index !== undefined && index !== null &&
      index >= 0 && index < this.__segmentsCount) {
      return true;
    }
    return false;
  }

  // -------------------------------------
  // check if numbers are equal
  // -------------------------------------
  __isEqual(first, second, epsilon) {
    if (epsilon) return Math.abs(first - second) < epsilon;
    else return Math.abs(first - second) < this.EPS;
  }

  // --------------------
  // dispose
  // --------------------
  dispose() {
    super.dispose();

    // point objects
    if (this.pointObjects) {
      this.remove(this.pointObjects);
      this.pointObjects.material.dispose();
      this.pointObjects.geometry.dispose();
    }
    // segments' labels
    if (this.segmentLabels.length > 0) this.__destroySegmentLabels();

    this.material.dispose();
    this.geometry.dispose();
  }

  // ---------------------------------------------------------
  // setSegment() / setSegments()
  // 
  // input coordinates can be: 
  //  an instance of GlLine3,
  //  or an array of GlLine3 instances: [obj1, obj2];
  //  or an array of points pairs: [pt1, pt2,... ptn-1, ptn]
  //  or an array of coords: [x1, y1, z1, x2, y2, z2, ...]
  // 
  // ---------------------------------------------------------
  setSegment(index, coord) {
    this.setSegments(index, coord);
  }

  setSegments(index, array) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    const xyz = this.geometry.attributes.position;
    if (xyz) {
      // adjust coordinates as: [x0, y0, z0, x1, y1, z1]
      const coords = this.__validateCoordinates(array);
      if (coords && coords.length) {
        const allPtCnt = 2 * this.__segmentsCount;
        const ptCount = coords.length / xyz.itemSize;
        const ptIndex = 2 * index;

        // set new coordinates
        const last = ptIndex + ptCount > allPtCnt ? allPtCnt : ptIndex + ptCount;
        for (let i = ptIndex; i < last; ++i) {
          const pos = (i - ptIndex) * xyz.itemSize;
          xyz.setXYZ(i, coords[pos], coords[pos + 1], coords[pos + 2]);
        }

        xyz.needsUpdate = true;

        if (this.__segmentLabelsExist) {
          this.__changeSegmentLabels(index, ptCount, GlPointAction.Set);
        }

        this.geometry.computeBoundingSphere();
      }
    }
  }

  // ---------------------------------------------------------
  // addSegment() / addSegments()
  //
  // input coordinates can be: 
  //  an instance of GlLine3,
  //  or an array of GlLine3 instances: [obj1, obj2];
  //  or an array of points pairs: [pt1, pt2,... ptn-1, ptn]
  //  or an array of coords: [x1, y1, z1, x2, y2, z2, ...]
  //
  // ---------------------------------------------------------
  addSegment(points) {
    this.addSegments(points);
  }

  addSegments(array) {
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

  // -------------------------------------------------------
  // insertSegment() / insertSegments()
  // 
  // input coordinates can be: 
  //  an instance of GlLine3,
  //  or an array of GlLine3 instances: [obj1, obj2];
  //  or an array of points pairs: [pt1, pt2,... ptn-1, ptn]
  //  or an array of coords: [x1, y1, z1, x2, y2, z2, ...]
  //
  // --------------------------------------------------------
  insertSegment(index, point) {
    this.insertSegments(index, point);
  }

  insertSegments(index, array) {
    if (index === 0 && this.__segmentsCount === 0) {
      this.addSegments(array);
    } else {
      if (!this.__isValidIndex(index)) {
        console.log('Ошибка: задан некорректный индекс');
        return;
      }

      const coords = this.__validateCoordinates(array);
      if (coords && coords.length) {
        if (this.geometry.attributes.position) {
          const xyz = this.geometry.attributes.position;
          const newPointsCount = coords.length / xyz.itemSize;
          if (2 * this.__segmentsCount + newPointsCount <= xyz.count) {
            const insertStart = 2 * index * xyz.itemSize;
            const insertEnd = insertStart + newPointsCount * xyz.itemSize;

            // move existing points
            const moveStart = 2 * this.__segmentsCount * xyz.itemSize - 1;
            const moveEnd = 2 * index * xyz.itemSize;
            const moveSize = newPointsCount * xyz.itemSize;
            for (let i = moveStart; i >= moveEnd; --i) {
              xyz.array[i + moveSize] = xyz.array[i];
            }

            // add new points coordinates
            for (let i = insertStart; i < insertEnd; i += 3) {
              xyz.array[i] = coords[i - insertStart];
              xyz.array[i + 1] = coords[i - insertStart + 1];
              xyz.array[i + 2] = coords[i - insertStart + 2];
            }
            this.__segmentsCount += (0.5 * newPointsCount);

            this.geometry.setDrawRange(0, this.__segmentsCount * 2);
            xyz.needsUpdate = true;

            if (this.__segmentLabelsExist) {
              this.__changeSegmentLabels(index, (insertEnd - insertStart) / xyz.itemSize, GlPointAction.Insert);
            }

            this.geometry.computeBoundingSphere();
          } else {
            // the (position) BufferAttribute's size is not enough to add new
            // coordinates. Since the buffer size can't be changed in order
            // to re-size the BufferAttribute we'll create a new
            // BufferGeometry and dispose the current one
            const lastIdx = 2 * this.__segmentsCount * xyz.itemSize;
            const newCoordsSize = lastIdx + coords.length;
            const newCoords = Array(newCoordsSize).fill(0.0);
            const breakPoint = index * xyz.itemSize;
            let i; let j;
            for (i = 0; i < breakPoint; i += 3) {
              newCoords[i] = xyz.array[i];
              newCoords[i + 1] = xyz.array[i + 1];
              newCoords[i + 2] = xyz.array[i + 2];
            }
            for (j = 0; j < coords.length; j += 3) {
              newCoords[j + i] = coords[j];
              newCoords[j + i + 1] = coords[j + 1];
              newCoords[j + i + 2] = coords[j + 2];
            }
            j += i;
            for (i = breakPoint; i < lastIdx; i += 3) {
              newCoords[j] = xyz.array[i];
              newCoords[j + 1] = xyz.array[i + 1];
              newCoords[j + 2] = xyz.array[i + 2];
              j += 3;
            }
            this.__segmentsCount = 0;
            this.__recreateBufferGeometry(newCoords);
          }
        } else {
          this.__recreateBufferGeometry(coords);
        }
      }
    }
  }

  // -------------------------------------
  // deleteSegment() / deleteSegments()
  // -------------------------------------
  deleteSegment(index) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    this.deleteSegments(index, index);
  }

  deleteSegments(startIndex = 0, endIndex = this.getSegmentsCount() - 1) {
    if (!this.__isValidIndex(startIndex)) {
      console.log('Ошибка: задан некорректный начальный индекс');
      return;
    }
    if (!this.__isValidIndex(endIndex)) {
      console.log('Ошибка: задан некорректный конечный индекс');
      return;
    }
    if (startIndex > endIndex) {
      console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
      return;
    }

    const xyz = this.geometry.attributes.position;
    if (xyz) {
      const start = 2 * (endIndex + 1) * xyz.itemSize;
      const end = 2 * this.__segmentsCount * xyz.itemSize;
      const delCount = 2 * (endIndex - startIndex + 1) * xyz.itemSize;

      // move coordinates
      for (let i = start; i <= end; ++i) {
        // TodO set last point to 0
        xyz.array[i - delCount] = xyz.array[i];
      }

      // set a new points count
      this.__segmentsCount -= endIndex - startIndex + 1;

      // xyz.setXYZ(this.__segmentsCount, 0, 0, 0);

      this.geometry.setDrawRange(0, this.__segmentsCount * 2);
      xyz.needsUpdate = true;

      if (this.__segmentsCount === 0) this.resetPivotPoint();

      if (this.__segmentLabelsExist) {
        this.__changeSegmentLabels(startIndex, endIndex - startIndex + 1, GlPointAction.Delete);
      }

      this.geometry.computeBoundingSphere();
    }
  }

  // -------------------------------------
  // deleteAllSegments()
  // -------------------------------------
  deleteAllSegments() {
    const xyz = this.geometry.attributes.position;
    if (xyz) {
      this.__segmentsCount = 0;
      this.geometry.setDrawRange(0, this.__segmentsCount);
      this.resetPivotPoint();

      if (this.__segmentLabelsExist) {
        this.__changeSegmentLabels(0, this.__segmentsCount, GlPointAction.Delete);
      }

      this.geometry.computeBoundingSphere();
    }
  }

  setGeometryIndex(indexArray) {
    this.geometry.setIndex(indexArray);
    this.__segmentsCount = indexArray.length / 2;
    this.geometry.setDrawRange(0, this.__segmentsCount * 2);
  }

  deleteIndexedSegmentsByVertexIndex(index) {
    this.deleteIndexedSegmentsByVertexIndexRange(index, index);
  }

  deleteIndexedSegmentsByVertexIndexRange(startIndex, endIndex) {
    if (this.geometry.index) {
      const indexArray = this.geometry.index.array;
      const length = this.__segmentsCount * 2;
      const delCount = endIndex - startIndex + 1;
      for (let i = 0, j = 0; j < length; j += 2) {
        const startPointIncluded = indexArray[j] >= startIndex && indexArray[j] <= endIndex;
        const endPointIncluded = indexArray[j + 1] >= startIndex && indexArray[j + 1] <= endIndex;
        if (startPointIncluded || endPointIncluded) {
          this.__segmentsCount -= 1;
          continue;
        }

        indexArray[i] = indexArray[j];
        indexArray[i + 1] = indexArray[j + 1];

        if (indexArray[i] > endIndex) indexArray[i] -= delCount;
        if (indexArray[i + 1] > endIndex) indexArray[i + 1] -= delCount;

        i += 2;
      }

      this.geometry.index.needsUpdate = true;
      this.geometry.setDrawRange(0, this.__segmentsCount * 2);

      // todo: reset pivot point?
      // todo: change segment labels?
    }
  }

  deleteIndexedSegmentsBySegmentIndex(index) {
    this.deleteIndexedSegmentsBySegmentIndexRange(index, index);
  }

  deleteIndexedSegmentsBySegmentIndexRange(startIndex, endIndex) {
    if (this.geometry.index) {
      const indexArray = this.geometry.index.array;
      const length = this.__segmentsCount * 2;
      const delCount = endIndex - startIndex + 1;
      const start = 2 * startIndex;
      const end = 2 * ( endIndex + 1 );
      for (let i = 0, j = 0; j < length; j += 2) {
        if (j >= start && j < end) {
          this.__segmentsCount -= 1;
          continue;
        }

        indexArray[i] = indexArray[j];
        indexArray[i + 1] = indexArray[j + 1];

        // if (indexArray[i] > endIndex) indexArray[i] -= delCount;
        // if (indexArray[i + 1] > endIndex) indexArray[i + 1] -= delCount;

        i += 2;
      }

      this.geometry.index.needsUpdate = true;
      this.geometry.setDrawRange(0, this.__segmentsCount * 2);
    }
  }

  addSegmentIndices(indices) {
    if (indices.length % 2) {
      console.error("Segment indices are incorrect")
      return;
    }

    let indArray = this.geometry.index;

    if (indArray) {
      if (this.__segmentsCount * 2 + indices.length >= indArray.count) {
        // no space enough recreate BufferAttribute
        const newIndices = new Uint32Array(this.__segmentsCount * 2 + indices.length + 15);
        for (let i = 0; i < this.__segmentsCount * 2; i++) {
          newIndices[i] = indArray.array[i];
        }

        this.geometry.setIndex(new BufferAttribute(newIndices, 1));
        indArray = this.geometry.index;
      }

      for (let i = 0; i < indices.length && this.__segmentsCount * 2 < indArray.count; i += 2) {
        indArray.array[this.__segmentsCount * 2] = indices[i];
        indArray.array[this.__segmentsCount * 2 + 1] = indices[i + 1];
        this.__segmentsCount++;
      }

      this.geometry.setDrawRange(0, this.__segmentsCount * 2);
      indArray.needsUpdate = true;
      this.geometry.computeBoundingSphere();
    }
  }

  // ---------------------------------------------------
  // getSegmentPoints()
  //
  // returns a segment's points as: 
  //  an array of point object pairs: [pt1, pt2]
  //  or an array of coords: [x1, y1, z1, x2, y2, z2]
  // ---------------------------------------------------
  getSegmentPoints(index, asFlatArray) {
    if (this.__isValidIndex(index)) {
      const xyz = this.geometry.attributes.position;
      if (xyz) {
        const point = [];
        let start = 2 * index * xyz.itemSize;
        for (let i = 1; i < 2; i++) {
          this.__v3.set(xyz.array[start], xyz.array[start + 1], xyz.array[start + 2]);
          this.__v3.applyMatrix4(this.matrixWorld);
          if (asFlatArray) {
            point.push(this.__v3.x, this.__v3.y, this.__v3.z);
          } else {
            point.push(this.__v3.clone());
          }
          start += 3;
        }
        return point;
      }
      return null;
    }

    console.log('Ошибка: задан некорректный индекс');
    return null;
  }

  // --------------------------------------------------------
  // getSegmentsPoints()
  //
  // returns a segments points as: 
  //  an array of point objects pairs: [pt1, pt2, ... ]
  //  or an array of coords: [x1, y1, z1, x2, y2, z2, ...]
  // --------------------------------------------------------
  getSegmentsPoints(startIndex = 0, endIndex = this.getSegmentsCount() - 1, asFlatArray) {
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

    const xyz = this.geometry.attributes.position;
    if (xyz) {
      const start = 2 * startIndex * xyz.itemSize;
      const end = 2 * (endIndex + 1) * xyz.itemSize;
      for (let i = start; i < end; i += 3) {
        this.__v3.set(xyz.array[i], xyz.array[i + 1], xyz.array[i + 2]);
        this.__v3.applyMatrix4(this.matrixWorld);

        if (asFlatArray) {
          result.push(this.__v3.x, this.__v3.y, this.__v3.z);
        } else {
          result.push(this.__v3.clone());
        }
      }
    }
    return result;
  }

  // --------------------------------------
  // getSegmentAt()
  // 
  // returns a segment as a GlLine3 object
  // --------------------------------------
  getSegmentAt(index) {
    if (this.__isValidIndex(index)) {
      const xyz = this.geometry.attributes.position;
      if (xyz) {
        const segment = new GlLine3();
        let start = 2 * index * xyz.itemSize;
        for (let i = 1; i <= 2; i++) {
          this.__v3.set(xyz.array[start], xyz.array[start + 1], xyz.array[start + 2]);
          this.__v3.applyMatrix4(this.matrixWorld);
          if (i === 1) segment.start.copy(this.__v3);
          else segment.end.copy(this.__v3);
          start += 3;
        }
        return segment;
      }
      return null;
    }

    console.log('Ошибка: задан некорректный индекс');
    return null;
  }

  // -------------------------------------
  // getSegments()
  // 
  // returns segments as an array of
  // GlLine3 objects
  // -------------------------------------
  getSegments(startIndex = 0, endIndex = this.getSegmentsCount() - 1) {
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

    const xyz = this.geometry.attributes.position;
    if (xyz) {
      const start = 2 * startIndex * xyz.itemSize;
      const end = 2 * (endIndex + 1) * xyz.itemSize;
      let firstPt = true;
      let segment = null;
      for (let i = start; i < end; i += 3) {
        this.__v3.set(xyz.array[i], xyz.array[i + 1], xyz.array[i + 2]);
        this.__v3.applyMatrix4(this.matrixWorld);

        if (firstPt) {
          result.push(new GlLine3());
          segment = result[result.length - 1];
          segment.start.copy(this.__v3);
          firstPt = false;
        }
        else {
          segment.end.copy(this.__v3);
          firstPt = true;
        }
      }
    }
    return result;
  }

  // -------------------------------------
  // get length
  // -------------------------------------
  getLength() {
    let length = 0;
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__segmentsCount > 0) {
      let x = xyz.getX(0);
      let y = xyz.getY(0);
      let z = xyz.getZ(0);
      let x1; let y1; let z1;
      for (let i = 1; i < 2 * this.__segmentsCount; i++) {
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

  // -------------------------------------
  // get projected length
  // -------------------------------------
  getProjectedLength(normal) {
    let projectedLength = 0;
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__segmentsCount > 0) {
      const prevPoint = new Vector3();
      const nextPoint = new Vector3();

      prevPoint.set(xyz.getX(0), xyz.getY(0), xyz.getZ(0));
      if (normal && normal.isVector3) prevPoint.projectOnPlane(normal);
      for (let i = 1; i < 2 * this.__segmentsCount; i++) {
        nextPoint.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        if (normal && normal.isVector3) nextPoint.projectOnPlane(normal);
        projectedLength += Math.sqrt(((prevPoint.x - nextPoint.x) * (prevPoint.x - nextPoint.x)) +
          ((prevPoint.y - nextPoint.y) * (prevPoint.y - nextPoint.y)) +
          ((prevPoint.z - nextPoint.z) * (prevPoint.z - nextPoint.z)));

        prevPoint.copy(nextPoint);
      }
    }
    return projectedLength;
  }

  // -------------------------------------
  // getSegmentsCount()
  // -------------------------------------
  getSegmentsCount() {
    return this.__segmentsCount;
  }

  // -------------------------------------
  // getPointsCount()
  // -------------------------------------
  getPointsCount() {
    return this.__segmentsCount * 2;
  }

  // -------------------------------------
  // showPoints()
  // -------------------------------------
  showPoints(flag) {
    if (flag) {
      if (!this.pointObjects && this.geometry.attributes.position) {
        const material = new PointsMaterial({
          size: 5,
          color: this.pointObjectsColor,
        });

        this.pointObjects = new Points(this.geometry, material);
        this.pointObjects.raycast = function (raycaster, intersects) { };
        this.pointObjects.name = "points";
        this.add(this.pointObjects);
      } else if (this.pointObjects) {
        this.pointObjects.visible = true;
      }
    } else if (this.pointObjects && this.pointObjects.visible) {
      this.pointObjects.visible = false;
    }
  }

  isPointsShown() {
    let shown = this.pointObjects && this.pointObjects.visible;
    if (shown && this.isSelected) {
      shown = this.__pointObjectsBeforeSel ? true : false;
    }

    return shown;
  }

  // -------------------------------------
  // ACTIONS ON SEGMENT LABELS
  // -------------------------------------

  // -------------------------------------
  // create or destroy segment labels
  // -------------------------------------
  showSegmentLabels(flag) {
    if (flag && !this.__segmentLabelsExist) {
      this.__createSegmentLabels();
    } else if (!flag && this.__segmentLabelsExist) {
      this.__destroySegmentLabels();
    }
  }

  __changeSegmentLabels(index, changedPointQuantity, action) {
    const xyz = this.geometry.attributes.position;
    if (xyz) {
      const syncPromises = [];
      if (action === GlPointAction.Delete) {
        for (let i = this.__segmentsCount + changedPointQuantity - 1; i >= this.__segmentsCount; i--) {
          // this.remove(this.segmentLabels[i]);
          this.segmentLabels[i].dispose();
        }

        this.segmentLabels.splice(this.__segmentsCount, changedPointQuantity);

        for (let i = index; i < this.__segmentsCount; i++) {
          this.segmentLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        }
      } else if (action === GlPointAction.Insert || action === GlPointAction.Add) {
        if (index !== this.__segmentsCount - changedPointQuantity && action === GlPointAction.Insert) {
          for (let i = index; i < this.__segmentsCount - changedPointQuantity; i++) {
            this.segmentLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
          }
        }

        for (let i = this.__segmentsCount - changedPointQuantity; i < this.__segmentsCount; i++) {
          const ind = i + 1;
          const coordLabel = ind.toString();

          const point = {
            x: xyz.getX(i),
            y: xyz.getY(i),
            z: xyz.getZ(i),
          };

          const label = new GlLabel({
            text: coordLabel,
            color: this.segmentLabelsColor,
            fontSize: 0.12,
            font: this.segmentLabelsFont,
            orientation: "camera"
          });

          // label.sync();
          syncPromises.push(label.sync());
          label.position.set(point.x, point.y, point.z);
          // this.add(label);
          this.segmentLabels.push(label);
        }
      } else if (action === GlPointAction.Set) {
        if (changedPointQuantity === 1 && index === 0) {
          this.segmentLabels[0].position.set(xyz.getX(0), xyz.getY(0), xyz.getZ(0));

        } else if (changedPointQuantity === 1 && index === this.__segmentsCount - 1) {
          const lastPnt = this.__segmentsCount - 1;
          this.segmentLabels[lastPnt].position.set(xyz.getX(lastPnt), xyz.getY(lastPnt), xyz.getZ(lastPnt));

        } else {
          for (let i = index; i < index + changedPointQuantity; i++) {
            this.segmentLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
          }
        }
      }
      this.__executeOnLabelsUpdated(syncPromises);
    }
  }

  __createSegmentLabels() {
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__segmentsCount > 0 && this.segmentLabels.length === 0) {
      const syncPromises = [];
      for (let i = 0; i < this.__segmentsCount; ++i) {
        const ind = i + 1;
        const coordLabel = ind.toString();

        const point = {
          x: xyz.getX(i),
          y: xyz.getY(i),
          z: xyz.getZ(i),
        };

        const label = new GlLabel({
          text: coordLabel,
          color: this.segmentLabelsColor,
          fontSize: 0.12,
          font: this.segmentLabelsFont,
          orientation: "camera",
          scaleFactor: true,
        });

        syncPromises.push(label.sync());
        label.position.set(point.x, point.y, point.z);
        // this.add(label);
        this.segmentLabels.push(label);
      }
      this.__executeOnLabelsUpdated(syncPromises);
      this.__segmentLabelsExist = true;
    }
  }

  async __executeOnLabelsUpdated(syncPromises) {
    await Promise.all(syncPromises);
    // all texts sync complete
    if (this.instancedLabel) {
      this.remove(this.instancedLabel);
      this.instancedLabel.dispose();
    }
    this.instancedLabel = mergeTextsIntoInstancedText(this.segmentLabels);
    if (this.instancedLabel) this.add(this.instancedLabel);
    this.handleLabel()();
  }

  __destroySegmentLabels() {
    for (const label of this.segmentLabels) {
      // this.remove(label);
      label.dispose();
    }
    if (this.instancedLabel) {
      this.remove(this.instancedLabel);
      this.instancedLabel.dispose();
    }
    this.segmentLabels.length = 0;
    this.__segmentLabelsExist = false;
  }

  isSegmentLabelsShown() {
    return this.__segmentLabelsExist;
  }

  // -------------------------------------
  // setSegmentLabelsFont()
  // -------------------------------------
  setSegmentLabelsFont(font) {
    if (typeof font === 'string' && font.length > 5) {
      this.showSegmentLabels(false);
      this.segmentLabelsFont = font;
      this.showSegmentLabels(true);
    }
  }

  // -------------------------------------
  // setSegmentLabelsColor()
  // -------------------------------------
  setSegmentLabelsColor(color) {
    if (color === null || color === undefined) return;

    this.segmentLabelsColor = color;
    if (this.__segmentLabelsExist) {
      for (const label of this.segmentLabels) {
        label.setColor(this.segmentLabelsColor);
      }
    }
  }

  // -------------------------------------
  // setPointsColor()
  // -------------------------------------
  setPointsColor(color) {
    if (color !== null || color !== undefined) this.pointObjectsColor = color;
    if (this.pointObjects && !this.isSelected) {
      this.pointObjects.material.color.setHex(this.pointObjectsColor);
    }
  }

  // -------------------------------------
  // setLineColor()
  // -------------------------------------
  setLineColor(color) {
    if (color !== null || color !== undefined) this.lineColor = color;
    if (this.material && !this.isSelected) {
      this.material.color.setHex(this.lineColor);
    }
  }

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox() {
    const boundingBox = new Box3();
    if (this.geometry) {
      if (!this.geometry.boundingBox) {
        this.geometry.computeBoundingBox();
      }

      boundingBox.copy(this.geometry.boundingBox);
      boundingBox.applyMatrix4(this.matrixWorld);
    }

    return boundingBox.isEmpty() ? null : boundingBox;
  }

  // -------------------------------------
  // calculate the centroid of a polyline in
  // terms of world coordinates
  // -------------------------------------
  getCentroid() {
    if (this.__segmentsCount > 0) {
      // calculate centroid of the polyline
      const centroid = new Vector3();
      let point;
      for (let i = 0; i < this.__segmentsCount; i++) {
        point = this.getSegmentAt(i);
        centroid.add(point);
      }
      centroid.divideScalar(this.__segmentsCount);

      return centroid;
    }

    return null;
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

  // -------------------------------------
  // reverse existing points' order
  // -------------------------------------
  reverseOrder() {
    const xyz = this.geometry.attributes.position;
    if (xyz) {
      const ptCount = 2 * this.__segmentsCount;
      for (let i = 0, cnt = Math.floor(this.__segmentsCount); i < cnt; i++) {
        const point = {
          x: xyz.getX(i),
          y: xyz.getY(i),
          z: xyz.getZ(i),
        };
        xyz.setXYZ(i, xyz.getX(ptCount - i - 1), xyz.getY(ptCount - i - 1), xyz.getZ(ptCount - i - 1));
        xyz.setXYZ(ptCount - i - 1, point.x, point.y, point.z);
      }

      xyz.needsUpdate = true;

      if (this.__segmentLabelsExist) {
        this.__changeSegmentLabels(0, this.__segmentsCount, GlPointAction.Set);
      }

      this.geometry.computeBoundingSphere();
    }
  }

  // -------------------------------------
  // calculate the plane of segments in
  // terms of local coordinates
  // -------------------------------------
  __getPlane() {
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__segmentsCount > 0) {
      // calculate centroid of the segments
      const centroid = new Vector3();
      const point = new Vector3();
      const ptCount = 2 * this.__segmentsCount;
      for (let i = 0; i < ptCount; i++) {
        point.fromBufferAttribute(xyz, i);
        centroid.add(point);
      }
      centroid.divideScalar(ptCount);

      // create matrix
      const A = new Float64Array(9).fill(0);
      for (let i = 0; i < ptCount; i++) {
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
  // calculate the plane of a polyline in
  // terms of a world coordinates
  // -------------------------------------
  getPlane() {
    const plane = this.__getPlane();
    if (plane) {
      plane.centroid.applyMatrix4(this.matrixWorld);
    }

    return plane;
  }

  // -------------------------------------
  // get value that represents
  // if points shown without selection
  // -------------------------------------
  getPointObjectsBeforeSel() {
    return this.__pointObjectsBeforeSel;
  }

  // -------------------------------------
  // set value that represents
  // if points shown without selection
  // -------------------------------------
  setPointObjectsBeforeSel(flag) {
    this.__pointObjectsBeforeSel = flag;
  }

  // -------------------------------------
  // select / deselect on scene
  // -------------------------------------
  select(child, isMultiSelect) {
    if (!this.selectable || this.isSelected) return null;

    const clrSelected = 0x0000FF;

    if (this.material) {
      this.material.color.setHex(clrSelected);
    }

    // point objects
    this.__pointObjectsBeforeSel = this.pointObjects ? this.pointObjects.visible : false;
    this.showPoints(true);

    if (this.pointObjects) {
      this.pointObjects.material.color.setHex(clrSelected);
    }

    this.showPivotPoint();
    this.isSelected = true;
    return null;
  }

  deselect(child) {
    if (!this.isSelected || child && child.index !== undefined) return;

    if (this.material) {
      this.material.color.setHex(this.lineColor);
    }

    //  point objects
    if (!this.__pointObjectsBeforeSel) {
      this.showPoints(false);
    }
    if (this.pointObjects) {
      this.pointObjects.material.color.setHex(this.pointObjectsColor);
    }

    if (!this.pivotPointVisible) this.hidePivotPoint();
    this.isSelected = false;
  }

  // -------------------------------------------
  // this function will be called by raycaster
  // -------------------------------------------
  raycast(raycaster, intersects) {
    // don't do raycasting if the object is not selectable and not snappable
    if (!this.visible ||
        (!this.selectable && !this.snappable) ||
        this.__segmentsCount === 0) return;
    
    const inverseMatrix = new Matrix4();
    const ray = new GlRay();
    const sphere = new Sphere();
    const precision = raycaster.params.Line.threshold;
    const threshold = raycaster.params.Points.threshold;
    const snapMode = raycaster.params.snapMode;
    const perpPoints = raycaster.params.perpPoints;
    let childPnt = null;

    if (snapMode && snapMode !== GlSnapMode.None && !this.snappable) return;

    // set the clipping sections obb
    const clippedSection = raycaster.params.clippedSection;
    if (clippedSection) this.__obb.copy(clippedSection.obb);

    const geometry = this.geometry;
    const matrixWorld = this.matrixWorld;

    sphere.copy(geometry.boundingSphere);
    sphere.applyMatrix4(matrixWorld);
    sphere.radius += precision;

    if (raycaster.ray.intersectsSphere(sphere) === false) return;
    if (clippedSection && !this.__obb.intersectsRay(raycaster.ray)) return;

    inverseMatrix.copy(matrixWorld).invert();
    ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);
    if (clippedSection) this.__obb.applyMatrix4(inverseMatrix);

    // precision for line raycasting
    const localPrecision = precision / ((this.scale.x + this.scale.y + this.scale.z) / 3);
    const localPrecisionSq = localPrecision * localPrecision;

    // threshold for point raycasting
    const localThreshold = threshold / ((this.scale.x + this.scale.y + this.scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;

    // 'skipPoints' is used to check if the current snapping mode is 'GlSnapMode.Lines'.
    // const skipPoints = localThresholdSq < localPrecisionSq;

    const vStart = new Vector3();
    const vEnd = new Vector3();
    const interSegment = new Vector3();
    const interRay = new Vector3();

    const ptCount = this.__segmentsCount * 2;
    const xyz = geometry.attributes.position;
    const index = geometry.index;
    for (let i = 0; i < ptCount - 1; i += 2) {
      if (index) {
        const a = index.getX(i);
        const b = index.getX(i + 1);

        vStart.fromBufferAttribute(xyz, a);
        vEnd.fromBufferAttribute(xyz, b);
      } else {
        vStart.fromBufferAttribute(xyz, i);
        vEnd.fromBufferAttribute(xyz, i + 1);
      }

      if (clippedSection &&
         (!this.__obb.containsPoint(vStart, i > 0) &&
          !this.__obb.containsPoint(vEnd, i > 0))) {
        continue;
      }

      // inspect for a point
      const distSq = ray.distanceSqToSegment(vStart, vEnd, interRay, interSegment);
      if (clippedSection && !this.__obb.containsPoint(interSegment, i > 0)) continue;

      // 'skipPoints' is used to check if the current snapping mode is 'GlSnapMode.Lines'.
      // In this case we need skip raycasting for points
      // if (!skipPoints && distSq < localThresholdSq) {
      if ((!snapMode || snapMode === GlSnapMode.Points || snapMode === GlSnapMode.All) && distSq < localThresholdSq) {
        const distSqToStart = interSegment.distanceToSquared(vStart);
        const distSqToEnd = interSegment.distanceToSquared(vEnd);
        let foundIndex = -1;
        if (distSqToStart < localThresholdSq) foundIndex = i;
        else if (distSqToEnd < localThresholdSq) foundIndex = i + 1;

        if (foundIndex !== -1) {
          // Move back to world space for distance calculation
          interRay.applyMatrix4(this.matrixWorld);
          const distance = raycaster.ray.origin.distanceTo(interRay);
          if (distance > raycaster.near && distance < raycaster.far) {
            intersects.push({
              distance: distance,
              point: interSegment.clone().applyMatrix4(this.matrixWorld),
              object: this,
              child: {
                distance: distance,
                point: foundIndex === i ? vStart.clone().applyMatrix4(this.matrixWorld) :
                  vEnd.clone().applyMatrix4(this.matrixWorld),
                index: foundIndex,
                segmentIndex: foundIndex % 2 ? (foundIndex - 1) / 2 : foundIndex / 2,
                object: this
              }
            });

            // // skip the next segment
            // if (foundIndex === i + 1) {
            //   i++;
            //   continue;
            // }
          }
        }
      }

      // inspect for a line
      if (snapMode !== GlSnapMode.Points && distSq < localPrecisionSq) {
        // if point raycasting was skipped need to check extra conditions
        // in order to make sure that snapping to lines done correctly
        // if (skipPoints) {
        if (snapMode === GlSnapMode.Lines) {
          const distSqToStart = interSegment.distanceToSquared(vStart);
          const distSqToEnd = interSegment.distanceToSquared(vEnd);
          if (i > 0 && distSqToStart < this.EPS) continue;
          else if (i < ptCount - 2 && distSqToEnd < this.EPS) continue;
        } else if (snapMode === GlSnapMode.Perpendicular) {
          const distSqToStart = interSegment.distanceToSquared(vStart);
          const distSqToEnd = interSegment.distanceToSquared(vEnd);
          if (i > 0 && distSqToStart < this.EPS) continue;
          else if (i < ptCount - 2 && distSqToEnd < this.EPS) continue;
          // convert segment to world coords
          const startPoint = vStart.clone().applyMatrix4(this.matrixWorld);
          const endPoint = vEnd.clone().applyMatrix4(this.matrixWorld);
          if (perpPoints && perpPoints.length) {
            const point = [perpPoints[0]];
            if (perpPoints.length === 3) point.push(perpPoints[2]);
            for (let i = 0; i < point.length; i++) {
              const v1 = new Vector3().subVectors(endPoint, startPoint);
              const v2 = new Vector3().subVectors(point[i], startPoint);
              const perpV = v2.projectOnVector(v1);
              if (v1.dot(v2) > 0 && perpV.length() <= v1.length()) {
                perpV.addVectors(startPoint, perpV);
                childPnt = new Vector3().copy(perpV);
                break;
              }
            }
          }
        } else if (snapMode === GlSnapMode.Bisector) {
          const distSqToStart = interSegment.distanceToSquared(vStart);
          const distSqToEnd = interSegment.distanceToSquared(vEnd);
          if (i > 0 && distSqToStart < this.EPS) continue;
          else if (i < ptCount - 2 && distSqToEnd < this.EPS) continue;
          const startPoint = vStart.clone().applyMatrix4(this.matrixWorld);
          const endPoint = vEnd.clone().applyMatrix4(this.matrixWorld);
          const vTemp = new Vector3().subVectors(endPoint, startPoint).multiplyScalar(0.5);
          childPnt = new Vector3().addVectors(startPoint, vTemp);
        }

        // Move back to world space for distance calculation
        interRay.applyMatrix4(this.matrixWorld);

        const distance = raycaster.ray.origin.distanceTo(interRay);

        if (distance > raycaster.near && distance < raycaster.far) {
          intersects.push({
            distance: distance,
            // intersection point on the segment
            // point: raycaster.ray.at( distance ),
            child: {
              distance: distance,
              segmentIndex: i / 2,
              point: interSegment.clone().applyMatrix4(this.matrixWorld),
            },
            object: this
          });
        }
      }
    }
  }

  // ------------------------
  // toJSON
  // ------------------------
  toJSON(meta, keepUuid = false) {
    const output = {};

    // meta is a string when called from JSON.stringify
    const isRootObject = (meta === undefined || meta === null || typeof meta === 'string');
    if (isRootObject) {
      output.metadata = {
        version: 5.0,
        type: 'GlSegments',
        generator: 'GlSegments.toJSON'
      };
    }

    const object = {};
    if (keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.objectType) object.oT = this.objectType;
    if (this.attachedText) object.aT = this.attachedText.toJSON();

    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    object.sCt = this.__segmentsCount;

    object.lC = this.lineColor;

    object.pOC = this.pointObjectsColor;
    object.pO = (this.pointObjects && !this.isSelected) ? true : false;

    object.sLF = this.segmentLabelsFont;
    object.sLC = this.segmentLabelsColor;
    object.sLE = this.__segmentLabelsExist;

    object.geom = GlUtils.bufferGeometryToJson(this.geometry);

    output.object = object;
    return output;
  }

  get properties() {
    return {
      type: Primitive_Type.String, // type
      oT: Primitive_Type.Uint8, // objectType
      aT: Primitive_Type.Object, // attachedText
      n: Primitive_Type.String, // name
      rO: Primitive_Type.Uint8, // renderOrder
      v: Primitive_Type.Uint8, // visible
      l: Primitive_Type.Int32, // layers.mask
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      sCt: Primitive_Type.Int32, // segmentsCount
      lC: Primitive_Type.Uint32, // lineColor
      pOC: Primitive_Type.Uint32, // pointObjectsColor
      pO: Primitive_Type.Uint8, // pointObjects
      sLF: Primitive_Type.Uint32, // segmentsLabelsColor
      sLC: Primitive_Type.Uint32, // segmentsLabelsColor
      sLE: Primitive_Type.Uint8, // segmentsLabelsExist
      geom: Primitive_Type.Object, // geometry
    }
  }

  // ------------------------
  // toArrayBuffer
  // ------------------------
  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);

    writeToDv('type', this.type);
    if (this.objectType) writeToDv('oT', this.objectType);
    if (this.attachedText) {
      writeToDv('aT', null);
      this.attachedText.toArrayBuffer(myDv)
    }

    if (this.name !== '') writeToDv('n', this.name);
    if (this.renderOrder !== 0) writeToDv('rO', this.renderOrder);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);
    writeToDv('m', this.matrix.toArray());
    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);

    writeToDv('sCt', this.__segmentsCount);

    writeToDv('lC', this.lineColor);

    writeToDv('pOC', this.pointObjectsColor);
    writeToDv('pO', (this.pointObjects && !this.isSelected) ? true : false);

    writeToDv('sLF', this.segmentLabelsFont);
    writeToDv('sLC', this.segmentLabelsColor);
    writeToDv('sLE', this.__segmentLabelsExist);

    writeToDv('geom', null);
    GlUtils.bufferGeometryToArrayBuffer(this.geometry, myDv);
    writeToDv('endObj');
  }

  // *fromArrayBuffer(myDv) {
  //   const read = GlUtils.createReader(myDv);
  //   let res = null;
  //   const json = {};
  //   const scope = this;
  //   const setProperty = function*(prop, value) {
  //     switch(prop) {
  //       case 'aT':
  //         scope.attachedText = new GlText({});
  //         yield* scope.attachedText.fromArrayBuffer(myDv);
  //         scope.attachedText.sync(scope.handleLabel());
  //         scope.add(scope.attachedText);
  //         break;
  //       case 'uA':
  //         yield* scope.attributes.fromArrayBuffer(myDv);
  //         break;
  //       case 'geom':
  //         const geometry = yield* GlUtils.bufferGeometryFromArrayBuffer(myDv);
  //         scope.geometry = geometry ? geometry : new BufferGeometry();
  //         break;
  //       default:
  //         json[prop] = value;
  //     }
  //   };

  //   do {
  //     res = yield* read();
  //     yield* setProperty(res.prop, res.value);
  //   } while(res.prop !== 'geom');
  //   this.__initFromJson(json);
  // }

}
