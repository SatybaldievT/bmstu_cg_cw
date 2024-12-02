import {GlLayer} from './gl-layer';
import { GlUtils } from '../utils/gl-utils';
import { Primitive_Type } from './gl-constants';
import {
  Vector3,
  Box3,
} from 'three';

export class GlSegmentsSet extends GlLayer {
  constructor(params, fromJSON) {
    super();

    this.name = '';
    this.type = 'GlSegmentsSet';
    this.isGlSegmentsSet = true;

    this.bbox = new Vector3(1, 1, 1);

    this.selectable = true;
    this.visible = true;
    this.pointsVisible = false;
    this.segmentLabelsVisible = false;
    this.pointsColor = 0x000000;
    this.linesColor = 0x000000;
    this.segmentLabelsColor = 0x0000FF;

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
      if (params.linesColor) this.linesColor = params.linesColor;
      if (params.segmentLabelsColor) this.segmentLabelsColor = params.segmentLabelsColor;
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

    // line's params
    this.linesColor = fromJSON.lC;

    // line's label
    this.segmentLabelsColor = fromJSON.sLC;
    // if (fromJSON.sLV) this.segmentLabelsVisible = true;

    // user attributes
    if (fromJSON.uA && this.attributes) this.attributes.fromJSON(fromJSON.uA);

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

    // line's params
    this.linesColor = fromJSON.linesColor;

    // segments' label
    this.segmentLabelsColor = fromJSON.segmentLabelsColor;
    if (fromJSON.segmentLabelsVisible) this.segmentLabelsVisible = true;

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
  addChild(segment, params) {
    if (!segment.isGlSegments) return;
    params = params || {};

    const segUuid = segment.uuid;
    const found = params.unique ? -1 : this.children.findIndex((item) => item.uuid === segUuid);
    if (found === -1) {
      if (!params.keepProperties) {
        segment.setPointsColor(this.pointsColor);
        // segment.setLineColor(this.linesColor);
        segment.setSegmentLabelsColor(this.segmentLabelsColor);

        segment.showSegmentLabels(this.segmentLabelsVisible);
        segment.showPoints(this.pointsVisible);
        segment.setDepthTest(this.depthTest);
      }

      if (params && params.keepParent) {
        this.addKeepingParent(segment);
      } else {
        this.add(segment);
      }
    } else {
      console.log('Object already exist!');
    }

    return found === -1;
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
  setSegmentLabelsFont(font) {
    if (!font) return;

    for (let i = 0; i < this.children.length; i++) {
      this.children[i].setSegmentLabelsFont(font);
    }
  }

  // -------------------------------------
  // makes GlSegmentsSet's properties
  // default to children.
  // e.g.: if the set's default point color is yellow,
  // then changes all children's point color to yellow
  // -------------------------------------
  setDefaults() {
    this.setPointsColor();
    this.setLineColor();
    this.showPoints();
    this.showPointLabels();
    this.showSegmentLabels();
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
  // showLineLabels
  // -----------------------
  showSegmentLabels(flag) {
    if (flag === undefined || flag === null) {
      flag = this.segmentLabelsVisible;
    } else {
      this.segmentLabelsVisible = flag;
    }

    // each children will request update
    // with childLabelCount object updated within last children
    if (flag) this.childLabelCount = this.children.length;
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].__segmentLabelsExist && flag) this.childLabelCount--;
      this.children[i].showSegmentLabels(flag);
    }
  }

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox(includeAll) {
    const segmentSetBB = new Box3();

    for (const object of this.children) {
      const skip = includeAll ? false : !object.visible;
      if (object.getBoundingBox && !skip) {
        const objectBB = object.getBoundingBox();
        if (objectBB) {
          const min = objectBB.min.clone();
          const max = objectBB.max.clone();
          segmentSetBB.expandByPoint(min);
          segmentSetBB.expandByPoint(max);
        }
      }
    }
    if (!segmentSetBB.isEmpty()) {
      segmentSetBB.getSize(this.bbox);
      if (this.bbox.length() < 1) this.bbox.set(1, 1, 1);
    }
    return segmentSetBB.isEmpty() ? null : segmentSetBB;
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
        type: 'GlSegmentsSet',
        generator: 'GlSegmentsSet.toJSON'
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

    object.pCr = this.pointsColor;
    if (this.pointsVisible) object.pV = true;
  
    object.sLC = this.segmentLabelsColor;
    // if (this.segmentLabelsVisible) object.sLV = true;
    
    object.lC = this.linesColor;
    if (this.pivotOffset.lengthSq() > 1e-3) object.pvO = this.pivotOffset.toArray();

    if (this.children.length) {
      object.ch = [];
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlSegments && this.children[i].getPointsCount() > 0) {
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
      pCr: Primitive_Type.Uint32, // pointsColor
      pV: Primitive_Type.Uint8, // pointsVisible
      lC: Primitive_Type.Uint32, // linesColor
      sLC: Primitive_Type.Uint32, // lineLabelsColor
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

    writeToDv('type', this.type);
    if (this.name !== '') writeToDv('n', this.name);
    if (this.renderOrder !== 0) writeToDv('rO', this.renderOrder);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);
    writeToDv('m', this.matrix.toArray());
    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);

    writeToDv('pCr', this.pointsColor);
    if (this.pointsVisible) writeToDv('pV', true);
  
    writeToDv('sLC', this.segmentLabelsColor);
    // if (this.segmentLabelsVisible) writeToDv('sLV', true);
    
    writeToDv('lC', this.linesColor);
    if (this.pivotOffset.lengthSq() > 1e-3) writeToDv('pvO', this.pivotOffset.toArray());

    if (this.attributes.size > 0) {
      writeToDv('uA', null);
      this.attributes.toArrayBuffer(myDv);
    }

    if (this.children.length) {
      writeToDv('ch', this.children.length);
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlSegments && this.children[i].getPointsCount() > 0) {
          this.children[i].toArrayBuffer(myDv);
        }
      }
      writeToDv('chEnd');
    }
    writeToDv('endObj');
  }
}