/* eslint-disable no-undef */
import { GlBase } from './gl-base';
import { GlLabel } from './gl-label';
import { MathUtils } from '../utils/math-utils';
import { ImageResources } from '../utils/image-resources';
import { GlPointAction, LabelField, GlSnapMode, Primitive_Type } from './gl-constants';
import { GlUtils } from '../utils/gl-utils';
import {
  PointsMaterial,
  BufferGeometry,
  Color,
  Texture,
  LinearMipMapLinearFilter,
  LinearFilter,
  BufferAttribute,
  Vector3,
  Box3,
  Sphere,
  Matrix4,
  Ray,
} from 'three';
import { mergeTextsIntoInstancedText } from '../troika/troika-three-text/InstancedText';
import { GlAttribute } from './gl-attribute';
import { GlAttributeValueType as V_TYPE, GlAttributeType as A_TYPE } from './gl-constants';
import { utils } from '@tangens/common/utils/dataUtils';

const onBeforeCompile = function (shader) {
  shader.vertexShader = `
      attribute float visibility;
      varying float vVisible;
    ${shader.vertexShader}`
    .replace(
      `gl_PointSize = size;`,
      `
            gl_PointSize = size * 0.9;
            vVisible = visibility;
            `
    );
  shader.fragmentShader = `
      varying float vVisible;
    ${shader.fragmentShader}`
    .replace(
      `#include <clipping_planes_fragment>`,
      `
              if (vVisible < 0.5) discard;
            #include <clipping_planes_fragment>`
    );
}

export class GlPointsBase extends GlBase {
  constructor(params, fromJSON) {
    super();

    params = params || {};
    const isFromJson = fromJSON && fromJSON.geometry ? true : false;
    const defMaterial = new PointsMaterial({ alphaTest: 0.1, onBeforeCompile });
    if (GlPointsBase.pointsTexture) defMaterial.map = GlPointsBase.pointsTexture;

    const geometry = isFromJson ? fromJSON.geometry : params.geometry ? params.geometry : undefined;
    const material = params.material ? params.material : defMaterial;

    this.geometry = geometry ? geometry : new BufferGeometry();
    this.material = material;

    this.isPoints = true;   // this is needed to render this object via WebGlRenderer correctly
    this.isGlPointsBase = true;
    this.type = 'GlPointsBase';
    this.name = '';
    this.EPS = 1e-8;
    this.__changesCount = 0;

    this.__pointsCount = 0;
    this.pointSize = 5;

    // object's datasource
    this.ds = [];

    // points color settings
    this.pointsColor = params.color ? params.color : new Color(0x047C28);
    this.pointsColor.R = Math.round(this.pointsColor.r * 255);
    this.pointsColor.G = Math.round(this.pointsColor.g * 255);
    this.pointsColor.B = Math.round(this.pointsColor.b * 255);
    this.selectedColor = new Color(0xFF0000);
    this.selectedColor.R = Math.round(this.selectedColor.r * 255);
    this.selectedColor.G = Math.round(this.selectedColor.g * 255);
    this.selectedColor.B = Math.round(this.selectedColor.b * 255);
    this.material.size = 5;
    this.material.vertexColors = true;
    this.material.color.setHex(0xFFFFFF);

    // points' labels
    this.hasLabels = true;
    this.pointLabels = [];
    this.__pointLabelsColor = 0x0000ff;
    this.__pointLabelsFont = '';
    this.__pointLabelsExist = false;
    this.currentPointLabel = LabelField.MARK;
    this.fontSize = 0.12;
    this.numerationOffset = 1;

    // selection
    this.selectable = true;
    this.snappable = true;
    this.lastHiddenPoints = new Map();
    this.hiddenPointsCount = 0;
    this.selectedPoints = new Map();
    this.childIndexToSkip = -1;

    if (isFromJson) {
      if (fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    } else {
      if (params.name) this.name = params.name;
      if (params.pointSize) {
        this.pointSize = params.pointSize;
        this.material.size = params.pointSize;
      }
      this.geometry.setDrawRange(0, this.__pointsCount);
    }

    if (!GlPointsBase.pointsTexture) {
      // get an appropriate image, which will be used as a texture
      const symbolImage = ImageResources.getBase64('circle_full');
      if (symbolImage) {
        GlPointsBase.pointsTexture = new Texture(symbolImage);
        GlPointsBase.pointsTexture.needsUpdate = true;
        GlPointsBase.pointsTexture.minFilter = LinearMipMapLinearFilter;
        GlPointsBase.pointsTexture.magFilter = LinearFilter;
        GlPointsBase.pointsTexture.sourceName = 'circle_full';
      }
    }
    this.material.map = GlPointsBase.pointsTexture;
  }

  // ------------------------------------------------
  // initialize an object from JSON
  // ------------------------------------------------
  __initFromJson(fromJSON) {
    // setMaterial onBeforeCompile
    this.material.onBeforeCompile = onBeforeCompile;

    //uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.n) this.name = fromJSON.n;

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;

    // points' count
    this.__pointsCount = fromJSON.pCt
    this.geometry.setDrawRange(0, this.__pointsCount);
    this.setPointSize(fromJSON.pSz);

    // hiddenPoints
    if (fromJSON.hasHiddenPoints) this.hasHiddenPoints = fromJSON.hHP;

    // point's params
    this.pointsColor = new Color(fromJSON.pCr);
    this.pointsColor.R = Math.round(this.pointsColor.r * 255);
    this.pointsColor.G = Math.round(this.pointsColor.g * 255);
    this.pointsColor.B = Math.round(this.pointsColor.b * 255);

    // user attributes
    if (fromJSON.uA && this.attributes) this.attributes.fromJSON(fromJSON.uA);

    // points' labels
    this.__pointLabelsColor = fromJSON.pLC;
    if (fromJSON.pLE) this.showPointLabels(true);
  }

  // ------------------------------------------------
  // initialize an object from JSON_v1
  // ------------------------------------------------
  __initFromJson_v4_5(fromJSON) {
    // setMaterial onBeforeCompile
    this.material.onBeforeCompile = onBeforeCompile;

    // hiddenPoints
    if (fromJSON.hasHiddenPoints) this.hasHiddenPoints = fromJSON.hasHiddenPoints;

    // uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.name) this.name = fromJSON.name;

    if (fromJSON.matrix !== undefined) {
      this.matrix.fromArray(fromJSON.matrix);
      if (fromJSON.matrixAutoUpdate !== undefined) this.matrixAutoUpdate = fromJSON.matrixAutoUpdate;
      if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);
    } else {
      if (fromJSON.position !== undefined) this.position.fromArray(fromJSON.position);
      if (fromJSON.rotation !== undefined) this.rotation.fromArray(fromJSON.rotation);
      if (fromJSON.quaternion !== undefined) this.quaternion.fromArray(fromJSON.quaternion);
      if (fromJSON.scale !== undefined) this.scale.fromArray(fromJSON.scale);
    }

    if (fromJSON.renderOrder) this.renderOrder = fromJSON.renderOrder;

    // points' count
    this.__pointsCount = fromJSON.pointsCount;
    this.geometry.setDrawRange(0, this.__pointsCount);

    // point's params
    this.pointsColor = new Color(fromJSON.pointsColor);
    this.pointsColor.R = Math.round(this.pointsColor.r * 255);
    this.pointsColor.G = Math.round(this.pointsColor.g * 255);
    this.pointsColor.B = Math.round(this.pointsColor.b * 255);

    // points' labels
    this.__pointLabelsColor = fromJSON.pointLabelsColor;
    if (fromJSON.pointLabelsExist) this.showPointLabels(true);
  }

  // ---------------
  // copy()
  // ---------------
  copy(source, recursive) {
    super.copy(source, recursive);
    this.material = source.material;
    this.geometry = source.geometry;

    return this;
  }

  // ----------------------------------------------------
  // __validateCoordinates()
  // validate and adjust coordinates as:
  // [x0, y0, z0, x1, y1, z1]
  // This method converts coordinates from world to local
  // -----------------------------------------------------
  __validateCoordinates(coords, reverseOrder = false) {
    if (!coords) return null;

    let retCoords = null;
    let error = '';
    if (coords instanceof Array || ArrayBuffer.isView(coords)) {
      if (coords[0] instanceof Array) {
        // we'll assum that the 'coords' is an array of arrays: [[x0, y0, z0], [x1, y1, z1], ...]
        retCoords = Array(coords.length * 3).fill(0.0);

        if (reverseOrder) coords.reverse();

        for (let i = 0; i < coords.length; ++i) {
          if (coords[i][0] === undefined || coords[i][1] === undefined || coords[i][2] === undefined ||
            coords[i][0] === null || coords[i][1] === null || coords[i][2] === null) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retCoords[i * 3] = coords[i][0];
            retCoords[i * 3 + 1] = coords[i][1];
            retCoords[i * 3 + 2] = coords[i][2];
          }
        }
      } else if (typeof coords[0] === 'object') {
        // we'll assume that the 'coords' is an array of objects: [point1, point2, ...]
        retCoords = Array(coords.length * 3).fill(0.0);

        if (reverseOrder) coords.reverse();

        for (let i = 0; i < coords.length; ++i) {
          if (coords[i].x === undefined || coords[i].y === undefined ||
            coords[i].z === undefined) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retCoords[i * 3] = coords[i].x;
            retCoords[i * 3 + 1] = coords[i].y;
            retCoords[i * 3 + 2] = coords[i].z;
          }
        }
      } else {
        // we'll assume that the 'coords' are given as: [x0, y0, z0, x1, y1, z1]
        const ptCount = Math.floor(coords.length / 3);
        const arrLen = ptCount * 3;
        retCoords = Array(arrLen).fill(0.0);
        if (!reverseOrder) {
          for (let i = 0; i < arrLen; ++i) {
            retCoords[i] = coords[i];
          }
        } else {
          let j = 0;
          for (let i = arrLen - 3; i >= 0; i -= 3) {
            retCoords[j] = coords[i];
            retCoords[j + 1] = coords[i + 1];
            retCoords[j + 2] = coords[i + 2];
            j += 3;
          }
        }
      }
    } else {
      // we'll assume that the 'coords' is an object
      if (coords.x === undefined || coords.y === undefined || coords.z === undefined) {
        error = 'Ошибка: координаты заданы некорректно';
      } else {
        retCoords = [coords.x, coords.y, coords.z];
      }
    }

    if (retCoords && retCoords.length) {
      // set an objects position if it's needed
      if (this.__pointsCount === 0) {
        this.__m4.copy(this.matrixWorld).invert();
        this.pivotOffset.set(0, 0, 0);
        this.position.set(retCoords[0], retCoords[1], retCoords[2]);
        this.position.applyMatrix4(this.__m4);
        this.updateMatrixWorld();
      }

      this.__m4.copy(this.matrixWorld).invert();

      // convert coordinates from world to local
      for (let i = 0; i < retCoords.length; i += 3) {
        this.__v3.set(retCoords[i], retCoords[i + 1], retCoords[i + 2]);
        this.__v3.applyMatrix4(this.__m4);
        retCoords[i] = this.__v3.x;
        retCoords[i + 1] = this.__v3.y;
        retCoords[i + 2] = this.__v3.z;
      }
    }

    if (error) {
      console.log(error);
    }

    return retCoords;
  }

  // ------------------------------------------------
  // validateCoordinates()
  // validate and adjust coordinates as:
  // [x0, y0, z0, x1, y1, z1]
  // This method doesn't convert coordinates to world
  // and should be called by external functions to
  // validate any coordinates
  // ------------------------------------------------
  validateCoordinates(coords) {
    if (!coords) return null;

    let retCoords = null;
    let error = '';
    if (coords instanceof Array || ArrayBuffer.isView(coords)) {
      if (typeof coords[0] === 'object') {
        // we'll assume that the 'coords' is an array of objects: [point1, point2, ...]
        retCoords = Array(coords.length * 3).fill(0.0);
        for (let i = 0; i < coords.length; ++i) {
          if (coords[i].x === undefined || coords[i].y === undefined ||
            coords[i].z === undefined) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retCoords[i * 3] = coords[i].x;
            retCoords[i * 3 + 1] = coords[i].y;
            retCoords[i * 3 + 2] = coords[i].z;
          }
        }
      } else {
        // we'll assume that the 'coords' are given as: [x0, y0, z0, x1, y1, z1]
        const ptCount = Math.floor(coords.length / 3);
        retCoords = Array(ptCount * 3).fill(0.0);
        for (let i = 0; i < ptCount * 3; ++i) {
          retCoords[i] = coords[i];
        }
      }
    } else {
      // we'll assume that the 'coords' is an object
      if (coords.x === undefined || coords.y === undefined || coords.z === undefined) {
        error = 'Ошибка: координаты заданы некорректно';
      } else {
        retCoords = [coords.x, coords.y, coords.z];
      }
    }

    if (error) {
      console.log(error);
    }

    return retCoords;
  }

  // ------------------------------------------------
  // __validateColors()
  // validate and adjust colors as:
  // [r0, g0, b0, r1, g1, b1, ...]
  // ------------------------------------------------
  __validateColors(colors) {
    if (!colors) return null;

    let retColors = null;
    let error = '';
    if (colors instanceof Array) {
      if (typeof colors[0] === 'object') {
        // we'll assume that the 'colors' is an array of objects: [color1, color2, ...]
        retColors = Array(colors.length * 3).fill(0.0);
        for (let i = 0; i < colors.length; ++i) {
          if (colors[i].r === undefined || colors[i].g === undefined ||
            colors[i].b === undefined) {
            error = 'Ошибка: некоторые компоненты цвета (r, g, b) заданы некорректно';
          } else {
            retColors[i * 3] = colors[i].r;
            retColors[i * 3 + 1] = colors[i].g;
            retColors[i * 3 + 2] = colors[i].b;
          }
        }
      } else {
        // we'll assume that the 'colors' are given as: [r0, g0, b0, r1, g1, b1]
        const ptCount = Math.floor(colors.length / 3);
        retColors = Array(ptCount * 3).fill(0.0);
        for (let i = 0; i < ptCount * 3; ++i) {
          retColors[i] = colors[i];
        }
      }
    } else {
      // we'll assume that the 'colors' is an object
      if (colors.r === undefined || colors.g === undefined || colors.b === undefined) {
        error = 'Ошибка: Компоненты цвета (r, g, b) заданы некорректно';
      } else {
        retColors = [colors.r, colors.g, colors.b];
      }
    }

    if (error) {
      console.log(error);
    }

    return retColors;
  }

  // ----------------------------------------------------
  // __recreateBufferGeometry(coords, colors)
  // 'coords' must be the type of Array and contain
  // local coordinates as: [x0, y0, z0, x1, y1, z1]
  // ----------------------------------------------------
  __recreateBufferGeometry(coords, colors, vrtxAttr) {
    if (!(coords && coords instanceof Array)) return;

    // prepare a colors array if it is not ready yet
    const coordLen = coords.length;
    if (!(colors && colors instanceof Array)) {
      colors = new Uint8Array(coordLen);
      for (let i = 0; i < coordLen; i += 3) {
        colors[i] = this.pointsColor.R;
        colors[i + 1] = this.pointsColor.G;
        colors[i + 2] = this.pointsColor.B;
      }
    }

    const itemSize = 3;
    const newPointsCount = Math.floor(coordLen / itemSize);

    // define the size of new attribute
    const newSize = (this.__pointsCount + newPointsCount + 100) * itemSize;

    // create a new buffer for coordinates, colors and attributes
    const newXYZ = new BufferAttribute(new Float32Array(newSize), itemSize);
    const newRGB = new BufferAttribute(new Uint8Array(newSize), itemSize, true);
    const newVisibility = new BufferAttribute(new Uint8Array(newSize / itemSize), 1);
    const newPntAttr = new Map();
    this.attributes.forEach((attr, key) => {
      if (attr.type === A_TYPE.Vertex) {
        if (attr.valueType === V_TYPE.Array || attr.valueType === V_TYPE.BooleanArray) {
          newPtCount.set(key, new Uint32Array(newSize / itemSize));
        } else if (attr.valueType === V_TYPE.BufferArray) {
          newPtCount.set(key, new Float64Array(newSize / itemSize));
        }
      }
    });

    const lastIdx = this.__pointsCount;

    // copy all existing coordinates and colors from the current geometry to the new one
    let oldGeometry;
    if (this.geometry.attributes.position) {
      oldGeometry = this.geometry;
      for (let i = 0; i < lastIdx; ++i) {
        newXYZ.copyAt(i, this.geometry.attributes.position, i);
        newRGB.copyAt(i, this.geometry.attributes.color, i);
        newVisibility.copyAt(i, this.geometry.attributes.visibility, i);
        this.attributes.forEach((attr, key) => {
          if (attr.type === A_TYPE.Vertex) {
            const pntAttrV = this.getAttributeAt(key, i);
            newPntAttr.get(key)[i] = pntAttrV;
          }
        })
      }
    }

    // add new coordinates and colors
    const start = lastIdx * itemSize;
    const end = start + newPointsCount * itemSize;
    for (let i = start; i < end; i += itemSize) {
      // coordinates
      newXYZ.array[i] = coords[i - start];
      newXYZ.array[i + 1] = coords[i - start + 1];
      newXYZ.array[i + 2] = coords[i - start + 2];

      // colors
      newRGB.array[i] = colors[i - start];
      newRGB.array[i + 1] = colors[i - start + 1];
      newRGB.array[i + 2] = colors[i - start + 2];

      // visibility
      newVisibility.array[i / itemSize] = 1;

      newPntAttr.forEach((newAttr, key) => {
        const indx = i / itemSize;
        const pntAttrV = vrtxAttr.has(key) ? vrtxAttr.get(key)[indx] : undefined;
        newAttr[indx] = pntAttrV;
      });
    }

    this.__pointsCount += newPointsCount;

    if (oldGeometry) {
      this.geometry = new BufferGeometry();
      oldGeometry.dispose();
    }
    this.geometry.setAttribute('position', newXYZ);
    this.geometry.setAttribute('color', newRGB);
    this.geometry.setAttribute('visibility', newVisibility);
    newPntAttr.forEach((newAttr, key) => {
      this.attributes.get(key).value = newAttr;
    });
    newPntAttr.clear();

    this.geometry.computeBoundingBox = this.computeBoundingBox;
    this.geometry.computeBoundingSphere = this.computeBoundingSphere;

    if (this.__pointLabelsExist) {
      this.__changePointLabels(this.__pointsCount - newPointsCount, newPointsCount, GlPointAction.Add);
    }

    this.geometry.setDrawRange(0, this.__pointsCount);
    this.geometry.computeBoundingSphere();
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (index !== undefined && index !== null &&
      index >= 0 && index < this.__pointsCount) {
      return true;
    }
    return false;
  }

  // -------------------------------------
  // check if numbers are equal
  // -------------------------------------
  __isEqual(first, second) {
    return Math.abs(first - second) < this.EPS;
  }

  // --------------------
  // dispose
  // --------------------
  dispose() {
    super.dispose();
    // points' labels
    if (this.pointLabels.length > 0) this.__destroyPointLabels();

    // datasource
    if (this.ds) this.ds.length = 0;

    this.geometry.dispose();
    this.material.dispose();
    if (this.material.map && this.material.map.dispose &&
      GlPointsBase.pointsTexture && this.material.map.id !== GlPointsBase.pointsTexture.id) {
      this.material.map.dispose();
    }
    if (GlPointsBase.pointsTexture && GlPointsBase.pointsTexture.dispose) {
      GlPointsBase.pointsTexture.dispose();
    }

    this.disposePivotPoint();
  }

  /**
   * setAttributeAt method creates attribute per vertex
   * @param {*} key - key of GlAttribute
   * @param {*} index - index of value per vertex
   * @param {*} value - attribute value of vertex
   */
  setAttributeAt(key, index, value) {
    let ptAttr = this.attributes.get(key);
    if (!ptAttr) {
      const size = Array.from({ length: this.__pointsCount + 100 });
      if (typeof (value) === 'string') {
        ptAttr = new GlAttribute(A_TYPE.Vertex, V_TYPE.Array, ['']);
        ptAttr.index = new Uint32Array(size);
      } else if (typeof (value) === 'boolean') {
        ptAttr = new GlAttribute(A_TYPE.Vertex, V_TYPE.BooleanArray, new Uint32Array(size));
      } else {
        ptAttr = new GlAttribute(A_TYPE.Vertex, V_TYPE.BufferArray, new Float64Array(size));
      }

      this.attributes.set(key, ptAttr);
    }

    if (ptAttr.isIndexed) {
      if (utils.isEmpty(value)) value = '';
      let fIndex = ptAttr.value.findIndex(v => v === value);
      if (fIndex === -1) {
        ptAttr.value.push(value);
        fIndex = ptAttr.value.length - 1;
      }
      ptAttr.index[index] = fIndex;
    } else {
      ptAttr.value[index] = value;
    }
  }

  setAttributes(key, index, array) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    if (array && array.length) {
      // set new attributes
      const last = index + array.length > this.__pointsCount ? this.__pointsCount : index + array.length;
      for (let i = index; i < last; ++i) {
        const pos = i - index;
        this.setAttributeAt(key, i, array[pos]);
      }
    }
  }

  getAttributeAt(key, index) {
    let ptAttr = this.attributes.get(key);
    if (ptAttr) {
      if (ptAttr.isIndexed) {
        return ptAttr.value[ptAttr.index[index]];
      } else {
        return ptAttr.value[index];
      }
    } else {
      console.error("Attribute not found");
    }

  }

  getAttributes(key, startIndex, endIndex) {
    const result = [];
    if (!this.__isValidIndex(startIndex)) {
      console.log('Ошибка: задан некорректный начальный индекс');
      return result;
    }
    if (!this.__isValidIndex(endIndex)) {
      console.log('Ошибка: задан некорректный конечный индекс');
      return result;
    }
    if (startIndex > endIndex) {
      console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
      return result;
    }

    const ptAttr = this.attributes.get(key);
    if (ptAttr) {
      for (let index = startIndex; index < endIndex + 1; index++) {
        if (ptAttr.isIndexed) {
          result.push(ptAttr.value[ptAttr.index[index]]);
        } else {
          result.push(ptAttr.value[index]);
        }
      }
    } else {
      console.error("Attribute not found");
    }

    return result;
  }

  // -------------------------------------
  // setColor() / setColors()
  // -------------------------------------
  setColor(index, color) {
    this.setColors(index, color);
  }

  setColors(index, array) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    const rgb = this.geometry.attributes.color;
    if (rgb) {
      // adjust colors as: [r0, g0, b0, r1, g1, b1, ...]
      const colors = this.__validateColors(array);
      if (colors && colors.length) {
        const ptCount = colors.length / rgb.itemSize;

        // set new colors
        const last = index + ptCount > this.__pointsCount ?
          this.__pointsCount * rgb.itemSize : (index + ptCount) * rgb.itemSize;
        let pos = 0;
        const maxColor = colors.reduce((a, b) => Math.max(a, b));
        for (let i = index; i < last; i += 3) {
          rgb.array[i] = maxColor > 1 ? Math.round(colors[pos]) : Math.round(colors[pos] * 255);
          rgb.array[i + 1] = maxColor > 1 ? Math.round(colors[pos + 1]) : Math.round(colors[pos + 1] * 255);
          rgb.array[i + 2] = maxColor > 1 ? Math.round(colors[pos + 2]) : Math.round(colors[pos + 2] * 255);
          pos += 3;
        }

        rgb.needsUpdate = true;
      }
    }
  }

  getColor(index) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    this.getColors(index, index, asFlatArray);
  }

  getColors(startIndex, endIndex) {
    const result = [];
    if (!this.__isValidIndex(startIndex)) {
      console.log('Ошибка: задан некорректный начальный индекс');
      return result;
    }
    if (!this.__isValidIndex(endIndex)) {
      console.log('Ошибка: задан некорректный конечный индекс');
      return result;
    }
    if (startIndex > endIndex) {
      console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
      return result;
    }

    const rgb = this.geometry.attributes.color;
    if (rgb) {
      for (let i = startIndex; i <= endIndex; i++) {
        const found = this.selectedPoints.get(i);
        if (found) {
          result.push(found.R, found.G, found.B);
        } else {
          result.push(
            rgb.array[i * 3] > 1 ? Math.round(rgb.array[i * 3]) : Math.round(rgb.array[i * 3] * 255),
            rgb.array[i * 3 + 1] > 1 ? Math.round(rgb.array[i * 3 + 1]) : Math.round(rgb.array[i * 3 + 1] * 255),
            rgb.array[i * 3 + 2] > 1 ? Math.round(rgb.array[i * 3 + 2]) : Math.round(rgb.array[i * 3 + 2] * 255)
          );
        }
      }
    }
    return result;
  }

  // -------------------------------------
  // __setColors()
  // this method sets the colors without
  // validating index and color values
  // assuming that they are given as
  // [r0, g0, b0, r1, g1, b1, ...]
  // -------------------------------------
  __setColors(index, colors) {
    const rgb = this.geometry.attributes.color;
    if (rgb) {
      const ptCount = colors.length / rgb.itemSize;

      // set new colors
      const last = index + ptCount > this.__pointsCount ?
        this.__pointsCount * rgb.itemSize : (index + ptCount) * rgb.itemSize;
      let pos = 0;
      for (let i = index * rgb.itemSize; i < last; i += 3) {
        rgb.array[i] = colors[pos];
        rgb.array[i + 1] = colors[pos + 1];
        rgb.array[i + 2] = colors[pos + 2];
        pos += 3;
      }
      rgb.needsUpdate = true;
    }
  }

  setPointsColor(clr) {
    const rgb = this.geometry.attributes.color;
    if (rgb) {
      // adjust colors as: [r0, g0, b0, r1, g1, b1, ...]
      const color = this.__validateColors(clr);
      if (color) {
        this.pointsColor.fromArray([color[0], color[1], color[2]]);
        this.pointsColor.R = Math.round(this.pointsColor.r * 255);
        this.pointsColor.G = Math.round(this.pointsColor.g * 255);
        this.pointsColor.B = Math.round(this.pointsColor.b * 255);

        const last = this.__pointsCount * rgb.itemSize;
        for (let i = 0; i < last; i += 3) {
          rgb.array[i] = this.pointsColor.R;
          rgb.array[i + 1] = this.pointsColor.G;
          rgb.array[i + 2] = this.pointsColor.B;
        }

        rgb.needsUpdate = true;
      }
    }
  }

  // -------------------------------------
  // setPoint() / setPoints()
  // -------------------------------------
  setPoint(index, coord) {
    this.setPoints(index, coord);
  }

  setPoints(index, array) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    const xyz = this.geometry.attributes.position;
    if (xyz) {
      // adjust coordinates as: [x0, y0, z0, x1, y1, z1]
      const coords = this.__validateCoordinates(array, index);
      if (coords && coords.length) {
        const ptCount = coords.length / xyz.itemSize;

        // set new coordinates
        const last = index + ptCount > this.__pointsCount ? this.__pointsCount : index + ptCount;
        for (let i = index; i < last; ++i) {
          const pos = (i - index) * xyz.itemSize;
          xyz.setXYZ(i, coords[pos], coords[pos + 1], coords[pos + 2]);
        }

        xyz.needsUpdate = true;

        if (this.__pointLabelsExist) {
          this.__changePointLabels(index, ptCount, GlPointAction.Set);
        }

        this.geometry.computeBoundingSphere();
      }
    }
  }

  // -------------------------------------
  // addPoint() / addPoints()
  // -------------------------------------
  addPoint(point, color) {
    this.addPoints(point, color);
  }

  addPoints(array, arrColors) {
    // adjust coordinates as: [x0, y0, z0, x1, y1, z1]
    const coords = this.__validateCoordinates(array);
    if (coords && coords.length) {
      const coordLen = coords.length;

      // validate / prepare colors
      let colors;
      if (arrColors) colors = this.__validateColors(arrColors);
      if (colors && colors.length < coordLen) {
        const addCount = Math.floor(coordLen / 3) - Math.floor(colors.length / 3);
        for (let i = 0; i < addCount; i++) {
          colors.push(this.pointsColor.R, this.pointsColor.G, this.pointsColor.B);
        }
      }

      // now start adding points to the end of a line
      if (this.geometry.attributes.position) {
        const xyz = this.geometry.attributes.position;
        const rgb = this.geometry.attributes.color;
        const visibility = this.geometry.attributes.visibility;

        const newPointsCount = coordLen / xyz.itemSize;

        if (this.__pointsCount + newPointsCount <= xyz.count) {
          const lastIdx = this.__pointsCount;

          // add new points coordinates and colors
          const start = lastIdx * xyz.itemSize;
          const end = start + newPointsCount * xyz.itemSize;
          for (let i = start; i < end; i += 3) {
            visibility.setX(i / 3, 1);
            xyz.array[i] = coords[i - start];
            xyz.array[i + 1] = coords[i - start + 1];
            xyz.array[i + 2] = coords[i - start + 2];

            if (colors) {
              rgb.array[i] = colors[i - start];
              rgb.array[i + 1] = colors[i - start + 1];
              rgb.array[i + 2] = colors[i - start + 2];
            } else {
              rgb.array[i] = this.pointsColor.R;
              rgb.array[i + 1] = this.pointsColor.G;
              rgb.array[i + 2] = this.pointsColor.B;
            }

            this.attributes.forEach((attr, key) => {
              if (attr.type === A_TYPE.Vertex) this.setAttributeAt(key, i / xyz.itemSize, undefined);
            })
          }
          this.__pointsCount += newPointsCount;

          this.geometry.setDrawRange(0, this.__pointsCount);
          xyz.needsUpdate = true;
          rgb.needsUpdate = true;
          visibility.needsUpdate = true;

          if (this.__pointLabelsExist) {
            this.__changePointLabels(this.__pointsCount - newPointsCount, newPointsCount, GlPointAction.Add);
          }

          this.geometry.computeBoundingSphere();
        } else {
          // the (position) BufferAttribute's size is not enough to add new
          // coordinates. Since the buffer size can't be changed in order
          // to re-size the BufferAttribute we'll create a new
          // BufferGeometry and dispose the current one
          this.__recreateBufferGeometry(coords, colors);
        }
      } else {
        this.__recreateBufferGeometry(coords, colors);
      }
    }
  }

  // -------------------------------------
  // insertPoint() / insertPoints()
  // -------------------------------------
  insertPoint(index, point, color) {
    this.insertPoints(index, point, color);
  }

  insertPoints(index, array, arrColors) {
    if (index === 0 && this.__pointsCount === 0) {
      this.addPoints(array, arrColors);
    } else {
      if (!this.__isValidIndex(index)) {
        console.log('Ошибка: задан некорректный индекс');
        return;
      }

      const coords = this.__validateCoordinates(array, index);
      if (coords && coords.length) {
        const coordLen = coords.length;

        // validate / prepare colors
        let colors;
        if (arrColors) colors = this.__validateColors(arrColors);
        if (!(colors && colors.length)) {
          colors = new Uint8Array(coordLen);
          for (let i = 0; i < coordLen; i += 3) {
            colors[i] = this.pointsColor.R;
            colors[i + 1] = this.pointsColor.G;
            colors[i + 2] = this.pointsColor.B;
          }
        } else if (colors.length < coordLen) {
          const addCount = Math.floor(coordLen / 3) - Math.floor(colors.length / 3);
          for (let i = 0; i < addCount; i++) {
            colors.push(this.pointsColor.R, this.pointsColor.G, this.pointsColor.B);
          }
        } else if (colors && colors.length > coordLen) {
          for (let i = 0; i < colors.length; i++) {
            colors[i] = colors[i] > 1 ? Math.round(colors[i]) : Math.round(colors[i] * 255);
          }
        }

        if (this.geometry.attributes.position) {
          const xyz = this.geometry.attributes.position;
          const rgb = this.geometry.attributes.color;

          const newPointsCount = coords.length / xyz.itemSize;
          if (this.__pointsCount + newPointsCount <= xyz.count) {

            const insertStart = index * xyz.itemSize;
            const insertEnd = insertStart + newPointsCount * xyz.itemSize;

            // move existing points and colors
            const moveStart = this.__pointsCount * xyz.itemSize - 1;
            const moveEnd = index * xyz.itemSize;
            const moveSize = newPointsCount * xyz.itemSize;
            for (let i = moveStart; i >= moveEnd; --i) {
              xyz.array[i + moveSize] = xyz.array[i];
              rgb.array[i + moveSize] = rgb.array[i];

              this.attributes.forEach((attr, key) => {
                const attrI = i / xyz.itemSize;
                const attrMs = moveSize / xyz.itemSize;
                if (attr.type === A_TYPE.Vertex) {
                  const attrValue = this.getAttributeAt(key, attrI);
                  this.setAttributeAt(key, attrI + attrMs, attrValue);
                }
              })
            }

            // add new points coordinates and colors
            for (let i = insertStart; i < insertEnd; i += 3) {
              xyz.array[i] = coords[i - insertStart];
              xyz.array[i + 1] = coords[i - insertStart + 1];
              xyz.array[i + 2] = coords[i - insertStart + 2];

              rgb.array[i] = colors[i - insertStart];
              rgb.array[i + 1] = colors[i - insertStart + 1];
              rgb.array[i + 2] = colors[i - insertStart + 2];

              this.attributes.forEach((attr, key) => {
                if (attr.type === A_TYPE.Vertex) {
                  this.setAttributeAt(key, i / xyz.itemSize, undefined);
                }
              })
            }
            this.__pointsCount += newPointsCount;

            this.geometry.setDrawRange(0, this.__pointsCount);
            xyz.needsUpdate = true;
            rgb.needsUpdate = true;

            if (this.__pointLabelsExist) {
              this.__changePointLabels(index, (insertEnd - insertStart) / xyz.itemSize, GlPointAction.Insert);
            }

            this.geometry.computeBoundingSphere();
          } else {
            // the (position) BufferAttribute's size is not enough to add new
            // coordinates. Since the buffer size can't be changed in order
            // to re-size the BufferAttribute we'll create a new
            // BufferGeometry and dispose the current one
            const newCoordsSize = xyz.array.length + coords.length - 3;
            const newCoords = Array(newCoordsSize).fill(0.0);
            const newColors = new Uint8Array(newCoordsSize);
            const breakPoint = index * xyz.itemSize;
            let i; let j;
            for (i = 0; i < breakPoint; i += 3) {
              newCoords[i] = xyz.array[i];
              newCoords[i + 1] = xyz.array[i + 1];
              newCoords[i + 2] = xyz.array[i + 2];

              newColors[i] = rgb.array[i];
              newColors[i + 1] = rgb.array[i + 1];
              newColors[i + 2] = rgb.array[i + 2];
            }
            for (j = 0; j < coords.length; j += 3) {
              newCoords[j + i] = coords[j];
              newCoords[j + i + 1] = coords[j + 1];
              newCoords[j + i + 2] = coords[j + 2];

              newColors[j + i] = colors[j];
              newColors[j + i + 1] = colors[j + 1];
              newColors[j + i + 2] = colors[j + 2];
            }
            j += i;
            for (i = breakPoint; i < xyz.length; i += 3) {
              newCoords[j] = xyz.array[i];
              newCoords[j + 1] = xyz.array[i + 1];
              newCoords[j + 2] = xyz.array[i + 2];

              newColors[j] = rgb.array[i];
              newColors[j + 1] = rgb.array[i + 1];
              newColors[j + 2] = rgb.array[i + 2];
              j += 3;
            }
            this.__pointsCount = 0;
            this.__recreateBufferGeometry(newCoords, newColors);
          }
        } else {
          this.__recreateBufferGeometry(coords, colors);
        }
      }
    }
  }

  // -----------------------------------------------------------------
  // insertPointsRanges(coords, rangesGroup)
  //
  // -----------------------------------------------------------------
  insertPointsRanges(newCoords, newRGB, pntAttributes, rangesGroup, pntNames) {
    if (!rangesGroup || (rangesGroup && !rangesGroup.length)) return;

    const xyz = this.geometry.attributes.position;
    const rgb = this.geometry.attributes.color;
    let newPtCount = this.__pointsCount;
    let changedPointQ = 0;
    if (xyz && rgb) {
      const intervals = [];
      let i = 0;
      const cnt = rangesGroup.length;
      if (cnt === 0) return;

      for (i = 0; i < cnt; i++) {
        const range = rangesGroup[i];

        if (!(range.start !== undefined && range.start !== null &&
          range.start >= 0)) {
          console.log('Ошибка: задан некорректный индекс');
          continue;
        }
        if (!(range.end !== undefined && range.end !== null &&
          range.end >= 0)) {
          console.log('Ошибка: задан некорректный индекс');
          continue;
        }
        if (range.start > range.end) {
          console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
          continue;
        }

        if (range.start > this.__pointsCount && i !== 0 && range.start > newPtCount) {
          console.log('Ошибка: задан некорректный индекс');
          continue;
        }

        newPtCount += range.end - range.start + 1;
        changedPointQ += range.end - range.start + 1;

        const pos = (range.end + 1) * xyz.itemSize;
        intervals.push({ start: pos, end: pos });

        if (i === 0) continue;

        intervals[i - 1].end = range.start * xyz.itemSize - 1;
      }

      if (intervals[intervals.length - 1].start === newPtCount * xyz.itemSize) {
        intervals.splice(intervals.length - 1, 1);
      } else {
        intervals[intervals.length - 1].end = newPtCount * xyz.itemSize - 1;
      }

      if (rangesGroup[0].start !== 0) {
        intervals.splice(0, 0, { start: 0, end: rangesGroup[0].start * xyz.itemSize - 1 });
      }

      // gather coordinates and colors
      const coords = new Float32Array(newPtCount * xyz.itemSize);
      const rgbs = new Uint8Array(newPtCount * rgb.itemSize);
      const attrs = new Map();
      this.attributes.forEach((attr, key) => {
        if (attr.type === A_TYPE.Vertex) {
          if (attr.valueType === V_TYPE.Array) {
            attrs.set(key, new Array(newPtCount));
          } else if (attr.valueType === V_TYPE.BooleanArray) {
            attrs.set(key, new Uint32Array(newPtCount));
          } else if (attr.valueType === V_TYPE.BufferArray) {
            attrs.set(key, new Float64Array(newPtCount));
          }
        }
      });

      let coordInd = 0;
      let rgbInd = 0;
      let newCoordPos = 0;
      let newRGBPos = 0;
      let oldCoordInd = 0;
      let oldRGBInd = 0;

      if (rangesGroup[0].start === 0) {
        if (rangesGroup.length > intervals.length) {
          for (let i = 0; i < rangesGroup.length; i++) {
            newCoords[i] = this.__validateCoordinates(newCoords[i]);
            for (let j = rangesGroup[i].start; j <= rangesGroup[i].end; j++) {
              if (!(coordInd % xyz.itemSize)) {
                this.attributes.forEach((attr, key) => {
                  attrs.get(key)[coordInd / xyz.itemSize] = pntAttributes[key][i][newCoordPos / xyz.itemSize];
                });
              }

              coords[coordInd++] = newCoords[i][newCoordPos++];
              coords[coordInd++] = newCoords[i][newCoordPos++];
              coords[coordInd++] = newCoords[i][newCoordPos++];
              rgbs[rgbInd++] = newRGB[i][newRGBPos++];
              rgbs[rgbInd++] = newRGB[i][newRGBPos++];
              rgbs[rgbInd++] = newRGB[i][newRGBPos++];
            }
            newCoordPos = 0;
            newRGBPos = 0;

            if (i < intervals.length) {
              for (let j = intervals[i].start; j <= intervals[i].end; j++) {
                if (!(coordInd % xyz.itemSize)) {
                  this.attributes.forEach((attr, key) => {
                    attrs.get(key)[coordInd / xyz.itemSize] = this.getAttributeAt(key, oldCoordInd / xyz.itemSize)
                  });
                }
                coords[coordInd++] = xyz.array[oldCoordInd++];
                rgbs[rgbInd++] = rgb.array[oldRGBInd++];
              }
            }
          }
        } else {
          for (let i = 0; i < intervals.length; i++) {
            if (i < rangesGroup.length) {
              newCoords[i] = this.__validateCoordinates(newCoords[i]);
              for (let j = rangesGroup[i].start; j <= rangesGroup[i].end; j++) {
                if (!(coordInd % xyz.itemSize)) {
                  this.attributes.forEach((attr, key) => {
                    attrs.get(key)[coordInd / xyz.itemSize] = pntAttributes[key][i][newCoordPos / xyz.itemSize];
                  });
                }
                coords[coordInd++] = newCoords[i][newCoordPos++];
                coords[coordInd++] = newCoords[i][newCoordPos++];
                coords[coordInd++] = newCoords[i][newCoordPos++];
                rgbs[rgbInd++] = newRGB[i][newRGBPos++];
                rgbs[rgbInd++] = newRGB[i][newRGBPos++];
                rgbs[rgbInd++] = newRGB[i][newRGBPos++];
              }
              newCoordPos = 0;
              newRGBPos = 0;
            }

            if (i < intervals.length) {
              for (let j = intervals[i].start; j <= intervals[i].end; j++) {
                if (!(coordInd % xyz.itemSize)) {
                  this.attributes.forEach((attr, key) => {
                    attrs.get(key)[coordInd / xyz.itemSize] = this.getAttributeAt(key, oldCoordInd / xyz.itemSize)
                  });
                }
                coords[coordInd++] = xyz.array[oldCoordInd++];
                rgbs[rgbInd++] = rgb.array[oldRGBInd++];
              }
            }
          }
        }
      } else {
        if (rangesGroup.length > intervals.length) {
          for (let i = 0; i < rangesGroup.length; i++) {
            if (i < intervals.length) {
              for (let j = intervals[i].start; j <= intervals[i].end; j++) {
                if (!(coordInd % xyz.itemSize)) {
                  this.attributes.forEach((attr, key) => {
                    attrs.get(key)[coordInd / xyz.itemSize] = this.getAttributeAt(key, oldCoordInd / xyz.itemSize)
                  });
                }
                coords[coordInd++] = xyz.array[oldCoordInd++];
                rgbs[rgbInd++] = rgb.array[oldRGBInd++];
              }
            }

            newCoords[i] = this.__validateCoordinates(newCoords[i]);
            for (let j = rangesGroup[i].start; j <= rangesGroup[i].end; j++) {
              this.attributes.forEach((attr, key) => {
                attrs.get(key)[coordInd / xyz.itemSize] = pntAttributes[key][i][newCoordPos / xyz.itemSize];
              });
              coords[coordInd++] = newCoords[i][newCoordPos++];
              coords[coordInd++] = newCoords[i][newCoordPos++];
              coords[coordInd++] = newCoords[i][newCoordPos++];
              rgbs[rgbInd++] = newRGB[i][newRGBPos++];
              rgbs[rgbInd++] = newRGB[i][newRGBPos++];
              rgbs[rgbInd++] = newRGB[i][newRGBPos++];
            }
            newCoordPos = 0;
            newRGBPos = 0;
          }
        } else {
          for (let i = 0; i < intervals.length; i++) {
            for (let j = intervals[i].start; j <= intervals[i].end; j++) {
              if (!(coordInd % xyz.itemSize)) {
                this.attributes.forEach((attr, key) => {
                  attrs.get(key)[coordInd / xyz.itemSize] = this.getAttributeAt(key, oldCoordInd / xyz.itemSize)
                });
              }
              coords[coordInd++] = xyz.array[oldCoordInd++];
              rgbs[rgbInd++] = rgb.array[oldRGBInd++];
            }

            if (i < rangesGroup.length) {
              newCoords[i] = this.__validateCoordinates(newCoords[i]);
              for (let j = rangesGroup[i].start; j <= rangesGroup[i].end; j++) {
                if (!(coordInd % xyz.itemSize)) {
                  this.attributes.forEach((attr, key) => {
                    attrs.get(key)[coordInd / xyz.itemSize] = pntAttributes[key][i][newCoordPos / xyz.itemSize];
                  });
                }
                coords[coordInd++] = newCoords[i][newCoordPos++];
                coords[coordInd++] = newCoords[i][newCoordPos++];
                coords[coordInd++] = newCoords[i][newCoordPos++];
                rgbs[rgbInd++] = newRGB[i][newRGBPos++];
                rgbs[rgbInd++] = newRGB[i][newRGBPos++];
                rgbs[rgbInd++] = newRGB[i][newRGBPos++];
              }
              newCoordPos = 0;
              newRGBPos = 0;
            }
          }
        }
      }

      const bufferSize = xyz.count;
      for (let i = 0; i < bufferSize && i < newPtCount; i++) {
        xyz.array[i * 3] = coords[i * 3];
        xyz.array[i * 3 + 1] = coords[i * 3 + 1];
        xyz.array[i * 3 + 2] = coords[i * 3 + 2];
        rgb.array[i * 3] = rgbs[i * 3];
        rgb.array[i * 3 + 1] = rgbs[i * 3 + 1];
        rgb.array[i * 3 + 2] = rgbs[i * 3 + 2];
        this.attributes.forEach((attr, key) => {
          this.setAttributeAt(key, i, attrs.get(key)[i]);
        });
      }

      if (newPtCount > xyz.count) {
        const recreateCoord = new Float32Array((newPtCount - bufferSize) * 3);
        const recreateColor = new Float32Array((newPtCount - bufferSize) * 3);
        for (let i = bufferSize; i < newPtCount; i++) {
          recreateCoord[(i - bufferSize) * 3] = coords[i * 3];
          recreateCoord[(i - bufferSize) * 3 + 1] = coords[i * 3 + 1];
          recreateCoord[(i - bufferSize) * 3 + 2] = coords[i * 3 + 2];
          recreateColor[(i - bufferSize) * 3] = rgbs[i * 3];
          recreateColor[(i - bufferSize) * 3 + 1] = rgbs[i * 3 + 1];
          recreateColor[(i - bufferSize) * 3 + 2] = rgbs[i * 3 + 2];
          // todo recreate withing attributes
        }
        this.__recreateBufferGeometry(recreateCoord, recreateColor);
      } else {
        // set a new points count
        this.__pointsCount = newPtCount;

        this.geometry.setDrawRange(0, this.__pointsCount);
        xyz.needsUpdate = true;
        rgb.needsUpdate = true;

        this.geometry.computeBoundingSphere();
      }

      this.__changePointLabels(rangesGroup[0].start, changedPointQ, GlPointAction.InsertRanges, rangesGroup, pntNames);
    }
  }

  // -----------------------------------------------------------------
  // insertPointsRanges(coords, rangesGroup)
  //
  // -----------------------------------------------------------------
  setPointsRanges(rangesGroup) {
    if (!rangesGroup || (rangesGroup && !rangesGroup.length)) return;

    const xyz = this.geometry.attributes.position;
    if (xyz) {
      const cnt = rangesGroup.length;
      if (cnt === 0) return;

      for (let i = 0; i < cnt; i++) {
        const range = rangesGroup[i];

        if (!(range.start !== undefined && range.start !== null &&
          range.start >= 0 && range.start < this.__pointsCount)) {
          console.log('Ошибка: задан некорректный индекс');
          continue;
        }
        if (!(range.end !== undefined && range.end !== null &&
          range.end >= 0 && range.end < this.__pointsCount)) {
          console.log('Ошибка: задан некорректный индекс');
          continue;
        }
        if (range.start > range.end) {
          console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
          continue;
        }
      }

      xyz.needsUpdate = true;
      this.geometry.computeBoundingSphere();
    }
  }

  // -------------------------------------
  // deletePoint() / deletePoints()
  // -------------------------------------
  deletePoint(index) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    this.deletePoints(index, index);
  }

  deletePoints(startIndex, endIndex) {
    if (!this.__isValidIndex(startIndex)) {
      console.log('Ошибка: задан некорректный начальный индекс');
      return;
    }
    if (!this.__isValidIndex(endIndex)) {
      console.log('Ошибка: задан некорректный конечный индекс');
      return;
    }
    if (startIndex > endIndex) {
      console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
      return;
    }

    const xyz = this.geometry.attributes.position;
    const rgb = this.geometry.attributes.color;
    if (xyz && rgb) {
      const start = (endIndex + 1) * xyz.itemSize;
      const end = this.__pointsCount * xyz.itemSize;
      const delCount = (endIndex - startIndex + 1) * xyz.itemSize;

      // move coordinates and colors
      for (let i = start; i < end; ++i) {
        xyz.array[i - delCount] = xyz.array[i];
        rgb.array[i - delCount] = rgb.array[i];

        if (!(i % xyz.itemSize)) {
          this.attributes.forEach((attr, key) => {
            const attrIndex = i / xyz.itemSize;
            const attrDelCount = delCount / xyz.itemSize;
            if (attr.type === A_TYPE.Vertex) {
              const attrV = this.getAttributeAt(key, attrIndex);
              this.setAttributeAt(key, attrIndex - attrDelCount, attrV);
            }
          })
        }
      }

      const changedPointQuantity = endIndex - startIndex + 1;
      // set a new points count
      this.__pointsCount -= changedPointQuantity;

      xyz.setXYZ(this.__pointsCount, 0, 0, 0);
      this.geometry.setDrawRange(0, this.__pointsCount);
      xyz.needsUpdate = true;
      rgb.needsUpdate = true;

      if (this.__pointsCount === 0) this.resetPivotPoint();

      if (this.__pointLabelsExist) {
        this.__changePointLabels(startIndex, changedPointQuantity, GlPointAction.Delete);
      }

      this.geometry.computeBoundingSphere();
    }
  }

  // -----------------------------------------------------------------
  // deletePointsRanges(rangesGroup)
  //
  // The 'rangesGroup' argument must be an array of objects that
  // have the structure {start: startIndex, end: endIndex}), and
  // the array has to be sorted in ascending order
  // Example: [
  //     {start:   23, end:  140},
  //     {start: 1301, end: 1400},
  //     {start: 3900, end: 3970},
  //     {start: 4085, end: 4090},
  // ]
  // -----------------------------------------------------------------
  deletePointsRanges(rangesGroup) {
    if (!rangesGroup || (rangesGroup && !rangesGroup.length)) return;

    const xyz = this.geometry.attributes.position;
    const rgb = this.geometry.attributes.color;
    if (xyz && rgb) {
      let bufSize = 0;
      const intervals = [];
      let i = 0;
      let cnt = rangesGroup.length;
      let changedPointQ = 0;
      const itemSize = xyz.itemSize;

      for (i = 0; i < cnt; i++) {
        const range = rangesGroup[i];

        if (!(range.start !== undefined && range.start !== null &&
          range.start >= 0 && range.start < this.__pointsCount)) {
          console.log('Ошибка: задан некорректный индекс');
          continue;
        }
        if (!(range.end !== undefined && range.end !== null &&
          range.end >= 0 && range.end < this.__pointsCount)) {
          console.log('Ошибка: задан некорректный индекс');
          continue;
        }
        if (range.start > range.end) {
          console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
          continue;
        }

        changedPointQ += range.end - range.start + 1;

        const pos = (range.end + 1) * itemSize;
        intervals.push({ start: pos, end: pos });

        if (i === 0) continue;

        intervals[i - 1].end = range.start * itemSize - 1;
        bufSize += intervals[i - 1].end - intervals[i - 1].start + 1;
      }

      if (intervals[i - 1].start < this.__pointsCount * itemSize) {
        intervals[i - 1].end = this.__pointsCount * itemSize - 1;
        bufSize += intervals[i - 1].end - intervals[i - 1].start + 1;
      } else {
        intervals.pop();
      }

      // gather coordinates, colors, point's attributes
      const coords = new Float32Array(bufSize);
      const rgbs = new Uint8Array(bufSize);
      const attrs = new Map();
      this.attributes.forEach((attr, key) => {
        if (attr.type === A_TYPE.Vertex) {
          if (attr.valueType === V_TYPE.Array || attr.valueType === V_TYPE.BooleanArray) {
            attrs.set(key, new Uint32Array(bufSize / itemSize));
          } else if (attr.valueType === V_TYPE.BufferArray) {
            attrs.set(key, new Float64Array(bufSize / itemSize));
          }
        }
      })

      let pos = 0;
      for (const interval of intervals) {
        for (let i = interval.start; i <= interval.end; i++) {
          coords[pos] = xyz.array[i];
          rgbs[pos] = rgb.array[i];

          // gain each point attribute
          if (!(i % itemSize)) {
            this.attributes.forEach((attr, key) => {
              if (attr.type === A_TYPE.Vertex) {
                let attrV = this.getAttributeAt(key, i / itemSize);
                if (attr.isIndexed) attrV = i / itemSize;
                attrs.get(key)[pos / itemSize] = attrV;
              }
            })
          }

          pos++;
        }
      }

      // move coordinates and colors
      pos = rangesGroup[0].start * itemSize;
      const newPtCount = rangesGroup[0].start + Math.floor(bufSize / itemSize);
      for (i = 0, cnt = coords.length; i < cnt; i++) {
        xyz.array[i + pos] = coords[i];
        rgb.array[i + pos] = rgbs[i];

        if (!(i % itemSize)) {
          this.attributes.forEach((attr, key) => {
            if (attr.type === A_TYPE.Vertex) {
              let attrV = attrs.get(key)[i / itemSize];
              if (attr.isIndexed) attrV = this.getAttributeAt(key, attrV);
              this.setAttributeAt(key, (i + pos) / itemSize, attrV);
            }
          })
        }
      }

      // set a new points count
      this.__pointsCount = newPtCount;

      if (this.__pointsCount === 0) this.resetPivotPoint();

      this.geometry.setDrawRange(0, this.__pointsCount);
      xyz.needsUpdate = true;
      rgb.needsUpdate = true;

      this.geometry.computeBoundingSphere();

      this.__changePointLabels(rangesGroup[0].start, changedPointQ, GlPointAction.DeleteRanges, rangesGroup);
    }
  }

  // -------------------------------------
  // deleteAllPoints()
  // -------------------------------------
  deleteAllPoints() {
    const xyz = this.geometry.attributes.position;
    if (xyz) {
      this.__pointsCount = 0;
      this.geometry.setDrawRange(0, this.__pointsCount);
      this.resetPivotPoint();

      if (this.__pointLabelsExist) {
        this.__changePointLabels(0, this.__pointsCount, GlPointAction.Delete);
      }

      this.geometry.computeBoundingSphere();
    }
  }

  setGeometryIndex(indexArray) {
    this.geometry.setIndex(indexArray);
    this.__pointsCount = indexArray.length;
    this.geometry.setDrawRange(0, this.__pointsCount);
  }

  deleteIndexedPointsByVertexIndex(index) {
    this.deleteIndexedPointsByVertexIndexRange(index, index);
  }

  deleteIndexedPointsByVertexIndexRange(startIndex, endIndex) {
    if (this.geometry.index) {
      const indexArray = this.geometry.index.array;
      const length = this.__pointsCount;
      const delCount = endIndex - startIndex + 1;
      for (let i = 0, j = 0; j < length; j += 1) {
        const pointIncluded = indexArray[j] >= startIndex && indexArray[j] <= endIndex;
        if (pointIncluded) {
          this.__pointsCount -= 1;
          continue;
        }

        indexArray[i] = indexArray[j];

        if (indexArray[i] > endIndex) indexArray[i] -= delCount;

        i += 1;
      }

      this.geometry.index.needsUpdate = true;
      this.geometry.setDrawRange(0, this.__pointsCount);

      // todo: reset pivot point?
      // todo: change labels?
    }
  }

  // -------------------------------------
  // getPointAt()
  // -------------------------------------
  getPointAt(index, asFlatArray) {
    if (this.__isValidIndex(index)) {
      const xyz = this.geometry.attributes.position;
      if (xyz) {
        const point = asFlatArray ? [] : new Vector3();
        const start = index * xyz.itemSize;
        if (asFlatArray) {
          this.__v3.set(xyz.array[start], xyz.array[start + 1], xyz.array[start + 2]);
          this.__v3.applyMatrix4(this.matrixWorld);
          point.push(this.__v3.x, this.__v3.y, this.__v3.z);
        } else {
          point.set(xyz.array[start], xyz.array[start + 1], xyz.array[start + 2]);
          point.applyMatrix4(this.matrixWorld);
        }
        return point;
      }
      return null;
    }

    console.log('Ошибка: задан некорректный индекс');
    return null;
  }

  // -------------------------------------
  // getPoints()
  // -------------------------------------
  getPoints(startIndex, endIndex, asFlatArray) {
    const result = [];
    if (!this.__isValidIndex(startIndex)) {
      console.log('Ошибка: задан некорректный начальный индекс');
      return result;
    }
    if (!this.__isValidIndex(endIndex)) {
      console.log('Ошибка: задан некорректный конечный индекс');
      return result;
    }
    if (startIndex > endIndex) {
      console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
      return result;
    }

    const xyz = this.geometry.attributes.position;
    if (xyz) {
      const start = startIndex * xyz.itemSize;
      const end = (endIndex + 1) * xyz.itemSize;
      for (let i = start; i < end; i += 3) {
        this.__v3.set(xyz.array[i], xyz.array[i + 1], xyz.array[i + 2]);
        this.__v3.applyMatrix4(this.matrixWorld);

        if (asFlatArray) {
          result.push(this.__v3.x, this.__v3.y, this.__v3.z);
        } else {
          result.push(new Vector3(this.__v3.x, this.__v3.y, this.__v3.z));
        }
      }
    }
    return result;
  }

  // -------------------------------------
  // getPointsAsArray()
  // -------------------------------------
  getPointsAsArray(startIndex, endIndex) {
    const result = [];
    if (!this.__isValidIndex(startIndex)) {
      console.log('Ошибка: задан некорректный начальный индекс');
      return result;
    }
    if (!this.__isValidIndex(endIndex)) {
      console.log('Ошибка: задан некорректный конечный индекс');
      return result;
    }
    if (startIndex > endIndex) {
      console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
      return result;
    }

    const xyz = this.geometry.attributes.position;
    if (xyz) {
      const start = startIndex * xyz.itemSize;
      const end = (endIndex + 1) * xyz.itemSize;
      for (let i = start; i < end; i += 3) {
        this.__v3.set(xyz.array[i], xyz.array[i + 1], xyz.array[i + 2]);
        this.__v3.applyMatrix4(this.matrixWorld);
        result.push([this.__v3.x, this.__v3.y, this.__v3.z]);
      }
    }
    return result;
  }

  // ----------------------------------------
  // Find point index matching given point.
  // If no points found return an empty array
  // ----------------------------------------
  findPoint(point) {
    const pointIndices = [];
    const coords = this.__validateCoordinates(point);
    if (coords && coords.length) {
      if (this.geometry.attributes.position) {
        const xyz = this.geometry.attributes.position;
        for (let i = 0; i < this.__pointsCount; i++) {
          if (this.__isEqual(coords[0], xyz.getX(i)) &&
            this.__isEqual(coords[1], xyz.getY(i)) &&
            this.__isEqual(coords[2], xyz.getZ(i))) {
            pointIndices.push(i);
          }
        }
      }
    }
    return pointIndices;
  }

  // -----------------------------------
  // Find point indices that match with
  // given points. if no points found
  // return empty array
  // -----------------------------------
  findPoints(points) {
    const pointsIndices = [];
    const coords = this.__validateCoordinates(points);
    for (let i = 0; i < coords.length / 3; i++) {
      pointsIndices[i] = [];
    }
    if (coords && coords.length) {
      if (this.geometry.attributes.position) {
        const xyz = this.geometry.attributes.position;
        let k = 0;
        for (let i = 0; i < coords.length; i += 3) {
          for (let j = 0; j < this.__pointsCount; j++) {
            if (this.__isEqual(coords[i], xyz.getX(j)) &&
              this.__isEqual(coords[i + 1], xyz.getY(j)) &&
              this.__isEqual(coords[i + 2], xyz.getZ(j))) {
              pointsIndices[k].push(j);
            }
          }
          k++;
        }
      }
    }
    return pointsIndices;
  }

  setPointSize(size) {
    this.pointSize = size;
    this.material.size = size;
  }

  setPointsTexture(texture) {
    const currTexture = this.material.map;
    if (typeof texture === 'string' && currTexture.sourceName !== texture) {
      // get an appropriate image, which will be used as a texture
      const savedTexture = GlPointsBase.pointsTextures.get(texture);
      if (savedTexture) {
        if (this.material.map.id !== savedTexture.id) this.material.map.dispose();
        savedTexture.needsUpdate = true;
        this.material.map = savedTexture;
      } else {
        const symbolImage = ImageResources.getBase64(texture);
        if (symbolImage) {
          const pointsTexture = new Texture(symbolImage);
          pointsTexture.needsUpdate = true;
          pointsTexture.minFilter = LinearMipMapLinearFilter;
          pointsTexture.magFilter = LinearFilter;
          pointsTexture.sourceName = texture;

          if (this.material.map.id !== pointsTexture.id) this.material.map.dispose();
          this.material.map = pointsTexture;
          GlPointsBase.pointsTextures.set(texture, pointsTexture);
        }
      }
    }
  }
  // -------------------------------------
  // getPointsCount()
  // -------------------------------------
  getPointsCount() {
    return this.__pointsCount;
  }

  // -------------------------------------
  // showPoints()
  // -------------------------------------
  // point's index
  showPoints(flag, points) {
    const visibility = this.geometry.attributes.visibility;
    if (points) {
      points.forEach((value, key) => {
        visibility.setX(key, flag ? 1 : 0);
        if (this.__pointLabelsExist) this.pointLabels[key].fillOpacity = flag ? 1 : 0;
      });

      if (flag) {
        this.hiddenPointsCount -= points.size || points.length;
        this.visible = flag;
      } else {
        this.hiddenPointsCount += points.size || points.length;
      }

      this.hasHiddenPoints = this.hiddenPointsCount ? true : false;
      visibility.needsUpdate = true;
      return;
    }
  }

  setPointVisibility(index, flag) {
    const visibility = this.geometry.attributes.visibility;
    if (!this.__isValidIndex(index)) console.error("Not Valid Index");
    visibility.setX(index, flag ? 1 : 0);

    (flag) ? this.hiddenPointsCount++ : this.hiddenPointsCount--;
    this.hasHiddenPoints = this.hiddenPointsCount ? true : false;
    visibility.needsUpdate = true;
  }

  //  showPointsAll()
  showPointsAll() {
    this.visible = true;
    if (this.hasHiddenPoints === false) return;
    const visibility = this.geometry.attributes.visibility;
    for (let i = 0; i < this.__pointsCount; i++) {
      visibility.setX(i, 1);
      if (this.__pointLabelsExist) this.pointLabels[i].fillOpacity = 1;
    }

    this.hiddenPointsCount = 0;
    this.hasHiddenPoints = false;
    visibility.needsUpdate = true;
  }

  // -------------------------------------
  // ACTIONS ON POINT LABELS
  // -------------------------------------
  showPointLabels(flag, lblField) {
    if (lblField) {
      this.__destroyPointLabels();
      this.__createPointLabels(lblField);
    }
    if (flag && !this.__pointLabelsExist) {
      this.__createPointLabels();
    } else if (!flag && this.__pointLabelsExist) {
      this.__destroyPointLabels();
    }
  }

  __changePointLabels(index, changedPointQuantity, action, rangesGroup, pntNames) {
    const xyz = this.geometry.attributes.position;

    if (xyz) {
      if (pntNames === null || pntNames === undefined) {
        pntNames = [];
      } else if (!(pntNames instanceof Array)) {
        console.log('Чтобы добавить точку с именем, аргумент на имени точек должен быть массивом');
        pntNames = [];
      }

      if (!this.__pointLabelsExist) {
        if (this.pointNames && this.pointNames.length) {
          let c = 0;
          for (let i = 0; i < rangesGroup; i++) {
            if (rangesGroup[i].start < this.pointNames.length && rangesGroup[i].end < this.pointNames.length) {
              this.pointNames.splice(rangesGroup[i].start - c, rangesGroup[i].end - rangesGroup[i].start);
              c += rangesGroup[i].end - rangesGroup[i].start;
            }
          }
        }
      } else {
        const syncPromises = [];
        if (action === GlPointAction.Delete) {
          if (this.currentPointLabel === LabelField.MARK && !(this.pointNames && this.pointNames.length)) {
            for (let i = 0; i < changedPointQuantity; i++) {
              // this.remove(this.pointLabels[this.pointLabels.length - i - 1]);
              this.pointLabels[this.pointLabels.length - i - 1].dispose();
            }

            this.pointLabels.splice(this.pointLabels.length - changedPointQuantity, changedPointQuantity);

            for (let i = index; i < this.pointLabels.length; i++) {
              this.pointLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
            }
          } else {
            for (let i = 0; i < changedPointQuantity; i++) {
              // this.remove(this.pointLabels[index + i]);
              this.pointLabels[index + i].dispose();
            }
            this.pointLabels.splice(index, changedPointQuantity);
          }
        } else if (action === GlPointAction.DeleteRanges) {

          if (this.currentPointLabel === LabelField.MARK && !(this.pointNames && this.pointNames.length)) {
            for (let i = 0; i < changedPointQuantity; i++) {
              // this.remove(this.pointLabels[this.pointLabels.length - i - 1]);
              this.pointLabels[this.pointLabels.length - i - 1].dispose();
            }

            this.pointLabels.splice(this.pointLabels.length - changedPointQuantity, changedPointQuantity);
          } else {
            for (let i = 0; i < rangesGroup.length; i++) {
              for (let j = rangesGroup[i].start; j <= rangesGroup[i].end; j++) {
                // this.remove(this.pointLabels[j]);
                this.pointLabels[j].dispose();
              }
            }

            let c = 0;
            for (let i = 0; i < rangesGroup.length; i++) {
              this.pointLabels.splice(rangesGroup[i].start - c, rangesGroup[i].end - rangesGroup[i].start + 1);
              if (this.pointNames && this.pointNames.length) {
                this.pointNames.splice(rangesGroup[i].start - c, rangesGroup[i].end - rangesGroup[i].start + 1);
              }
              c += rangesGroup[i].end - rangesGroup[i].start + 1;
            }
          }

          for (let i = index; i < this.__pointsCount; i++) {
            this.pointLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
          }

        } else if (action === GlPointAction.Add) {
          for (let i = this.__pointsCount - changedPointQuantity; i < this.__pointsCount; i++) {
            const ind = i + this.numerationOffset;
            let coordLabel = ind.toString();

            if (this.currentPointLabel === LabelField.MARK && pntNames.length > changedPointQuantity) {
              coordLabel = pntNames[i - this.__pointsCount + changedPointQuantity];
            } else if (this.currentPointLabel !== LabelField.MARK) {
              const origPnt = this.getPointAt(i);

              if (this.currentPointLabel === LabelField.X) {
                coordLabel = origPnt.x.toFixed(3);
              } else if (this.currentPointLabel === LabelField.Y) {
                coordLabel = origPnt.y.toFixed(3);
              } else if (this.currentPointLabel === LabelField.Z) {
                coordLabel = origPnt.z.toFixed(3);
              }
            }

            const point = {
              x: xyz.getX(i),
              y: xyz.getY(i),
              z: xyz.getZ(i),
            };

            const label = new GlLabel({
              text: coordLabel,
              color: this.__pointLabelsColor,
              font: this.__pointLabelsFont,
              fontSize: this.fontSize,
              orientation: "camera"
            });

            // label.sync();
            syncPromises.push(label.sync());
            label.position.set(point.x, point.y, point.z);
            // this.add(label);
            this.pointLabels.push(label);
          }
        } else if (action === GlPointAction.Insert) {

          for (let i = index; i < this.__pointsCount - changedPointQuantity; i++) {
            this.pointLabels[i].position.set(xyz.getX(i + changedPointQuantity), xyz.getY(i + changedPointQuantity), xyz.getZ(i + changedPointQuantity));
          }

          for (let i = index; i < index + changedPointQuantity; i++) {
            const ind = i + this.numerationOffset;
            let coordLabel = ind.toString();

            const point = {
              x: xyz.getX(i),
              y: xyz.getY(i),
              z: xyz.getZ(i),
            };

            if (this.currentPointLabel === LabelField.MARK && pntNames.length > i - this.__pointsCount) {
              coordLabel = pntNames[i];
            } else if (this.currentPointLabel !== LabelField.MARK) {
              const origPnt = this.getPointAt(i);

              if (this.currentPointLabel === LabelField.X) {
                coordLabel = origPnt.x.toFixed(3);
              } else if (this.currentPointLabel === LabelField.Y) {
                coordLabel = origPnt.y.toFixed(3);
              } else if (this.currentPointLabel === LabelField.Z) {
                coordLabel = origPnt.z.toFixed(3);
              }
            }

            const label = new GlLabel({
              text: coordLabel,
              color: this.__pointLabelsColor,
              font: this.__pointLabelsFont,
              fontSize: this.fontSize,
              orientation: "camera"
            });

            // label.sync();
            syncPromises.push(label.sync());
            label.position.set(point.x, point.y, point.z);
            // this.add(label);
            this.pointLabels.splice(i, 0, label);
          }
        } else if (action === GlPointAction.InsertRanges) {
          if (this.currentPointLabel === LabelField.MARK && !(this.pointNames && this.pointNames.length)) {
            for (let i = this.__pointsCount - changedPointQuantity; i < this.__pointsCount; i++) {
              const ind = i + this.numerationOffset;
              const coordLabel = ind.toString();

              const point = {
                x: xyz.getX(i),
                y: xyz.getY(i),
                z: xyz.getZ(i),
              };

              const label = new GlLabel({
                text: coordLabel,
                color: this.__pointLabelsColor,
                font: this.__pointLabelsFont,
                fontSize: this.fontSize,
                orientation: "camera"
              });

              // label.sync();
              syncPromises.push(label.sync());
              label.position.set(point.x, point.y, point.z);
              // this.add(label);
              this.pointLabels.push(label);
            }
          } else {
            let c = 0;
            for (let i = 0; i < rangesGroup.length; i++) {
              let pos = 0;
              if (this.pointNames && this.pointNames.length >= rangesGroup[i].start) {
                for (let j = rangesGroup[i].start; j <= rangesGroup[i].end; j++) {
                  if (pntNames) {
                    this.pointNames.splice(j, 0, (pntNames[i] && pos < pntNames[i].length) ? pntNames[i][pos++] : (j + 1).toString());
                  }

                  let coordLabel = this.pointNames[j];

                  const origPnt = this.getPointAt(j);

                  if (this.currentPointLabel === LabelField.X) {
                    coordLabel = origPnt.x.toFixed(3);
                  } else if (this.currentPointLabel === LabelField.Y) {
                    coordLabel = origPnt.y.toFixed(3);
                  } else if (this.currentPointLabel === LabelField.Z) {
                    coordLabel = origPnt.z.toFixed(3);
                  }

                  const label = new GlLabel({
                    text: coordLabel,
                    color: this.__pointLabelsColor,
                    font: this.__pointLabelsFont,
                    fontSize: this.fontSize,
                    orientation: "camera"
                  });

                  // label.sync();
                  syncPromises.push(label.sync());
                  label.position.set(0, 0, 0);
                  // this.add(label);
                  this.pointLabels.splice(j, 0, label);
                }
              } else {
                for (let j = rangesGroup[i].start; j <= rangesGroup[i].end; j++) {
                  const ind = j + 1;
                  let coordLabel = ind.toString();

                  const point = {
                    x: xyz.getX(j),
                    y: xyz.getY(j),
                    z: xyz.getZ(j),
                  };

                  const origPnt = this.getPointAt(j);

                  if (this.currentPointLabel === LabelField.X) {
                    coordLabel = origPnt.x.toFixed(3);
                  } else if (this.currentPointLabel === LabelField.Y) {
                    coordLabel = origPnt.y.toFixed(3);
                  } else if (this.currentPointLabel === LabelField.Z) {
                    coordLabel = origPnt.z.toFixed(3);
                  }

                  const label = new GlLabel({
                    text: coordLabel,
                    color: this.__pointLabelsColor,
                    font: this.__pointLabelsFont,
                    fontSize: this.fontSize,
                    orientation: "camera"
                  });

                  // label.sync();
                  syncPromises.push(label.sync());
                  label.position.set(point.x, point.y, point.z);
                  // this.add(label);
                  this.pointLabels.splice(j, 0, label);
                }
              }
            }
          }

          for (let i = index; i < this.__pointsCount; i++) {
            this.pointLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
          }
        } else if (action === GlPointAction.Set) {
          for (let i = index; i < index + changedPointQuantity; i++) {
            if (this.pointLabels[i]) this.pointLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
          }
        }
        this.executeOnLabelsUpdated(syncPromises);
      }
    }
  }

  __createPointLabels(lblField) {
    const xyz = this.geometry.attributes.position;
    const visibility = this.geometry.attributes.visibility;
    const isPtNamesExist = this.pointNames && this.pointNames.length > 0;
    if (xyz && this.__pointsCount > 0 && this.pointLabels.length === 0) {
      const syncPromises = [];
      for (let i = 0; i < this.__pointsCount; ++i) {
        const ind = i + this.numerationOffset;
        let coordLabel = isPtNamesExist && this.pointNames[i] && !(this.pointNames[i] instanceof Array) && !(this.pointNames[i] instanceof Object) ? this.pointNames[i] : ind.toString();

        const point = {
          x: xyz.getX(i),
          y: xyz.getY(i),
          z: xyz.getZ(i),
        };

        if (lblField) {
          const origPnt = this.getPointAt(i);
          if (lblField === LabelField.X) coordLabel = origPnt.x.toFixed(3);
          else if (lblField === LabelField.Y) coordLabel = origPnt.y.toFixed(3);
          else if (lblField === LabelField.Z) coordLabel = origPnt.z.toFixed(3);
        }
        const label = new GlLabel({
          text: coordLabel,
          color: this.__pointLabelsColor,
          font: this.__pointLabelsFont,
          fontSize: this.fontSize,
          orientation: "camera",
          scaleFactor: true,
        });

        syncPromises.push(label.sync(/* this.handleLabel() */));
        // label.sync(this.handleLabel());
        label.position.set(point.x, point.y, point.z);

        label.fillOpacity = visibility.getX(i);

        // this.add(label);
        this.pointLabels.push(label);
      }
      this.executeOnLabelsUpdated(syncPromises);
      this.__pointLabelsExist = true;
    }
  }

  async executeOnLabelsUpdated(syncPromises) {
    await Promise.all(syncPromises);
    // all texts sync complete
    if (this.instancedLabel) {
      this.remove(this.instancedLabel);
      this.instancedLabel.dispose();
    }
    this.instancedLabel = mergeTextsIntoInstancedText(this.pointLabels);
    if (this.instancedLabel) {
      if (this.material.clipping) this.instancedLabel.setClippingPlanes(this.material.minPoint, this.material.maxPoint);
      this.add(this.instancedLabel);
    }
    this.handleLabel()();
  }

  __destroyPointLabels() {
    for (const label of this.pointLabels) {
      // this.remove(label);
      label.dispose();
    }
    if (this.instancedLabel) {
      this.remove(this.instancedLabel);
      this.instancedLabel.dispose();
    }
    this.pointLabels.length = 0;
    this.__pointLabelsExist = false;
  }

  isPointLabelsShown() {
    return this.__pointLabelsExist;
  }

  // -------------------------------------
  // setPointLabelsFont()
  // -------------------------------------
  setPointLabelsFont(font) {
    if (typeof font === 'string' && font.length > 5) {
      this.showPointLabels(false);
      this.__pointLabelsFont = font;
      this.showPointLabels(true);
    }
  }

  // -------------------------------------
  // isPointsShown()
  // -------------------------------------
  isPointsShown() {
    return this.visible;
  }

  // -------------------------------------
  // isPointVisible()
  // -------------------------------------
  isPointVisible(index) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    const visibility = this.geometry.attributes.visibility;
    return visibility.array[index] ? true : false;
  }

  // -------------------------------------
  // setPointLabelsColor()
  // -------------------------------------
  setPointLabelsColor(color) {
    if ((color !== null || color !== undefined) && color !== this.__pointLabelsColor) {
      this.__pointLabelsColor = color;
      if (this.__pointLabelsExist) {
        this.showPointLabels(false);
        this.showPointLabels(true);
      } else {
        this.showPointLabels(true);
        this.showPointLabels(false);
      }
    }
  }

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox() {
    const boundingBox = new Box3();
    if (this.geometry) {
      if (!this.geometry.boundingBox) {
        this.geometry.computeBoundingBox();
      }

      boundingBox.copy(this.geometry.boundingBox);
      boundingBox.applyMatrix4(this.matrixWorld);
    }

    return boundingBox.isEmpty() ? null : boundingBox;
  }

  // -------------------------------------
  // computeBoundingBox()
  // -------------------------------------
  computeBoundingBox() {
    // this function is intended to replace native 'computeBoundingBox'
    // of a geometry, so 'this' here refers to BufferGeometry
    const xyz = this.attributes.position;
    if (xyz) {
      if (this.drawRange.count) {
        if (!this.boundingBox) {
          this.boundingBox = new Box3();
        }

        const bb = this.boundingBox;

        let minX = +Infinity;
        let minY = +Infinity;
        let minZ = +Infinity;

        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (let i = 0, l = this.drawRange.count; i < l; i++) {
          const x = xyz.getX(i);
          const y = xyz.getY(i);
          const z = xyz.getZ(i);

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;

          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
        }

        bb.min.set(minX, minY, minZ);
        bb.max.set(maxX, maxY, maxZ);
      } else {
        this.boundingBox.makeEmpty();
      }
    }
  }

  computeBoundingSphere() {
    // this function is intended to replace native 'computeBoundingSphere'
    // of a geometry, so 'this' here refers to BufferGeometry
    const xyz = this.attributes.position;
    if (xyz) {
      this.computeBoundingBox();
      if (this.boundingBox.isEmpty()) {
        this.boundingSphere.radius = 0;
        this.boundingSphere.center.set(0, 0, 0);
        return;
      }

      if (this.boundingSphere === null) {
        this.boundingSphere = new Sphere();
      }

      // first, find the center of the bounding sphere
      const center = this.boundingSphere.center;
      this.boundingBox.getCenter(center);

      // second, try to find a boundingSphere with a radius smaller than the
      // boundingSphere of the boundingBox: sqrt(3) smaller in the best case
      let maxRadiusSq = 0;
      const _vector = new Vector3();

      for (let i = 0, il = this.drawRange.count; i < il; i++) {
        _vector.fromBufferAttribute(xyz, i);
        maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector));
      }

      this.boundingSphere.radius = Math.sqrt(maxRadiusSq);

      if (isNaN(this.boundingSphere.radius)) {
        console.error('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.', this);
      }
    }
  }

  // -------------------------------------
  // reverse existing points' order
  // -------------------------------------
  reverseOrder() {
    const xyz = this.geometry.attributes.position;
    if (xyz) {
      for (let i = 0, cnt = Math.floor(this.__pointsCount / 2); i < cnt; i++) {
        const point = {
          x: xyz.getX(i),
          y: xyz.getY(i),
          z: xyz.getZ(i),
        };
        xyz.setXYZ(i, xyz.getX(this.__pointsCount - i - 1), xyz.getY(this.__pointsCount - i - 1), xyz.getZ(this.__pointsCount - i - 1));
        xyz.setXYZ(this.__pointsCount - i - 1, point.x, point.y, point.z);
      }

      xyz.needsUpdate = true;

      this.geometry.computeBoundingSphere();

      if (this.__pointLabelsExist) {
        this.__changePointLabels(0, this.__pointsCount, GlPointAction.Set);
      }
    }
  }

  // -------------------------------------
  // calculate the plane of a polyline in
  // terms of local coordinates
  // -------------------------------------
  __getPlane() {
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__pointsCount > 0) {
      // calculate centroid of the polyline
      const centroid = new Vector3();
      const point = new Vector3();
      for (let i = 0; i < this.__pointsCount; i++) {
        point.fromBufferAttribute(xyz, i);
        centroid.add(point);
      }
      centroid.divideScalar(this.__pointsCount);

      // create matrix
      const A = new Float64Array(9).fill(0);
      for (let i = 0; i < this.__pointsCount; i++) {
        point.fromBufferAttribute(xyz, i);
        point.sub(centroid);
        A[0] += point.x * point.x;
        A[1] += point.x * point.y;
        A[2] += point.x * point.z;
        A[4] += point.y * point.y;
        A[5] += point.y * point.z;
        A[8] += point.z * point.z;
      }
      A[3] = A[1];
      A[6] = A[2];
      A[7] = A[5];

      // calculate eigenvalues and eigenvectors
      const result = MathUtils.eigen_decompose(A);

      if (result) {
        const eVectors = result.eigenvectors;
        const eValues = result.eigenvalues;

        let minInd = eValues[0] < eValues[1] ? 0 : 1;
        minInd = eValues[minInd] < eValues[2] ? minInd : 2;

        return {
          normal: new Vector3(eVectors[minInd], eVectors[3 + minInd], eVectors[6 + minInd]),
          centroid,
          error: eValues[minInd],
        };
      }
    }

    return null;
  }

  // -------------------------------------
  // calculate the plane of a polyline in
  // terms of a world coordinates
  // -------------------------------------
  getPlane() {
    const plane = this.__getPlane();
    if (plane) {
      plane.centroid.applyMatrix4(this.matrixWorld);
    }

    return plane;
  }

  // -------------------------------------
  // select / deselect on scene
  // -------------------------------------
  select(child) {
    if (!this.selectable || !child) return null;

    const found = this.selectedPoints.has(child.index);
    if (!found) {
      const c = this.selectedColor;
      const clr = {
        R: this.geometry.attributes.color.array[child.index * 3],
        G: this.geometry.attributes.color.array[child.index * 3 + 1],
        B: this.geometry.attributes.color.array[child.index * 3 + 2]
      };
      this.selectedPoints.set(child.index, clr);
      this.__setColors(child.index, [c.R, c.G, c.B]);
    }
    return null;
  }

  deselect(child) {
    const c = this.pointsColor;
    if (child && child.index !== undefined && child.index !== null) {
      const deselColor = this.selectedPoints.get(child.index);
      if (deselColor) {
        this.__setColors(child.index, [deselColor.R, deselColor.G, deselColor.B]);
      } else {
        this.__setColors(child.index, [c.R, c.G, c.B]);
      }
      this.selectedPoints.delete(child.index);

    } else if (!child) {
      this.selectedPoints.forEach((value, key) => {
        this.__setColors(key, [value.R, value.G, value.B]);
      });
      this.selectedPoints.clear();
    }
  }

  // -------------------------------------------
  // frustumSelect on scene
  // -------------------------------------------
  frustumSelect(frustum, obb, multiSelect) {
    if (!frustum || !this.visible || (this.parent && !this.parent.visible) || (!this.selectable)) return null;

    const xyz = this.geometry.attributes.position;
    const rgb = this.geometry.attributes.color;
    const visibility = this.geometry.attributes.visibility;
    if (xyz && rgb) {
      const point = new Vector3();

      const desel = this.pointsColor;
      const sel = this.selectedColor;

      const ptSize = this.__pointsCount * 3;
      for (let i = 0, idx = 0; i < ptSize; i += 3, idx++) {
        point.set(xyz.array[i], xyz.array[i + 1], xyz.array[i + 2]);
        point.applyMatrix4(this.matrixWorld);
        if (frustum.containsPoint(point) && this.visible && this.parent.visible) {

          
          // check if point is inside section or not
          if (obb && !obb.containsPoint(point)) continue;
          if (multiSelect === -1) {
            const deselColor = this.selectedPoints.get(idx);
            
            if (deselColor) {
              rgb.array[i] = deselColor.R;
              rgb.array[i + 1] = deselColor.G;
              rgb.array[i + 2] = deselColor.B;
              this.selectedPoints.delete(idx);
            } else {
              /*
              rgb.array[i] = desel.R;
              rgb.array[i + 1] = desel.G;
              rgb.array[i + 2] = desel.B;*/
            }

            this.selectedPoints.delete(idx);
            continue;
          }
          if (this.selectedPoints.get(idx)) continue;
          if (this.hasHiddenPoints && !visibility.array[idx]) continue;

          const clr = {
            R: rgb.array[i],
            G: rgb.array[i + 1],
            B: rgb.array[i + 2]
          };

          
          this.selectedPoints.set(idx, clr);
          rgb.array[i] = sel.R;
          rgb.array[i + 1] = sel.G;
          rgb.array[i + 2] = sel.B;
        } else {
          if (multiSelect) continue;
          const deselColor = this.selectedPoints.get(idx);
          if (deselColor) {
            rgb.array[i] = deselColor.R;
            rgb.array[i + 1] = deselColor.G;
            rgb.array[i + 2] = deselColor.B;
            this.selectedPoints.delete(idx);
          } else {
            /*
            rgb.array[i] = desel.R;
            rgb.array[i + 1] = desel.G;
            rgb.array[i + 2] = desel.B;*/
          }
        }
      }

      rgb.needsUpdate = true;
      return this.selectedPoints;
    }
    return null;
  }

  // -------------------------------------------
  // this function will be called by raycaster
  // -------------------------------------------
  raycast(raycaster, intersects) {
    // don't do raycasting if the object is not selectable
    if (!this.visible || (this.parent && !this.parent.visible) ||
      (!this.selectable && !this.snappable) ||
      this.__pointsCount === 0) return;

    const inverseMatrix = new Matrix4();
    const ray = new Ray();
    const sphere = new Sphere();
    const precision = raycaster.params.Line.threshold;
    const threshold = raycaster.params.Points.threshold;
    const snapMode = raycaster.params.snapMode;
    if (snapMode && snapMode !== GlSnapMode.None && !this.snappable) return;

    // set the clipping sections obb
    const clippedSection = raycaster.params.clippedSection;
    if (clippedSection) this.__obb.copy(clippedSection.obb);

    const geometry = this.geometry;
    const matrixWorld = this.matrixWorld;

    sphere.copy(geometry.boundingSphere);
    sphere.applyMatrix4(matrixWorld);
    sphere.radius += precision;

    if (snapMode === GlSnapMode.Lines ||
      raycaster.ray.intersectsSphere(sphere) === false) return;
    if (clippedSection && !this.__obb.intersectsRay(raycaster.ray)) return;

    inverseMatrix.copy(matrixWorld).invert();
    ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

    if (clippedSection) this.__obb.applyMatrix4(inverseMatrix);

    const scale = this.parent.partOfPlot ? this.parent.parent.scale : this.scale;
    // threshold for point raycasting
    const localThreshold = threshold / ((scale.x + scale.y + scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;

    const vStart = new Vector3();
    const xyz = geometry.attributes.position;
    for (let i = 0; i < this.__pointsCount; i++) {
      if (this.childIndexToSkip === i) continue;

      vStart.fromBufferAttribute(xyz, i);
      if (clippedSection && !this.__obb.containsPoint(vStart, i > 0)) continue;

      // inspect for a point
      const rayPointDistanceSq = ray.distanceSqToPoint(vStart);
      if (rayPointDistanceSq < localThresholdSq) {
        const intersectPoint = new Vector3();
        ray.closestPointToPoint(vStart, intersectPoint);

        // Move back to world space for distance calculation
        intersectPoint.applyMatrix4(this.matrixWorld);

        const distance = raycaster.ray.origin.distanceTo(intersectPoint);

        if (distance > raycaster.near && distance < raycaster.far) {
          intersects.push({
            distance: distance,
            point: intersectPoint,
            index: i,
            face: null,
            faceIndex: null,
            object: this,
            child: {
              distance: distance,
              distanceToRay: Math.sqrt(rayPointDistanceSq),
              point: vStart.clone().applyMatrix4(this.matrixWorld),
              index: i,
              face: null,
              object: this
            }
          });
        }
      }
    }
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
        type: 'GlPointsBase',
        generator: 'GlPointsBase.toJSON'
      };
      if (this.isGlPoints) {
        output.metadata.type = 'GlPoints';
        output.metadata.generator = 'GlPoints.toJSON';
      } else if (this.isGlPointSamples) {
        output.metadata.type = 'GlPointSamples';
        output.metadata.generator = 'GlPointSamples.toJSON';
      }
    }

    //   'type' ->   'type'
    //   'n'    ->   'name'
    //   'rO'   ->   'renderOrder'
    //   'l'    ->   'layers'
    //   'm'    ->   'matrix'
    //   'mAU'  ->   'matrixAutoUpdate'
    //   'pLF'  ->   'pointLabelField'
    //   'pCt'   ->   'pointsCount'
    //   'hHP'   ->   'hasHiddenPoints'
    //   'pCr'   ->   'pointsColor'
    //   'pLC'  ->   'pointLabelsColor'
    //   'pLE'  ->   'pointLabelsExist'

    const object = {};
    if (keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    object.pCt = this.__pointsCount;
    object.hHP = this.hasHiddenPoints;
    object.pCr = this.pointsColor.getHex();
    object.pLC = this.__pointLabelsColor;
    if (this.__pointLabelsExist) object.pLE = this.__pointLabelsExist;

    object.geom = GlUtils.bufferGeometryToJson(this.geometry);

    output.object = object;
    return output;
  }

  get properties() {
    return {
      'type': Primitive_Type.String, // type
      'n': Primitive_Type.String, // name
      'rO': Primitive_Type.Uint8, // renderOrder
      'v': Primitive_Type.Uint8, // visible
      'l': Primitive_Type.Int32, // layers
      'm': Primitive_Type.Float64Array, // matrix
      'mAU': Primitive_Type.Uint8, // matrixAutoUpdate
      'pLF': Primitive_Type.String, // pointLabelField
      'pCt': Primitive_Type.Int32, // pointsCount
      'pSz': Primitive_Type.Int32, // pointSize
      'hHP': Primitive_Type.Uint8, // hasHiddenPoints
      'pCr': Primitive_Type.Uint32, // pointsColor
      'pLC': Primitive_Type.Uint32, // pointLabelsColor
      'pLE': Primitive_Type.Uint8, // pointLabelsExist
      'geom': Primitive_Type.Object, // pointLabelsExist
    }
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

    writeToDv('pCt', this.__pointsCount);
    writeToDv('pSz', this.pointSize);
    writeToDv('hHP', this.hasHiddenPoints);
    writeToDv('pCr', this.pointsColor.getHex());
    writeToDv('pLC', this.__pointLabelsColor);

    if (this.__pointLabelsExist) writeToDv('pLE', this.__pointLabelsExist);

    if (this.attributes.size > 0) {
      writeToDv('uA', null);
      this.attributes.toArrayBuffer(myDv);
    }

    writeToDv('geom', null);
    GlUtils.bufferGeometryToArrayBuffer(this.geometry, myDv);
    writeToDv('endObj');
  }
}

GlPointsBase.pointsTextures = new Map();
