import { GlBase } from "./gl-base";
import { createInstancedUniformsDerivedMaterial } from '../troika/three-instanced-uniforms-mesh/InstancedUniformsDerivedMaterial';
import { getShadersForMaterial } from '../troika/troika-three-utils/getShadersForMaterial';
import {
  Matrix4,
  Color,
  InstancedBufferAttribute,
  MeshBasicMaterial,
} from 'three';
import { GlUtils } from "../utils/gl-utils";

function isEmpty(value) {
  return value === null || value === undefined;
}
const _m4 = new Matrix4();
const _color = new Color();

const matrixItemSize = 16;
const colorItemSize = 3;

export class GlInstancedBase extends GlBase {
  constructor() {
    super();

    this.isInstancedMesh = true;  // this is needed to render this object via WebGlRenderer correctly
    this.isMesh = true; // needs for correct rendering
    this.instanceColor = null;
    this.frustumCulled = false;

    this.isGlInstancedBase = true;
    this.type = 'GlInstancedBase';

    this._instancedUniformNames = [] // treated as immutable

    this._count = 0;
    this.instanceMatrix = null;
  }

  // ---------------------
  // set / get count
  // ---------------------
  set count(val) {
    this.__recreateInstancedBufferGeometry(val);
    this._count = val;
  }

  get count() {
    return this._count;
  }

  dispose() {
    super.dispose();
    const iMatrixAttr = this.instanceMatrix;
    const iColorAttr = this.instanceColor;

    if (iMatrixAttr.array) {
      iMatrixAttr.array = null;
      iMatrixAttr.count = 0;
      iMatrixAttr.needsUpdate = true;
    }

    if (iColorAttr && iColorAttr.array) {
      iColorAttr.array = null;
      iColorAttr.count = 0;
      iColorAttr.needsUpdate = true;
    }

    this.count = 0;
    this.geometry.dispose();
    this.material.dispose();
  }

  // ----------------------------------------------------
  // __recreateInstancedBufferGeometry()
  // ----------------------------------------------------
  __recreateInstancedBufferGeometry(count) {
    let instanceMatrix = new InstancedBufferAttribute(new Float32Array(count * matrixItemSize), matrixItemSize);
    if (this.instanceMatrix && this._count < count) {
      // recreate instanceMatrix and instanceColor
      let instanceColor = null;
      if (this.instanceColor) {
        instanceColor = new InstancedBufferAttribute(new Float32Array(count * colorItemSize), colorItemSize);
      }

      for (let i = 0; i < this._count; i++) {
        this.getMatrixAt(i, _m4);
        _m4.toArray(instanceMatrix.array, i * matrixItemSize);
        if (instanceColor) {
          this.getColorAt(i, _color);
          _color.toArray(instanceColor.array, i * colorItemSize);
        }
      }
      this.instanceColor = instanceColor;

      // handle _instancedUniformNames
      const uniformNames = this._instancedUniformNames;
      const attrs = this.geometry.attributes
      for (let uI = 0, uL = uniformNames.length; uI < uL; uI++) {
        const attrName = `troika_attr_${uniformNames[uI]}`;
        const attr = attrs[attrName];
        const defaultValue = getDefaultUniformValue(this._baseMaterial, uniformNames[uI])
        const itemSize = getItemSizeForValue(defaultValue)
        const newAttr = new InstancedBufferAttribute(new Float32Array(itemSize * count), itemSize)
        // Fill old values:
        newAttr.array.set(attr.array);
        // for (let start = 0, end = this._count * itemSize; start < end; start++) {
        //   newAttr.array[start] = attr.array[start];
        // }
        // Fill default values:
        if (defaultValue !== null) {
          for (let i = this._count; i < count; i++) {
            setAttributeValue(newAttr, i, defaultValue)
          }
        }

        attrs[attrName] = newAttr;
        newAttr.needsUpdate = true;
      }
    }

    if (!this.instanceMatrix || this.instanceMatrix.count < count) this.instanceMatrix = instanceMatrix;
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (index !== undefined && index !== null &&
      index >= 0 && index < this._count) {
      return true;
    }
    return false;
  }
  
  /*
   * Getter/setter for automatically wrapping the user-supplied material with our upgrades. We do the
   * wrapping lazily on _read_ rather than write to avoid unnecessary wrapping on transient values.
   */
  get material () {
    let derivedMaterial = this._derivedMaterial
    const baseMaterial = this._baseMaterial || this._defaultMaterial || (this._defaultMaterial = new MeshBasicMaterial())
    if (!derivedMaterial || derivedMaterial.baseMaterial !== baseMaterial) {
      derivedMaterial = this._derivedMaterial = createInstancedUniformsDerivedMaterial(baseMaterial)
    }
    derivedMaterial.setUniformNames(this._instancedUniformNames)
    return derivedMaterial
  }

  set material (baseMaterial) {
    if (Array.isArray(baseMaterial)) {
      throw new Error('GlInstancedBase does not support multiple materials')
    }
    // Unwrap already-derived materials
    while (baseMaterial && baseMaterial.isInstancedUniformsMaterial) {
      baseMaterial = baseMaterial.baseMaterial
    }
    this._baseMaterial = baseMaterial
  }

  get customDepthMaterial () {
    return this.material.getDepthMaterial()
  }

  get customDistanceMaterial () {
    return this.material.getDistanceMaterial()
  }

  /**
   * Set the value of a shader uniform for a single instance.
   * @param {string} name - the name of the shader uniform
   * @param {number} index - the index of the instance to set the value for
   * @param {number|Vector2|Vector3|Vector4|Color|Array|Matrix3|Matrix4|Quaternion} value - the uniform value for this instance
   */
  setUniformAt (name, index, value) {
    const attrs = this.geometry.attributes
    const attrName = `troika_attr_${name}`
    let attr = attrs[attrName]
    if (!attr) {
      const defaultValue = getDefaultUniformValue(this._baseMaterial, name)
      const itemSize = getItemSizeForValue(defaultValue)
      attr = attrs[attrName] = new InstancedBufferAttribute(new Float32Array(itemSize * this._count), itemSize)
      // Fill with default value:
      if (defaultValue !== null) {
        for (let i = 0; i < this._count; i++) {
          setAttributeValue(attr, i, defaultValue)
        }
      }
      this._instancedUniformNames = [...this._instancedUniformNames, name]
    }
    
    if (!GlUtils.isEmpty(value)) {
      setAttributeValue(attr, index, value)
      attr.needsUpdate = true;
    } 
  }

  /**
   * Get the value of a shader uniform for a single instance.
   * @param {string} name - the name of the shader uniform
   * @param {number} index - the index of the instance 
   */
  getUniformAt(name, index) {
    const attrs = this.geometry.attributes
    const attrName = `troika_attr_${name}`
    let attr = attrs[attrName]
    if (attr) {
      const defaultValue = getDefaultUniformValue(this._baseMaterial, name);
      const itemSize = getItemSizeForValue(defaultValue);
      if (!isEmpty(index)) {
        if (itemSize === 1) {
          return attr.getX(index);
        } else if (itemSize === 2) {
          return {x: attr.getX(index), y: attr.getY(index)};
        } else if (itemSize === 3) {
          return {x: attr.getX(index), y: attr.getY(index), z: attr.getZ(index)};
        } else if (itemSize === 4) {
          return {x: attr.getX(index), y: attr.getY(index), z: attr.getZ(index), w: attr.getW(index)};
        } else if (defaultValue.toArray) {
          // 
        } else {
          return attr.getX(index * itemSize);
        }
      } else {
        return attr.array;
      }
    } else {
      console.error('UniformByName not found');
    }
  }

  /**
   * Unset all instance-specific values for a given uniform, reverting back to the original
   * uniform value for all.
   * @param {string} name
   */
  unsetUniform (name) {
    this.geometry.deleteAttribute(`troika_attr_${name}`)
    this._instancedUniformNames = this._instancedUniformNames.filter(n => n !== name)
  }

  // ---------------------
  // getColorAt()
  // ---------------------
  getColorAt(index, color) {
    if (this.instanceColor)
      color.fromArray(this.instanceColor.array, index * colorItemSize);
  }

  /**
   * Get matrix of specific instance of object by index
   * @param {number} index - the index of the instance
   * @param {Matrix4} matrix - the matrix for storing specific instance's matrix
   * @param {boolean} worldCoord - the worldCoord in order to get worldCoord matrix4 (default: false)
   */
  getMatrixAt(index, matrix, worldCoord = false) {
    if (this.instanceMatrix) {
      matrix.fromArray(this.instanceMatrix.array, index * matrixItemSize);
      if (worldCoord) matrix.premultiply(this.matrixWorld);
    }
  }

  /**
   * Set color to specific instance of object by index
   * @param {number} index - the index of the instance
   * @param {Color} name - the color of instance
   */
  setColorAt(index, color) {
    if (GlUtils.isEmpty(this.instanceColor)) {
      if (this.instanceMatrix === null)  {
        console.log('GlInstancedBase.setColorAt: Error: instance matrix has not been set yet.');
        return;
      }

      this.instanceColor = new InstancedBufferAttribute(new Float32Array(this.instanceMatrix.count * colorItemSize), colorItemSize);
    }
    color.toArray(this.instanceColor.array, index * colorItemSize);
  }

  /**
   * Set matrix to specific instance of object by index
   * @param {number} index - the index of the instance
   * @param {Matrix4} name - the matrix of instance
   */
  setMatrixAt(index, matrix) {
    if (GlUtils.isEmpty(this.instanceMatrix)) {
      console.log('GlInstancedBase.setMatrixAt: Error: instance matrix has not been set yet.');
      return;
    }

    matrix.toArray(this.instanceMatrix.array, index * matrixItemSize);
  }
}

function setAttributeValue (attr, index, value) {
  let size = attr.itemSize
  if (size === 1) {
    attr.setX(index, value)
  } else if (size === 2) {
    attr.setXY(index, value.x, value.y)
  } else if (size === 3) {
    if (value.isColor) {
      attr.setXYZ(index, value.r, value.g, value.b)
    } else {
      attr.setXYZ(index, value.x, value.y, value.z)
    }
  } else if (size === 4) {
    attr.setXYZW(index, value.x, value.y, value.z, value.w)
  } else if (value.toArray) {
    value.toArray(attr.array, index * size)
  } else {
    attr.set(value, index * size)
  }
}

function getDefaultUniformValue (material, name) {
  // Try uniforms on the material itself, then try the builtin material shaders
  let uniforms = material.uniforms
  if (uniforms && uniforms[name]) {
    return uniforms[name].value
  }
  uniforms = getShadersForMaterial(material).uniforms
  if (uniforms && uniforms[name]) {
    return uniforms[name].value
  }
  return null
}

function getItemSizeForValue (value) {
  return value == null ? 0
    : typeof value === 'number' ? 1
    : value.isVector2 ? 2
    : value.isVector3 || value.isColor ? 3
    : value.isVector4 || value.isQuaternion ? 4
    : value.elements ? value.elements.length
    : Array.isArray(value) ? value.length
    : 0
}
