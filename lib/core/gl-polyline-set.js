import {GlLayer} from './gl-layer';
import {Primitive_Type} from './gl-constants';
import {GlUtils} from '../utils/gl-utils';
import {
  Vector3,
  Box3,
} from 'three';

export class GlPolylineSet extends GlLayer {
  constructor(params, fromJSON) {
    super();

    this.name = '';
    this.type = 'GlPolylineSet';
    this.isGlPolylineSet = true;

    this.bbox = new Vector3(1, 1, 1);

    this.selectable = true;
    this.visible = true;
    this.pointsVisible = false;
    this.lineLabelsVisible = false;
    this.pointLabelsVisible = false;
    this.pointsColor = 0x000000;
    this.pointLabelsColor = 0x0000ff;
    this.linesColor = 0x000000;
    this.lineLabelsColor = 0x000000;

    if (fromJSON) {
      if(fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    } else if (params) {
      if (params.dataSource) this.dataSource = params.dataSource;
      if (params.name) this.name = params.name;
      if (params.uuid) this.uuid = params.uuid;
      if (params.pointsColor) this.pointsColor = params.pointsColor;
      if (params.pointLabelsColor) this.pointLabelsColor = params.pointLabelsColor;
      if (params.linesColor) this.linesColor = params.linesColor;
      if (params.lineLabelsColor) this.lineLabelsColor = params.lineLabelsColor;
    }
  }

  // ------------------------------------------------
  // initialize an object from JSON
  // ------------------------------------------------
  __initFromJson(fromJSON) {
    //uuid
    if(fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.n) this.name = fromJSON.n;

    //   'type' ->   'type'
    //   'n'    ->   'name'
    //   'dS'   ->   'dataSource'
    //   'rO'   ->   'renderOrder'
    //   'v'    ->   'visible'
    //   'l'    ->   'layers'
    //   'm'    ->   'matrix'
    //   'mAU'  ->   'matrixAutoUpdate'
    //   'pLC'  ->   'pointLabelsColor'
    //   'pLV'  ->   'pointLabelsVisible'
    //   'pCr'   ->  'pointsColor'
    //   'pV'   ->   'pointsVisible'
    //   'lLC'  ->   'lineLabelsColor'
    //   'lLV'  ->   'lineLabelsVisible'
    //   'lC'   ->   'linesColor'
    //   'pvO'  ->   'pivotOffset'
    //   'uA'   ->   'attributes'

    // dataSource
    if (fromJSON.dS) this.dataSource = fromJSON.dS;

    // set's visibility
    if (!fromJSON.v) this.visible = false;

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;

    // point's
    this.pointsColor = fromJSON.pCr;
    // if (fromJSON.pV) this.pointsVisible = true;

    // point's labels
    this.pointLabelsColor = fromJSON.pLC;
    // if (fromJSON.pLV) this.pointLabelsVisible = true;

    // line's params
    this.linesColor = fromJSON.lC;

    // line's label
    this.lineLabelsColor = fromJSON.lLC;
    // if (fromJSON.lLV) this.lineLabelsVisible = true;

    if (fromJSON.pvO) {
      this.__v3.fromArray(fromJSON.pvO);
      this.setPivotPoint(this.position.clone().add(this.__v3));
    }
  }

  // ------------------------------------------------
  // initialize an object from JSON
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

    // point's
    this.pointsColor = fromJSON.pointsColor;
    if (fromJSON.pointsVisible) this.pointsVisible = true;

    // point's labels
    this.pointLabelsColor = fromJSON.pointLabelsColor;
    if (fromJSON.pointLabelsVisible) this.pointLabelsVisible = true;

    // line's params
    this.linesColor = fromJSON.linesColor;

    // line's label
    this.lineLabelsColor = fromJSON.lineLabelsColor;
    if (fromJSON.lineLabelsVisible) this.lineLabelsVisible = true;

    // user attributes
    if (fromJSON.userAttributes && this.attributes) {
      this.attributes.fromJSON_v4_5(fromJSON.userAttributes);
    }
  }

  // -------------------------------------
  // adds polyline to this set
  // if argument is not polyline or already
  // in this set then it will not be added
  // -------------------------------------
  addChild(poly, params) {
    if (!poly.isGlPolyline) return;
    params = params || {};

    const polyUuid = poly.uuid;
    const found = params.unique ? -1 : this.children.findIndex((item) => item.uuid === polyUuid);
    if (found === -1) {
      if (!params.keepProperties) {
        poly.setPointsColor(this.pointsColor);
        poly.setPointLabelsColor(this.pointLabelsColor);
        // poly.setLineColor(this.linesColor);
        poly.setLineLabelsColor(this.lineLabelsColor);

        poly.showLineLabels(this.lineLabelsVisible);
        poly.showPoints(this.pointsVisible);
        poly.showPointLabels(this.pointLabelsVisible);
        poly.setDepthTest(this.depthTest);
      }

      if (params && params.keepParent) {
        this.addKeepingParent(poly);
      } else {
        this.add(poly);
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
  // setPointLabelsFont()
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
  // setLineColor()
  // -------------------------------------
  setLineColor(color) {
    if (color === undefined || color === null) {
      color = this.linesColor;
    } else {
      this.linesColor = color;
    }

    for (let i = 0; i < this.children.length; i++) {
      this.children[i].setLineColor(color);
    }
  }

  // -------------------------------------
  // setLineLabelsFont()
  // -------------------------------------
  setLineLabelsFont(font) {
    if (!font) return;

    for (let i = 0; i < this.children.length; i++) {
      this.children[i].setLineLabelsFont(font);
    }
  }

  // -------------------------------------
  // makes GlPolylineSet's properties
  // default to children.
  // e.g.: if the set's default point color is yellow,
  // then changes all children's point color to yellow
  // -------------------------------------
  setDefaults() {
    this.setPointLabelsColor();
    this.setPointsColor();
    this.setLineColor();
    this.showPoints();
    this.showPointLabels();
    this.showLineLabels();
  }

  // -------------------------------------
  // show/hide(with children) set
  // -------------------------------------
  showSet(flag) {
    if (flag === true || flag === false) {
      this.visible = flag;
    }
  }

  // -----------------------
  // showPoints
  // -----------------------
  showPoints(flag) {
    if (flag === undefined || flag === null) {
      flag = this.pointsVisible;
    } else {
      this.pointsVisible = flag;
    }

    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].isSelected) {
        if (flag) {
          this.children[i].setPointObjectsBeforeSel(true);
        } else {
          this.children[i].setPointObjectsBeforeSel(false);
          this.children[i].showPoints(true);
          continue;
        }
      }
      this.children[i].showPoints(flag);
    }
  }

  // -----------------------
  // showPointLabels
  // -----------------------
  showPointLabels(flag) {
    if (flag === undefined || flag === null) {
      flag = this.pointLabelsVisible;
    } else {
      this.pointLabelsVisible = flag;
    }

    // each children will request update
    // with childLabelCount object updated within last children
    if (flag) this.childLabelCount = this.children.length;
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].__pointLabelsExist && flag) this.childLabelCount--;
      this.children[i].showPointLabels(flag);
    }
  }

  // -----------------------
  // showLineLabels
  // -----------------------
  showLineLabels(flag) {
    if (flag === undefined || flag === null) {
      flag = this.lineLabelsVisible;
    } else {
      this.lineLabelsVisible = flag;
    }

    // each children will request update
    // with childLabelCount object updated within last children
    if (flag) this.childLabelCount = this.children.length;
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].__lineLabelsExist && flag) this.childLabelCount--;
      this.children[i].showLineLabels(flag);
    }
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
        type: 'GlPolylineSet',
        generator: 'GlPolylineSet.toJSON'
      };
    }

    //   'type' ->   'type'
    //   'n'    ->   'name'
    //   'rO'   ->   'renderOrder'
    //   'v'    ->   'visible'
    //   'l'    ->   'layers'
    //   'm'    ->   'matrix'
    //   'mAU'  ->   'matrixAutoUpdate'
    //   'pLC'  ->   'pointLabelsColor'
    //   'pLV'  ->   'pointLabelsVisible'
    //   'pCr'   ->  'pointsColor'
    //   'pV'   ->   'pointsVisible'
    //   'lLC'  ->   'lineLabelsColor'
    //   'lLV'  ->   'lineLabelsVisible'
    //   'lC'   ->   'linesColor'
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

    object.pLC = this.pointLabelsColor;
    // if (this.pointLabelsVisible) object.pLV = true;

    object.pCr = this.pointsColor;
    if (this.pointsVisible) object.pV = true;
  
    object.lLC = this.lineLabelsColor;
    // if (this.lineLabelsVisible) object.lLV = true;
    
    object.lC = this.linesColor;
    if (this.pivotOffset.lengthSq() > 1e-3) object.pvO = this.pivotOffset.toArray();

    if (this.children.length) {
      object.ch = [];
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlPolyline && this.children[i].getPointsCount() > 0) {
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
      dS: Primitive_Type.String, // dataSource
      rO: Primitive_Type.Uint8, // renderOrder
      v: Primitive_Type.Uint8, // visible
      l: Primitive_Type.Int32, // layers
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      pLC: Primitive_Type.Uint32, // pointLabelsColor
      pCr: Primitive_Type.Uint32, // pointsColor
      pV: Primitive_Type.Uint8, // pointsVisible
      lC: Primitive_Type.Uint32, // linesColor
      lLC: Primitive_Type.Uint32, // lineLabelsColor
      pvO: Primitive_Type.Float32Array, // pivotOffset
      uA: Primitive_Type.Object, // attributes
      ch: Primitive_Type.Int32, // children
    }
  }

  // ------------------------
  // toArrayBuffer
  // ------------------------
  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);

    writeToDv("type", this.type);
    if (this.name !== '') writeToDv("n", this.name);
    if (this.renderOrder !== 0) writeToDv("rO", this.renderOrder);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);
    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);
    writeToDv('m', this.matrix.toArray());

    writeToDv('pLC', this.pointLabelsColor);
    writeToDv('pCr', this.pointsColor);

    if (this.pointsVisible)  writeToDv('pV', this.pointsVisible);
  
    writeToDv('lLC', this.lineLabelsColor);
    
    writeToDv('lC', this.linesColor);
    if (this.pivotOffset.lengthSq() > 1e-3) writeToDv('pvO', this.pivotOffset.toArray());
    if (this.attributes.size > 0) {
      writeToDv('uA', null);
      this.attributes.toArrayBuffer(myDv);
    }

    if (this.children.length) {
      writeToDv('ch', this.children.length);
      
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlPolyline && this.children[i].getPointsCount() > 0) {
          this.children[i].toArrayBuffer(myDv);
        }
      }

      writeToDv('chEnd');
    }

    writeToDv('endObj');
  }
}