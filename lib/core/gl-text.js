import {Text} from '../troika/troika-three-text/Text';
import {DefaultFont, Primitive_Type} from './gl-constants';
import { GlUtils } from '../utils/gl-utils';
import {
  Box3,
  Matrix4,
} from 'three';

export class GlText extends Text {
  constructor(params, fromJSON) {
    super();

    this.isGlText = true;
    this.type = 'GlText';

    // selection
    this.selectable = true;
    this.isSelected = false;

    this.font = DefaultFont;
    this.color = 0x111111;
    this.__m4 = new Matrix4();

    this._depthTest = true;

    const sizeFactor = 67;
    if (!fromJSON) {
      if (!params) params = {};
      if (params.color !== null && params.color !== undefined) this.color = params.color;
      if (params.coords && params.coords.length !== 0) this.coords = params.coords[0];

      // the next lines are intented to be used just for backward compatibility
      if (params.labels && params.labels.length !== 0) this.text = params.labels[0];
      if (!(isNaN(params.size)) && params.size / sizeFactor) this.fontSize = params.size / sizeFactor;

      if (typeof params.font === 'string' && params.font.length > 5) this.font = params.font;
      if (params.text) this.text = (params.text) ? params.text : "";
      if (params.fontSize) this.fontSize = params.fontSize;
      if (!isNaN(params.offsetH)) this.offsetH = params.offsetH;
      if (!isNaN(params.offsetV)) this.offsetV = params.offsetV;
      if (params.anchorX) this.anchorX = params.anchorX;
      if (params.anchorY) this.anchorY = params.anchorY;
    } else {
      if(fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    }
  }

  set depthTest(value) {
    this._depthTest = value;
 
    if (this.material && this.material.depthTest !== this._depthTest) {
      this.material.depthTest = this._depthTest;
      this.material.depthWrite = this._depthTest;
      this.material.needsUpdate = true;

      if (this._depthTest) {
        this.renderOrder = 0;
        if (this._transparent !== undefined) this.material.transparent = this._transparent;
      } else {
        this.renderOrder = 1;
        // since transparent objects are rendered last set to true
        this._transparent = this.material.transparent;
        this.material.transparent = true;
      }
    }
  }

  get depthTest() {
    return this._depthTest;
  }

  setDepthTest(val) {
    if (this.material) this.depthTest = val;
  }


  /**
   * Initialise an instance from a json file
   * @param {object} fromJSON - json object
   * @return {void}
   */
  __initFromJson(fromJSON) {
    const sizeFactor = 67;
    //uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;
    if (fromJSON.p) this.position.fromArray(fromJSON.p);
    if (fromJSON.c) this.color = fromJSON.c;
    if (fromJSON.txt) this.text = fromJSON.txt;
    if (fromJSON.cd) this.coords = fromJSON.cd[0];
    if (fromJSON.lb) this.text = fromJSON.lb[0];
    // if (fromJSON.size && fromJSON.size / sizeFactor) this.fontSize = fromJSON.size / sizeFactor;
    if (fromJSON.v) this.visible = fromJSON.v;
    if (!fromJSON.sl) this.selectable = fromJSON.sl;

    if (typeof fromJSON.f === 'string' && fromJSON.f.length > 5) this.font = fromJSON.f;
    if (fromJSON.o) this.orientation = fromJSON.o;
    if (fromJSON.fS) this.fontSize = fromJSON.fS;
    if (fromJSON.oH) this.offsetH = fromJSON.oH;
    if (fromJSON.oV) this.offsetV = fromJSON.oV;
    if (fromJSON.aX) this.anchorX = fromJSON.aX;
    if (fromJSON.aY) this.anchorY = fromJSON.aY;

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;
  }

  /**
 * Initialise an instance from a json_v1 file
 * @param {object} fromJSON - json object
 * @return {void}
 */
  __initFromJson_v4_5(fromJSON) {
    const sizeFactor = 67;
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;
    if (fromJSON.position) this.position.set(fromJSON.position.x, fromJSON.position.y, fromJSON.position.z);
    if (fromJSON.color !== null && fromJSON.color !== undefined) this.color = fromJSON.color;
    if (fromJSON.text) this.text = fromJSON.text;
    if (fromJSON.coords && fromJSON.coords.length !== 0) this.coords = fromJSON.coords[0];
    if (fromJSON.labels && fromJSON.labels.length !== 0) this.text = fromJSON.labels[0];
    if (fromJSON.size && fromJSON.size / sizeFactor) this.fontSize = fromJSON.size / sizeFactor;
    if (fromJSON.visible) this.visible = fromJSON.visible;
    if (!fromJSON.selectable) this.selectable = fromJSON.selectable;

    if (typeof fromJSON.font === 'string' && fromJSON.font.length > 5) this.font = fromJSON.font;
    if (fromJSON.text) this.text = fromJSON.text;
    if (fromJSON.fontSize) this.fontSize = fromJSON.fontSize;
    if (fromJSON.offsetH) this.offsetH = fromJSON.offsetH;
    if (fromJSON.offsetV) this.offsetV = fromJSON.offsetV;
    if (fromJSON.anchorX) this.anchorX = fromJSON.anchorX;
    if (fromJSON.anchorY) this.anchorY = fromJSON.anchorY;

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
  }

  /**
   * Set the URL of a custom font file to be used. Supported font formats are:
   * .ttf,  .otf,  .woff (.woff2 is not supported)
   * Default: The Roboto font loaded from Google Fonts CDN
   * @param {String=} fontURL - url of the font
   */
  setFont(fontURL) {
    if (typeof fontURL === 'string' && fontURL.length > 5) {
      this.font = fontURL;
      this.sync();
    }
  }

  setFontSize(size, callback) {
    if (Number.isNaN(size)) return;

    this.fontSize = size;
    this.sync((callback) ? callback : this.handleLabel());
  }

  /**
   * Set a new label
   * @param {String} newLabel - new text og
   */
  setLabel(newLabel, callback) {
    if (typeof newLabel === 'string') {
      this.text = newLabel;
      this.sync((callback) ? callback : this.handleLabel());
    }
  }

  // notify to parent when labels are updated
  handleLabel() {
    const self = this;
    return function() {
      if (self.parent) self.parent.dispatchEvent( {type: 'handleLabel', message: 'handleLabelUpdate'} );
    };
  }

  /**
   * Set a new color
   * @param {String} color - new color og
   */
  setColor(color) {
    if (this.textBeforeSelection !== undefined && this.isSelected) {
      this.textBeforeSelection = color;
    } else {
      if (color || color == 0) this.color = color;
    }
    this.sync();
  }

  /**
   * select / deselect 
   */
  select() {
    if (!this.selectable || this.isSelected) return null;

    const clrSelected = 0x0000FF;
    this.textBeforeSelection = this.color;
    this.setColor(clrSelected);

    this.isSelected = true;
    return null;
  }

  //
  // getLength
  //
  getLength() {
    return this.text.length;
  }

  //
  // getText
  //
  getText() {
    return this.text;
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

  deselect(child) {
    if (child && child.index !== undefined) return;
    const color = this.textBeforeSelection;
    this.textBeforeSelection = undefined;
    this.setColor(color);
    this.isSelected = false;
  }

  /**
   * this function will be called by raycaster
   */
  raycast(raycaster, intersects) {
    // don't do raycasting if the object is not selectable
    if (!this.visible || (this.parent && !this.parent.visible) ||
        !this.selectable) return;

    super.raycast(raycaster, intersects);
  }

  /**
   * toJSON
   */
  toJSON(meta, keepUuid = false) {
    const output = {};

    // meta is a string when called from JSON.stringify
    const isRootObject = (meta === undefined || meta === null || typeof meta === 'string');
    if (isRootObject) {
      output.metadata = {
        version: 5.0,
        type: 'GlText',
        generator: 'GlText.toJSON'
      };
    }

    // 'type' ->  'type'
    // 'txt '  ->  'text'
    // 'rO '  ->  'renderOrder'
    // 'v  '  ->  'visible'
    // 'l  '  ->  'layers.mask'
    // 'm  '  ->  'matrix'
    // 'mAU'  ->  'matrixAutoUpdate'
    // 'cd '  ->  'coords'
    // 'lb '  ->  'labels'
    // 'fS '  ->  'fontSize'
    // 'c'  ->  'color'
    // 'f'  ->  'font'
    // 'p'  ->  'position'
    // 'oH'  ->  'offsetH'
    // 'oV'  ->  'offsetV'
    // 'aX'  ->  'anchorX'
    // 'aY'  ->  'anchorY'

    const object = {};
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.text !== '') object.txt = this.text;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    object.cd = this.coords;
    object.lb = this.labels;
    object.fS = this.fontSize;
    object.c = this.color;
    object.f = this.font;
    object.p = this.position.toArray();
    object.o = this.orientation;
    object.sl = this.selectable;

    if (this.offsetH) object.oH = this.offsetH;
    if (this.offsetV) object.oV = this.offsetV;
    if (this.anchorX) object.aX = this.anchorX;
    if (this.anchorY) object.aY = this.anchorY;

    output.object = object;

    return output;
  }

  get properties() {
    return {
      type: Primitive_Type.String, // type
      txt: Primitive_Type.String, // text
      rO: Primitive_Type.Uint8, // text
      v: Primitive_Type.Uint8, // visible
      l: Primitive_Type.Int32, // layers.mask
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      cd: Primitive_Type.Float32Array, // coords
      lb: Primitive_Type.String, // labels
      fS: Primitive_Type.Float32, // fontsize
      c: Primitive_Type.Uint32, // color
      f: Primitive_Type.String, // font
      p: Primitive_Type.Float32Array, // position
      o: Primitive_Type.String, // orientation
      sl: Primitive_Type.Uint8, // selectable
      oH: Primitive_Type.Int32, // offsetH
      oV: Primitive_Type.Int32, // offsetV
      aX: Primitive_Type.Int32, // anchorX
      aY: Primitive_Type.Int32, // anchorY
    }
  }

  // ------------------------
  // toArrayBuffer
  // ------------------------
  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);

    writeToDv('type', this.type);
    if (this.text !== '') writeToDv('txt', this.text);
    if (this.renderOrder !== 0) writeToDv('rO', this.renderOrder);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);
    writeToDv('m', this.matrix.toArray());
    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);

    if (this.coords) writeToDv('cd', this.coords);
    if (this.labels) writeToDv('lb', this.labels);
    writeToDv('fS', this.fontSize);
    writeToDv('c', this.color);
    writeToDv('f', this.font);
    writeToDv('p', this.position.toArray());
    writeToDv('o', this.orientation);
    writeToDv('sl', this.selectable);
    
    if (this.offsetH) writeToDv('oH', this.offsetH);
    if (this.offsetV) writeToDv('oV', this.offsetV);
    if (this.anchorX) writeToDv('aX', this.anchorX);
    if (this.anchorY) writeToDv('aY', this.anchorY);
    
    writeToDv('endObj');
  }

  // *fromArrayBuffer(myDv) {
  //   const read = GlUtils.createReader(myDv);
  //   let res = null;
  //   const json = {};
  //   const setProperty = function*(prop, value) {
  //     switch(prop) {
  //       default:
  //         json[prop] = value;
  //     }
  //   };

  //   do {
  //     res = yield* read();
  //     yield* setProperty(res.prop, res.value);
  //   } while(res.prop !== 'endText');
  //   this.__initFromJson(json);
  // }

  clone(keepUuid, keepParent) {
    const clone = new this.constructor();

    const oldGeom = clone.geometry;
    clone.geometry = this.geometry.clone();
    if (oldGeom) oldGeom.dispose();
    clone.geometry.computeBoundingBox = clone.computeBoundingBox;
    clone.geometry.computeBoundingSphere = clone.computeBoundingSphere;
    clone.length = this.getLength();
    clone.text = this.text;

    if (typeof keepUuid === 'boolean' && keepUuid) clone.uuid = this.uuid;
    clone.selectable = this.selectable;

    clone.frustumCulled = this.frustumCulled;

    clone.position.copy(this.position);
    clone.rotation.order = this.rotation.order;
    clone.quaternion.copy(this.quaternion);
    clone.scale.copy(this.scale);

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

    clone.setColor(this.textBeforeSelection ? this.textBeforeSelection : this.color);
    clone.setFontSize(this.fontSize);

    if (this.hatchName) {
      clone.createHatch(this.hatchName, this.hatchImage, this.pwUnit);
    }

    if (this.isSelected) clone.deselect();
    clone.isSelected = false;

    return clone;
  }
}