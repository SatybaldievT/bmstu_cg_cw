import {GlAxis} from './gl-constants';
import {GlGroup} from './gl-group';
import { GlUtils } from '../utils/gl-utils';
import { Primitive_Type } from './gl-constants';

/* eslint-disable no-undef */
export class GlDxfGroup extends GlGroup {
  constructor(params, fromJSON) {
    params = params || {};
    super(params);
    this.type = 'GlDxfGroup';
    this.isGlDxfGroup = true;
    this.objectUuid = null;
    this.axis = null;
    this.axisValue = null;
    this.oldValues = [];

    if (fromJSON) {
      if(fromJSON.version !== 4.5) {
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

  projectToAxis(glObj, glAxis, value) {
    const pointsCount = glObj.getPointsCount();
    if (pointsCount < 2 || isNaN(value)) {
      console.log('Invalid value or pointsCount not enough to operate with');
      return;
    }

    const points = glObj.getPoints(0, pointsCount - 1);
    this.oldValues.length = 0;

    if (glAxis === GlAxis.X) {
      for (let i = 0; i < pointsCount; i++) {
        this.oldValues.push(points[i]);
        points[i].x = value;
      }
      this.axis = GlAxis.X;
    } else if (glAxis === GlAxis.Y) {
      for (let i = 0; i < pointsCount; i++) {
        this.oldValues.push(points[i]);
        points[i].y = value;
      }
      this.axis = GlAxis.Y;
    } else if (glAxis === GlAxis.Z) {
      for (let i = 0; i < pointsCount; i++) {
        this.oldValues.push(points[i]);
        points[i].z = value;
      }
      this.axis = GlAxis.Z;
    }
    glObj.setPoints(0, points);
    this.axisValue = value;
    this.objectUuid = glObj.uuid;
  }

  restore(glObj) {
    if (this.oldValues.length && this.objectUuid === glObj.uuid) {
      glObj.setPoints(0, this.oldValues);
      this.oldValues.length = 0;
    }
  }

  projectAllToAxis(glAxis, value) {
    if (isNaN(value)) {
      console.log('Invalid value on axis');
      return;
    }

    const points = glObj.getPoints(0, pointsCount - 1);
    this.oldValues.length = 0;

    if (glAxis === GlAxis.X) {
      for (let i = 0; i < pointsCount; i++) {
        this.oldValues.push(points[i]);
        points[i].x = value;
      }
      this.axis = GlAxis.X;
    } else if (glAxis === GlAxis.Y) {
      for (let i = 0; i < pointsCount; i++) {
        this.oldValues.push(points[i]);
        points[i].y = value;
      }
      this.axis = GlAxis.Y;
    } else if (glAxis === GlAxis.Z) {
      for (let i = 0; i < pointsCount; i++) {
        this.oldValues.push(points[i]);
        points[i].z = value;
      }
      this.axis = GlAxis.Z;
    }
    glObj.setPoints(0, points);
    this.axisValue = value;
    this.objectUuid = glObj.uuid;
  }

  restoreAll(glObj) {
    if (this.oldValues.length && this.objectUuid === glObj.uuid) {
      glObj.setPoints(0, this.oldValues);
      this.oldValues.length = 0;
    }
  }

  toJSON(meta, keepUuid = false) {
    // meta is a string when called from JSON.stringify
    const isRootObject = ( meta === undefined || meta === null || typeof meta === 'string' );

    const output = {};

    // meta is a hash used to collect textures, images.
    // not providing it implies that this is the root object
    // being serialized.
    if (isRootObject) {
      meta = {
        textures: {},
        images: {},
      };

      output.metadata = {
        version: 5.0,
        type: 'GlDxfGroup',
        generator: 'GlDxfGroup.toJSON'
      };
    }
    // standard Object3D serialization

    const object = {};
    
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;

    if (this.name !== '') object.n = this.name;
 
    if ( this.children.length > 0 ) {
      object.ch = [];
      for ( let i = 0; i < this.children.length; i ++ ) {
        // if (this.children[i].isGlGroup) {
        object.ch.push( this.children[i].toJSON(meta, keepUuid).object );
        // continue;
        // }
        // object.source.push(this.children[i].source);
      }
    }

    if (isRootObject) {
      const textures = extractFromCache(meta.textures);
      const images = extractFromCache(meta.images);

      if (textures.length > 0) output.textures = textures;
      if (images.length > 0) output.images = images;
    }

    output.object = object;

    return output;


    // extract data from the cache hash
    // remove metadata on each item
    // and return as array
    function extractFromCache(cache) {
      const values = [];
      for (const key in cache) {
        if (Object.prototype.hasOwnProperty.call(cache, key)) {
          const data = cache[key];
          delete data.metadata;
          values.push(data);
        }
      }
      return values;
    }
  }
  
  get properties() {
    return {
      type: Primitive_Type.String,
      n: Primitive_Type.String,
      ch: Primitive_Type.Int32,
    };
  }

  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);
    
    writeToDv('type', this.type);
    writeToDv('n', this.name);
    writeToDv('ch', this.children.length);
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].toArrayBuffer(myDv);
    }

    writeToDv('endObj');
  }
}