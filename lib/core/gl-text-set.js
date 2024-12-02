import { Primitive_Type } from './gl-constants';
import {GlLayer} from './gl-layer';
import { GlUtils } from '../utils/gl-utils';
import {
  Vector3,
  Box3,
} from 'three';

export class GlTextSet extends GlLayer {
  constructor(params, fromJSON) {
    super();
    this.name = '';
    this.type = 'GlTextSet';
    this.isGlTextSet = true;

    this.bbox = new Vector3(1, 1, 1);

    this.selectable = true;
    this.visible = true;
    this.color = 0x000000;
    this.fontSize = 1;

    if (fromJSON) {
      if(fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    } else if (params) {

      if (params.dataSource) this.dataSource = params.dataSource;

      if (params.name) this.name = params.name;

      if (params.color) this.color = params.color;

      if (params.fontSize) this.fontSize = params.fontSize;
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

    // dataSource
    if (fromJSON.dS) this.dataSource = fromJSON.dS;

    // set's visibility
    if (!fromJSON.v) this.visible = false;

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;

    // color
    this.color = fromJSON.c;
  }

  // ------------------------------------------------
  // initialize an object from JSON_v1
  // ------------------------------------------------
  __initFromJson_v4_5(fromJSON) {
    // uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.name) this.name = fromJSON.name;

    // dataSource
    if (fromJSON.dataSource) this.dataSource = fromJSON.dataSource;

    // set's visibility
    if (!fromJSON.visible) {
      this.visible = false;
    }

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

    // color
    this.color = fromJSON.color;
  }

  // -------------------------------------
  // adds polyline to this set
  // if argument is not polyline or already
  // in this set then it will not be added
  // -------------------------------------
  addChild(label, params) {
    if (!(label.isGlLabel || label.isGlText)) return;
    params = params instanceof Object ? params : {};

    const labelUuid = label.uuid;
    const found = params.unique ? -1 : this.children.findIndex((item) => item.uuid === labelUuid);
    if (found === -1) {
      if (!params.keepProperties) {
        label.setColor(this.color);
        label.setDepthTest(this.depthTest);
      }

      if (params && params.keepParent) {
        this.addKeepingParent(label);
      } else {
        this.add(label);
      }
    } else {
      console.log('Object already exist');
    }

    return found === -1;
  }

  // -------------------------------------
  // setPointLabelsFont()
  // -------------------------------------
  setFont(childIndex, font, setAll) {
    if (font) {
      if (setAll === true) {
        this.childLabelCount = this.children.length;
        for (let i = 0; this.children.length; i++) {
          this.children[i].setFont(font);
        }
      } else if (this._isValidIndex(childIndex)) {
        this.children[childIndex].setFont(font);
      }
    }
  }

  setLabel(childIndex, label, setAll) {
    if (label && !(label instanceof Object)) {
      const validLabel = label.toString();
      if (validLabel) {
        if (setAll === true) {
          this.childLabelCount = this.children.length;
          for (let i = 0; this.children.length; i++) {
            this.children[i].setLabel(validLabel);
          }
        } else if (this._isValidIndex(childIndex)) {
          this.children[childIndex].setLabel(validLabel);
        }
      }
    }
  }

  showLastHiddenObjects() {
    if (!this.lastHiddenObjects.size) return;
    this.lastHiddenObjects.forEach((value, key)=> {
      value.visible = true;
    });
    this.lastHiddenObjects.clear();
  }

  // -------------------------------------
  // setPointsColor()
  // -------------------------------------
  setColor(childIndex, color, setAll) {
    if (color === undefined || color === null) {
      color = this.color;
    } else {
      this.color = color;
    }
    if (setAll === true) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].setColor(color);
      }
    } else if (this._isValidIndex(childIndex)) {
      this.children[childIndex].setColor(color);
    }
  }

  // -------------------------------------
  // setFontSize()
  // -------------------------------------
  setFontSize(childIndex, fontSize, setAll) {
    if (fontSize === undefined || fontSize === null) {
      fontSize = this.fontSize;
    } else {
      this.color = fontSize;
    }
    if (setAll === true) {
      this.childLabelCount = this.children.length;
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].setFontSize(fontSize);
      }
    } else if (this._isValidIndex(childIndex)) {
      this.children[childIndex].setFontSize(fontSize);
    }
  }

  // getFontSize
  getFontSize() {
    if (!this.children.length) this.fontSize;
    return this.children[0].fontSize;
  }

  // -------------------------------------
  // makes GlPolylineSet's properties
  // default to children.
  // e.g.: if the set's default point color is yellow,
  // then changes all children's point color to yellow
  // -------------------------------------
  setDefaults() {
    this.setColor(null, null, true);
  }

  // -------------------------------------
  // show/hide(with children) set
  // -------------------------------------
  showSet(flag) {
    if (flag === true || flag === false) {
      this.visible = flag;
    }
  }

  _isValidIndex(index) {
    if (Number.isInteger(index) && index >= 0 && index < this.children.length) return true;
    return false;
  }

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox(includeAll) {
    const polySetBB = new Box3();

    for (const object of this.children) {
      const skip = includeAll ? false : !object.visible;
      if (object.getBoundingBox && !skip) {
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
        type: 'GlTextSet',
        generator: 'GlTextSet.toJSON'
      };
    }

    const object = {};

    //   'type' ->   'type'
    //   'n'    ->   'name'
    //   'rO'   ->   'renderOrder'
    //   'v'    ->   'visible'
    //   'l'    ->   'layers'
    //   'm'    ->   'matrix'
    //   'mAU'  ->   'matrixAutoUpdate'
    //   'c'    ->   'color'
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    object.c = this.color;

    if (this.children.length) {
      object.ch = [];
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlText) {
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
      l: Primitive_Type.Int32, // layers.mask
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      c: Primitive_Type.Uint32, // color
      ch: Primitive_Type.Int32 // children
    }
  }

  // -------------------------
  // toArrayBuffer
  // -------------------------
  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);

    writeToDv('type', this.type);
    if (this.name !== '') writeToDv('n', this.name);
    if (this.renderOrder !== 0) writeToDv('rO', this.renderOrder);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);
    writeToDv('m', this.matrix.toArray());
    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);

    writeToDv('c', this.color);

    if (this.children.length) {
      writeToDv('ch', this.children.length);
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlText) {
          this.children[i].toArrayBuffer(myDv);
        }
      }
      writeToDv('chEnd');
    }
    writeToDv('endObj');
  }
}