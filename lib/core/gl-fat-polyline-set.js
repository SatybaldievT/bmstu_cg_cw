import { GlUtils } from '../utils/gl-utils';
import { Primitive_Type } from './gl-constants';
import {GlLayer} from './gl-layer';
import {
  Vector3,
  Box3
} from 'three';

export class GlFatPolylineSet extends GlLayer {

  constructor(params, fromJSON) {
    super();

    params = params || {};
    // set the object's type
    this.isGlFatPolylineSet = true;
    this.type = 'GlFatPolylineSet';
    this.materialColor = 0xffffff;

    this.bbox = new Vector3(1, 1, 1);

    // length label
    this.lengthLabelColor = 0xff0000;
    this.lengthLabelVisible = false;

    // point objects
    this.pointObjectsVisible = false;
    this.pointObjectsColor = 0x000000;

    // selection
    this.selectable = true;

    if (!fromJSON) {
      this.name = params.name;
      if (params.uuid) this.uuid = params.uuid;

      if (params.traceColor) this.traceColor = params.traceColor;
      else this.traceColor = 0x00FF00;

      if (params.traceWidth) this.traceWidth = params.traceWidth;
      else this.traceWidth = 2;

      if (params.dataSource) this.dataSource = params.dataSource;
    } else {
      if(fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
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

    // length label
    this.lengthLabelColor = fromJSON.lLC;
    if (fromJSON.lLV) this.lengthLabelVisible = true;

    this.pointObjectsColor = fromJSON.pointObjectsColor;
    if (fromJSON.pOV) this.pointObjectsVisible = true;

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;

    // set's visibility
    if (!fromJSON.v) this.visible = false;

    this.materialColor = fromJSON.materialColor;

    this.traceColor = fromJSON.tCr;

    this.traceWidth = fromJSON.tW;
  }

  // ------------------------------------------------
  // initialize an object from JSON_v1
  // ------------------------------------------------
  __initFromJson_v4_5(fromJSON) {

    this.name = fromJSON.name;
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // length label
    this.lengthLabelColor = fromJSON.lengthLabelColor;
    if (fromJSON.lengthLabelVisible) this.lengthLabelVisible = true;

    this.pointObjectsColor = fromJSON.pointObjectsColor;
    if (fromJSON.pointObjectsVisible) this.pointObjectsVisible = true;

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

    if (!fromJSON.visible) {
      this.visible = false;
    }

    this.materialColor = fromJSON.materialColor;

    this.traceColor = fromJSON.traceColor;

    this.traceWidth = fromJSON.traceWidth;
  }

  // -------------------------------------
  // adds a fatPolyline to this set
  // -------------------------------------
  addChild(fatPoly, params) {
    if (!fatPoly.isGlFatPolyline) return;
    params = params || {};

    const polyUuid = fatPoly.uuid;
    const found = params.unique ? -1 : this.children.findIndex((item) => item.uuid === polyUuid);
    if (found === -1) {
      if (!params.keepProperties) {
        fatPoly.setTraceColor(this.traceColor);
        fatPoly.setTraceWidth(this.traceWidth);
        fatPoly.showPoints(this.pointObjectsVisible);
        fatPoly.setLengthLabelColor(this.lengthLabelColor);
        fatPoly.showLengthLabel(this.lengthLabelVisible);
        // fatPoly.setDepthTest(this.depthTest);
      }

      if (params && params.keepParent) {
        this.addKeepingParent(fatPoly);
      } else {
        this.add(fatPoly);
      }
    } else {
      console.log('Object already exist!');
    }

    return found === -1;
  }

  // -------------------------------------
  // makes GlPolylineSet's properties
  // default to children.
  // e.g.: if the set's default point color is yellow,
  // then changes all children's point color to yellow
  // -------------------------------------
  setDefaults() {
    this.showPoints(this.pointObjectsVisible);
    this.setTraceColor(this.traceColor);
    this.setTraceWidth(this.traceWidth);
    this.showLengthLabel(this.lengthLabelVisible);
    this.setLengthLabelColor(this.lengthLabelColor);
  }

  // -------------------------------------
  // show/hide(with children) set
  // -------------------------------------
  showSet(flag) {
    if (flag === true || flag === false) {
      this.visible = flag;
    }
  }

  setMaterialResolution(width, height) {
    for (let i=0; i<this.children.length; i++) {
      this.children[i].setMaterialResolution(width, height);
    }
  }

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox() {
    const polySetBB = new Box3();

    for (const object of this.children) {
      if (object.getBoundingBox) {
        const objectBB = object.getBoundingBox();
        if (objectBB) {
          const min = objectBB.min.clone();
          const max = objectBB.max.clone();
          polySetBB.expandByPoint(min);
          polySetBB.expandByPoint(max);
        }
      }
    }
    if (!polySetBB.isEmpty()) {
      polySetBB.getSize(this.bbox);
      if (this.bbox.length() < 1) this.bbox.set(1, 1, 1);
    }
    return polySetBB.isEmpty() ? null : polySetBB;
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (Number.isInteger(index) &&
      index >= 0 && index < this.children.length) {
      return true;
    }
    return false;
  }

  // -------------------------------------
  // addPoint() / addPoints()
  // -------------------------------------
  addPoint(index, point) {
    if (this.__isValidIndex(index)) {
      this.children[index].addPoint(point);
    }
  }

  addPoints(index, array) {
    if (this.__isValidIndex(index)) {
      this.children[index].addPoint(array);
    }
  }

  // -------------------------------------
  // setPoint() / setPoints()
  // -------------------------------------
  setPoint(fatPolyIndex, index, coord) {
    if (this.__isValidIndex(fatPolyIndex)) {
      this.children[fatPolyIndex].setPoint(index, coord);
    }
  }

  setPoints(fatPolyIndex, index, array) {
    if (this.__isValidIndex(fatPolyIndex)) {
      this.children[fatPolyIndex].setPoints(index, array);
    }
  }

  // -------------------------------------
  // deletePoint() / deletePoints()
  // -------------------------------------
  deletePoint(fatPolyIndex, index) {
    if (this.__isValidIndex(fatPolyIndex)) {
      this.children[fatPolyIndex].deletePoint(index);
    }
  }

  deletePoints(fatPolyIndex, startIndex, endIndex) {
    if (this.__isValidIndex(fatPolyIndex)) {
      this.children[fatPolyIndex].deletePoints(startIndex, endIndex);
    }
  }

  deleteAllPoints(fatPolyIndex) {
    if (this.__isValidIndex(fatPolyIndex)) {
      this.children[fatPolyIndex].deleteAllPoints();
    }
  }

  //
  getPointAt(fatPolyIndex, index, asFlatArray) {
    if (this.__isValidIndex(fatPolyIndex)) {
      return this.children[fatPolyIndex].getPointAt(index, asFlatArray);
    }
  }

  //
  getPoints(fatPolyIndex, startIndex, endIndex, asFlatArray) {
    if (this.__isValidIndex(fatPolyIndex)) {
      return this.children[fatPolyIndex].getPoints(startIndex, endIndex, asFlatArray);
    }
  }

  //
  getPointsCount(fatPolyIndex) {
    if (this.__isValidIndex(fatPolyIndex)) {
      return this.children[fatPolyIndex].getPointsCount();
    }
  }

  //
  getLength(fatPolyIndex) {
    if (this.__isValidIndex(fatPolyIndex)) {
      return this.children[fatPolyIndex].getLength();
    } else {
      const lenArr = [];
      for (let i = 0; i < this.children.length; i++) {
        lenArr.push(this.children[i].getLength());
      }
      return lenArr;
    }
  }

  //
  isPointsShown() {
    return this.pointObjectsVisible;
  }

  //
  showPoints(flag) {
    if (flag === undefined || flag === null) {
      flag = this.pointObjectsVisible;
    } else {
      this.pointObjectsVisible = flag;
    }

    for (let i=0; i<this.children.length; i++) {
      this.children[i].showPoints(flag);
    }
  }

  // -------------------------------------
  // setTraceColor
  // -------------------------------------
  setTraceColor(color) {
    if (color === undefined || color === null) {
      color = this.traceColor;
    } else {
      this.traceColor = color;
    }

    for (let i=0; i<this.children.length; i++) {
      this.children[i].setTraceColor(color);
    }
  }

  // --------------------
  // setTraceWidth
  // --------------------
  setTraceWidth(width) {
    if (!isNaN(width)) {
      this.traceWidth = width;
    } else {
      width = this.traceWidth;
    }
    for (let i=0; i<this.children.length; i++) {
      this.children[i].setTraceWidth(width);
    }
  }

  // -------------------------------------
  // show length label
  // -------------------------------------
  showLengthLabel(font) {
    this.lengthLabelVisible = true;

    for (let i=0; i<this.children.length; i++) {
      this.children[i].showLengthLabel(font);
    }
  }

  // -------------------------------------
  // hide length label
  // -------------------------------------
  hideLengthLabel() {
    this.lengthLabelVisible = false;

    for (let i=0; i<this.children.length; i++) {
      this.children[i].hideLengthLabel();
    }
  }

  // -------------------------------------
  // update length label
  // -------------------------------------
  updateLengthLabel(ind) {
    this.lengthLabelVisible = false;

    if (Number.isInteger(ind) && ind >= 0 && ind < this.children.length) {
      this.children[ind].updateLengthLabel();
    } else {
      for (let i=0; i<this.children.length; i++) {
        this.children[i].updateLengthLabel();
      }
    }
  }

  // -------------------------------------
  // setLengthLabelColor
  // -------------------------------------
  setLengthLabelColor(color) {
    if (color === undefined || color === null) {
      color = this.lengthLabelColor;
    } else {
      this.lengthLabelColor = color;
    }

    for (let i=0; i<this.children.length; i++) {
      this.children[i].setLengthLabelColor(color);
    }
  }

  // -------------------------------------
  // setLengthLabelFont
  // -------------------------------------
  setLengthLabelFont(font) {
    if (!font) return;

    for (let i=0; i<this.children.length; i++) {
      this.children[i].setLengthLabelFont(font);
    }
  }
  // -------------------------------------
  // select / deselect on scene
  // -------------------------------------
  select(child, isMultiSelect) {
    //
  }

  deselect() {
    //
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
        type: 'GlFatPolylineSet',
        generator: 'GlFatPolylineSet.toJSON'
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

    object.mCr = this.materialColor;

    object.lLC = this.lengthLabelColor;
    if(this.lengthLabelVisible) object.lLV = this.lengthLabelVisible;

    object.pOC = this.pointObjectsColor;
    if(this.pointObjectsVisible) object.pOV = this.pointObjectsVisible;

    if (this.children.length) {
      object.ch = [];
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlFatPolyline && this.children[i].getPointsCount() > 0) {
          object.ch.push(this.children[i].toJSON(meta, keepUuid).object);
        }
      }
    }

    output.object = object;

    return output;
  }

  get properties() {
    return {
      type: Primitive_Type.String, // type
      n: Primitive_Type.String, // name
      rO: Primitive_Type.Uint8, // renderOrder
      v: Primitive_Type.Uint8, // visible
      l: Primitive_Type.Int32, // layers
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      tCr: Primitive_Type.Uint32, // traceColor
      tW: Primitive_Type.Uint8, // traceWidth
      mCr: Primitive_Type.Uint32, // materialColor
      lLC: Primitive_Type.Uint32, // lengthLabelsColor
      lLv: Primitive_Type.Uint8, // lengthLableVisible
      pOC: Primitive_Type.Uint32, // pointObjectsColor
      pOV: Primitive_Type.Uint32, // pointObjectsVisible
      ch: Primitive_Type.Int32, // children
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

    writeToDv('mCr', this.materialColor);

    writeToDv('lLC', this.lengthLabelColor);
    if(this.lengthLabelVisible) writeToDv('lLV', this.lengthLabelVisible);

    writeToDv('pOC', this.pointObjectsColor);
    if(this.pointObjectsVisible) writeToDv('pOV', this.pointObjectsVisible);

    if (this.children.length) {
      writeToDv('ch', this.children.length);
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlFatPolyline && this.children[i].getPointsCount() > 0) {
          this.children[i].toArrayBuffer(myDv);
        }
      }
      writeToDv('chEnd');
    }

    writeToDv('endObj');
  }
}
