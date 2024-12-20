import { GlUtils } from '../utils/gl-utils';
import {GlAttributeValueType as V_TYPE, GlAttributeType as A_TYPE, Primitive_Type } from './gl-constants';

export class GlAttribute {
  constructor(type, valueType, value, editable = true) {
    this.__type = A_TYPE.Mesh;
    this.__valueType = V_TYPE.Number;
    this.__value = 0;

    this.index = null;
    
    this.__editable = editable;
    this.isGlAttribute = true;

    if (type || valueType || value) {
      this.__init(type, valueType, value);
    }
  }

  __init(type, valueType, value) {
    this.type = type;
    this.valueType = valueType;
    this.value = value;
  }

  set editable(flag) {
    if (flag) {
      this.__editable = true;
    }else {
      this.__editable = false;
    }
  }

  get editable() {
    return this.__editable;
  }


  set type(type) {
    if (type && type >= A_TYPE.Vertex && type <= A_TYPE.Mesh) {
      this.__type = type;
    } else {
      throw new Error('Unknown attribute type');
    }
  }

  get type() {
    return this.__type;
  }


  set valueType(valueType) {
    if (valueType && valueType >= V_TYPE.Number && valueType <= V_TYPE.BufferArray) {
      this.__valueType = valueType;
      const isNumber = this.__valueType === V_TYPE.Number;
      const isString = this.__valueType === V_TYPE.String;
      const isBoolean = this.__valueType === V_TYPE.Boolean;
      const isNumArr = this.__valueType === V_TYPE.NumberArray;
      const isStrArr = this.__valueType === V_TYPE.StringArray;
      const isBlnArr = this.__valueType === V_TYPE.BooleanArray;
      const isArr = this.__valueType === V_TYPE.Array;
      const isObject = this.__valueType === V_TYPE.Object;
      if (Array.isArray(this.__value) && (isNumArr || isStrArr || isBlnArr || isArr)) {
        if (this.__value.length > 0) {
          if ((typeof this.__value[0] === 'number' && !isNumArr) ||
              (typeof this.__value[0] === 'string' && !isStrArr) ||
              (typeof this.__value[0] === 'boolean' && !isBlnArr)) {
            this.__value.length = 0;
          } else if (isArr) {
            this.__value.length = 0;
          }
        }
      } else if (isNumber && typeof this.__value !== 'number') {
        this.__value = 0;
      } else if (isString && typeof this.__value !== 'string') {
        this.__value = '';
      } else if (isBoolean && typeof this.__value !== 'boolean') {
        this.__value = false;
      } else if (isObject && typeof this.__value !== 'object') {
        this.__value = {};
      }
    } else {
      throw new Error('Unknown attribute value type');
    }
  }
  get valueType() {
    return this.__valueType;
  }


  set value(value) {
    if (value !== null && value !== undefined) {
      const isNumber = this.__valueType === V_TYPE.Number;
      const isString = this.__valueType === V_TYPE.String;
      const isBoolean = this.__valueType === V_TYPE.Boolean;
      const isNumArr = this.__valueType === V_TYPE.NumberArray;
      const isStrArr = this.__valueType === V_TYPE.StringArray;
      const isBlnArr = this.__valueType === V_TYPE.BooleanArray;
      const isArr = this.__valueType === V_TYPE.Array;
      const isBfrArr = this.__valueType === V_TYPE.BufferArray;
      const isObject = this.__valueType === V_TYPE.Object;
      if (Array.isArray(value) && (isNumArr || isStrArr || isBlnArr || isArr)) {
        if (value.length > 0) {
          if ((typeof value[0] === 'number' && isNumArr) ||
              (typeof value[0] === 'string' && isStrArr) ||
              (typeof value[0] === 'boolean' && isBlnArr)) {
            this.__value = value;
          } else if (isArr) {
            this.__value = value;
          } else {
            throw new Error('Incompitable attribute value');
          }
        } else {
          this.__value = [];
        }
      } else if ((typeof value === 'number' && isNumber) ||
                 (typeof value === 'string' && isString) ||
                 (typeof value === 'boolean' && isBoolean)) {
        this.__value = value;
      } else if ((value instanceof Float32Array ||
                  value instanceof Float64Array ||
                  value instanceof Int8Array ||
                  value instanceof Uint8Array ||
                  value instanceof Int16Array ||
                  value instanceof Uint16Array ||
                  value instanceof Int32Array ||
                  value instanceof Uint32Array) 
                && isBfrArr) {
        this.__value = value;
      } else if (typeof value === 'object' && isObject) {
        this.__value = value;
      } else {
        throw new Error('Incompitable attribute value');
      }
    }
  }

  get value() {
    return this.__value;
  }

  get isIndexed() {
    if (this.index && this.index.length){
      return true;
    }
    return false;
  }

  dispose() {
    if (this.isIndexed) {
      this.index = null;
      this.value = null;
    } else {
      this.value = null;
    }
  }


  isVertexType() {
    return this.__type === A_TYPE.Vertex;
  }
  isEdgeType() {
    return this.__type === A_TYPE.Edge;
  }
  isMeshType() {
    return this.__type === A_TYPE.Mesh;
  }


  isNumber() {
    return this.__valueType === V_TYPE.Number;
  }
  isString() {
    return this.__valueType === V_TYPE.String;
  }
  isBoolean() {
    return this.__valueType === V_TYPE.Boolean;
  }
  isNumberArray() {
    return this.__valueType === V_TYPE.NumberArray;
  }
  isStringArray() {
    return this.__valueType === V_TYPE.StringArray;
  }
  isBooleanArray() {
    return this.__valueType === V_TYPE.BooleanArray;
  }
  isBufferArray() {
    return this.__valueType === V_TYPE.BufferArray;
  }
  isObject() {
    return this.__valueType === V_TYPE.Object;
  }
  isArray() {
    return this.__valueType === V_TYPE.Array;
  }
  valueAtIndex(index) {
    if (this.isIndexed) {
      return this.value[this.index[index]];
    }
  }

  get properties() {
    return {
      t: Primitive_Type.Uint8,
      vt: Primitive_Type.Uint8,
      pt: Primitive_Type.String,
      v: Primitive_Type.ObjectString,
      i: Primitive_Type.Uint32Array,
      e: Primitive_Type.Uint8,
    }
  }

  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);

    writeToDv("t", this.__type);
    writeToDv("vt", this.__valueType);

    switch(this.valueType) {
      case V_TYPE.BufferArray:
        writeToDv("pt", this.__value.constructor.name);
        writeToDv("v", this.__value, Primitive_Type[this.__value.constructor.name]);
        break;
      case V_TYPE.String:
        writeToDv("v", this.__value, Primitive_Type.String);
        break;
      case V_TYPE.Number:
        writeToDv("v", this.__value, Primitive_Type.Float32)
        break;
      default:
        writeToDv("v", this.__value);
    }

    if (this.isIndexed) writeToDv('i', this.index);

    writeToDv("e", this.__editable);
    writeToDv('attrEnd');
  }
}

GlAttribute.isGlAttribute = true;


export class GlAttributes extends Map {
  constructor() {
    super();
    this.type = 'GlAttributes';
    this.isGlAttributes = true;
  }

  clone() {
    const object = new this.constructor();
    const keys = Array.from(this.keys());
    for (let i = 0; i < keys.length; i++) {
      const currAttr = this.get(keys[i]);
      const glAttr = new GlAttribute(currAttr.type, currAttr.valueType, currAttr.value, currAttr.editable);
      if (glAttr.isIndexed) glAttr.index = currAttr.index;
      object.set(keys[i], glAttr);
    }
    
    return object;
  }

  set(key, value) {
    const isValidKey = typeof key === 'string';
    const isValidValue = typeof value === 'object' && value.isGlAttribute === true;
    if (!isValidKey) {
      throw new Error('Invalid key');
    }
    if (!isValidValue) {
      throw new Error('Invalid value');
    }

    return super.set(key, value);
  }
  
  dispose() {
    super.forEach((value, key) => {
      value.dispose();
      this.delete(key);
    })
  }

  toJSON() {
    const object = {};
    // 'e' ->  'editable'
    // 't' ->  'type'
    // 'v' ->  'value'
    // 'vt' ->  'valueType'
    this.forEach((value, key) => {
      object[key] = {
        e: value.__editable,
        t: value.__type,
        v: value.__value,
        vt: value.__valueType
      };
      if (value.__valueType === V_TYPE.BufferArray) {
        object[key].pt = value.__value.constructor.name;
        object[key].v = Array.from(object[key].v);
      }
    }) 
    return object;
  }

  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, {});
    
    writeToDv("t", this.type, Primitive_Type.String);
    this.forEach((value, key) => {
      writeToDv("k", key, Primitive_Type.String);
      value.toArrayBuffer(myDv);
    });

    writeToDv('endObj');
  }

  *fromArrayBuffer(myDv) {
    const read = GlUtils.createReader(myDv);
    let res = null;
    let json = {};
    const attrJson = {};
    const setProperty = function* (prop, value) {
      switch(prop) {
        case 'attrEnd':
          attrJson[json.k] = json;
          json = {};
          // all attributes are loaded
          break;
        default:
          json[prop] = value;
      }
    }

    do {
      res = yield* read();
      yield* setProperty(res.prop, res.value);
    } while(res.prop !== 'endObj');
    this.fromJSON(attrJson);
  } 

  fromJSON(json) {
    if (typeof json !== 'object') return;

    this.clear();
    const ownProps = Object.keys(json)

    for (const prop of ownProps) {
      const jsonAttr = json[prop];
      let attribute = null;

      switch(jsonAttr.pt) {
        case 'Float32Array':
          jsonAttr.v = new Float32Array(jsonAttr.v);
          break; 
        case 'Float64Array':
          jsonAttr.v = new Float64Array(jsonAttr.v);
          break; 
        case 'Int8Array':
          jsonAttr.v = new Int8Array(jsonAttr.v);
          break; 
        case 'Uint8Array':
          jsonAttr.v = new Uint8Array(jsonAttr.v);
          break; 
        case 'Int16Array':
          jsonAttr.v = new Int16Array(jsonAttr.v);
          break; 
        case 'Uint16Array':
          jsonAttr.v = new Uint16Array(jsonAttr.v);
          break; 
        case 'Int32Array':
          jsonAttr.v = new Int32Array(jsonAttr.v);
          break; 
        case 'Uint32Array':
          jsonAttr.v = new Uint32Array(jsonAttr.v);
          break;
      }

      attribute = new GlAttribute(jsonAttr.t, jsonAttr.vt, jsonAttr.v, jsonAttr.e);
      if (jsonAttr.i) attribute.index = jsonAttr.i;
      
      this.set(prop, attribute);
    }
  }

  fromJSON_v4_5(json) {
    if (typeof json !== 'object') return;

    this.clear();
    const ownProps = Object.keys(json)

    for (const prop of ownProps) {
      const jsonAttr = json[prop];
      const attribute = new GlAttribute(jsonAttr.__type, jsonAttr.__valueType, jsonAttr.__value);
      this.set(prop, attribute);
    }
  }
}