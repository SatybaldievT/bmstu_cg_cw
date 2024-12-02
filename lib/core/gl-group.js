import { GlBase } from './gl-base';
import { GlUtils } from '../utils/gl-utils';
import { Primitive_Type } from './gl-constants';
import { Vector3, Box3 } from 'three';

/* eslint-disable no-undef */
export class GlGroup extends GlBase {
  constructor(params, fromJSON) {
    params = params || {};
    super();
    this.type = 'GlGroup';
    this.isGroup = true;  // this is needed to use shaders correctly to render this object
    this.isGlGroup = true;
    this.visible = true;
    this.bbox = new Vector3(1, 1, 1);
    this.selectable = true;
    this.rootParentUuid = null;
    this.source = null;
    this.mapChanges = new Map();

    if (fromJSON) {
      if (fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    } else {
      if (params.dataSource) this.dataSource = params.dataSource;
      if (params.name) this.name = params.name;
      if (params.uuid) this.uuid = params.uuid;
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

  }

  // ------------------------------------------------
  // initialize an object from JSON_v4.5
  // ------------------------------------------------
  __initFromJson_v4_5(fromJSON) {

    // uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.name) this.name = fromJSON.name;

    // dataSource
    if (fromJSON.dataSource) this.dataSource = fromJSON.dataSource;
  }

  addChild(child, params) {
    if (child) {
      if (child.isGlGroup) child.rootParentUuid = (this.rootParentUuid) ? this.rootParentUuid : this.uuid;
      params = params || {};
      const childUuid = child.uuid;
      if (this.isGlDxfGroup && this.position.length() === 0) this.position.add(child.position);
      const found = this.children.findIndex((item) => item.uuid === childUuid);

      if (found === -1) {        
        if (!params.keepParent) {
          if (child.setDepthTest) child.setDepthTest(this.depthTest);
        }

        if (params.keepParent === true) {
          this.addKeepingParent(child);
        } else {
          this.add(child);
        }

      } else {
        console.log('Object already exist!');
      }
      
      return found === -1;
    }
  }

  // -------------------------------------------------
  // remove specific element from a set.
  // if argument is an integer then the object
  // with that index among childrens will be returned
  // if argument is a string object or a gl object
  // will be removed by uuid
  // --------------------------------------------------
  removeChild(child) {
    let index = -1;
    if (child === null || child === undefined) return child;

    if (Number.isInteger(child) && child < this.children.length) {
      index = child;
    } else if (typeof child === 'string') {
      index = this.children.findIndex((item) => item.uuid === child);
    } else if (typeof child === 'object') {
      index = this.children.findIndex((item) => item.uuid === child.uuid);
    }

    if (index !== -1) {
      this.remove(this.children[index]);
    }

    return index !== -1;
  }

  remove(object) {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) {
        this.remove(arguments[i]);
      }
      return this;
    }

    const index = this.children.indexOf(object);
    if (index !== - 1) {
      this.children[index].dispose();
      this.children.splice(index, 1);
    }

    return this;
  }

  addKeepingParent(a) {
    if (1 < arguments.length) {

      for (let b = 0; b < arguments.length; b++) {
        this.children.push(arguments[b]);
        a.dispatchEvent({ type: "added" });
      }
      return this;
    }
    if (a === this) {
      console.error("Object3D.add: object can't be added as a child of itself.", a);
      return this;
    }
    if (a && a.isObject3D) {

      this.children.push(a);
      a.dispatchEvent({ type: "added" });
    } else {
      console.error("Object3D.add: object not an instance of Object3D.", a);
    }
    return this;
  }

  // -----------------------
  // dispose all objects in a set
  // -----------------------
  dispose() {
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].parent.uuid === this.uuid) {
        this.children[i].dispose();
      }
    }

    this.children.length = 0;
  }

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox() {
    const glGroupBB = new Box3();

    for (const object of this.children) {
      if (object.getBoundingBox && object.visible) {
        const objectBB = object.getBoundingBox();
        if (objectBB) {
          const min = objectBB.min.clone();
          const max = objectBB.max.clone();
          glGroupBB.expandByPoint(min);
          glGroupBB.expandByPoint(max);
        }
      }
    }
    if (!glGroupBB.isEmpty()) {
      glGroupBB.getSize(this.bbox);
      if (this.bbox.length() < 1) this.bbox.set(1, 1, 1);
    }
    return glGroupBB.isEmpty() ? null : glGroupBB;
  }

  toJSON(meta, keepUuid = false) {
    // meta is a string when called from JSON.stringify
    const isRootObject = (meta === undefined || meta === null || typeof meta === 'string');

    const output = {};
    if (isRootObject) {
      output.metadata = {
        version: 5.0,
        type: 'GlGroup',
        generator: 'GlGroup.toJSON'
      };
    }
    // standard Object3D serialization

    const object = {};
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    if (this.children.length > 0) {
      object.ch = [];
      for (let i = 0; i < this.children.length; i++) {
        // if (this.children[i].isGlGroup) {
        //   object.source.push(this.children[i].toJSON(meta).object);
        //   continue;
        // }

        // object.source.push(this.children[i].source);
        object.ch.push(this.children[i].toJSON(meta, keepUuid).object);
      }
    }

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

  // -------------------------------------
  // methods related to changes
  // -------------------------------------
  childChanged(child) {
    if (this.mapChanges.has(child.uuid)) {
      if (!child.isChanged()) this.mapChanges.delete(child.uuid);
    } else {
      this.mapChanges.set(child.uuid, child);
    }
  }

  isChanged() {
    return this.mapChanges.size > 0;
  }

  changesSaved() {
    this.mapChanges.forEach((value, key) => {
      value.changesSaved();
    })
    this.mapChanges.clear();
  }

  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);
    
    writeToDv('type', this.type);
    if (this.name !== '') writeToDv('n', this.name);
    if (this.renderOrder !== 0) writeToDv('rO', this.renderOrder);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);
    writeToDv('m', this.matrix.toArray());
    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);

    if (this.attributes.size > 0) {
      writeToDv('uA', null);
      this.attributes.toArrayBuffer(myDv);
    }
    
    if (this.children.length) {
      writeToDv('ch', this.children.length);
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].toArrayBuffer) this.children[i].toArrayBuffer(myDv);
      }
      writeToDv('chEnd');
    }
    
    writeToDv('endObj');
  }
}