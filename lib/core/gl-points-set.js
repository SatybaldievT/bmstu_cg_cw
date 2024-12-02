import {GlLayer} from './gl-layer';
import { Primitive_Type } from './gl-constants';
import { GlUtils } from '../utils/gl-utils';
import {
  Vector3,
  Box3,
} from 'three';

export class GlPointsSet extends GlLayer {
  constructor(params, fromJSON) {
    super();
    this.name = '';
    this.type = 'GlPointsSet';
    this.isGlPointsSet = true;
    this.bbox = new Vector3(1, 1, 1);
    this.selectable = true;
    this.visible = true;
    this.pointLabelsVisible = false;
    this.pointsColor = 0x000000;
    this.pointLabelsColor = 0x0000ff;
    this.pointLabel = 'Метки';
    this._pointsCnt = 0;

    if (fromJSON) {
      if(fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    } else if (params) {

      if (params.name) this.name = params.name;
      if (params.uuid) this.uuid = params.uuid;
      if (params.pointsColor) this.pointsColor = params.pointsColor;
      if (params.pointLabelsColor) this.pointLabelsColor = params.pointLabelsColor;
      if (params.dataSource) this.dataSource = params.dataSource;
    }
  }

  // ------------------------------------------------
  // initialize an object from JSON
  // ------------------------------------------------
  __initFromJson(fromJSON) {

    //   'type' ->   'type'
    //   'n'    ->   'name'
    //   'rO'   ->   'renderOrder'
    //   'l'    ->   'layers'
    //   'm'    ->   'matrix'
    //   'mAU'  ->   'matrixAutoUpdate'
    //   'pLF'  ->   'pointLabelField'
    //   'pCr'   ->   'pointsColor'
    //   'pLC'  ->   'pointLabelsColor'
    //   'pLV'  ->   'pointLabelsVisible'
    //   'pLC'  ->   'pointLabelsColor'
    //   'pO'   ->   'pivotOffset'
    //   'ch'    ->   'children'
    //   'uA'   ->   'attributes'

    //uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.n) this.name = fromJSON.n;

    // dataSource
    if (fromJSON.dS) this.dataSource = fromJSON.dS;

    //set the last pointLabel
    this.pointLabel = fromJSON.pLF;

    // set's visibility
    if (!fromJSON.v) this.visible = false;

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;

    // point's
    this.pointsColor = fromJSON.pCr;

    // point's labels
    this.pointLabelsColor = fromJSON.pLC;
    // if (fromJSON.pLV) this.pointLabelsVisible = true;

    // user attributes
    if (fromJSON.uA && this.attributes) this.attributes.fromJSON(fromJSON.uA);

  }

  // ------------------------------------------------
  // initialize an object from JSON_v1
  // ------------------------------------------------
  __initFromJson_v4_5(fromJSON) {
    // uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.name) this.name = fromJSON.name;

    if (fromJSON.dataSource) this.dataSource = fromJSON.dataSource;

    //set the last pointLabel
    this.pointLabel = fromJSON.pointLabel;

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

    // point's
    this.pointsColor = fromJSON.pointsColor;
    if (fromJSON.pointsVisible) this.pointsVisible = true;

    // point's labels
    this.pointLabelsColor = fromJSON.pointLabelsColor;
    if (fromJSON.pointLabelsVisible) this.pointLabelsVisible = true;
    // user attributes
    if (fromJSON.userAttributes && this.attributes) {
      this.attributes.fromJSON_v4_5(fromJSON.userAttributes);
    }
  }

  // -------------------------------------
  // adds a point cloud to this set
  // -------------------------------------
  addChild(glPoint, params) {
    if (!glPoint.isGlPoints) return;
    params = params || {};

    const pointUuid = glPoint.uuid;
    const found = params.unique ? -1 : this.children.findIndex((item) => item.uuid === pointUuid);
    if (found === -1) {
      if (!params.keepProperties) {
        glPoint.setPointLabelsColor(this.pointLabelsColor);
        glPoint.setPointsColor(this.pointsColor);
        glPoint.showPointLabels(this.pointLabelsVisible);
        glPoint.setDepthTest(this.depthTest);
      }

      if (params && params.keepParent) {
        this.addKeepingParent(glPoint);
      } else {
        this.add(glPoint);
      }
    } else {
      console.log('Object already exist!');
    }

    return found === -1;
  }

  // -------------------------------------
  // setPointLabelsFont()
  // -------------------------------------
  setPointLabelsFont(font) {
    if (!font) return;

    for (let i = 0; i < this.children.length; i++) {
      this.children[i].setPointLabelsFont(font);
    }
  }

  // -------------------------------------
  // setPointLabelColor()
  // -------------------------------------
  setPointLabelsColor(color) {
    if (color === undefined || color === null) {
      color = this.pointLabelsColor;
    } else {
      this.pointLabelsColor = color;
    }

    for (let i = 0; i < this.children.length; i++) {
      this.children[i].setPointLabelsColor(color);
    }
  }

  // -------------------------------------
  // setPointsColor()
  // -------------------------------------
  setPointsColor(color) {
    if (color === undefined || color === null) {
      color = this.pointsColor;
    } else {
      this.pointsColor = color;
    }

    for (let i = 0; i < this.children.length; i++) {
      this.children[i].setPointsColor(color);
    }
  }

  // -------------------------------------
  // setPointsTexture()
  // -------------------------------------
  setPointsTexture(texture) {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].setPointsTexture(texture);
    }
  }

  // -------------------------------------
  // setPointsSize()
  // -------------------------------------
  setPointsSize(size) {
    if (!Number.isInteger(size)) return;

    for (let i = 0; i < this.children.length; i++) {
      this.children[i].setPointSize(size);
    }
  }

  // ---------------------------------------------------
  // makes GlPointsSet's properties
  // default to children.
  // e.g.: if the set's default point color is yellow,
  // then changes all children's point color to yellow
  // ---------------------------------------------------
  setDefaults() {
    this.setPointLabelsColor();
    this.setPointsColor();
    this.showPointLabels();
  }

  // -------------------------------------
  // show/hide(with children) set
  // -------------------------------------
  showSet(flag) {
    if (flag === true || flag === false) {
      this.visible = flag;
    }
  }

  // ---------------------------------------
  // amount of added pntsCount of childrens
  // ---------------------------------------
  getPointsCount() {
    
    this._pointsCnt = 0;
    for (let i = 0; i < this.children.length; i++) {
      this._pointsCnt += this.children[i].getPointsCount();
    }

    return this._pointsCnt;
  }

  showSetNormals(flag, length) {
    const children = this.children;
    for (let i = 0; i < children.length; i++) {
      this.children[i].showNormals(flag, length);
    }
  }

  // -----------------------
  // showPointLabels
  // -----------------------
  showPointLabels(flag, lblField) {
    if (flag === undefined || flag === null) {
      flag = this.pointLabelsVisible;
      lblField = this.pointLabel;
    } else {
      this.pointLabelsVisible = flag;
      this.pointLabel = lblField;
    }

    // each children will request update
    // with childLabelCount object updated within last children
    if (flag) this.childLabelCount = this.children.length;
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].showPointLabels(flag, lblField);
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
        type: 'GlPointsSet',
        generator: 'GlPointsSet.toJSON'
      };
    }

    //   'type' ->   'type'
    //   'n'    ->   'name'
    //   'rO'   ->   'renderOrder'
    //   'l'    ->   'layers'
    //   'm'    ->   'matrix'
    //   'mAU'  ->   'matrixAutoUpdate'
    //   'pLF'  ->   'pointLabelField'
    //   'pCr'   ->   'pointsColor'
    //   'pLC'  ->   'pointLabelsColor'
    //   'pLV'  ->   'pointLabelsVisible'
    //   'pV'   ->   'pointsVisible'
    //   'pLC'  ->   'pointLabelsColor'
    //   'pO'   ->   'pivotOffset'
    //   'ch'    ->   'children'
    //   'uA'   ->   'attributes'

    const object = {};
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    object.pLF = this.pointLabel;
    object.pCr = this.pointsColor;

    object.pLC = this.pointLabelsColor;
    // if (this.pointLabelsVisible) object.pLV = true;
    
    if (this.children.length) {
      object.ch = [];
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlPoints  && this.children[i].getPointsCount() > 0) {
          object.ch.push(this.children[i].toJSON(meta, keepUuid).object);
        }
      }
    }

    if (this.attributes.size > 0) object.uA = this.attributes.toJSON();

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
      pLF: Primitive_Type.String, // pointLabelField
      pCr: Primitive_Type.Uint32, // pointsColor
      uA: Primitive_Type.Object, // attributes
      ch: Primitive_Type.Int32, // children
    }
  }

  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);
    
    writeToDv('type', this.type)
    if (this.name !== '') writeToDv('n', this.name);
    if (this.renderOrder !== 0) writeToDv('rO', this.renderOrder);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);

    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);
    writeToDv('m', this.matrix.toArray());

    writeToDv('pLF', this.pointLabel);
    writeToDv('pCr', this.pointsColor);
    
    if (this.attributes.size > 0) {
      writeToDv('uA', null);
      this.attributes.toArrayBuffer(myDv);
    }

    if (this.children.length) {
      writeToDv('ch', this.children.length);
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlPoints  && this.children[i].getPointsCount() > 0) {
          this.children[i].toArrayBuffer(myDv);
        }
      }
      writeToDv('chEnd');
    }
    writeToDv('endObj');
  }
}