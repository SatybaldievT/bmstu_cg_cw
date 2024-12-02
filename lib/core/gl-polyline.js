/* eslint-disable no-undef */
import {GlBase} from './gl-base';
import {GlLabel} from './gl-label';
import {MathUtils} from '../utils/math-utils';
import {GlObjectFactoryType, GlPointAction, GlSnapMode, HatchPolygonOffset} from './gl-constants';
import {GlMesh} from './gl-mesh';
import {GlTriangulator} from '../tools/gl-triangulator';
import {GlUtils} from '../utils/gl-utils';
import {Primitive_Type} from './gl-constants';
import {GlRay} from './gl-ray';
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
  Quaternion,
  Texture,
  LinearFilter,
  RepeatWrapping,
  MeshBasicMaterial,
  DoubleSide,
} from 'three';
import { GlAttribute } from './gl-attribute';
import { GlAttributeValueType as V_TYPE, GlAttributeType as A_TYPE } from './gl-constants';
import { mergeTextsIntoInstancedText } from '../troika/troika-three-text/InstancedText';
import { utils } from '@tangens/common/utils/dataUtils';
import { ChartLine } from '../charts/chart-line';

export class GlPolyline extends GlBase {
  constructor(params, fromJSON) {
    super();

    params = params || {};
    const isFromJson = fromJSON && fromJSON.geometry ? true : false;
    const geometry = isFromJson ? fromJSON.geometry : params.geometry ? params.geometry : null;
    const material = params.material ? params.material : null;

    this.geometry = geometry ? geometry : new BufferGeometry();
    this.material = material ? material : new LineBasicMaterial();

    this.isLine = true;   // this is needed to render this object via WebGlRenderer correctly
    this.isGlPolyline = true;
    this.type = 'GlPolyline';
    this.name = params.name || "";
    if (params.uuid) this.uuid = params.uuid;

    this.EPS = 1e-8;
    this.__changesCount = 0;

    // selection
    this.selectable = true;
    this.snappable = true;

    // line's params
    this.lineColor = 0x000000;
    if (params.color) this.lineColor = params.color;
    if (!material) {
      this.material.color.setHex(this.lineColor);
    } else if (material && material.color) {
      this.lineColor = material.color.getHex();
    }

    // object's datasource
    this.ds = [];

    // line's labels
    this.lineLabels = [];
    this.__lineLabelsColor = 0x000000;
    this.__lineLabelsFont = '';
    this.__lineLabelsExist = false;

    // point objects
    this.pointObjects = null;
    this.pointObjectsColor = 0x000000;

    // points' labels
    this.pointLabels = [];
    this.__pointLabelsColor = 0xf0f0ff;
    this.__pointLabelsFont = '';
    this.__pointLabelsExist = false;

    // hatch resources
    this.pwUnit = 0;
    this.hatchName = null;
    this.hatchImage = null;
    this.hatchType = null;
    this.surface = null;
    this.hatchPatternData = null;

    if (isFromJson) {
      if(fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    } else {
      this.__pointsCount = 0;
      this.geometry.setDrawRange(0, this.__pointsCount);
    }
  }

  // ------------------------------------------------
  // initialize an object from JSON
  // ------------------------------------------------
  __initFromJson(fromJSON) {
    // 'type' ->  'type'
    // 'oT '  ->  'objectType'
    // 'aT '  ->  'attachedText'
    // 'n  '  ->  'name'
    // 'rO '  ->  'renderOrder'
    // 'v  '  ->  'visible'
    // 'l  '  ->  'layers.mask'
    // 'm  '  ->  'matrix'
    // 'mAU'  ->  'matrixAutoUpdate'
    // 'pCt '  ->  'pointsCount'
    // 'lC '  ->  'lineColor'
    // 'lLC'  ->  'lineLabelsColor'
    // 'lLE'  ->  'lineLabelsExist'
    // 'pOC'  ->  'pointObjectsColor'
    // 'pO '  ->  'pointObjects'
    // 'pLC'  ->  'pointLabelsColor'
    // 'pLE'  ->  'pointLabelsExist'
    // 'pvO'  ->  'pivotOffset'
    // 'uA '  ->  'attributes'
    // 'pU '  ->  'pwUnit'
    // 'hN '  ->  'hatchName'
    // 'hIS'  ->  'hatchImage.src'
    // 'hT'  ->  'hatchType'
    // 'hPD'  ->  'hatchPatternData'
    // 'geom' ->  'geometry'
    // 'pVC' -> 'vertexColors'

    //uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.n) this.name = fromJSON.n;

    //objectType
    if (fromJSON.oT) this.objectType = fromJSON.oT;

    // points' count
    this.__pointsCount = fromJSON.pCt;
    this.geometry.setDrawRange(0, this.__pointsCount);

    // line's params
    this.lineColor = fromJSON.lC;
    this.material.color.setHex(this.lineColor);
    if (fromJSON.pVC) {
      this.material.vertexColors = true;
      this.material.needsUpdate = true;
    }

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;
    this.visible = fromJSON.v ? true : false;

    this.geometry.computeBoundingBox = this.computeBoundingBox;
    this.geometry.computeBoundingSphere = this.computeBoundingSphere;
    this.geometry.computeBoundingSphere();

    // line's labels
    this.__lineLabelsColor = fromJSON.lLC;
    if (fromJSON.lLE) this.showLineLabels(true);

    // point objects
    this.pointObjectsColor = fromJSON.pOC;

    // points' labels
    this.__pointLabelsColor = fromJSON.pLC;
    if (fromJSON.pLE) this.showPointLabels(true);

    if (fromJSON.hIS) {
      const args = { hatchName: fromJSON.hN, hatchImage: fromJSON.hIS, pwUnit: fromJSON.pU, hatchType: fromJSON.hT, hatchPatternData: fromJSON.hPD}
      this.createHatch(args);
    }

    // user attributes
    if (fromJSON.uA && this.attributes) this.attributes.fromJSON(fromJSON.uA);

    if (fromJSON.pvO) {
      this.__v3.fromArray(fromJSON.pvO);
      this.setPivotPoint(this.position.clone().add(this.__v3));
    }
  }


  __initFromJson_v4_5(fromJSON) {
    // uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.name) this.name = fromJSON.name;

    //objectType
    if (fromJSON.objectType) this.objectType = fromJSON.objectType;

    // points' count
    this.__pointsCount = fromJSON.pointsCount;
    this.geometry.setDrawRange(0, this.__pointsCount);

    // line's params
    this.lineColor = fromJSON.lineColor;
    this.material.color.setHex(this.lineColor);

    if (fromJSON.matrix !== undefined) {
      this.matrix.fromArray(fromJSON.matrix);
      if (fromJSON.matrixAutoUpdate !== undefined) this.matrixAutoUpdate = fromJSON.matrixAutoUpdate;
      if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);
    } else {
      if (fromJSON.position !== undefined ) this.position.fromArray(fromJSON.position);
      if (fromJSON.rotation !== undefined ) this.rotation.fromArray(fromJSON.rotation);
      if (fromJSON.quaternion !== undefined ) this.quaternion.fromArray(fromJSON.quaternion);
      if (fromJSON.scale !== undefined ) this.scale.fromArray(fromJSON.scale );
    }

    if (fromJSON.renderOrder) this.renderOrder = fromJSON.renderOrder;

    this.geometry.computeBoundingBox = this.computeBoundingBox;
    this.geometry.computeBoundingSphere = this.computeBoundingSphere;
    this.geometry.computeBoundingSphere();

    // line's labels
    this.__lineLabelsColor = fromJSON.lineLabelsColor;
    if (fromJSON.lineLabelsExist) this.showLineLabels(true);

    // point objects
    this.pointObjectsColor = fromJSON.pointObjectsColor;

    // points' labels
    this.__pointLabelsColor = fromJSON.pointLabelsColor;
    if (fromJSON.pointLabelsExist) this.showPointLabels(true);

    if (fromJSON.hatchImageSrc) {
      const args = { hatchName: fromJSON.hN, hatchImage: fromJSON.hatchImageSrc, pwUnit: fromJSON.pU, hatchType: fromJSON.hT, hatchPatternData: fromJSON.hPD}
      this.createHatch(args);
    }

    // user attributes
    if (fromJSON.userAttributes && this.attributes) {
      this.attributes.fromJSON_v4_5(fromJSON.userAttributes);
    }

    if (fromJSON.pivotOffset) this.setPivotPoint(this.position.clone().add(fromJSON.pivotOffset));
  }

  // ------------------------------------------------
  // clone the current polyline and return it
  // ------------------------------------------------
  clone(keepUuid, keepParent) {
    const clone = new this.constructor();

    const oldGeom = clone.geometry;
    clone.geometry = this.geometry.clone();
    clone.material = this.material.clone();
    if (oldGeom) oldGeom.dispose();

    clone.geometry.computeBoundingBox = clone.computeBoundingBox;
    clone.geometry.computeBoundingSphere = clone.computeBoundingSphere;
    clone.__pointsCount = this.__pointsCount;

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
    clone.attributes = this.attributes.clone();

    clone.matrix.copy(this.matrix);
    clone.matrixWorld.copy(this.matrixWorld);
    if (this.parent && !this.parent.isScene) {
      // since the pivot offset is integrated into an object's
      // local matrix we need to compute actual matrixWorld of parents
      let scope = this;
      const parents = [];
      while(scope.parent && scope.parent.matrixWorld && !scope.parent.isScene) {
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
    clone.setPointLabelsColor(this.__pointLabelsColor);
    clone.setLineColor(this.lineColor);
    clone.setLineLabelsColor(this.__lineLabelsColor);

    if (this.hatchName) {
      clone.createHatch(this);
    }

    if (this.__lineLabelsExist) clone.showLineLabels(true);
    if (this.pointObjects && this.pointObjects.length) clone.showPoints(true);
    if (this.__pointLabelsExist) clone.showPointLabels(true);

    if (this.isSelected) clone.deselect();
    clone.isSelected = false;

    return clone;
  }

  // ---------------
  // copy()
  // ---------------
  copy(source, recursive) {
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
      const lineDistances = [0];
  
      for (let i = 1, l = positionAttribute.count; i < l; i++) {
        _start.fromBufferAttribute(positionAttribute, i - 1);
        _end.fromBufferAttribute(positionAttribute, i);
  
        lineDistances[i] = lineDistances[i - 1];
        lineDistances[i] += _start.distanceTo(_end);
      }
  
      geometry.setAttribute('lineDistance', new Float32BufferAttribute(lineDistances, 1));
    } else {
      console.warn('GlPolyline.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.');
    }
  
    return this;
  }

  // ----------------------------------------------------
  // __validateCoordinates()
  // validate and adjust coordinates as:
  // [x0, y0, z0, x1, y1, z1]
  // This method converts coordinates from world to local
  // -----------------------------------------------------
  __validateCoordinates(coords, reverseOrder = false) {
    if (!coords) return null;

    let retCoords = null;
    let error = '';
    if (coords instanceof Array) {
      if (coords[0] instanceof Array) {
        // we'll assum that the 'coords' is an array of arrays: [[x0, y0, z0], [x1, y1, z1], ...]
        retCoords = Array(coords.length * 3).fill(0.0);

        if (reverseOrder) coords.reverse();

        for (let i = 0; i < coords.length; ++i) {
          if (coords[i][0] === undefined || coords[i][1] === undefined || coords[i][2] === undefined ||
            coords[i][0] === null || coords[i][1] === null || coords[i][2] === null) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retCoords[i * 3] = coords[i][0];
            retCoords[i * 3 + 1] = coords[i][1];
            retCoords[i * 3 + 2] = coords[i][2];
          }
        }
      } else if (typeof coords[0] === 'object') {
        // we'll assume that the 'coords' is an array of objects: [point1, point2, ...]
        retCoords = Array(coords.length * 3).fill(0.0);

        if (reverseOrder) coords.reverse();

        for (let i = 0; i < coords.length; ++i) {
          if (coords[i].x === undefined || coords[i].y === undefined ||
            coords[i].z === undefined) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retCoords[i * 3] = coords[i].x;
            retCoords[i * 3 + 1] = coords[i].y;
            retCoords[i * 3 + 2] = coords[i].z;
          }
        }
      } else {
        // we'll assume that the 'coords' are given as: [x0, y0, z0, x1, y1, z1]
        const ptCount = Math.floor(coords.length / 3);
        const arrLen = ptCount * 3;
        retCoords = Array(arrLen).fill(0.0);
        if (!reverseOrder) {
          for (let i = 0; i < arrLen; ++i) {
            retCoords[i] = coords[i];
          }
        } else {
          let j = 0;
          for (let i = arrLen - 3; i >= 0 ; i -= 3) {
            retCoords[j] = coords[i];
            retCoords[j + 1] = coords[i + 1];
            retCoords[j + 2] = coords[i + 2];
            j += 3;
          }
        }
      }
    } else {
      // we'll assume that the 'coords' is an object
      if (coords.x === undefined || coords.y === undefined || coords.z === undefined) {
        error = 'Ошибка: координаты заданы некорректно';
      } else {
        retCoords = [coords.x, coords.y, coords.z];
      }
    }

    if (retCoords && retCoords.length) {
      // set an objects position if it's needed
      if (this.__pointsCount === 0) {
        this.__m4.copy(this.matrixWorld).invert();
        this.pivotOffset.set(0,0,0);
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
    const newPointsCount = Math.floor(coords.length / itemSize);

    // define the size of new attribute
    const newSize = (this.__pointsCount + newPointsCount + 100) * itemSize;

    // create a new buffer for coordinates
    const newXYZ = new BufferAttribute(new Float32Array(newSize), itemSize);

    // check if the polyline is closed
    const closed = this.isClosed();
    const lastIdx = closed ? this.__pointsCount - 1 : this.__pointsCount;

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

    // if the line is closed we need to put
    // the coordinates of the first point into the last one
    if (closed) {
      newXYZ.array[start + end] = newXYZ.array[0];
      newXYZ.array[start + end + 1] = newXYZ.array[1];
      newXYZ.array[start + end + 2] = newXYZ.array[2];
    }

    this.__pointsCount += newPointsCount;
    
    this.attributes.forEach((attr) => {
      const availableSize = Array.from({length: newSize / itemSize});
      if (attr.type === A_TYPE.Vertex) {
        let prop = "value";
        let newValue = null;
        if (attr.isIndexed) {
          prop = "index";
          newValue = new Uint32Array(availableSize);
        } else if (attr.valueType === V_TYPE.BooleanArray) {
          newValue = new Uint32Array(availableSize);
        } else if (attr.valueType === V_TYPE.BufferArray) {
          newValue = new Float64Array(availableSize);
        }

        if (newValue) {
          for (let i = 0, end = attr[prop].length; i < end; i++) {
            newValue[i] = attr[prop][i];
          }
          attr[prop] = newValue;
        }
      }
    });

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

    if (this.__pointLabelsExist) {
      this.__changePointLabels(this.__pointsCount - newPointsCount, newPointsCount, GlPointAction.Add);
    }

    this.geometry.setDrawRange(0, this.__pointsCount);
    this.geometry.computeBoundingSphere();
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (index !== undefined && index !== null &&
      index >= 0 && index < this.__pointsCount) {
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

  // -------------------------------------
  // isClosed()
  // -------------------------------------
  isClosed(epsilon) {
    let closed = false;
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__pointsCount > 1) {
      const end = this.__pointsCount - 1;
      closed = this.__isEqual(xyz.getX(0), xyz.getX(end), epsilon) &&
        this.__isEqual(xyz.getY(0), xyz.getY(end), epsilon) &&
        this.__isEqual(xyz.getZ(0), xyz.getZ(end), epsilon);
    }
    return closed;
  }

  // --------------------
  // dispose
  // --------------------
  dispose() {
    super.dispose();
    // line's labels
    if (this.lineLabels.length > 0) this.__destroyLineLabels();

    // point objects
    if (this.pointObjects) this.pointObjects.material.dispose();

    // points' labels
    if (this.pointLabels.length > 0) this.__destroyPointLabels();

    // hatch surface
    if (this.surface) this.surface.dispose();

    // datasource
    if (this.ds) this.ds.length = 0;

    this.disposePivotPoint();
    this.material.dispose();
    this.geometry.dispose();
  }

  /**
   * setAttributeAt method creates attribute per vertex
   * @param {*} key - key of GlAttribute
   * @param {*} index - index of value per vertex
   * @param {*} value - attribute value of vertex
   */
  setAttributeAt(key, index, value) {
    let ptAttr = this.attributes.get(key);
    if (!ptAttr) {
      const size = Array.from({length: this.__pointsCount + 100});
      if (typeof(value) === 'string') {
        ptAttr = new GlAttribute(A_TYPE.Vertex, V_TYPE.Array, ['']);
        ptAttr.index = new Uint32Array(size);
      } else if (typeof(value) === 'boolean') {
        ptAttr = new GlAttribute(A_TYPE.Vertex, V_TYPE.BooleanArray, new Uint32Array(size));
      } else {
        ptAttr = new GlAttribute(A_TYPE.Vertex, V_TYPE.BufferArray, new Float64Array(size));
      }

      this.attributes.set(key, ptAttr);
    }

    if (ptAttr.isIndexed) {
      if (utils.isEmpty(value)) value = '';
      let fIndex = ptAttr.value.findIndex(v => v === value);
      if (fIndex === -1) {
        ptAttr.value.push(value);
        fIndex = ptAttr.value.length - 1;
      }
      ptAttr.index[index] = fIndex;
    } else {
      ptAttr.value[index] = value;
    }
  }

  setAttributes(key, index, array) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    if (array && array.length) {

      // set new attributes
      const last = index + array.length > this.__pointsCount ? this.__pointsCount : index + array.length;
      for (let i = index; i < last; ++i) {
        const pos = i - index;
        this.setAttributeAt(key, i, array[pos]);
      }
    }
  }

  getAttributeAt(key, index) {
    let ptAttr = this.attributes.get(key);
    if (ptAttr) {
      if (ptAttr.isIndexed) {
        return ptAttr.value[ptAttr.index[index]];
      } else {
        return ptAttr.value[index];
      }
    } else {
      console.error("Attribute not found");
    }
    
  }

  getAttributes(key, startIndex, endIndex) {
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

    const ptAttr = this.attributes.get(key);
    if (ptAttr) {
      for (let index = startIndex; index < endIndex + 1; index++) {
        if (ptAttr.isIndexed) {
          result.push(ptAttr.value[ptAttr.index[index]]);
        } else {
          result.push(ptAttr.value[index]);
        }
      }
    } else {
      console.error("Attribute not found");
    }

    return result;
  }

  // -------------------------------------
  // setPoint() / setPoints()
  // -------------------------------------
  setPoint(index, coord) {
    this.setPoints(index, coord);
  }

  setPoints(index, array, reverse) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    const xyz = this.geometry.attributes.position;
    if (xyz) {
      // adjust coordinates as: [x0, y0, z0, x1, y1, z1]
      const coords = this.__validateCoordinates(array, reverse);
      if (coords && coords.length) {
        const ptCount = coords.length / xyz.itemSize;

        // check if the polyline is closed
        const closed = this.isClosed();

        // set new coordinates
        const last = index + ptCount > this.__pointsCount ? this.__pointsCount : index + ptCount;
        for (let i = index; i < last; ++i) {
          const pos = (i - index) * xyz.itemSize;
          xyz.setXYZ(i, coords[pos], coords[pos + 1], coords[pos + 2]);
        }

        xyz.needsUpdate = true;

        if (closed) {
          if (index === 0) {
            xyz.setXYZ(this.__pointsCount - 1, coords[0], coords[1], coords[2]);
          } else if (this.__pointsCount > 2 && index === this.__pointsCount - 1) {
            xyz.setXYZ(0, coords[0], coords[1], coords[2]);
          }
        }

        if (this.__pointLabelsExist) {
          this.__changePointLabels(index, ptCount, GlPointAction.Set);
        }

        if (this.__lineLabelsExist) {
          this.__changeLineLabels(index, ptCount, GlPointAction.Set);
        }

        this.geometry.computeBoundingSphere();
      }
    }
  }

  // -------------------------------------
  // addPoint() / addPoints()
  // -------------------------------------
  addPoint(point) {
    this.addPoints(point);
  }

  addPoints(array, reverse) {
    // adjust coordinates as: [x0, y0, z0, x1, y1, z1]
    const coords = this.__validateCoordinates(array, reverse);
    if (coords && coords.length) {
      // now start adding points to the end of a line
      if (this.geometry.attributes.position) {
        const xyz = this.geometry.attributes.position;
        const newPointsCount = coords.length / xyz.itemSize;

        if (this.__pointsCount + newPointsCount <= xyz.count) {
          // check if the polyline is closed
          const closed = this.isClosed();
          const lastIdx = closed ? this.__pointsCount - 1 : this.__pointsCount;

          // add new points coordinates
          const start = lastIdx * xyz.itemSize;
          const end = start + newPointsCount * xyz.itemSize;
          for (let i = start; i < end; i += 3) {
            xyz.array[i] = coords[i - start];
            xyz.array[i + 1] = coords[i - start + 1];
            xyz.array[i + 2] = coords[i - start + 2];
            this.attributes.forEach((attr, key) => {
              if (attr.type === A_TYPE.Vertex) this.setAttributeAt(key, i / xyz.itemSize, undefined);
            })
          }
          this.__pointsCount += newPointsCount;

          // if the line is closed we need to put
          // the coordinates of the first point into the last one
          if (closed) {
            xyz.setXYZ(this.__pointsCount - 1, xyz.array[0], xyz.array[1], xyz.array[2]);
          }

          this.geometry.setDrawRange(0, this.__pointsCount);
          xyz.needsUpdate = true;

          if (this.__pointLabelsExist) {
            this.__changePointLabels(this.__pointsCount - newPointsCount, newPointsCount, GlPointAction.Add);
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

  // -------------------------------------
  // insertPoint() / insertPoints()
  // -------------------------------------
  insertPoint(index, point) {
    this.insertPoints(index, point);
  }

  insertPoints(index, array, reverse) {
    if (index === 0 && this.__pointsCount === 0) {
      this.addPoints(array);
    } else {
      if (!this.__isValidIndex(index)) {
        console.log('Ошибка: задан некорректный индекс');
        return;
      }

      const coords = this.__validateCoordinates(array, reverse);
      if (coords && coords.length) {
        if (this.geometry.attributes.position) {
          const xyz = this.geometry.attributes.position;
          const newPointsCount = coords.length / xyz.itemSize;
          if (this.__pointsCount + newPointsCount <= xyz.count) {
            // check if the polyline is closed
            const closed = this.isClosed();

            const insertStart = index * xyz.itemSize;
            const insertEnd = insertStart + newPointsCount * xyz.itemSize;

            // move existing points
            const moveStart = this.__pointsCount * xyz.itemSize - 1;
            const moveEnd = index * xyz.itemSize;
            const moveSize = newPointsCount * xyz.itemSize;
            for (let i = moveStart; i >= moveEnd; --i) {
              xyz.array[i + moveSize] = xyz.array[i];
              this.attributes.forEach((attr, key) => {
                const attrI = i / xyz.itemSize;
                const attrMs = moveSize / xyz.itemSize;
                if (attr.type === A_TYPE.Vertex) {
                  const attrValue = this.getAttributeAt(key, attrI);
                  this.setAttributeAt(key, attrI + attrMs, attrValue);
                }
              })
            }

            // add new points coordinates
            for (let i = insertStart; i < insertEnd; i += 3) {
              xyz.array[i] = coords[i - insertStart];
              xyz.array[i + 1] = coords[i - insertStart + 1];
              xyz.array[i + 2] = coords[i - insertStart + 2];
              this.attributes.forEach((attr, key) => {
                if (attr.type === A_TYPE.Vertex) {
                  this.setAttributeAt(key, i / xyz.itemSize, undefined);
                }
              })
            }
            this.__pointsCount += newPointsCount;

            // if the line is closed we need to put
            // the coordinates of the first point into the last one
            if (closed && index === 0) {
              xyz.setXYZ(this.__pointsCount - 1, xyz.array[0], xyz.array[1], xyz.array[2]);
            }

            this.geometry.setDrawRange(0, this.__pointsCount);
            xyz.needsUpdate = true;

            if (this.__pointLabelsExist) {
              this.__changePointLabels(index, (insertEnd - insertStart) / xyz.itemSize, GlPointAction.Insert);
            }

            this.geometry.computeBoundingSphere();
          } else {
            // the (position) BufferAttribute's size is not enough to add new
            // coordinates. Since the buffer size can't be changed in order
            // to re-size the BufferAttribute we'll create a new
            // BufferGeometry and dispose the current one
            const lastIdx = this.__pointsCount * xyz.itemSize;
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
            this.__pointsCount = 0;
            this.__recreateBufferGeometry(newCoords);
          }
        } else {
          this.__recreateBufferGeometry(coords);
        }
      }
    }
  }

  // -------------------------------------
  // deletePoint() / deletePoints()
  // -------------------------------------
  deletePoint(index) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    this.deletePoints(index, index);
  }

  deletePoints(startIndex, endIndex) {
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
      // check if the polyline is closed
      const closed = this.isClosed();
      if (closed && endIndex === this.__pointsCount - 1 && startIndex === endIndex) {
        startIndex = 0;
        endIndex = 0;
      }
      // } else if (closed && endIndex === this.__pointsCount - 1 && startIndex > 0) {
      //   endIndex--;
      //   if (startIndex > endIndex) startIndex--;
      // }

      const start = (endIndex + 1) * xyz.itemSize;
      const end = this.__pointsCount * xyz.itemSize;
      const delCount = (endIndex - startIndex + 1) * xyz.itemSize;

      // move coordinates
      for (let i = start; i < end; ++i) {
        xyz.array[i - delCount] = xyz.array[i];
        this.attributes.forEach((attr, key) => {
          const attrIndex = i / xyz.itemSize;
          const attrDelCount = delCount / xyz.itemSize;
          if (attr.type === A_TYPE.Vertex) {
            const attrV = this.getAttributeAt(key, attrIndex);
            this.setAttributeAt(key, attrIndex - attrDelCount, attrV);
          }
        })
      }

      // set a new points count
      this.__pointsCount -= endIndex - startIndex + 1;

      if (closed && startIndex === 0 && this.__pointsCount > 1) {
        xyz.setXYZ(this.__pointsCount - 1, xyz.array[0], xyz.array[1], xyz.array[2]);
      }
      xyz.setXYZ(this.__pointsCount, 0, 0, 0);

      this.geometry.setDrawRange(0, this.__pointsCount);
      xyz.needsUpdate = true;

      if (this.__pointsCount === 0) this.resetPivotPoint();

      if (this.__pointLabelsExist) {
        this.__changePointLabels(startIndex, endIndex - startIndex + 1, GlPointAction.Delete);
      }

      this.geometry.computeBoundingSphere();
    }
  }

  // -------------------------------------
  // deleteAllPoints()
  // -------------------------------------
  deleteAllPoints() {
    const xyz = this.geometry.attributes.position;
    if (xyz) {
      this.resetPivotPoint();

      this.__pointsCount = 0;
      this.geometry.setDrawRange(0, this.__pointsCount);

      if (this.__pointLabelsExist) {
        this.__changePointLabels(0, this.__pointsCount, GlPointAction.Delete);
      }

      this.geometry.computeBoundingSphere();
    }
  }

  // --------------------------------------
  // close polyline
  // --------------------------------------
  close() {
    if (!this.isClosed()) {
      const xyz = this.geometry.attributes.position;
      if (xyz && this.__pointsCount > 2) {
        if (this.__pointsCount + 1 > xyz.count) {
          this.__recreateBufferGeometry([xyz.array[0], xyz.array[1], xyz.array[2]]);
          xyz.setXYZ(this.__pointsCount, xyz.array[0], xyz.array[1], xyz.array[2]);
        } else {
          xyz.setXYZ(this.__pointsCount, xyz.array[0], xyz.array[1], xyz.array[2]);
          this.__pointsCount++;  
        }

        if (this.__pointLabelsExist) {
          this.__changePointLabels(this.__pointsCount - 1, 1, GlPointAction.Add);
        }

        this.geometry.setDrawRange(0, this.__pointsCount);
        xyz.needsUpdate = true;
        this.geometry.computeBoundingSphere();
      }
    }
  }

  // --------------------------------------
  // open polyline
  // --------------------------------------
  open() {
    if (this.isClosed()) {
      this.__pointsCount--;

      if (this.__pointLabelsExist) {
        this.__changePointLabels(this.__pointsCount - 1, 1, GlPointAction.Delete);
      }

      this.geometry.setDrawRange(0, this.__pointsCount);
      this.geometry.attributes.position.needsUpdate = true;

      this.geometry.computeBoundingSphere();
    }
  }

  // -------------------------------------
  // getPointAt()
  // -------------------------------------
  getPointAt(index, asFlatArray) {
    if (this.__isValidIndex(index)) {
      const xyz = this.geometry.attributes.position;
      if (xyz) {
        const point = asFlatArray ? [] : new Vector3();
        const start = index * xyz.itemSize;
        if (asFlatArray) {
          this.__v3.set(xyz.array[start], xyz.array[start + 1], xyz.array[start + 2]);
          this.__v3.applyMatrix4(this.matrixWorld);
          point.push(this.__v3.x, this.__v3.y, this.__v3.z);
        } else {
          point.set(xyz.array[start], xyz.array[start + 1], xyz.array[start + 2]);
          point.applyMatrix4(this.matrixWorld);
        }
        return point;
      }
      return null;
    }

    console.log('Ошибка: задан некорректный индекс');
    return null;
  }

  // -------------------------------------
  // getPoints()
  // -------------------------------------
  getPoints(startIndex, endIndex, asFlatArray, asLocalCS) {
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
      const start = startIndex * xyz.itemSize;
      const end = (endIndex + 1) * xyz.itemSize;
      for (let i = start; i < end; i += 3) {
        this.__v3.set(xyz.array[i], xyz.array[i + 1], xyz.array[i + 2]);
        if (!asLocalCS) this.__v3.applyMatrix4(this.matrixWorld);

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
  // getPointsAsF32Array()
  // -------------------------------------
  getPointsAsF32Array(startIndex, endIndex, includePointIndex) {
    let result = null;
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
      const start = startIndex * xyz.itemSize;
      const end = (endIndex + 1) * xyz.itemSize;
      const size = includePointIndex ? (endIndex + 1) * (xyz.itemSize + 1) : end;
      result = {origin: new Vector3(), array: new Float32Array(size)};

      for (let i = start, j = 0; i < end; i += 3) {
        this.__v3.set(xyz.array[i], xyz.array[i + 1], xyz.array[i + 2]);
        this.__v3.applyMatrix4(this.matrixWorld);

        if (i === start) result.origin.copy(this.__v3);
        this.__v3.sub(result.origin);

        result.array[j] = this.__v3.x;
        result.array[j + 1] = this.__v3.y;
        result.array[j + 2] = this.__v3.z;
        if (includePointIndex) {
          result.array[j + 3] = Math.floor(i / xyz.itemSize);
          j += 4;
        } else {
          j += 3;
        }
      }
    }
    return result;
  }

  getPointsAsArray(startIndex, endIndex) {
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
      const start = startIndex * xyz.itemSize;
      const end = (endIndex + 1) * xyz.itemSize;
      for (let i = start; i < end; i += 3) {
        this.__v3.set(xyz.array[i], xyz.array[i + 1], xyz.array[i + 2]);
        this.__v3.applyMatrix4(this.matrixWorld);
        result.push([this.__v3.x, this.__v3.y, this.__v3.z]);
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
    if (xyz && this.__pointsCount > 1) {
      let x = xyz.getX(0);
      let y = xyz.getY(0);
      let z = xyz.getZ(0);
      let x1; let y1; let z1;
      for (let i = 1; i < this.__pointsCount; i++) {
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
    if (xyz && this.__pointsCount > 1) {
      const prevPoint = new Vector3();
      const nextPoint = new Vector3();

      prevPoint.set(xyz.getX(0), xyz.getY(0), xyz.getZ(0));
      if (normal && normal.isVector3) prevPoint.projectOnPlane(normal);
      for (let i = 1; i < this.__pointsCount; i++) {
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

  // ----------------------------------------
  // Find point index matching given point.
  // If no points found return an empty array
  // ----------------------------------------
  findPoint(point, epsilon) {
    const pointIndices = [];
    const coords = this.__validateCoordinates(point);
    if (coords && coords.length) {
      if (this.geometry.attributes.position) {
        const xyz = this.geometry.attributes.position;
        for (let i = 0; i < this.__pointsCount; i++) {
          if (this.__isEqual(coords[0], xyz.getX(i), epsilon) &&
              this.__isEqual(coords[1], xyz.getY(i), epsilon) &&
              this.__isEqual(coords[2], xyz.getZ(i), epsilon)) {
            pointIndices.push(i);
          }
        }
      }
    }
    return pointIndices;
  }

  // -----------------------------------
  // Find point indices that match with
  // given points. if no points found
  // return empty array
  // -----------------------------------
  findPoints(points, epsilon) {
    const pointsIndices = [];
    const coords = this.__validateCoordinates(points);
    for (let i = 0; i < coords.length / 3; i++) {
      pointsIndices[i] = [];
    }
    if (coords && coords.length) {
      if (this.geometry.attributes.position) {
        const xyz = this.geometry.attributes.position;
        let k = 0;
        for (let i = 0; i < coords.length; i += 3) {
          for (let j = 0; j < this.__pointsCount; j++) {
            if (this.__isEqual(coords[i], xyz.getX(j), epsilon) &&
                this.__isEqual(coords[i + 1], xyz.getY(j), epsilon) &&
                this.__isEqual(coords[i + 2], xyz.getZ(j), epsilon)) {
              pointsIndices[k].push(j);
            }
          }
          k++;
        }
      }
    }
    return pointsIndices;
  }

  // -------------------------------------
  // getPointsCount()
  // -------------------------------------
  getPointsCount() {
    return this.__pointsCount;
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
        this.pointObjects.raycast = function (raycaster, intersects) {};
        this.pointObjects.name = "points";
        this.add(this.pointObjects);
      } else if (this.pointObjects) {
        this.pointObjects.visible = true;
      }
      
      if (this.pointObjects && this.pointObjects.material.depthTest !== this.material.depthTest) {
        this.pointObjects.material.depthTest = this.material.depthTest,
        this.pointObjects.material.transparent = this.material.transparent
        this.pointObjects.renderOrder = this.renderOrder;
      }
    } else if (this.pointObjects && this.pointObjects.visible) {
      this.pointObjects.visible = false;
    }
  }

  isPointsShown() {
    let shown = this.pointObjects && this.pointObjects.visible;
    // if (shown && this.isSelected) {
    //   shown = this.__pointObjectsBeforeSel ? true : false;
    // }

    return shown;
  }

  // -------------------------------------
  // ACTIONS ON POINT LABELS
  // -------------------------------------

  // -------------------------------------
  // create or destroy point labels
  // -------------------------------------
  showPointLabels(flag) {
    if (flag && !this.__pointLabelsExist) {
      this.__createPointLabels();
    } else if (!flag && this.__pointLabelsExist) {
      this.__destroyPointLabels();
    }
  }

  __changePointLabels(index, changedPointQuantity, action) {
    const xyz = this.geometry.attributes.position;
    if (xyz) {
      const syncPromises = [];
      if (action === GlPointAction.Delete) {
        for (let i = this.__pointsCount + changedPointQuantity - 1; i >= this.__pointsCount; i--) {
          // this.remove(this.pointLabels[i]);
          this.pointLabels[i].dispose();
        }

        this.pointLabels.splice(this.__pointsCount, changedPointQuantity);

        for (let i = index; i < this.__pointsCount; i++) {
          this.pointLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        }
      } else if (action === GlPointAction.Insert || action === GlPointAction.Add) {
        if (index !== this.__pointsCount - changedPointQuantity && action === GlPointAction.Insert) {
          for (let i = index; i < this.__pointsCount - changedPointQuantity; i++) {
            this.pointLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
          }
        }

        for (let i = this.__pointsCount - changedPointQuantity; i < this.__pointsCount; i++) {
          const ind = i + 1;
          const coordLabel = ind.toString();

          const point = {
            x: xyz.getX(i),
            y: xyz.getY(i),
            z: xyz.getZ(i),
          };

          const label = new GlLabel({
            text: coordLabel,
            color: this.__pointLabelsColor,
            fontSize: 0.12,
            font: this.__pointLabelsFont,
            orientation: "camera"
          });

          // label.sync(this.handleLabel());
          syncPromises.push(label.sync(/* this.handleLabel() */));
          label.position.set(point.x, point.y, point.z);
          // this.add(label);
          this.pointLabels.push(label);
        }
      } else if (action === GlPointAction.Set) {
        if (changedPointQuantity === 1 && index === 0) {
          this.pointLabels[0].position.set(xyz.getX(0), xyz.getY(0), xyz.getZ(0));
          if (this.isClosed()) this.pointLabels[this.__pointsCount - 1].position.set(xyz.getX(0), xyz.getY(0), xyz.getZ(0));
        } else if (changedPointQuantity === 1 && index === this.__pointsCount - 1) {
          const lastPnt = this.__pointsCount - 1;
          this.pointLabels[lastPnt].position.set(xyz.getX(lastPnt), xyz.getY(lastPnt), xyz.getZ(lastPnt));
          if (this.isClosed()) this.pointLabels[0].position.set(xyz.getX(lastPnt), xyz.getY(lastPnt), xyz.getZ(lastPnt));
        } else {
          for (let i = index; i < index + changedPointQuantity; i++) {
            this.pointLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
          }
        }
      }
      this.executeOnLabelsUpdated(syncPromises);
    }
  }

  __createPointLabels() {
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__pointsCount > 0 && this.pointLabels.length === 0) {
      const syncPromises = [];
      for (let i = 0; i < this.__pointsCount; ++i) {
        const ind = i + 1;
        const coordLabel = ind.toString();

        const point = {
          x: xyz.getX(i),
          y: xyz.getY(i),
          z: xyz.getZ(i),
        };

        const label = new GlLabel({
          text: coordLabel,
          color: this.__pointLabelsColor,
          fontSize: 0.12,
          font: this.__pointLabelsFont,
          orientation: "camera",
          scaleFactor: true,
        });

        // label.sync(this.handleLabel());
        syncPromises.push(label.sync(/* this.handleLabel() */));
        label.position.set(point.x, point.y, point.z);
        // this.add(label);
        this.pointLabels.push(label);
      }
      this.executeOnLabelsUpdated(syncPromises);
      this.__pointLabelsExist = true;
    }
  }

  async executeOnLabelsUpdated(syncPromises) {
    await Promise.all(syncPromises);
    // all texts sync complete
    if (this.instancedLabel) {
      this.remove(this.instancedLabel);
      this.instancedLabel.dispose();
    }
    this.instancedLabel = mergeTextsIntoInstancedText(this.pointLabels);
    if (this.instancedLabel) this.add(this.instancedLabel);
    this.handleLabel()();
  }

  __destroyPointLabels() {
    for (const label of this.pointLabels) {
      // this.remove(label);
      label.dispose();
    }
    if (this.instancedLabel) {
      this.remove(this.instancedLabel);
      this.instancedLabel.dispose();
    }
    this.pointLabels.length = 0;
    this.__pointLabelsExist = false;
  }

  isPointLabelsShown() {
    return this.__pointLabelsExist;
  }

  // -------------------------------------
  // setPointLabelsFont()
  // -------------------------------------
  setPointLabelsFont(font) {
    if (typeof font === 'string' && font.length > 5) {
      this.showPointLabels(false);
      this.__pointLabelsFont = font;
      this.showPointLabels(true);
    }
  }

  // -------------------------------------
  // setPointLabelsFont()
  // -------------------------------------
  setPointLabelsColor(color) {
    if (color === null || color === undefined) return;

    this.__pointLabelsColor = color;
    if (this.__pointLabelsExist) {
      for (const label of this.pointLabels) {
        label.setColor(this.__pointLabelsColor);
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
  // ACTIONS ON LINE LABELS
  // -------------------------------------

  // -------------------------------------
  // check if a line label on scene
  // -------------------------------------
  isLineLabelsShown() {
    return this.__lineLabelsExist;
  }

  // -------------------------------------
  // setLineColor()
  // -------------------------------------
  setLineColor(color) {
    if (color !== null || color !== undefined) {
      if (this.material.vertexColors) {
        this.material.vertexColors = false;
        this.material.needsUpdate = true;
      }
      this.lineColor = color;
    }
    if (this.material && !this.isSelected) {
      this.material.color.setHex(this.lineColor);
    }
  }

  // -------------------------------------
  // setLineLabelsColor()
  // -------------------------------------
  setLineLabelsColor(color) {
    if (color !== null || color !== undefined) {
      this.__lineLabelsColor = color;
      for (const label of this.lineLabels) {
        label.setColor(this.__lineLabelsColor);
      }
    }
  }

  // -------------------------------------
  // setLineLabelsFont()
  // -------------------------------------
  setLineLabelsFont(font) {
    if (typeof font === 'string' && font.length > 5) {
      this.showLineLabels(false);
      this.__lineLabelsFont = font;
      this.showLineLabels(true);
    }
  }

  // -------------------------------------
  // change existing line labels (NOT IMPLEMENTED)
  // -------------------------------------
  __changeLineLabels(index, changedPointQuantity, action) {
    const xyz = this.geometry.attributes.position;
    if (xyz) {
      if (action === GlPointAction.Delete) {
        for (let i = this.__pointsCount + changedPointQuantity - 1; i >= this.__pointsCount; i--) {
          this.remove(this.lineLabels[i]);
          this.lineLabels[i].geometry.dispose();
        }

        this.lineLabels.splice(this.__pointsCount, changedPointQuantity);

        for (let i = index; i < this.__pointsCount; i++) {
          this.lineLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        }
      } else if (action === GlPointAction.Insert || action === GlPointAction.Add) {
        if (index !== this.__pointsCount - changedPointQuantity && action === GlPointAction.Insert) {
          for (let i = index; i < this.__pointsCount - changedPointQuantity; i++) {
            this.lineLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
          }
        }

        for (let i = this.__pointsCount - changedPointQuantity; i < this.__pointsCount; i++) {
          const ind = i + 1;
          const coordLabel = ind.toString();

          const point = {
            x: xyz.getX(i),
            y: xyz.getY(i),
            z: xyz.getZ(i),
          };

          const label = new GlLabel({
            text: coordLabel,
            color: this.__lineLabelsColor,
            fontSize: 0.12,
            font: this.__lineLabelsFont,
            orientation: "camera"
          });

          label.sync();
          label.position.set(point.x, point.y, point.z);
          this.add(label);
          this.lineLabels.push(label);
        }
      } else if (action === GlPointAction.Set) {
        for (let i = index; i < index + changedPointQuantity; i++) {
          if (this.lineLabels[i]) this.lineLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        }
      }
    }
  }

  // -------------------------------------
  // create line labels
  // -------------------------------------
  __createLineLabels() {
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__pointsCount > 0 && this.lineLabels.length === 0) {
      let point;
      if (this.__pointsCount === 1) {
        point = {
          x: xyz.getX(0),
          y: xyz.getY(0),
          z: xyz.getZ(0),
        };
      } else if (this.__pointsCount === 2) {
        point = {
          x: (xyz.getX(0) + xyz.getX(1)) / 2,
          y: (xyz.getY(0) + xyz.getY(1)) / 2,
          z: (xyz.getZ(0) + xyz.getZ(1)) / 2,
        };
      } else {
        point = {
          x: (xyz.getX(0) + xyz.getX(1) + xyz.getX(2)) / 3,
          y: (xyz.getY(0) + xyz.getY(1) + xyz.getY(2)) / 3,
          z: (xyz.getZ(0) + xyz.getZ(1) + xyz.getZ(2)) / 3,
        };
      }

      if (this.name) {
        const label = new GlLabel({
          text: this.name,
          color: this.__lineLabelsColor,
          fontSize: 0.12,
          font: this.__lineLabelsFont,
          orientation: "camera"
        });

        label.sync(this.handleLabel());
        label.position.set(point.x, point.y, point.z);
        this.add(label);
        this.lineLabels.push(label);
        this.__lineLabelsExist = true;
      }
    }
  }

  // -------------------------------------
  // destroy line labels
  // -------------------------------------
  __destroyLineLabels() {
    for (const label of this.lineLabels) {
      this.remove(label);
      label.dispose();
    }
    this.lineLabels.length = 0;
    this.__lineLabelsExist = false;
  }

  // -------------------------------------
  // create or destroy line labels
  // -------------------------------------
  showLineLabels(flag) {
    if (flag && !this.__lineLabelsExist) {
      this.__createLineLabels();
    } else if (!flag && this.__lineLabelsExist) {
      this.__destroyLineLabels();
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
    const last = this.isClosed() ? 1 : 0;
    if (this.__pointsCount > 0) {
      // calculate centroid of the polyline
      const centroid = new Vector3();
      let point;
      for (let i = 0; i < this.__pointsCount - last; i++) {
        point = this.getPointAt(i);
        centroid.add(point);
      }
      centroid.divideScalar(this.__pointsCount - last);

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
      for (let i = 0, cnt = Math.floor(this.__pointsCount / 2); i < cnt; i++) {
        const point = {
          x: xyz.getX(i),
          y: xyz.getY(i),
          z: xyz.getZ(i),
        };
        xyz.setXYZ(i, xyz.getX(this.__pointsCount - i - 1), xyz.getY(this.__pointsCount - i - 1), xyz.getZ(this.__pointsCount - i - 1));
        xyz.setXYZ(this.__pointsCount - i - 1, point.x, point.y, point.z);
      }

      xyz.needsUpdate = true;

      if (this.__pointLabelsExist) {
        this.__changePointLabels(0, this.__pointsCount, GlPointAction.Set);
      }

      this.geometry.computeBoundingSphere();
    }
  }

  // -------------------------------------
  // calculate the area
  // -------------------------------------
  getArea() {
    let area = 0.0;
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__pointsCount > 2) {
      const unitZ = new Vector3(0, 0, 1);
      const thisPlane = this.__getPlane();
      const quat = new Quaternion().setFromUnitVectors(thisPlane.normal, unitZ);
      const firstPoint = new Vector3();
      const prevPoint = new Vector3();
      const nextPoint = new Vector3();

      firstPoint.set(xyz.getX(0), xyz.getY(0), xyz.getZ(0));
      firstPoint.applyQuaternion(quat);
      prevPoint.copy(firstPoint);
      for (let i = 1; i < this.__pointsCount; i++) {
        nextPoint.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        nextPoint.applyQuaternion(quat);
        area += (prevPoint.x * nextPoint.y) - (prevPoint.y * nextPoint.x);

        prevPoint.copy(nextPoint);
      }

      area += (prevPoint.x * firstPoint.y) - (prevPoint.y * firstPoint.x);
      area = Math.abs(area / 2);
    }

    return area;
  }

  // -------------------------------------
  // calculate the projected area
  // -------------------------------------
  getProjectedArea(normal) {
    let area = 0.0;
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__pointsCount > 2) {
      const unitZ = new Vector3(0, 0, 1);
      let quat;
      if (normal && normal.isVector3) {
        quat = new Quaternion().setFromUnitVectors(normal, unitZ);
      }
      const firstPoint = new Vector3();
      const prevPoint = new Vector3();
      const nextPoint = new Vector3();

      firstPoint.set(xyz.getX(0), xyz.getY(0), xyz.getZ(0));
      if (quat) firstPoint.applyQuaternion(quat);
      prevPoint.copy(firstPoint);
      for (let i = 1; i < this.__pointsCount; i++) {
        nextPoint.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        if (quat) nextPoint.applyQuaternion(quat);
        area += (prevPoint.x * nextPoint.y) - (prevPoint.y * nextPoint.x);

        prevPoint.copy(nextPoint);
      }

      area += (prevPoint.x * firstPoint.y) - (prevPoint.y * firstPoint.x);
      area = Math.abs(area / 2);
    }

    return area;
  }

  // -------------------------------------
  // get volume
  // -------------------------------------
  getVolume() {
    let volume = 0;
    if (this.surface) {
      volume = this.surface.getVolume();
    }
    return volume;
  }

  // -------------------------------------
  // check for clockwise order
  // -------------------------------------
  isClockwise(quat) {
    let clockwise = false;
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__pointsCount > 2) {
      let sum = 0.0;
      this.__m3.setFromMatrix4(this.matrixWorld);
      const prevPoint = new Vector3();
      const nextPoint = new Vector3();

      prevPoint.set(xyz.getX(0), xyz.getY(0), xyz.getZ(0));
      prevPoint.applyMatrix3(this.__m3);
      if (quat && quat.isQuaternion) prevPoint.applyQuaternion(quat);

      for (let i = 1; i < this.__pointsCount; i++) {
        nextPoint.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        nextPoint.applyMatrix3(this.__m3);
        if (quat && quat.isQuaternion) nextPoint.applyQuaternion(quat);
        sum += (prevPoint.x * nextPoint.y) - (prevPoint.y * nextPoint.x);

        prevPoint.copy(nextPoint);
      }

      clockwise = (sum < 0);
    }

    return clockwise;
  }

  // -------------------------------------
  // calculate the plane of a polyline in
  // terms of local coordinates
  // -------------------------------------
  __getPlane() {
    const last = this.isClosed() ? 1 : 0;
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__pointsCount > 0) {
      // calculate centroid of the polyline
      const centroid = new Vector3();
      const point = new Vector3();
      for (let i = 0; i < this.__pointsCount - last; i++) {
        point.fromBufferAttribute(xyz, i);
        centroid.add(point);
      }
      centroid.divideScalar(this.__pointsCount - last);

      // create matrix
      const A = new Float64Array(9).fill(0);
      for (let i = 0; i < this.__pointsCount - last; i++) {
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
          normal: new Vector3(eVectors[minInd], eVectors[3 + minInd], eVectors[6 + minInd]).normalize(),
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
      this.__m3.setFromMatrix4(this.matrixWorld);
      plane.normal.applyMatrix3(this.__m3);
      plane.centroid.applyMatrix4(this.matrixWorld);

      // Swap direction to honour right hand rule
      const unitZ = new Vector3(0, 0, 1);
      const dot = plane.normal.dot(unitZ);
      if (dot < 0) {
        plane.normal.negate();
      }
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
  // functions related hatches
  // -------------------------------------
  createHatch(args) {
    const { hatchName, hatchImage, pwUnit, hatchType, normal, hatchPatternData } = args;

    if (!hatchImage || hatchName && hatchName === this.hatchName) return false;
    
    if (!this.isClosed()) return false;

    let planeNormal;
    if (normal && normal.isVector3) {
      planeNormal = normal;
    } else {
      const plane = this.__getPlane();
      planeNormal = plane.normal;
    }
    if (!planeNormal) return false;

    const coords = this.getPoints(0, this.__pointsCount - 2, true, true);
    if (!(coords && coords.length)) return false;
    
    // do triangulation
    const triMaker = new GlTriangulator();
    triMaker.setNormal(planeNormal);
    const triangles = triMaker.triangulate(coords, null, 3);
    if (triangles.length === 0) return false;

    const triFaces = triMaker.convertToIndexed(triangles)

    // prepare a transformation matrix
    const unitZ = new Vector3(0, 0, 1);
    const upDirection = new Vector3(0, 0, 1);

    const dot = unitZ.dot(planeNormal);
    if (1 - Math.abs(dot) < 1.e-2) upDirection.set(0, 1, 0);

    upDirection.projectOnPlane(planeNormal);
    upDirection.normalize();

    const crossProd = new Vector3();
    crossProd.crossVectors(upDirection, planeNormal);
    crossProd.normalize();

    // create the new transformation matrix
    const trMatrix = new Matrix4()
    trMatrix.makeBasis(crossProd, upDirection, planeNormal);

    const bbox = this.geometry.boundingBox.clone();
    bbox.applyMatrix4(trMatrix);
    const boxSize = Math.max(
      bbox.max.x - bbox.min.x,
      bbox.max.y - bbox.min.y,
      bbox.max.z - bbox.min.z);

    let imgSize = 64;
    let repNum = boxSize * pwUnit / imgSize;
    repNum = repNum > 1 ? repNum : 1;
    
    const imageBase64 = new Image();
    imageBase64.src = hatchImage;
    const hatchOffset = hatchType ? HatchPolygonOffset[hatchType] : HatchPolygonOffset.Default;
    const hatchTexture = new Texture(imageBase64);
    // const loader = new TextureLoader();
    // const hatchTexture = loader.load(
    //   // resource URL
    //   hatchImage.src,
    
    //   // onLoad callback
    //   function ( texture ) {
    //     return true;
    //   },
    
    //   // onProgress callback currently not supported
    //   undefined,
    
    //   // onError callback
    //   function ( err ) {
    //     console.error( 'An error happened.' );
    //   }
    // );

    hatchTexture.minFilter = LinearFilter;
    hatchTexture.magFilter = LinearFilter;
    hatchTexture.wrapS = hatchTexture.wrapT = RepeatWrapping;
    hatchTexture.repeat.set(repNum, repNum);
    hatchTexture.needsUpdate = true;

    let material = new MeshBasicMaterial({
      side: DoubleSide,
      map: hatchTexture,
      polygonOffset: true,
      polygonOffsetFactor: hatchOffset * 2,
      polygonOffsetUnits: hatchOffset,
      transparent: true,
    });
    
    const params = {
      material,
      name: 'hatch'
    }

    const glTri = new GlMesh(params);
    glTri.uvTransMatrix = trMatrix.clone();
    glTri.addVertices(triFaces.vertices);
    glTri.setTriFaces(triFaces.indices);
    glTri.applyBoxUV(trMatrix.invert());

    glTri.raycast = (raycaster, intersects) => {
      const arr = [];
      GlMesh.prototype.raycast.call(glTri, raycaster, arr);
      if (arr.length) { 
        for (let i = 0; i < arr.length; i++) {
          arr[i].object = this;
        }
        intersects.push(...arr);
      }
    }

    // this prevents flickering
    glTri.renderOrder = -1 * hatchOffset;

    if (this.surface) {
      this.remove(this.surface);
      this.surface.dispose();
    }

    this.surface = glTri;
    this.surface.selectable = true;
    this.surface.snappable = false;
    this.add(this.surface);

    this.pwUnit = pwUnit;
    this.hatchImage = hatchImage;
    this.hatchName = hatchName;
    this.hatchType = hatchType;
    this.hatchPatternData = hatchPatternData;

    return true;
  }

  updateHatchImage(args) {
    const { hatchName, hatchImage, hatchType, pwUnit, hatchPatternData } = args;

    if (!hatchImage || hatchName && hatchName === this.hatchName) return false;

    const trMatrix = this.surface.uvTransMatrix.clone();
    const bbox = this.geometry.boundingBox.clone();
    bbox.applyMatrix4(trMatrix);
    const boxSize = Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z);

    let imgSize = 64;
    let repNum = boxSize * pwUnit / imgSize;
    repNum = repNum > 1 ? repNum : 1;

    const imageBase64 = new Image();
    imageBase64.src = hatchImage;
    const hatchTexture = new Texture(imageBase64);
    hatchTexture.minFilter = LinearFilter;
    hatchTexture.magFilter = LinearFilter;
    hatchTexture.wrapS = hatchTexture.wrapT = RepeatWrapping;
    hatchTexture.repeat.set(repNum, repNum);
    hatchTexture.needsUpdate = true;

    if (this.surface) {
      const material = this.surface.material;
      // if (material.map) material.map.dispose();
      material.map.needsUpdate = true;
      material.map = hatchTexture;
      const hatchOffset = hatchType ? HatchPolygonOffset[hatchType] : HatchPolygonOffset.Default;
      material.polygonOffsetUnits = hatchOffset;
      material.polygonOffsetFactor = hatchOffset * 2;
      this.surface.renderOrder = -hatchOffset;
      material.needsUpdate = true;

      this.pwUnit = pwUnit;
      this.hatchImage = hatchImage;
      this.hatchName = hatchName;
      this.hatchType = hatchType;
      this.hatchPatternData = hatchPatternData;
    }

    return true;
  }

  editHatchShape(pointAction, startIndex, newCoords) {
    let bResult = false;
    if (pointAction < GlPointAction.Set || pointAction > GlPointAction.Delete ||
        !this.surface || !this.isClosed())
      return bResult;

    // if (pointAction === GlPointAction.Set) {
    //   const ptCoords = this.getPointAt(startIndex, true);
    //   const ptIndices = this.surface.findVertices(ptCoords, 1.e-4);
    //   if (ptIndices && ptIndices.length) {
    //     const trMatrix = this.surface.uvTransMatrix.clone();
    //     const material = this.surface.material;
    //     this.surface.setVertex(ptIndices[0], newCoords);

    //     // adjust texture
    //     const bbox = this.surface.geometry.boundingBox.clone();
    //     bbox.applyMatrix4(trMatrix);
    //     const boxSize = Math.max(
    //       bbox.max.x - bbox.min.x,
    //       bbox.max.y - bbox.min.y,
    //       bbox.max.z - bbox.min.z);

    //     let repNum = boxSize / (material.map.image.naturalHeight / this.pwUnit);
    //     repNum = repNum < 1 ? 1 : repNum;
    //     material.map.repeat.set(repNum, repNum);
    //     material.map.needsUpdate = true;

    //     this.surface.applyBoxUV(trMatrix.invert());
    //   }

    // } else if (pointAction === GlPointAction.Delete) {
      const trMatrix = this.surface.uvTransMatrix.clone();
      const material = this.surface.material.clone();
      const normal = new Vector3().setFromMatrixColumn(trMatrix, 2);

      const coords = this.getPoints(0, this.__pointsCount - 2, true, true);
      if (!(coords && coords.length)) return bResult;

      // do triangulation
      const triMaker = new GlTriangulator();
      triMaker.setNormal(normal);
      const triangles = triMaker.triangulate(coords, null, 3);
      if (triangles.length === 0) return bResult;

      const triFaces = triMaker.convertToIndexed(triangles);

      // remove hatch surface
      if (this.surface) {
        this.remove(this.surface);
        this.surface.material = null;
        this.surface.dispose();
      }

      // adjust texture
      const bbox = this.geometry.boundingBox.clone();
      bbox.applyMatrix4(trMatrix);
      const boxSize = Math.max(
        bbox.max.x - bbox.min.x,
        bbox.max.y - bbox.min.y,
        bbox.max.z - bbox.min.z);

      // let repNum = boxSize / (material.map.image.naturalHeight / this.pwUnit);
      let imgSize = 64;
      let repNum = boxSize * this.pwUnit / imgSize;
      repNum = repNum < 1 ? 1 : repNum;
      material.map.repeat.set(repNum, repNum);
      material.map.needsUpdate = true;

      // create a new hatch surface
      const params = {material, name: 'hatch'};

      const glTri = new GlMesh(params);
      glTri.uvTransMatrix = trMatrix.clone();
      glTri.addVertices(triFaces.vertices);
      glTri.setTriFaces(triFaces.indices);
      glTri.applyBoxUV(trMatrix.invert());

      glTri.renderOrder = -1 * this.hatchOffset;

      this.surface = glTri;
      this.surface.selectable = true;
      this.surface.snappable = false;
      this.add(this.surface);
    // }

    return true;
  }

  removeHatch() {
    if (this.surface) {
      this.remove(this.surface);
      this.surface.dispose();
    }

    this.surface = null;
    this.hatchName = null;
    this.hatchImage = null;
    this.hatchPolygonOffset = 0;
    this.pwUnit = 0;
  }

  // -------------------------------------
  // methods related to changes
  // -------------------------------------
  changed(cmdType) {
    if (['CmdSetPosition', 'CmdSetRotation', 'CmdSetScale', 'CmdSetQuatOffPos'].includes(cmdType)) return;
    if ([GlObjectFactoryType.Arrow, GlObjectFactoryType.Circle, GlObjectFactoryType.Rectangle, GlObjectFactoryType.Ellipse].includes(this.objectType) && !this.__changesCount) {
      this.oldObjType = this.objectType;
      this.objectType = null;
    }
    this.__changesCount++;
    if (this.parent && this.parent.isGlLayer) {
      this.parent.childChanged(this);
    }
  }

  undoChange() {
    this.__changesCount--;
    if ([GlObjectFactoryType.Arrow, GlObjectFactoryType.Circle, GlObjectFactoryType.Rectangle, GlObjectFactoryType.Ellipse].includes(this.oldObjType) && !this.__changesCount) {
        this.objectType = this.oldObjType;
    }
    if (this.__changesCount < 0) this.__changesCount = 0;
    if (this.parent && this.parent.isGlLayer) {
      this.parent.childChanged(this);
    }
  }

  isChanged() {
    return this.__changesCount > 0;
  }

  changesSaved() {
    this.__changesCount = 0;
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
      // this.pointObjects.material.color.setHex(this.pointObjectsColor);
    } // else {this.showPoints(false);}
    if (this.pointObjects) {
      this.pointObjects.material.color.setHex(this.pointObjectsColor);
    }
    if (!this.pivotPointVisible) this.hidePivotPoint();
    this.isSelected = false;
  }
  // -------------------------------------------
  // lock / unlock on scene
  // -------------------------------------------
  lock() {
    if (!this.selectable ) return null;
    const clrSelected = 0xD8D8D8;
    
    if (this.material) {
      this.material.color.setHex(clrSelected);
    }

    // point objects
    if (this.pointObjects) {
      this.pointObjects.material.color.setHex(clrSelected);
    }
    this.selectable = false;
    return null;
  }

  unlock() {
    if (this.material) {
      this.material.color.setHex(this.lineColor);
    }

    //  point objects
    if (this.pointObjects) {
      this.pointObjects.material.color.setHex(this.pointObjectsColor);
    }
    if (!this.pivotPointVisible) this.hidePivotPoint();
    this.selectable = true;
  }

  // -------------------------------------------
  // this function will be called by raycaster
  // -------------------------------------------
  raycast(raycaster, intersects) {
    // don't do raycasting if the object is not selectable and not snappable
    if (!this.visible || (!this.parent || !this.parent.visible) ||
        (!this.selectable && !this.snappable) ||
        this.__pointsCount === 0) return;

    const inverseMatrix = new Matrix4();
    const ray = new GlRay();
    const sphere = new Sphere();
    let precision = raycaster.params.Line.threshold;
    let threshold = raycaster.params.Points.threshold;
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

    const scale = this.parent.partOfPlot ? this.parent.parent.scale : this.scale;
    // const scale = this.scale;

    // precision for line raycasting
    const localPrecision = precision / ((scale.x + scale.y + scale.z) / 3);
    const localPrecisionSq = localPrecision * localPrecision;

    // threshold for point raycasting
    const localThreshold = threshold / ((scale.x + scale.y + scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;

    const vStart = new Vector3();
    const vEnd = new Vector3();
    const interSegment = new Vector3();
    const interRay = new Vector3();

    const ptCount = this.__pointsCount;
    const xyz = geometry.attributes.position;
    for (let i = 0; i < ptCount - 1; i++) {
      vStart.fromBufferAttribute(xyz, i);
      vEnd.fromBufferAttribute(xyz, i + 1);

      if (clippedSection &&
         (!this.__obb.containsPoint(vStart, i > 0) &&
          !this.__obb.containsPoint(vEnd, i > 0))) {
        continue;
      }

      // inspect for a point
      const distSq = ray.distanceSqToSegment(vStart, vEnd, interRay, interSegment);
      if (clippedSection && !this.__obb.containsPoint(interSegment, i > 0)) continue;

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
              index: foundIndex,
              face: null,
              faceIndex: null,
              object: this,
              child: {
                distance: distance,
                point: foundIndex === i ? vStart.clone().applyMatrix4(this.matrixWorld) :
                                          vEnd.clone().applyMatrix4(this.matrixWorld),
                index: foundIndex,
                face: null,
                object: this
              }
            });

            // skip the next segment
            if (foundIndex === i + 1) {
              i++;
              continue;
            }
          }
        }
      }

      // inspect for a line
      if (snapMode !== GlSnapMode.Points && distSq < localPrecisionSq) {
        // if point raycasting was skipped need to check extra conditions
        // in order to make sure that snapping to lines done correctly
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
            point: interSegment.clone().applyMatrix4(this.matrixWorld),
            index: i,
            face: null,
            child: childPnt ? {
              distance: distance,
              point: childPnt,
            } : null,
            faceIndex: null,
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
        type: 'GlPolyline',
        generator: 'GlPolyline.toJSON'
      };
    }

    const object = {};
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if(this.objectType) object.oT = this.objectType;

    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    object.pCt = this.__pointsCount;
    object.lC = this.lineColor;
    object.lLC = this.__lineLabelsColor;
    object.lLE = this.__lineLabelsExist;
    object.pOC = this.pointObjectsColor;
    object.pO = (this.pointObjects && !this.isSelected) ? true : false;
    object.pLC = this.__pointLabelsColor;
    if (this.__pointLabelsExist) object.pLE = this.__pointLabelsExist;
    if (this.pivotOffset.lengthSq() > 1e-3) object.pvO = this.pivotOffset.toArray();

    if (this.attributes.size > 0) object.uA = this.attributes.toJSON();

    // hatch resources
    if (this.surface) {
      object.pU = this.pwUnit;
      object.hN = this.hatchName;
      object.hIS = this.hatchImage.src;
      object.hT = this.hatchType;
      if(this.hatchPatternData) object.hPD = this.hatchPatternData;
    }

    object.geom = GlUtils.bufferGeometryToJson(this.geometry);

    output.object = object;
    return output;
  }

  get properties() {
    return {
      type: Primitive_Type.String, // type
      oT: Primitive_Type.Uint8, // objectType
      n: Primitive_Type.String, // name
      rO: Primitive_Type.Uint8, // renderOrder
      v: Primitive_Type.Uint8, // visible
      l: Primitive_Type.Int32, // layers.mask
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      pCt: Primitive_Type.Int32, // pointsCount
      lC: Primitive_Type.Uint32, // lineColor
      lLC: Primitive_Type.Uint32, // lineLabelsColor
      lLE: Primitive_Type.Uint8, // lineLabelsExist
      pOC: Primitive_Type.Uint32, // pointObjectsColor
      pO: Primitive_Type.Uint8, // pointObjects
      pLC: Primitive_Type.Uint32, // pointLabelsColor
      pLE: Primitive_Type.Uint8, // pointLabelsExist
      pvO: Primitive_Type.Float32Array, // pivotOffset
      uA: Primitive_Type.Object, // attributes
      pU: Primitive_Type.Float32, // pwUnit
      hN: Primitive_Type.String, // hatchName
      hIS: Primitive_Type.String, // hatchImage.src
      hPO: Primitive_Type.Int32, // hatchPolygonOffset
      hPD: Primitive_Type.Float32, // hatchPatternData
      geom: Primitive_Type.Object, // geometry
      rowO: Primitive_Type.Uint32Array // row order
    }
  }

  // ------------------------
  // toArrayBuffer
  // ------------------------
  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);

    writeToDv('type', this.type);
    if (this.objectType) writeToDv('oT', this.objectType);

    if (this.name !== '') writeToDv('n', this.name);
    if (this.renderOrder !== 0) writeToDv('rO', this.renderOrder);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);
    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);
    writeToDv('m', this.matrix.toArray());

    writeToDv('pCt', this.__pointsCount);
    writeToDv('lC', this.lineColor);
    writeToDv('lLC', this.__lineLabelsColor);
    writeToDv('lLE', this.__lineLabelsExist);
    writeToDv('pOC', this.pointObjectsColor);
    writeToDv('pO', (this.pointObjects && !this.isSelected) ? true : false);
    writeToDv('pLC', this.__pointLabelsColor);
    writeToDv('pVC', this.material.vertexColors);

    if (this.__pointLabelsExist) writeToDv('pLE', this.__pointLabelsExist);
    if (this.pivotOffset.lengthSq() > 1e-3) writeToDv('pvO', this.pivotOffset.toArray());

    if (this.attributes.size > 0) {
      writeToDv('uA', null);
      this.attributes.toArrayBuffer(myDv);
    }

    // hatch resources
    if (this.surface) {
      writeToDv('hN', this.hatchName);
      writeToDv('hIS', this.hatchImage.src);
      writeToDv('hPO', this.hatchPolygonOffset);
      if(this.hatchPatternData) writeToDv('hPD', this.hatchPatternData);
      writeToDv('pU', this.pwUnit);
    }

    writeToDv('geom', null);
    GlUtils.bufferGeometryToArrayBuffer(this.geometry, myDv);

    writeToDv('endObj');
  }

  toChartLine(){
    const line = new ChartLine();
    line.setLineWidth(2);
    line.addPoints(this.getPoints(0, this.__pointsCount - 1, true, false));
    line.setLineColor(this.lineColor);
    return line;
  }
}
