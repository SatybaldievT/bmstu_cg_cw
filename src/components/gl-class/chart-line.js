/* eslint-disable no-undef */
import { GlIntervalGeometry } from '../../lib/core/gl-interval-geometry';
import { GlIntervalMaterial } from '../../lib/core/gl-interval-material';
import { GlSnapMode } from '../../lib/core/gl-constants';
import { GlRay } from '../../lib/core/gl-ray';
import { OBB } from '../../lib/math/obb';
import {
  Object3D,
  Box3,
  Vector3,
  Color,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Matrix4,
  Sphere,
  Plane
} from 'three';

export class ChartLine extends Object3D {
  constructor(params, fromJSON) {
    super();

    // set the object's type
    this.isMesh = true;         // this is needed to render this object via WebGlRenderer correctly
    this.isChartLine = true;
    this.type = 'ChartLine';

    // for internal use only
    this.__m4 = new Matrix4();
    this.__v3 = new Vector3();
    this.__obb = new OBB();

    // selection
    this.selectable = true;
    this.snappable = true;
    this.isSelected = false;

    const geometry = new GlIntervalGeometry();
    const material = new GlIntervalMaterial({vertexColors: true});

    this.geometry = geometry;
    this.material = material;

    this.EPS = 1e-7;
    this.lenEPS = 1e-7;

    // line
    this.lineColor = 0x000000;
    this.lineWidth = 2;

    this.materialColor = 0xFFFFFF;

    if (params) {
      this.name = (params && params.name) ? params.name : "";
      if (params.uuid) this.uuid = params.uuid;
      if (params.lineColor) this.lineColor = params.lineColor;

      this.material.color.setHex(this.materialColor);

      if (params.lineWidth) this.lineWidth = params.lineWidth;
      this.material.linewidth = this.lineWidth;

    } else if (fromJSON) {
      this.__initFromJson(fromJSON);
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

    if (fromJSON.mCr) {
      this.materialColor = fromJSON.mCr;
      this.material.color.setHex(this.materialColor);
    }

    if (fromJSON.tCr) this.lineColor = fromJSON.tCr;
    if (fromJSON.tW) {
      this.lineWidth = fromJSON.tW;
      this.material.linewidth = this.lineWidth;
    }

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);
    if (fromJSON.rO) this.renderOrder = fromJSON.rO;
    if (!fromJSON.v) this.visible = false;
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
  // get bounding box
  // -------------------------------------
  getBoundingBox() {
    if (!this.geometry.boundingBox) this.geometry.computeBoundingBox();
    const boundingBox = new Box3();
    boundingBox.copy(this.geometry.boundingBox);
    boundingBox.applyMatrix4(this.matrixWorld);

    return boundingBox.isEmpty() ? null : boundingBox;
  }

  setMaterialResolution(width, height) {
    this.material.resolution.set(width, height);
  }

  // -------------------------------------
  // insertPoint() / insertPoint()
  // -------------------------------------
  insertPoint(index, array) {
    this.insertPoints(index, array);
  }

  insertPoints(index, array) {
    if (index > this.getPointsCount() - 1) {
      console.log("Ошибка: задан некорректный индекс");
      return;
    }

    const coords = this.__validateCoordinates(array);
    if (coords && coords.length) {
      const totCount = this.geometry.getPointsCount() + coords.length / 3;
      if (this.geometry.attributes.instanceStart.data.count < totCount) {
        this.__recreateGlIntervalGeometry(coords);
      }
      this.geometry.insertPoints(index, coords);
      const color = this.__validateColors(new Color(this.lineColor));
      // * set the inserted point color to default
      this.geometry.setColorInRange(index, index + 1, color);
    }
  }

  // ------------------------------------------------
  // TODO [["0x00000"],["0xffff"],["0x...."],["0x00000.."]]
  // TODO [["rgb()"],["rgb()"],["rgb()"],["rgb()"]]
  // [[1,1,1],[1,0,0],[0,1,0]]
  // [{r0:,g0:,b0:},{r1:,g1:,b1:},{r2:,g2:,b2:}]

  // __validateColors()
  // validate and adjust colors as:
  // [r0, g0, b0, r1, g1, b1]
  // ------------------------------------------------
  __validateColors(colors) {
    if (!colors) return null;

    let error = '';
    let retCollors = null;

    if (colors instanceof Array) {
      if (typeof colors[0] === 'object') {
        // we'll assume that the 'colors' is an array of objects: [{r0:,g0:,b0:},{r1:,g1:,b1:},{r2:,g2:,b2:}]
        retCollors = Array(colors.length * 3).fill(0.0);
        for (let start = 0; start < colors.length; ++start) {
          if (colors[start].r === undefined || colors[start].g === undefined ||
            colors[start].b === undefined) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retCollors[start * 3] = colors[start].r;
            retCollors[start * 3 + 1] = colors[start].g;
            retCollors[start * 3 + 2] = colors[start].b;
          }
        }
      } else if (typeof colors[0][0] === 'number') {
        return colors.join();
      } else {
        // we'll assume that the 'colors' are given as: [r0, g0, b0, r1, g1, b1]
        const ptCount = Math.floor(colors.length / 3);
        retCollors = Array(ptCount * 3).fill(0.0);
        for (let start = 0; start < ptCount * 3; ++start) {
          retCollors[start] = colors[start];
        }
      }
    } else if (typeof colors === 'string') {
      const newcolor = new Color(colors);
      retCollors = [newcolor.r, newcolor.g, newcolor.b];
    } else {
      // we'll assume that the 'colors' is an object
      if (colors.r === undefined || colors.g === undefined || colors.b === undefined) {
        error = 'Ошибка: координаты заданы некорректно';
      } else {
        retCollors = [colors.r, colors.g, colors.b];
      }
    }

    if (error) {
      console.log(error);
    }

    return retCollors;
  }

  // ------------------------------------------------
  // __validateCoordinates()
  // validate and adjust coordinates as:
  // [x0, y0, z0, x1, y1, z1]
  // The method converts coordinates from world to local
  // ------------------------------------------------
  __validateCoordinates(coords) {
    if (!coords) return null;

    let retCoords = null;
    let error = '';
    if (coords instanceof Array) {
      if (typeof coords[0] === 'object') {
        // we'll assume that the 'coords' is an array of objects: [point1, point2, ...]
        retCoords = Array(coords.length * 3).fill(0.0);
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
        retCoords = Array(ptCount * 3).fill(0.0);
        for (let i = 0; i < ptCount * 3; ++i) {
          retCoords[i] = coords[i];
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
      if (this.geometry.getPointsCount() === 0) {
        this.__v3.set(retCoords[0], retCoords[1], retCoords[2]);
        const diff = Math.abs(this.position.lengthSq() - this.__v3.lengthSq());
        if (diff > this.lenEPS) {
          this.__m4.copy(this.matrixWorld).invert();
          this.position.set(retCoords[0], retCoords[1], retCoords[2]);
          this.position.applyMatrix4(this.__m4);
          this.updateMatrixWorld();
        } else {
          this.matrixWorld.setPosition(this.position);
        }
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
  // __recreateGlIntervalGeometry(coords)
  // 'coords' must be the type of Array and contain
  // local coordinates as: [x0, y0, z0, x1, y1, z1]
  // ----------------------------------------------------
  __recreateGlIntervalGeometry(coords) {
    if (!(coords && coords instanceof Array)) return;

    const itemSize = 3;
    const newPointsCount = Math.floor(coords.length / itemSize);

    // define the size of new attributes
    const ptCount = this.geometry.getPointsCount();
    const newSize = (ptCount + newPointsCount + 10) * itemSize;

    // create the new buffer attributes
    const coordinatesBuffer = new InstancedInterleavedBuffer(new Float32Array(2 * newSize), 6, 1); // xyz, xyz
    const instanceStart = new InterleavedBufferAttribute(coordinatesBuffer, itemSize, 0);
    const instanceEnd = new InterleavedBufferAttribute(coordinatesBuffer, itemSize, 3);

    const colorsBuffer = new InstancedInterleavedBuffer(new Float32Array(2 * newSize), 6, 1); // rgb, rgb
    const instanceColorStart = new InterleavedBufferAttribute(colorsBuffer, itemSize, 0);
    const instanceColorEnd = new InterleavedBufferAttribute(colorsBuffer, itemSize, 3);


    // copy all existing coordinates from the current geometry to the new one
    let oldGeometry;
    if (this.geometry.attributes.instanceStart) {
      oldGeometry = this.geometry;
      const oldCoords = this.geometry.attributes.instanceStart.data;
      const oldColors = this.geometry.attributes.instanceColorStart.data;
      for (let i = 0; i < ptCount; ++i) {
        coordinatesBuffer.copyAt(i, oldCoords, i);
        colorsBuffer.copyAt(i, oldColors, i);
      }
    }

    if (oldGeometry) {
      this.geometry = new GlIntervalGeometry();
      this.geometry._pointsCount = ptCount;
      oldGeometry.dispose();
    }

    this.geometry.setAttribute('instanceStart', instanceStart);
    this.geometry.setAttribute('instanceEnd', instanceEnd);
    this.geometry.setAttribute('instanceColorStart', instanceColorStart);
    this.geometry.setAttribute('instanceColorEnd', instanceColorEnd);
    this.geometry.instanceCount = this.geometry.attributes.instanceStart.data.count;
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (index !== undefined && index !== null &&
      index >= 0 && index < this.geometry.getPointsCount()) {
      return true;
    }
    return false;
  }

  // -------------------------------------
  // addPoint() / addPoints()
  // -------------------------------------
  addPoint(point) {
    this.addPoints(point);
  }

  addPoints(array) {
    // adjust coordinates as: [x0, y0, z0, x1, y1, z1]
    const coords = this.__validateCoordinates(array);
    if (coords && coords.length) {
      const totCount = this.geometry.getPointsCount() + coords.length / 3;
      if (!this.geometry.attributes.instanceStart || this.geometry.attributes.instanceStart.data.count < totCount) {
        this.__recreateGlIntervalGeometry(coords);
      }
      this.geometry.addPoints(coords);
    }
  }

  // -------------------------------------
  // setPoint() / setPoints()
  // -------------------------------------
  setPoint(index, coord) {
    this.setPoints(index, coord);
  }

  setPoints(index, array) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    // adjust coordinates as: [x0, y0, z0, x1, y1, z1]
    const coords = this.__validateCoordinates(array, index);
    if (coords && coords.length) {
      this.geometry.setPoints(index, coords);
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

    // this.geometry.deletePoints(startIndex, endIndex);
    let start = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      this.geometry.removePoint(start + i);
      start--;
    }
  }

  deleteAllPoints() {
    const pointsCount = this.geometry.getPointsCount();
    let start = 0;
    for (let i = 0; i < pointsCount; i++) {
      this.geometry.removePoint(start + i);
      start--;
    }

    this.matrix.identity();
    this.updateMatrixWorld(true);
  }

  //
  getPointAt(index, asFlatArray) {
    return this.geometry.getPointAt(index, this.matrixWorld, asFlatArray);
  }

  //
  getPoints(startIndex, endIndex, asFlatArray) {
    return this.geometry.getPoints(startIndex, endIndex, this.matrixWorld, asFlatArray);
  }

  //
  getPointsAsArray(startIndex, endIndex) {
    return this.geometry.getPointsAsArray(startIndex, endIndex, this.matrixWorld);
  }

  //
  getPointsCount() {
    return this.geometry.getPointsCount();
  }

  //
  getPlane() {
    return this.geometry.getPlane(this.matrixWorld);
  }

  //
  getLength() {
    return this.geometry.getLength();
  }

  // -------------------------------------
  // setLineColor
  // -------------------------------------
  setLineColor(color) {
    if (color) this.lineColor = color;
    this.geometry.setColors(null, new Color(this.lineColor));
  }

  // -------------------------------------
  // setMaterialColor
  // -------------------------------------
  setMaterialColor(color) {
    if (color) this.materialColor = color;
    if (!this.isSelected) {
      this.material.color.setHex(this.materialColor);
    }
  }

  // --------------------
  // setLineWidth
  // --------------------
  setLineWidth(width) {
    if (!isNaN(width) && width > 0 && width < 10) {
      this.lineWidth = width;
      this.material.linewidth = this.lineWidth;
    }
  }
  
  // -------------------------------------
  // select / deselect on scene
  // -------------------------------------
  select() {
    if (!this.selectable || this.isSelected) return null;

    const clrSelected = 0x0000FF;
    this.material.color.setHex(clrSelected);
    this.material.linewidth = this.lineWidth + 1;
    this.material.opacity = 0.4;

    this.isSelected = true;
    return null;
  }

  deselect(child) {
    if (child && child.index !== undefined) return;

    this.material.color.setHex(this.materialColor);
    this.material.linewidth = this.lineWidth;
    this.material.opacity = 1;

    this.isSelected = false;
  }

  // -----------------------
  // raycast
  // -----------------------
  raycast(raycaster, intersects) {
    const geometry = this.geometry;
    const ptCount = geometry.getPointsCount();

    // don't do raycasting if the object is not selectable
    if (!this.visible || (this.parent && !this.parent.visible) ||
      (!this.selectable && !this.snappable) ||
      ptCount === 0) return;
    
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

    const vStart = new Vector3();
    const vEnd = new Vector3();
    const interSegment = new Vector3();
    const interRay = new Vector3();

    const start = geometry.attributes.instanceStart;
    const end = geometry.attributes.instanceEnd;
    for (let i = 0; i < ptCount - 1; i++) {
      vStart.fromBufferAttribute(start, i);
      vEnd.fromBufferAttribute(end, i);

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

  // --------------------
  // dispose
  // --------------------
  dispose() {
    this.geometry.dispose();
    this.material.dispose();

    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].dispose) {
        this.children[i].dispose();
      }
    }
    this.children.length = 0;
  }

  // ------------------------
  // toJSON
  // ------------------------
  toJSON(meta, keepUuid = false) {
    const output = {};

    // meta is a string when called from JSON.stringify
    const isRootObject = (meta === undefined || typeof meta === 'string');
    if (isRootObject) {
      output.metadata = {
        version: 5.0,
        type: 'ChartLine',
        generator: 'ChartLine.toJSON'
      };
    }

    const object = {};

    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    object.lCr = this.lineColor;
    object.lW = this.lineWidth;

    object.mCr = this.materialColor;

    output.object = object;

    return output;
  }

  get properties() {
    return {
      type: Primitive_Type.String, // type
      n: Primitive_Type.String, // name
      rO: Primitive_Type.Uint8, // renderOrder
      v: Primitive_Type.Uint8, // visible
      l: Primitive_Type.Int32, // layers.mask
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      mCr: Primitive_Type.Uint32, // materialColor
      lCr: Primitive_Type.Uint32, // lineColor
      lW: Primitive_Type.Uint8, // lineWidth
    }
  }

  // ------------------------
  // toArrayBuffer
  // ------------------------
  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);

    writeToDv('type', this.type);
    if (this.name !== '') writeToDv('n', this.name);
    if (this.renderOrder !== 0) writeToDv('rO', this.renderOrder);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);
    writeToDv('m', this.matrix.toArray());
    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);

    writeToDv('lCr', this.lineColor);
    writeToDv('lW', this.lineWidth);
    writeToDv('mCr', this.materialColor);

    writeToDv('endObj');
  }

  // -----------------------------------------------------------------------------
  // setClippingPlanes
  // Sets local clipping planes based on minPoint. maxPoint, viewDir, and upDir.
  // viewDir and upDir must be the normalized vectors (if they were passed)
  // -----------------------------------------------------------------------------
  setClippingPlanes(ptMin, ptMax, viewDir, upDir) {
    if (this.material && ptMin && ptMin.isVector3 && ptMax && ptMax.isVector3) {
      const viewV = viewDir && viewDir.isVector3 ? viewDir : new Vector3(0, 0, -1);
      const upV = upDir && upDir.isVector3 ? upDir : new Vector3(0, 1, 0);
      const normal = viewV.clone().cross(upV).normalize();

      this.removeClippingPlanes();

      this.material.clipping = true;
      this.material.clippingPlanes = [new Plane(), new Plane(), new Plane(), new Plane()];
      const cp = this.material.clippingPlanes;
      const leftPl = cp[0];
      const rightPl = cp[1];
      const topPl = cp[2];
      const bottomPl = cp[3];

      leftPl.setFromNormalAndCoplanarPoint(normal, ptMin);
      normal.negate();
      rightPl.setFromNormalAndCoplanarPoint(normal, ptMax);
      normal.cross(viewV).normalize();
      topPl.setFromNormalAndCoplanarPoint(normal, ptMax);
      normal.negate();
      bottomPl.setFromNormalAndCoplanarPoint(normal, ptMin);

      this.material.minPoint = ptMin.clone();
      this.material.maxPoint = ptMax.clone();
      this.material.planePoint = new Vector3();
    }
  }

  removeClippingPlanes() {
    if (this.material && Array.isArray(this.material.clippingPlanes)) {
      this.material.clipping = false;
      this.material.clippingPlanes = null;
      this.material.minPoint = null;
      this.material.maxPoint = null;
      this.material.planePoint = null;
    }
  }
}