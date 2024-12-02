import { GlUtils } from "../utils/gl-utils";
import { Primitive_Type } from "./gl-constants";
import { GlLayer } from "./gl-layer";
import {
  Vector3,
  Box3,
} from 'three';

export class GlImageSet extends GlLayer {
  constructor(params, fromJSON) {
    super();

    this.name = '';
    this.type = 'GlImageSet';
    this.isGlImageSet = true;

    this.bbox = new Vector3(1, 1, 1);

    if (fromJSON) {
      this.__initFromJson(fromJSON);
    } else if (params) {
      if (params.dataSource) this.dataSource = params.dataSource;
      if (params.name) this.name = params.name;
      if (params.uuid) this.uuid = params.uuid;
    }
  }

  
  // ------------------------------------------------
  // initialize an object from JSON
  // ------------------------------------------------
  __initFromJson(fromJSON) {
    // name
    if (fromJSON.n) this.name = fromJSON.n;

    // dataSource
    if (fromJSON.dS) this.dataSource = fromJSON.dS;

    // set's visibility
    if (!fromJSON.v) this.visible = false;

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

  }

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox() {
    const imageSetBB = new Box3();

    for (const object of this.children) {
      if (object.getBoundingBox) {
        const objectBB = object.getBoundingBox();
        if (objectBB) {
          const min = objectBB.min.clone();
          const max = objectBB.max.clone();
          imageSetBB.expandByPoint(min);
          imageSetBB.expandByPoint(max);
        }
      }
    }
    if (!imageSetBB.isEmpty()) {
      imageSetBB.getSize(this.bbox);
      if (this.bbox.length() < 1) this.bbox.set(1, 1, 1);
    }
    return imageSetBB.isEmpty() ? null : imageSetBB;
  }

  toJSON(meta, keepUuid = false){
    const output = {};

    // meta is a string when called from JSON.stringify
    const isRootObject = (meta === undefined || typeof meta === 'string');
    if (isRootObject) {
      output.metadata = {
        version: 5.0,
        type: 'GlImageSet',
        generator: 'GlImageSet.toJSON'
      };
    }

    const object = {};
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    if (this.children.length) {
      object.ch = [];
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlImage) {
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
      v: Primitive_Type.Uint8, // visible
      l: Primitive_Type.Int32, // layers
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      ch: Primitive_Type.Int32 // children
    }
  }

  // ------------------------
  // toArrayBuffer
  // ------------------------
  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);

    writeToDv('type', this.type);
    if (this.name !== '') writeToDv('n', this.name);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);
    writeToDv('m', this.matrix.toArray());
    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);

    if (this.children.length) {
      writeToDv('ch', this.children.length)
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlImage) {
          this.children[i].toArrayBuffer(myDv);
        }
      }
      writeToDv('chEnd');
    }

    writeToDv('endObj');
  }
}