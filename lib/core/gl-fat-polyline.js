/* eslint-disable no-undef */
import {GlIntervalGeometry} from './gl-interval-geometry';
import {GlIntervalMaterial} from './gl-interval-material';
import {GlLabel} from './gl-label';
import {OBB} from '../math/obb';
import {GlUtils} from '../utils/gl-utils';
import {GlSnapMode, Primitive_Type} from './gl-constants';
import {GlRay} from './gl-ray';
import {
  Mesh,
  Matrix4,
  Vector3,
  Color,
  Box3,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  BufferAttribute,
  PointsMaterial,
  Points,
  Sphere,
} from 'three';

export class GlFatPolyline extends Mesh {

  constructor(params, fromJSON) {
    // create a channel's geometry and material

    params = params || {};
    const isFromJson = fromJSON && fromJSON.geometry ? true : false;
    const geometry = isFromJson ? fromJSON.geometry : params.geometry ? params.geometry : new GlIntervalGeometry();
    const material = new GlIntervalMaterial({
      vertexColors: true
    });
    material.clipping = true;

    super(geometry, material);

    // set the object's type
    this.isGlFatPolyline = true;
    this.type = 'GlFatPolyline';
    this.materialColor = 0xffffff;

    this.EPS = 1e-7;
    this.lenEPS = 1e-3;

    this.length = 0;

    // for internal use only
    this.__m4 = new Matrix4();
    this.__v3 = new Vector3();
    this.__obb = new OBB();

    // length label
    this.lengthLabel;
    this.lengthLabelColor = 0xff0000;

    // point objects
    this.pointObjects = null;
    this.pointObjectsColor = 0x000000;

    // selection
    this.selectable = true;
    this.snappable = true;
    this.isSelected = false;

    if (!fromJSON) {
      this.name = params.name;
      if (params.uuid) this.uuid = params.uuid;

      if (params.materialColor) {
        this.materialColor = params.materialColor;
      }

      if (params.traceColor) this.traceColor = params.traceColor;
      else this.traceColor = 0xFF0000;

      if (params.traceWidth) this.traceWidth = params.traceWidth;
      else this.traceWidth = 2;
      this.material.linewidth = this.traceWidth;
    } else {
      if(fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    }

    this.material.color.setHex(this.materialColor);
    this.geometry.setColors(null, new Color(this.traceColor));
  }

  // ------------------------------------------------
  // initialize an object from JSON
  // ------------------------------------------------
  __initFromJson(fromJSON) {

    //uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;
    
    // name
    if (fromJSON.n) this.name = fromJSON.n;

    // length label
    this.lengthLabelColor = fromJSON.lLC;
    if (fromJSON.lLV) this.showLengthLabel();

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.pOV) this.showPoints(true);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;

    if (!fromJSON.v) this.visible = false;

    // this.materialColor = fromJSON.materialColor;

    this.traceColor = fromJSON.tCr;
    this.geometry.setColors(null, new Color(this.traceColor));

    this.traceWidth = fromJSON.tW;
    this.material.linewidth = this.traceWidth;
  }

  // ------------------------------------------------
  // initialize an object from JSON_v1
  // ------------------------------------------------
  __initFromJson_v4_5(fromJSON) {

    this.name = fromJSON.name;
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // length label
    this.lengthLabelColor = fromJSON.lengthLabelColor;
    // if (fromJSON.lengthLabelVisible) this.showLengthLabel();

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

    if (fromJSON.pointObjectsVisible) this.showPoints(true);

    if (fromJSON.renderOrder) this.renderOrder = fromJSON.renderOrder;

    if (!fromJSON.visible) {
      this.visible = false;
    }

    this.materialColor = fromJSON.materialColor;

    this.traceColor = fromJSON.traceColor;
    this.geometry.setColors(null, new Color(this.traceColor));

    this.traceWidth = fromJSON.traceWidth;
    this.material.linewidth = this.traceWidth;
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

  // -------------------------------------
  // set drillhole's material resolution
  // -------------------------------------
  setMaterialResolution(width, height) {
    this.material.resolution.set(width, height);
  }

  // ------------------------------------------------
  // __validateCoordinates()
  // validate and adjust coordinates as:
  // [x0, y0, z0, x1, y1, z1]
  // This method converts coordinates from world to local
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
        this.__m4.copy(this.matrixWorld).invert();
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
  // __recreateIntervalGeometry(coords)
  // 'coords' must be the type of Array and contain
  // local coordinates as: [x0, y0, z0, x1, y1, z1]
  // ----------------------------------------------------
  __recreateIntervalGeometry(coords) {
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

    const newXYZ = new BufferAttribute(new Float32Array(newSize), itemSize); // xyz

    // copy all existing coordinates from the current geometry to the new one
    let oldGeometry;
    if (this.geometry.attributes.position) {
      oldGeometry = this.geometry;
      const oldCoords = this.geometry.attributes.instanceStart.data;
      const oldColors = this.geometry.attributes.instanceColorStart.data;
      for (let i = 0; i < ptCount; ++i) {
        newXYZ.copyAt(i, this.geometry.attributes.position, i);
        coordinatesBuffer.copyAt(i, oldCoords, i);
        colorsBuffer.copyAt(i, oldColors, i);
      }
    }

    if (oldGeometry) {
      this.geometry = new GlIntervalGeometry();
      this.geometry._pointsCount = oldGeometry.getPointsCount();
      if (this.pointObjects) {
        this.pointObjects.geometry = this.geometry;
      }
      oldGeometry.dispose();
    }

    this.geometry.setAttribute('instanceStart', instanceStart);
    this.geometry.setAttribute('instanceEnd', instanceEnd);
    this.geometry.setAttribute('instanceColorStart', instanceColorStart);
    this.geometry.setAttribute('instanceColorEnd', instanceColorEnd);
    this.geometry.setAttribute('position', newXYZ);
    this.geometry.instanceCount = this.geometry.attributes.instanceStart.data.count;

    // add new coordinates
    this.geometry.addPoints(coords);
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
      const xyz = this.geometry.attributes.position;
      if (!xyz || (xyz && xyz.count < totCount)) {
        this.__recreateIntervalGeometry(coords);
      }

      // this.geometry.addPoints(coords);
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

    this.geometry.deletePoints(startIndex, endIndex);
  }

  deleteAllPoints() {
    this.geometry.deleteAllPoints();
  }

  //
  getPointAt(index, asFlatArray) {
    return this.geometry.getPointAt(index, asFlatArray);
  }

  //
  getPoints(startIndex, endIndex, asFlatArray) {
    return this.geometry.getPoints(startIndex, endIndex, asFlatArray);
  }

  //
  getPointsCount() {
    return this.geometry.getPointsCount();
  }

  //
  getPlane() {
    return this.geometry.getPlane();
  }

  //
  getLength() {
    return this.geometry.getLength();
  }

  //
  isPointsShown() {
    // let shown = this.pointObjects && this.pointObjects.visible;
    // if (shown && this.isSelected) {
    //   shown = this.__pointObjectsBeforeSel ? true : false;
    // }

    // return shown;
    return this.pointObjects && this.pointObjects.visible;
  }

  //
  showPoints(flag) {
    if (flag) {
      if (!this.pointObjects && this.geometry.attributes.position) {
        const material = new PointsMaterial({
          size: 5,
          color: this.pointObjectsColor,
        });

        this.pointObjects = new Points(this.geometry, material);
        this.add(this.pointObjects);
      } else if (this.pointObjects) {
        this.pointObjects.visible = true;
      }
    } else if (this.pointObjects && this.pointObjects.visible) {
      this.pointObjects.visible = false;
    }
  }

  // -------------------------------------
  // setTraceColor
  // -------------------------------------
  setTraceColor(color) {
    if (color !== null || color !== undefined) this.traceColor = color;

    this.geometry.setColors(null, new Color(this.traceColor));
  }

  // --------------------
  // setTraceWidth
  // --------------------
  setTraceWidth(width) {
    if (width > 0 && width < 10) {
      this.traceWidth = width;
      this.material.linewidth = this.traceWidth;
    }
  }

  // -------------------------------------
  // show/hide/update length label
  // -------------------------------------
  showLengthLabel(font) {
    if (this.lengthLabel) {
      this.lengthLabel.visible = true;
    } else {
      this.__createLengthLabel(font);
    }
  }

  hideLengthLabel() {
    if (this.lengthLabel) {
      this.lengthLabel.visible = false;
    }
  }

  updateLengthLabel() {
    if (this.lengthLabel) {
      const isVisible = this.lengthLabel.visible;
      this.lengthLabel.visible = false;

      const firstPoint = this.getPointAt(0);
      const lastPoint = this.getPointAt(this.getPointsCount());
      const length = this.getLength().toFixed(2);
      this.lengthLabel.coords[0].x = lastPoint.x;
      this.lengthLabel.coords[0].y = lastPoint.y;
      this.lengthLabel.coords[0].z = lastPoint.z;
      const offset = lastPoint.clone();
      offset.sub(firstPoint);
      this.lengthLabel.position.copy(offset);
      this.lengthLabel.setLabel(length);

      this.lengthLabel.visible = isVisible;
    }
  }

  // -------------------------------------
  // setLengthLabelColor
  // -------------------------------------
  setLengthLabelColor(color) {
    if (color !== null || color !== undefined) this.lengthLabelColor = color;
    if (this.lengthLabel) {
      this.lengthLabel.setColor(color);
    }
  }

  // -------------------------------------
  // __createLengthLabel
  // -------------------------------------
  __createLengthLabel(font) {
    if (!this.lengthLabel) {
      const firstPoint = this.getPointAt(0);
      const lastPoint = this.getPointAt(this.getPointsCount() - 1);
      const length = this.getLength().toFixed(2);
      this.lengthLabel = new GlLabel({
        text: length,
        color: this.lengthLabelColor,
        font: font,
        fontSize: 0.12,
        orientation: "camera",
        scaleFactor: true,
      });

      this.lengthLabel.sync();
      const offset = lastPoint.clone();
      offset.sub(firstPoint);
      this.lengthLabel.position.copy(offset);
      this.add(this.lengthLabel);
    } else {
      this.lengthLabel.setFont(font);
    }
  }

  // -------------------------------------
  // setLengthLabelFont
  // -------------------------------------
  setLengthLabelFont(font) {
    this.__createLengthLabel(font);
  }

  // -------------------------------------
  // select / deselect on scene
  // -------------------------------------
  select(child, isMultiSelect) {
    if (!this.selectable || this.isSelected) return null;

    const clrSelected = 0x0000FF;
    this.material.color.setHex(clrSelected);
    this.material.linewidth = this.traceWidth + 1;
    this.material.opacity = 0.4;

    this.isSelected = true;
    return null;
  }

  deselect() {
    this.material.color.setHex(this.traceColor);
    this.material.linewidth = this.traceWidth;
    this.material.opacity = 1;

    this.isSelected = false;
  }

  // -----------------------
  // raycast
  // -----------------------
  raycast(raycaster, intersects) {
    // don't do raycasting if the object is not selectable
    if (!this.visible || (this.parent && !this.parent.visible) ||
        (!this.selectable && !this.snappable)) return;

    const inverseMatrix = new Matrix4();
    const ray = new GlRay();
    const sphere = new Sphere();
    const precision = raycaster.params.Line.threshold;
    const threshold = raycaster.params.Points.threshold;
    const snapMode = raycaster.params.snapMode;
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

    const vStart = new Vector3();
    const vEnd = new Vector3();
    const interSegment = new Vector3();
    const interRay = new Vector3();

    const ptCount = geometry.getPointsCount();
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
              point: interSegment,
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
    super.dispose();

    // point objects
    if (this.pointObjects) {
      this.remove(this.pointObjects);
      this.pointObjects.material.dispose();
    }

    if (this.lengthLabel) this.lengthLabel.dispose();

    if (this.collarPoint) {
      const mat = this.collarPoint.material;
      mat.dispose();
      if (mat.map && mat.map.dispose) mat.map.dispose();
      this.collarPoint.geometry.dispose();
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
        type: 'GlFatPolyline',
        generator: 'GlFatPolyline.toJSON'
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

    object.tCr = this.traceColor;
    object.tW = this.traceWidth;

    object.pOC = this.pointObjectsColor;
    if (this.pointObjects && this.pointObjects.visible) object.pOV = true;

    object.lLC = this.lengthLabelColor;
    if (this.lengthLabel && this.lengthLabel.visible) object.lLV = true;

    // collar, survey and intervals
    object.cl = this.collar;

    object.geom = GlUtils.bufferGeometryToJson(this.geometry);

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
      tCr: Primitive_Type.Uint32, // traceColor
      tW: Primitive_Type.Uint8, // traceWidth
      pOC: Primitive_Type.Uint32, // pointObjectsColor
      pOV: Primitive_Type.Uint8, // pointObjects
      lLC: Primitive_Type.Uint32, // lineLabelColor
      lLV: Primitive_Type.Uint8, // lengthLabel
      cl: Primitive_Type.ObjectString, // collar
      geom: Primitive_Type.Object, // geometry
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

    writeToDv('tCr', this.traceColor);
    writeToDv('tW', this.traceWidth);

    writeToDv('pOC', this.pointObjectsColor);
    if (this.pointObjects && this.pointObjects.visible) writeToDv('pOV', true);

    writeToDv('lLC', this.lengthLabelColor);
    if (this.lengthLabel && this.lengthLabel.visible) writeToDv('lLV', true);

    // collar, survey and intervals
    if (this.collar) writeToDv('cl', this.collar);

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
