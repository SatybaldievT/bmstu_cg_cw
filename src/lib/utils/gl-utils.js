/* eslint-disable no-undef */
import {GlOrientation} from '../core/gl-constants';
import {GlIntervalGeometry} from '../core/gl-interval-geometry';
import { Primitive_Type } from '../core/gl-constants';
import {
  BufferGeometry,
  InstancedBufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  InterleavedBufferAttribute,
  Vector3,
  MathUtils,
  StaticDrawUsage,
  Sphere,
  InstancedInterleavedBuffer,
} from 'three';

const __encode = new Map();
__encode.set('position',       'p');
__encode.set('color',          'clr');
// __encode.set('normal',         'n');
__encode.set('uv',             'uv');
__encode.set('index',          'i');
__encode.set('visibility',     'v');
__encode.set('instanceStart',  'is');
__encode.set('instanceEnd',    'ie');
__encode.set('instanceColorStart',  'ics');
__encode.set('instanceColorEnd',   'ice');
__encode.set('Int8Array',      'i8');
__encode.set('Int16Array',     'i16');
__encode.set('Int32Array',     'i32');
__encode.set('Uint8Array',     'u8');
__encode.set('Uint16Array',    'u16');
__encode.set('Uint32Array',    'u32');
__encode.set('Float32Array',   'f32');
__encode.set('Float64Array',   'f64');
__encode.set('Uint8ClampedArray', 'u8C');

const __decode = new Map();
__decode.set('p',   'position');
__decode.set('clr', 'color');
// __decode.set('n',   'normal');
__decode.set('uv',  'uv');
__decode.set('i',   'index');
__decode.set('v',   'visibility');
__decode.set('is',   'instanceStart');
__decode.set('ie',   'instanceEnd');
__decode.set('ics',   'instanceColorStart');
__decode.set('ice',   'instanceColorEnd');


const geometryProperties = {
  t: Primitive_Type.String, // type
  iC: Primitive_Type.Uint32, // instanceCount
  uD: Primitive_Type.ObjectString, // userData
  i: Primitive_Type.ObjectString, // index
  atr: Primitive_Type.Object, // attributes
  clr: Primitive_Type.Object, // color
  p: Primitive_Type.Object, // position
  iS: Primitive_Type.Int32, // itemSize
  at: Primitive_Type.String,
  nz: Primitive_Type.Uint8, // normalized
  ar8: Primitive_Type.Uint8Array,
  ar: Primitive_Type.Float32Array,
  os: Primitive_Type.Uint32, // offset
  ug: Primitive_Type.Int32, // usage
  uR: Primitive_Type.ObjectString, // updateRange
  pCt: Primitive_Type.Int32, // pointsCount
  bS: Primitive_Type.ObjectString, // boundingSphere
  dR: Primitive_Type.ObjectString, // drawRange
};

const __mapTypes = {
  i8:   Int8Array,
  u8:   Uint8Array,
  u8C:  Uint8ClampedArray,
  i16:  Int16Array,
  u16:  Uint16Array,
  i32:  Int32Array,
  u32:  Uint32Array,
  f32:  Float32Array,
  f64:  Float64Array,
  BG:   BufferGeometry,
  IG:   GlIntervalGeometry,
  IBG:  InstancedBufferGeometry,
  BA:   BufferAttribute,
  IBA:  InstancedBufferAttribute,
  ILBA: InterleavedBufferAttribute
};

export const GlUtils = {

  // ---------------------------------
  // get view orientation
  // 'viewDir' must be a unit vector
  // ---------------------------------
  getViewOrientation: function(viewDir) {
    const EPS = 1.0e-6;

    if (!(viewDir && viewDir.isVector3)) {
      return GlOrientation.Arbitrary;
    }

    if (viewDir.z < (EPS - 1.0)) {
      return GlOrientation.LookingDown;
    } else if (viewDir.z > (1.0 - EPS)) {
      return GlOrientation.LookingUp;
    } else if (viewDir.x < (EPS - 1.0)) {
      return GlOrientation.LookingWest;
    } else if (viewDir.x > (1.0 - EPS)) {
      return GlOrientation.LookingEast;
    } else if (viewDir.y > (1.0 - EPS)) {
      return GlOrientation.LookingNorth;
    } else if (viewDir.y < (EPS - 1.0)) {
      return GlOrientation.LookingSouth;
    } else {
      return GlOrientation.Arbitrary;
    }
  },

  // ---------------------------------
  // get adjusted view orientation
  // 'viewDir' must be a unit vector
  // ---------------------------------
  getAdjustedViewOrientation: function(viewDir) {
    let orientation = GlUtils.getViewOrientation(viewDir);
    switch (orientation) {
      case GlOrientation.LookingWest:
      case GlOrientation.LookingEast:
        orientation = GlOrientation.LookingWest;
        break;

      case GlOrientation.LookingNorth:
      case GlOrientation.LookingSouth:
        orientation = GlOrientation.LookingNorth;
        break;

      case GlOrientation.LookingDown:
      case GlOrientation.LookingUp:
        orientation = GlOrientation.LookingDown;
        break;

      case GlOrientation.TransformSection:
        if (orientation === GlOrientation.LookingDown) {
          orientation = Math.abs(viewDir.x) > Math.abs(viewDir.y) ? GlOrientation.LookingWest : GlOrientation.LookingNorth;
        }
        break;

      case GlOrientation.Arbitrary:
      default:
        break;
    }

    return orientation;
  },

  // ---------------------------------
  // Convert decimal to RGB
  // ---------------------------------
  decimalToRgb: function(decimal, normalize) {
    let r = (decimal & 0xff0000) >> 16;
    let g = (decimal & 0x00ff00) >> 8;
    let b = (decimal & 0x0000ff);

    if (normalize) {
      r /= 255;
      g /= 255;
      b /= 255;
    }

    return {r, g, b};
  },

  // ---------------------------------
  // Convert RGB to decimal
  // ---------------------------------
  RgbToDecimal: function (r, g, b, normalized) {
    if (normalized) {
      r *= 255;
      g *= 255;
      b *= 255;
    }
    return (r << 16) + (g << 8) + (b);
  },

  // ---------------------------------
  // Convert HEX to RGB
  // ---------------------------------
  hexToRgb: function (hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  // ------------------------------------------------------------------------------
  // Calculate azimuth, dip and length of a line segment
  //
  // input:
  //  start - the starting point of a segment (an object with properties x, y, z)
  //  end - the ending point of a segment (an object with properties x, y, z)
  //
  // output:
  //  an object containing the properties: azimuth, dip and length
  // ------------------------------------------------------------------------------
  calculateSegmentsADL: function(start, end) {
    let retObj = null;
    let segment = null;
    if (start && !end) {
      segment = new Vector3(start.x, start.y, start.z);
    } else if (start && end) {
      segment = new Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
    }

    if (segment) {
      // calculate azimuth
      let azimuth = Math.atan2(segment.x, segment.y) * MathUtils.RAD2DEG;
      if (azimuth < 0) azimuth += 360.0;

      // calculate dip
      let dip;
      const sqDist = (segment.x * segment.x + segment.y * segment.y);
      if (sqDist === 0) dip = segment.z < 0 ? -90 : 90;
      else dip = Math.atan(segment.z / Math.sqrt(sqDist)) * MathUtils.RAD2DEG;

      // calculate length
      const length = Math.sqrt(segment.x * segment.x + segment.y * segment.y + segment.z * segment.z);

      retObj = {azimuth, dip, length};
    }

    return retObj;
  },

  // ------------------------------------------------------------------------------
  // Calculate a line segment's ending coordinates
  //
  // input:
  //  start - the starting point of the segment (an object with properties x, y, z)
  //  azimuth - azimuth of the segment
  //  dip - dip of the segment
  //  len - length of the segment

  // output:
  //  the ending point of the segment
  // ------------------------------------------------------------------------------
  calculateSegmentsEndCoord: function(start, azimuth, dip, len) {
    let retObj = null;
    azimuth = azimuth ? azimuth : 0.0;
    dip = dip ? dip : 0.0;
    len = len ? len : 0.0;
    if (start) {
      const ptStart = new Vector3(start.x, start.y, start.z);
      const ptEnd = new Vector3();

      // convert spherical coords into cartesian
      ptEnd.x = Math.sin(azimuth * MathUtils.DEG2RAD) * Math.cos(dip * MathUtils.DEG2RAD);
      ptEnd.y = Math.cos(azimuth * MathUtils.DEG2RAD) * Math.cos(dip * MathUtils.DEG2RAD);
      ptEnd.z = Math.sin(dip * MathUtils.DEG2RAD);

      ptEnd.normalize();
      ptEnd.multiplyScalar(len);

      retObj = new Vector3();
      retObj.addVectors(ptStart, ptEnd);
    }
    return retObj;
  },

  // ------------------------------------------------------------------------------
  // calculate where two segments are intersected
  // ------------------------------------------------------------------------------
  calculateSegIntersection(seg1, seg2) {

    const u = new Vector3();
    const u_2d = new Vector3();
    const v = new Vector3();
    const tmpU = new Vector3();
    const tmpP1 = new Vector3();
    const tmpP2 = new Vector3();
    const ptIntersect1 = new Vector3();
    const ptIntersect2 = new Vector3();

    const pt1 = seg1.start.clone();
    const pt2 = seg1.end.clone();
    tmpP1.copy(pt1);
    tmpP2.copy(pt2);
    u.subVectors(tmpP2, tmpP1);
    u_2d.copy(u).setZ(0);

    let pt1_poly2;
    let pt2_poly2;
    pt1.z = 0;
    pt2.z = 0;

    pt1_poly2 = seg2.start.clone();
    pt2_poly2 = seg2.end.clone();
    v.subVectors(pt2_poly2, pt1_poly2);

    const denominator = (v.y * u_2d.x) - (v.x * u_2d.y);
    const numA = v.x * (pt1.y - pt1_poly2.y) - v.y * (pt1.x - pt1_poly2.x);
    const numB = u_2d.x * (pt1.y - pt1_poly2.y) - u_2d.y * (pt1.x - pt1_poly2.x);
    const ua = numA / denominator;
    const ub = numB / denominator;

    tmpU.copy(u).multiplyScalar(ua);
    ptIntersect1.addVectors(tmpP1, tmpU);
    tmpU.copy(v).multiplyScalar(ub);
    ptIntersect2.addVectors(pt1_poly2, tmpU);
    
    if (!ua || !ub || !ptIntersect1 || !ptIntersect2) return null;
    
    const res = {
      distance1: ua,
      point1: ptIntersect1.clone(),
      distance2: ub,
      point2: ptIntersect2.clone()
    }

    return res;
  },

  // ----------------------------------------------------
  // Verify if an object is GlObject
  //
  // input:
  // object - checking object. E.g.: {a: 1}, or any instance of gl objects
  // includesGroups - true or false. This boolean value tells if to check grouping objects
  // excludes - array. gl objects to be excluded while checking. E.g.: ['GlFatPolyline', 'GlMeshSet']

  // output:
  //  true or false
  // -----------------------------------------------------

  isGlObject(object, includesGroups, excludes) {
    if (object instanceof Object && !(object instanceof Array)) {
      const glObjects = [
        'GlPolyline', 'GlPoints', 'GlSegments', 'GlIntervals',
        'Channel', 'Drillhole', 'RCHole', 'GlTriangulation','GlMesh',
        'GlFatPolyline', 'Trench', 'GlWall', 'Chart',
        'Notch', 'GlText', 'GlObb', 'GlPointSamples', 'GlBlocks', 'GlImage', 'ChartLine'
      ];
      excludes = excludes || [];
      
      if (this.isGlObjectSet(object, excludes)) return true;

      const glObjectsInd = glObjects.indexOf(object.type);
      const excludesInd = excludes.indexOf(object.type);

      if (excludesInd !== -1) return false;
      else {
        if (glObjectsInd !== -1) return true;
        else return false;
      }
    }
    return false;
  },

  isGlObjectSet(object, excludes) {
    if (object instanceof Object && !(object instanceof Array)) {
      const glSets = [
        'GlPolylineSet', 'GlPointsSet', 'ChannelSet',
        'DrillholeSet', 'RCHoleSet', 'GlSegmentsSet', 'GlIntervalsSet', 'GlTriangulationSet',
        'GlMeshSet', 'GlFatPolylineSet', 'GlJsonGroup', 'GlGroup', 'OneComponentCharts', 
        'TwoComponentsCharts', 'SemiVariogramSet', 'VariogramsMap', 'GlDxfGroup', 'GlTextSet', 'GlMultiSection', 'GlBlocksSet',
        'GlImageSet', 'GlMeshTrendSet', 'VariogramModelLine'
      ];
      excludes = excludes || [];

      const glSetsInd = glSets.indexOf(object.type);
      const excludesInd = excludes.indexOf(object.type);

      if (excludesInd !== -1) return false;
      else {
        if (glSetsInd !== -1) return true;
        else return false;
      }
    }
    return false;
  },

  isEmpty (value) {
    return value === null || value === undefined;
  },

  bufferGeometryToJson(geometry, isFloatAsRawBytes = true) {
    // 'type',           ->  't' 
    // 'array',          ->  'ar' 
    // 'array type',     ->  'at' 
    // 'attributes',     ->  'atr' 
    // 'index',          ->  'i' 
    // 'normalized',     ->  'nz' 
    // 'boundingSphere', ->  'bS' 
    // 'center',         ->  'cn' 
    // 'userData',       ->  'uD' 
    // 'radius',         ->  'rd' 
    // 'itemSize',       ->  'iS' 
    // 'instanceCount',  ->  'iC' 
    // 'updateRange',    ->  'uR' 
    // 'usage',          ->  'ug' 
    // 'drawRange'       ->  'dR' 

    const json = {};
    if (geometry) {
      json.t = geometry.isGlIntervalGeometry ? 'IG' : geometry.isInstancedBufferGeometry ? 'IBG' : 'BG';
      if (typeof geometry.instanceCount === 'number') {
        json.iC = geometry.instanceCount;
      }

      if (Object.keys(geometry.userData).length > 0) json.uD = this.userData;

      const index = json.t !== 'IG' ? geometry.index : null;
      if (index !== null) {
        json.i = {
          at: __encode.get(index.array.constructor.name),
          ar: Array.prototype.slice.call(index.array)
        };
      }

      json.atr = {};
      const attributes = geometry.attributes;
      for (const key in attributes) {
        let k = __encode.get(key);
        if (!k) continue;

        let attrib = attributes[key];
        const start = geometry.drawRange.start * attrib.itemSize;
        let count; 
        if(json.t === 'BG') {
          count = geometry.verticesCount ? geometry.verticesCount * attrib.itemSize : geometry.drawRange.count * attrib.itemSize;
        } else {
          count = (geometry._pointsCount - 1) * 6;
        }
        
        const arrType = attrib.array.constructor.name

        json.atr[k] = {
          t: attrib.isInterleavedBufferAttribute ? 'ILBA' : attrib.isInstancedBufferAttribute ? 'IBA' : 'BA',
          iS: attrib.itemSize,
          at: __encode.get(arrType),
          nz: attrib.normalized,
        };

        if (isFloatAsRawBytes && (arrType === "Float32Array" || arrType === "Float64Array") && (k === 'p')) {
          const m = arrType === "Float32Array" ? 4 : 8; 
          json.atr[k].ar8 = Array.from(new Uint8Array(attrib.array.buffer).subarray(start, count * m));
        } else {
          json.atr[k].ar = Array.from(attrib.array.subarray(start, count));
        }

        if (attrib.isInterleavedBufferAttribute) json.atr[k].os = attrib.offset;
        
        if (attrib.isInterleavedBufferAttribute && attrib.data) attrib = attrib.data;
        if (attrib.usage !== StaticDrawUsage ) json.atr[k].ug = attrib.usage;
        if (attrib.updateRange.offset !== 0 || attrib.updateRange.count !== - 1) json.atr[k].uR = attrib.updateRange;
      }

      if (geometry.isGlIntervalGeometry) json.pCt = geometry._pointsCount;

      const bS = geometry.boundingSphere;
      if (bS) {
        json.bS = {cn: bS.center.toArray(), rd: bS.radius};
      }

      if (geometry.userData) json.userData = geometry.userData;

      const dR = geometry.drawRange;
      if (dR) {
        json.dR = {st: dR.start, cnt: dR.count};
      }
    }

    return json;
  },

  bufferGeometryToArrayBuffer(geometry, myDv, isFloatAsRawBytes = true) {
    const writeToDv = this.createWriter(myDv, geometryProperties);

    if (geometry) {
      writeToDv('t', geometry.isGlIntervalGeometry ? 'IG' : geometry.isInstancedBufferGeometry ? 'IBG' : 'BG');
      if (typeof geometry.instanceCount === 'number') {
        writeToDv('iC', geometry.instanceCount);
      }

      if (Object.keys(geometry.userData).length > 0) writeToDv("uD", this.userData)

      const index = !(geometry.isGlIntervalGeometry) ? geometry.index : null;
      if (index !== null) {
        writeToDv('i', {at: __encode.get(index.array.constructor.name), ar: Array.prototype.slice.call(index.array)})
      }

      const attributes = geometry.attributes;
      let attrLength = 0;
      
      for (const key in attributes) {
        if (__encode.get(key)) attrLength++;;
      }
      
      writeToDv('atr', attrLength);
      for (const key in attributes) {
        let k = __encode.get(key);
        if (!k) continue;

        let attrib = attributes[key];
        const start = geometry.drawRange.start * attrib.itemSize;
        let count;
        if(!geometry.isInstancedBufferGeometry) {
          count = geometry.verticesCount ? geometry.verticesCount * attrib.itemSize : geometry.drawRange.count * attrib.itemSize;
        } else {
          count = (geometry._pointsCount - 1) * 6;
        }
        
        const arrType = attrib.array.constructor.name

        writeToDv(k, null);
        writeToDv('t', attrib.isInterleavedBufferAttribute ? 'ILBA' : attrib.isInstancedBufferAttribute ? 'IBA' : 'BA');
        writeToDv('iS', attrib.itemSize);
        writeToDv('at', __encode.get(arrType));
        writeToDv('nz', attrib.normalized);

        if (attrib.isInterleavedBufferAttribute) writeToDv('os', attrib.offset)
        
        if (attrib.isInterleavedBufferAttribute && attrib.data) attrib = attrib.data;
        if (attrib.usage !== StaticDrawUsage ) writeToDv('ug', attrib.usage);
        if (attrib.updateRange.offset !== 0 || attrib.updateRange.count !== - 1) writeToDv('uR', attrib.updateRange);

        if (isFloatAsRawBytes && (arrType === "Float32Array" || arrType === "Float64Array") && (k === 'p')) {
          const m = arrType === "Float32Array" ? 4 : 8;
          writeToDv('ar8', new Uint8Array(attrib.array.buffer).subarray(start, count * m));
        } else {
          writeToDv('ar', attrib.array.subarray(start, count), Primitive_Type[attrib.array.constructor.name]);
        }
        writeToDv('endAttr', null);
      }

      if (geometry.isGlIntervalGeometry) writeToDv('pCt', geometry._pointsCount);

      const bS = geometry.boundingSphere;
      if (bS) {
        writeToDv('bS', {cn: bS.center.toArray(), rd: bS.radius});
      }

      if (geometry.userData) writeToDv('uD', geometry.userData);

      const dR = geometry.drawRange;
      if (dR) {
        writeToDv('dR', {st: dR.start, cnt: dR.count});
      }

      writeToDv('endGeom', null);
    }
  },

  *bufferGeometryFromArrayBuffer(myDv) {
    const read = GlUtils.createReader(myDv);
    let res = null;
    let geometry = null;
    
    const setProperty = function* (prop, value) {
      switch(prop) {
        case 't':
          geometry = new __mapTypes[value];
          break;
        case 'iC':
          geometry.instanceCount = value;
          break;
        case 'i':
          const typedArray = new __mapTypes[value.at](value.ar);
          geometry.setIndex(new BufferAttribute(typedArray, 1));
          break;
        case 'atr':
          const attrL = value;
          let buffer;
          for (let i = 0; i < attrL; i++) {
            const map = new Map();
            const attrVal = yield* read();
            let attrName = attrVal.prop;
            let bufferAttribute;
            do {
              res = yield* read();
              map.set(res.prop, res.value);
            } while(res.prop !== 'endAttr');

            if (map.get('t') === 'ILBA') {
              const newSize = geometry.instanceCount ? geometry.instanceCount * 6 : map.get('ar').length;   
              if (attrName === 'is' || attrName === 'ics') buffer = GlUtils.__getInterleavedBuffer (newSize, {at: map.get('at'), ar: map.get('ar')});
              bufferAttribute = new InterleavedBufferAttribute(buffer, map.get('iS'), map.get('os'), map.get('nz'));

              if (map.get('uR') !== undefined) {
                bufferAttribute.data.updateRange.offset = map.get('uR').offset;
                bufferAttribute.data.updateRange.count = map.get('uR').count;
              }

              if (map.get('ug') !== undefined) bufferAttribute.data.setUsage(map.get('ug'));

            } else {
              let typedArray;
              if (map.get('ar8')) {
                const uint8a = new Uint8Array(map.get('ar8'));
                typedArray = new __mapTypes[map.get('at')](uint8a.buffer);
              } else {
                typedArray = new __mapTypes[map.get('at')](map.get('ar'));
              }
              
              bufferAttribute = new __mapTypes[map.get('t')](typedArray, map.get('iS'), map.get('nz'));
              if (map.get('uR') !== undefined) {
                bufferAttribute.updateRange.offset = map.get('uR').offset;
                bufferAttribute.updateRange.count = map.get('uR').count;
              }

              if (map.get('ug') !== undefined) bufferAttribute.setUsage(map.get('ug'));
            }

            if (bufferAttribute) {
              let k = __decode.get(attrName);
              if (!k) k = attrName;
              geometry.setAttribute(k, bufferAttribute);
            }
          }
        case 'pCt':
          geometry._pointsCount = value;
          break;
        case 'bS':
          const bS = value;
          const center = new Vector3();
          if (bS.cn !== undefined) {
            center.fromArray(bS.cn);
          }
          geometry.boundingSphere = new Sphere(center, bS.rd);
          break;
        case 'dR':
          const dR = value;
          if (typeof dR.st === 'number') geometry.drawRange.start = dR.st;
          if (typeof dR.cnt === 'number') geometry.drawRange.count = dR.cnt;
          break;
        case 'uD':
          geometry.userData = value;
          break;
        default:
      }
    }

    do {
      res = yield* read();
      yield* setProperty(res.prop, res.value);
    } while(res.prop !== 'endGeom');
    
    return geometry;
  },

  bufferGeometryFromJson(json) {
    const geometry = new __mapTypes[json.t]();

    if (typeof json.iC === 'number') {
      geometry.instanceCount = json.iC;
    }

    const index = json.i;
    if (index !== undefined) {
      const typedArray = new __mapTypes[index.at](index.ar);
      geometry.setIndex(new BufferAttribute(typedArray, 1));
    }

    const attributes = json.atr;
    let buffer;
    for (const key in attributes) {
      const attrib = attributes[key];
      let bufferAttribute;
      if (attrib.t === 'ILBA') {
        // TODO
        const newSize = geometry.instanceCount ? geometry.instanceCount * 6 : attrib.ar.length;   
        if (key === 'is' || key === 'ics') buffer = this.__getInterleavedBuffer (newSize, attrib);
        bufferAttribute = new InterleavedBufferAttribute(buffer, attrib.iS, attrib.os, attrib.nz);

        if (attrib.uR !== undefined) {
          bufferAttribute.data.updateRange.offset = attrib.uR.offset;
          bufferAttribute.data.updateRange.count = attrib.uR.count;
        }

        if (attrib.ug !== undefined) bufferAttribute.data.setUsage(attrib.ug);

      } else {
        let typedArray;
        if (attrib.ar8) {
          const uint8a = new Uint8Array(attrib.ar8);
          typedArray = new __mapTypes[attrib.at](uint8a.buffer);
        } else {
          typedArray = new __mapTypes[attrib.at](attrib.ar);
        }
        
        bufferAttribute = new __mapTypes[attrib.t](typedArray, attrib.iS, attrib.nz);
        if (attrib.uR !== undefined) {
          bufferAttribute.updateRange.offset = attrib.uR.offset;
          bufferAttribute.updateRange.count = attrib.uR.count;
        }

        if (attrib.ug !== undefined) bufferAttribute.setUsage(attrib.ug);
      }

      if (bufferAttribute) {
        let k = __decode.get(key);
        if (!k) k = key;
        geometry.setAttribute(k, bufferAttribute);
      }
    }

    if (geometry.isGlIntervalGeometry) geometry._pointsCount = json.pCt;

    const bS = json.bS;
    if (bS !== undefined) {
      const center = new Vector3();
      if (bS.cn !== undefined) {
        center.fromArray(bS.cn);
      }
      geometry.boundingSphere = new Sphere(center, bS.rd);
    }

    if (json.uD) geometry.userData = json.uD;

    const dR = json.dR;
    if (dR !== undefined) {
      if (typeof dR.st === 'number') geometry.drawRange.start = dR.st;
      if (typeof dR.cnt === 'number') geometry.drawRange.count = dR.cnt;
    }

    return geometry;
  },

  __getInterleavedBuffer (size, attrib) {
    const tArray = new __mapTypes[attrib.at](size) ;
    const typedArray = new __mapTypes[attrib.at](attrib.ar);
    tArray.set(typedArray);
    const buffer = new InstancedInterleavedBuffer(tArray, 6, 1);
    return buffer;
  },

  createWriter(myDv, properties) {
    const writeToDv = this.writeToDv;

    return function(key, value, propertyType, offset) {
      const property = propertyType ? propertyType: properties[key];
      let currentOffset = null;
      if (!GlUtils.isEmpty(offset)) {
        currentOffset = myDv.offset;
        myDv.offset = offset;
      }

      try {
        writeToDv(key, value, myDv, property);
        if (currentOffset) {
          myDv.offset = currentOffset;
        }
      } catch (err) {
        (!myDv.writer) ? console.error("Writer is not found") : myDv.writer.abort();
        console.error(err);
        throw err;
      }
    };
  },


  createReader(myDv) {
    const readFromDv = this.readFromDv;
    return function* (moveOffset = true) {
      try {
        // return readFromDv(myDv, moveOffset)
        // create Generator Function
        return yield* readFromDv(myDv, moveOffset);
      } catch (err) {
        console.error(err);
        throw err;
      }
    };
  },


};