/* eslint-disable no-undef */

import { GlUtils } from "../utils/gl-utils";
import { Primitive_Type } from "./gl-constants";
import { GlLoader } from "../loaders/gl-loader";
import {
  Object3D,
  BufferGeometry,
} from 'three';

export class GlJsonGroup extends Object3D {
  constructor(config, fromJSON) {
    super();
    config = config || {};
    this.type = 'GlJsonGroup';
    this.isGlJsonGroup = true;
    this.polySet = 0;
    this.pCloudSet = 0;
    this.drillholeSet = 0;
    this.rcholeSet = 0;
    this.channelSet = 0;
    this.triSet = 0;
    this.blastholeSet = 0;

    this.__metadata = {
      version: 5.5,
      type: 'GlJsonGroup',
      generator: 'GlJsonGroup.toJSON'
    };

    if (fromJSON) {
      if(fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON); 
      };
    } else {
      if (config.dataSource) this.dataSource = config.dataSource;
      if (config.name) this.name = config.name;
      if (config.uuid) this.uuid = config.uuid;
    }
  }

  get metadata() {
    for (let i = 0; i < this.children.length; i++) {
      this.__metadata = {...this.__metadata, ...this.children[i].metadata};
    }
    return this.__metadata;
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
  }

  // -----------------------------------
  // add an object / objects as a child
  // without changing object's parent
  // ----------------------------------
  addChild(object) {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) {
        this.add(arguments[i]);
      }
      return this;
    }

    if (object === this) {
      console.error("GlJsonGroup.add: object can't be added as a child of itself.", object);
      return this;
    }

    if ((object && object.isObject3D)) {
      this.children.push(object);

      if (object.isGlPolylineSet) {
        this.polySet++;
      }

      if (object.isGlPointsSet) {
        this.pCloudSet++;
      }

      if (object.isChannelSet) {
        this.channelSet++;
      }

      if (object.isDrillholeSet) {
        this.drillholeSet++;
      }

      if (object.isRCHoleSet) {
        this.rcholeSet++;
      }

      if (object.isBlastHoleSet) {
        this.blastholeSet++;
      }

      if (object.isGlMeshSet) {
        this.triSet++;
      }
    } else {
      console.error("Object3D.add: object not an instance of Object3D.", object);
    }
    return this;
  }

  add(object) {

    if ( arguments.length > 1 ) {
      for ( let i = 0; i < arguments.length; i ++ ) {
        this.add( arguments[i] );
      }

      return this;
    }

    if ( object === this ) {
      console.error( "Object3D.add: object can't be added as a child of itself.", object );
      return this;
    }

    if (object && object.isObject3D) {
      this.children.push( object );
    } else {
      console.error( "Object3D.add: object not an instance of Object3D.", object );
    }
    return this;
  }

  // -----------------------
  // dispose all objects in a set
  // -----------------------
  dispose() {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].dispose();
    }
    this.children.length = 0;
  }

  // ----------------------------------------
  // remove an object / objects as a child
  // without changing object's parent
  // ----------------------------------------
  removeChild(object) {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) {
        this.remove(arguments[i]);
      }
      return this;
    }

    const index = this.children.indexOf(object);
    if (index !== - 1) {
      this.children.splice(index, 1);
    }
    return this;
  }

  toJSON(meta, keepUuid = false) {

    // meta is a string when called from JSON.stringify
    const isRootObject = ( meta === undefined || typeof meta === 'string' );

    const output = {};
    if ( isRootObject ) {
      output.metadata = {
        version: 5,
        type: 'Object',
        generator: 'Object3D.toJSON'
      };

    }

    // standard Object3D serialization
    // 'cS' -> 'castShadow'
    // 'rS' -> 'receivedShadow'
    // 'fC' -> 'frustumCulled'
    // 'pS' -> 'PolySet'
    // 'pCS' -> 'pCloudSet'
    // 'dS' -> 'drillholeSet'
    // 'rcS' -> 'rcHoleSet'
    // 'bhS' -> 'blastholeSet'
    // 'chS' -> 'channelSet'
    // 'tS' 

    const object = {};
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;

    if (this.name !== '') object.n = this.name;
    if (this.castShadow === true) object.cS = true;
    if (this.receiveShadow === true) object.rS = true;
    if (this.visible === false) object.v = false;
    if (this.frustumCulled === false) object.fC = false;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    if ( this.matrixAutoUpdate === false ) object.mAU = false;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if ( JSON.stringify( this.userData ) !== '{}' ) object.uD = this.userData;

    if(this.polySet > 0) object.pS = this.polySet;
    if(this.pCloudSet > 0) object.pCS = this.pCloudSet;
    if(this.drillholeSet > 0) object.dS = this.drillholeSet;
    if(this.rcholeSet > 0) object.rcS = this.rcholeSet;
    if(this.blastholeSet > 0) object.bhS = this.blastholeSet;
    if(this.channelSet > 0) object.chS = this.channelSet;
    if(this.triSet > 0) object.tS = this.triSet;

    // object specific properties

    if (this.isInstancedMesh) {
      object.type = 'InstancedMesh';
      object.count = this.count;
      object.instanceMatrix = this.instanceMatrix.toJSON();
    }

    if ( this.children.length > 0 ) {
      object.ch = [];

      for ( let i = 0; i < this.children.length; i ++ ) {
        object.ch.push(this.children[i].toJSON(meta, keepUuid).object );
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
      cS: Primitive_Type.Uint8, // castShadow
      rS: Primitive_Type.Uint8, // receiveShadow
      v: Primitive_Type.Uint8, // visible
      frustumCulled: Primitive_Type.Uint8, // frustumCulled
      uD: Primitive_Type.ObjectString, // userData
      pS: Primitive_Type.Uint32,
      pCS: Primitive_Type.Uint32,
      dS: Primitive_Type.Uint32,
      rcS: Primitive_Type.Uint32,
      chS: Primitive_Type.Uint32,
      tS: Primitive_Type.Uint32,
      count: Primitive_Type.Uint32,
      instanceMatrix: Primitive_Type.Float64Array,
      ch: Primitive_Type.Int32 // children
    }
  }

  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);
    
    writeToDv("metadata", this.metadata, Primitive_Type.ObjectString);

    writeToDv('type', this.isInstancedMesh ? 'InstancedMesh' : this.type);
    if (this.name !== '') writeToDv('n', this.name);
    if (this.castShadow === true) writeToDv('cS', true);
    if (this.receiveShadow === true) writeToDv('rS', true);
    if (this.visible === false) writeToDv('v', false);
    if (this.frustumCulled === false) writeToDv('frustumCulled', false);
    if (this.renderOrder !== 0) writeToDv('rO', this.renderOrder);
    if ( this.matrixAutoUpdate === false ) writeToDv('mAU', false);
    writeToDv('l', this.layers.mask);
    writeToDv('m', this.matrix.toArray());
    if ( !GlUtils.isEmpty(this.userData) ) writeToDv('uD', this.userData);

    if(this.polySet > 0) writeToDv('pS', this.polySet);
    if(this.pCloudSet > 0) writeToDv('pCS', this.pCloudSet);
    if(this.drillholeSet > 0) writeToDv('dS', this.drillholeSet);
    if(this.rcholeSet > 0) writeToDv('rcS', this.rcholeSet);
    if(this.blastholeSet > 0) writeToDv('bhS', this.blastholeSet);
    if(this.channelSet > 0) writeToDv('chS', this.channelSet);
    if(this.triSet > 0) writeToDv('tS', this.triSet);

    // object specific properties
    if (this.isInstancedMesh) {
      writeToDv('count', this.count);
      writeToDv('instanceMatrix', this.instanceMatrix);
    }

    if (this.children.length) {
      writeToDv('ch', this.children.length);
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].toArrayBuffer(myDv);
      }
    }
    writeToDv('endObj');
  }

  // ------------------------
  // fromArrayBuffer
  // ------------------------
  // *fromArrayBuffer(myDv) {
  //   const read = GlUtils.createReader(myDv);
  //   const glLoader = new GlLoader();
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
  //       case 'ch':
  //         for (let i = 0; i < value; i++) {
  //           const res = yield* read(false);
  //           const glObject = glLoader.getGlObject(res.value);
  //           yield* glObject.fromArrayBuffer(myDv);
  //           scope.addChild(glObject);
  //         }

  //         if (value !== scope.children.length) {
  //           console.log("ch amount is wrong");
  //         }
  //         break;
  //       default:
  //         json[prop] = value;
  //     }
  //   }
    
  //   do {
  //     res = yield* read();
  //     yield* setProperty(res.prop, res.value);
  //   } while(res.prop !== 'endObj');
  //   this.__initFromJson(json);
  // }
}