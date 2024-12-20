/* eslint-disable no-undef */
import {GlBase} from './gl-base';
import {GlLabel} from './gl-label';
import {GlPointAction, MeshAttributeType, GlSnapMode, Primitive_Type} from './gl-constants';
import {GlNormals} from './gl-normals';
import {GlUtils} from '../utils/gl-utils';
import {
  Matrix4,
  Ray,
  Sphere,
  Vector3,
  Vector2,
  MeshStandardMaterial,
  Color,
  DoubleSide,
  BufferGeometry,
  BufferAttribute,
  Box3,
  Quaternion,
  MeshBasicMaterial,
  BackSide,
  Triangle,
} from 'three';
import { mergeTextsIntoInstancedText } from '../troika/troika-three-text/InstancedText';

const _inverseMatrix = new Matrix4();
const _ray = new Ray();
const _sphere = new Sphere();
const _vA = new Vector3();
const _vB = new Vector3();
const _vC = new Vector3();

const _uvA = new Vector2();
const _uvB = new Vector2();
const _uvC = new Vector2();

const _intersectionPoint = new Vector3();
const _intersectionPointWorld = new Vector3();

export class GlMeshBase extends GlBase {
  constructor(params, fromJSON) {
    super();

    params = params || {};
    const isFromJson = fromJSON && fromJSON.geometry ? true : false;
    const geometry = isFromJson ? fromJSON.geometry : undefined;
    let material = params.material ? params.material : undefined;
    if (material === undefined) {
      material = new MeshStandardMaterial({
        color: new Color(),
        flatShading: true,
        roughness: 1,
        metalness: 0,
        side: DoubleSide,
        transparent: true,
        opacity: 0.8,
        polygonOffset: true,
        polygonOffsetUnits: 1,
        polygonOffsetFactor: 1,
      });
    }

    this.geometry = geometry ? geometry : new BufferGeometry();
    this.material = material;

    this.isMesh = true;   // this is needed to render this object via WebGlRenderer correctly
    this.isGlMeshBase = true;
    this.type = 'GlMeshBase';
    this.name = '';

    this.EPS = 1e-8;

    this.__color = material ? material.color.getHex() : 0xffffff;

    // topology and geometry info
    this.isOrientable = false;
    this.isManifold = false;
    this.area = 0;
    this.silhoutteArea = 0;
    this.volume = 0;
    this.eulerPoincare = 0;
    this.edgesCount = 0;

    // selection
    this.selectable = true;
    this.snappable = true;
    this.selectBySettingColor = false;
    this.selectColor = 0x6193EF;

    // vertices
    this.vertices = null;
    this.verticesColor = new Color(0x000000);
    this.selectedColor = new Color(0xFF0000);

    this.selectedVertices = new Map();
    this.selectedFaces = new Map();

    // vertices' labels
    this.verticesLabels = [];
    this.__verticesLabelsColor = 0x0000ff;
    this.__verticesLabelsFont = '';
    this.__verticesLabelsExist = false;

    // verticesNormals
    this.__verticesNormalsColor = 0xff0000;
    this.verticesNormals = new GlNormals({color: this.__verticesNormalsColor});
    this.verticesNormals.selectable = false;
    this.__verticesNormalsExist = false;

    if (isFromJson) {
      if(fromJSON.version !== 4.5) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    } else if (params) {
      if (params.name) this.name = params.name;
      if (params.materialColor) {
        this.__color = params.materialColor.isColor ? params.materialColor.getHex() : params.materialColor;
        this.material.color.setHex(this.__color);
      }
      if (params.verticesColor) this.verticesColor = new Color(params.verticesColor);

      if (params.verticesLabelsColor) this.__verticesLabelsColor = params.verticesLabelsColor;

      this.__verticesCount = 0;
      this.__facesCount = 0;
      this.geometry.setDrawRange(0, this.__verticesCount);
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

    // vertices' count
    this.__verticesCount = fromJSON.vCt;
    if (this.geometry.index) {
      this.__facesCount = this.geometry.index.count;
      this.geometry.setDrawRange(0, this.geometry.index.count > this.__verticesCount ? this.geometry.index.count : this.__verticesCount);
    }

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.mCr !== undefined) {
      this.__color = fromJSON.mCr;
      this.material.color.setHex(this.__color);
    } 

    if (fromJSON.o !== undefined) this.isOrientable = fromJSON.o;
    if (fromJSON.md !== undefined) this.isManifold = fromJSON.md;
    if (fromJSON.a !== undefined) this.area = fromJSON.a;
    if (fromJSON.sA !== undefined) this.silhoutteArea = fromJSON.sA;
    if (fromJSON.vl !== undefined) this.volume = fromJSON.md ? fromJSON.vl : 0;
    if (fromJSON.eP !== undefined) this.eulerPoincare = fromJSON.eP;
    if (fromJSON.tCt !== undefined) this.triCount = fromJSON.tCt;
    if (fromJSON.eCt !== undefined) this.edgesCount = fromJSON.eCt;

    if (this.__verticesCount) {
      // bounding box
      this.geometry.computeBoundingBox = this.computeBoundingBox;
      this.geometry.computeBoundingSphere = this.computeBoundingSphere;
    }
    
    // vertices
    this.verticesColor = new Color(fromJSON.vCr);
    if (fromJSON.vr) this.showVertices(true);
    if (fromJSON.vVC) {
      this.material.vertexColors = true;
      this.material.needsUpdate = true;
    }

    // vertices' labels
    this.__verticesLabelsColor = fromJSON.vLC;
    if (fromJSON.vLE) this.showVerticesLabels(true);

    // user attributes
    if (fromJSON.uA && this.attributes) this.attributes.fromJSON(fromJSON.uA);

  }

  // ------------------------------------------------
  // initialize an object from JSON_v4_5
  // ------------------------------------------------
  __initFromJson_v4_5(fromJSON) {
    // uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.name) this.name = fromJSON.name;

    // vertices' count
    this.__verticesCount = fromJSON.verticesCount;
    this.__facesCount = this.geometry.index.count;
    this.geometry.setDrawRange(0, this.geometry.index && this.geometry.index.count > this.__verticesCount ? this.geometry.index.count : this.__verticesCount);

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

    if (fromJSON.isOrientable !== undefined) this.isOrientable = fromJSON.isOrientable;
    if (fromJSON.isManifold !== undefined) this.isManifold = fromJSON.isManifold;
    if (fromJSON.area !== undefined) this.area = fromJSON.area;
    if (fromJSON.silhoutteArea !== undefined) this.silhoutteArea = fromJSON.silhoutteArea;
    if (fromJSON.volume !== undefined) this.volume = fromJSON.isManifold ? fromJSON.volume : 0;
    if (fromJSON.eulerPoincare !== undefined) this.eulerPoincare = fromJSON.eulerPoincare;
    if (fromJSON.triCount !== undefined) this.triCount = fromJSON.triCount;
    if (fromJSON.edgesCount !== undefined) this.edgesCount = fromJSON.edgesCount;

    // bounding box
    this.geometry.computeBoundingBox = this.computeBoundingBox;
    this.geometry.computeBoundingSphere = this.computeBoundingSphere;

    // vertices
    this.verticesColor = new Color(fromJSON.verticesColor);
    if (fromJSON.vertices) this.showVertices(true);

    // vertices' labels
    this.__verticesLabelsColor = fromJSON.verticesLabelsColor;
    if (fromJSON.verticesLabelsExist) this.showVerticesLabels(true);

    // user attributes
    if (fromJSON.userAttributes && this.attributes) {
      this.attributes.fromJSON_v4_5(fromJSON.userAttributes);
    }
  }

  // ---------------
  // clone()
  // ---------------
  clone(keepUuid, keepParent) {
    const clone = new this.constructor({material: this.material.clone()});

    const oldGeom = clone.geometry;
    clone.geometry = this.geometry.clone();
    if (oldGeom) oldGeom.dispose();

    clone.geometry.computeBoundingBox = clone.computeBoundingBox;
    clone.geometry.computeBoundingSphere = clone.computeBoundingSphere;
    clone.__verticesCount = this.__verticesCount;
    clone.__facesCount = this.__facesCount;

    if (typeof keepUuid === 'boolean' && keepUuid) clone.uuid = this.uuid;
    clone.name = this.name;
    clone.selectable = this.selectable;
    clone.snappable = this.snappable;
    clone.selectBySettingColor = this.selectBySettingColor;

    clone.position.copy(this.position);
    clone.rotation.order = this.rotation.order;
    clone.quaternion.copy(this.quaternion);
    clone.scale.copy(this.scale);
    clone.pivotOffset.copy(this.pivotOffset);

    clone.matrix.copy(this.matrix);
    clone.matrixWorld.copy(this.matrixWorld);
    if (this.parent && !this.parent.isScene) {
      // since the pivot offset is integrated into an object's
      // local matrix we need to compute actual matrixWorld of parents
      let scope = this;
      const parents = [];
      while(scope.parent && scope.parent.matrixWorld && !scope.parent.isScene) {
        parents.push(scope.parent);
        scope = scope.parent;
      }
      const m4 = new Matrix4();
      for (let i = parents.length - 1; i >= 0; i--) {
        const p = parents[i];
        if (i === parents.length - 1) { 
          m4.compose(p.position, p.quaternion, p.scale);
        } else {
          this.__m4.compose(p.position, p.quaternion, p.scale);
          m4.multiply(this.__m4);
        }
      }
      clone.matrix.compose(this.position, this.quaternion, this.scale);
      clone.matrixWorld.multiplyMatrices(m4, clone.matrix);
      if (!keepParent)
        clone.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
    }
    clone.matrixAutoUpdate = this.matrixAutoUpdate;
    clone.matrixWorldNeedsUpdate = this.matrixWorldNeedsUpdate;

    clone.layers.mask = this.layers.mask;
    clone.visible = this.visible;

    clone.castShadow = this.castShadow;
    clone.receiveShadow = this.receiveShadow;
    clone.frustumCulled = this.frustumCulled;

    clone.renderOrder = this.renderOrder;
    clone.userData = JSON.parse(JSON.stringify(this.userData));

    clone.isOrientable  = this.isOrientable;
    clone.isManifold  = this.isManifold;
    clone.area = this.area;
    clone.silhoutteArea = this.silhoutteArea;
    clone.volume = this.isManifold ? this.volume : 0;
    clone.eulerPoincare = this.eulerPoincare;
    clone.triCount = this.triCount;
    clone.edgesCount = this.edgesCount;

    // vertices
    clone.verticesColor = this.verticesColor.clone();
    clone.__verticesLabelsColor = this.__verticesLabelsColor;

    if (this.isSelected) clone.deselect();
    clone.isSelected = false;

    return clone;
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

  // ------------------------------------------------
  // __validateArrayValues()
  // validate and adjust values as:
  // [x0, y0, z0, x1, y1, z1]
  // ------------------------------------------------
  __validateArrayValues(type, values) {
    if (!values) return null;

    let retValues = null;
    let error = '';
    let itemSize = 3;
    if (type === MeshAttributeType.UV) itemSize = 2;

    if (Array.isArray(values) || ArrayBuffer.isView(values)) {
      if (typeof values[0] === 'object') {
        // we'll assume that the 'values' is an array of objects: [attribute1, attribute2, ...]
        retValues = Array(values.length * itemSize).fill(0.0);
        error = 'Ошибка: некоторые значения заданы некорректно';
        for (let i = 0; i < values.length; ++i) {
          if (type === MeshAttributeType.UV) {
            if (values[i].u !== undefined && values[i].v !== undefined) {
              retValues[i * itemSize] = values[i].u;
              retValues[i * itemSize + 1] = values[i].v;
              error = '';
            }
          } else if (type === MeshAttributeType.COLOR) {
            if (values[i].r !== undefined && values[i].g !== undefined && values[i].b !== undefined) {
              retValues[i * itemSize] = values[i].r;
              retValues[i * itemSize + 1] = values[i].g;
              retValues[i * itemSize + 2] = values[i].b;
              error = '';
            }
          } else {
            if (values[i].x !== undefined && values[i].y !== undefined && values[i].z !== undefined) {
              retValues[i * itemSize] = values[i].x;
              retValues[i * itemSize + 1] = values[i].y;
              retValues[i * itemSize + 2] = values[i].z;
              error = '';
            }
          }
        }
      } else {
        // we'll assume that the 'values' are given as: [x0, y0, z0, x1, y1, z1]
        const vertCount = Math.floor(values.length / itemSize);
        retValues = Array(vertCount * itemSize).fill(0.0);
        for (let i = 0; i < vertCount * itemSize; ++i) {
          retValues[i] = values[i];
        }
      }
    } else {
      // we'll assume that the 'values' is an object
      error = 'Ошибка: значения заданы некорректно';
      if (type === MeshAttributeType.UV) {
        if (values.u !== undefined && values.v !== undefined) {
          retValues = [values.u, values.v];
          error = '';
        }
      } else if (type === MeshAttributeType.COLOR) {
        if (values.r !== undefined && values.g !== undefined && values.b !== undefined) {
          retValues = [values.r, values.g, values.b];
          error = '';
        }
      } else {
        if (values.x !== undefined && values.y !== undefined && values.z !== undefined) {
          retValues = [values.x, values.y, values.z];
          error = '';
        }
      }
    }

    if (type === MeshAttributeType.POSITION && retValues && retValues.length) {
      // set an objects position if it's needed
      if (this.__verticesCount === 0) {
        this.__m4.copy(this.matrixWorld).invert();
        this.pivotOffset.set(0,0,0);
        this.position.set(retValues[0], retValues[1], retValues[2]);
        this.position.applyMatrix4(this.__m4);
        this.updateMatrixWorld();
      }

      this.__m4.copy(this.matrixWorld).invert();

      // convert coordinates from world to local
      for (let i = 0; i < retValues.length; i += itemSize) {
        this.__v3.set(retValues[i], retValues[i + 1], retValues[i + 2]);
        this.__v3.applyMatrix4(this.__m4);
        retValues[i] = this.__v3.x;
        retValues[i + 1] = this.__v3.y;
        retValues[i + 2] = this.__v3.z;
      }
    }

    if (error) {
      console.log(error);
    }

    return retValues;
  }

  // ----------------------------------------------------
  // __createBufferGeometry(values)
  // 'values' must be the type of Array and contain
  // values as: [x0, y0, z0, x1, y1, z1]
  // ----------------------------------------------------
  __createBufferGeometry(type, values) {
    if (!(values && values instanceof Array)) return;

    let itemSize = 3;
    let attribName = 'position';
    let attrib = this.geometry.attributes.position;
    if (type === MeshAttributeType.COLOR) {
      attrib = this.geometry.attributes.color;
      attribName = 'color';
    } else if (type === MeshAttributeType.NORMAL) {
      attrib = this.geometry.attributes.normal;
      attribName = 'normal';
    } else if (type === MeshAttributeType.UV) {
      attrib = this.geometry.attributes.uv;
      attribName = 'uv';
      itemSize = 2;
    }

    // if the required attribute has already been created just exit
    if (attrib) return;


    const newValuesCount = Math.floor(values.length / itemSize);

    // define the size of new attribute and create a new buffer
    const newSize = (newValuesCount + 1) * itemSize;
    const newBuffer = new BufferAttribute(new Float32Array(newSize), itemSize);

    // add new values
    const end = newValuesCount * itemSize;
    for (let i = 0; i < end; i += itemSize) {
      newBuffer.array[i] = values[i];
      newBuffer.array[i + 1] = values[i + 1];
      if (itemSize > 2) newBuffer.array[i + 2] = values[i + 2];
    }

    this.geometry.setAttribute(attribName, newBuffer);
    newBuffer.needsUpdate = true;

    if (type === MeshAttributeType.POSITION) {
      this.geometry.computeBoundingBox = this.computeBoundingBox;
      this.geometry.computeBoundingSphere = this.computeBoundingSphere;

      this.__verticesCount += newValuesCount;
      if (!this.geometry.index) {
        this.geometry.setDrawRange(0, this.__verticesCount);
      }
      this.geometry.computeBoundingSphere();
    }
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (index !== undefined && index !== null &&
      index >= 0 && index <= this.__verticesCount) {
      return true;
    }
    return false;
  }

  // -------------------------------------
  // check if numbers are equal
  // -------------------------------------
  __isEqual(first, second, epsilon) {
    if (epsilon) return Math.abs(first - second) < epsilon;
    else return Math.abs(first - second) < this.EPS;
  }

  // --------------------
  // dispose
  // --------------------
  dispose() {
    super.dispose();
    // vertices
    if (this.vertices) this.vertices.material.dispose();

    // vertices' labels
    if (this.verticesLabels.length > 0) this.__destroyVerticesLabels();

    // wireframe mesh
    if (this.wfMesh) {
      this.remove(this.wfMesh);
      this.wfMesh.material.dispose();
      this.wfMesh = null;
    }

    if (this.material) {
      if (this.material.map) this.material.map.dispose();
      this.material.dispose();
    }

    this.geometry.dispose();
    
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].dispose) {
        this.children[i].dispose();
      }
    }
    this.children.length = 0;
  }

  // -------------------------------------
  // __setAttributes()
  // -------------------------------------
  __setAttributes(type, index, array) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    let attrib = this.geometry.attributes.position;
    if (type === MeshAttributeType.COLOR) {
      attrib = this.geometry.attributes.color;
    } else if (type === MeshAttributeType.NORMAL) {
      attrib = this.geometry.attributes.normal;
    } else if (type === MeshAttributeType.UV) {
      attrib = this.geometry.attributes.uv;
    }

    if (attrib) {
      // adjust values as: [x0, y0, z0, x1, y1, z1]
      const values = this.__validateArrayValues(type, array);
      if (values && values.length) {
        const vertCount = values.length / attrib.itemSize;
        
        // set new coordinates
        const last = index + vertCount > this.__verticesCount ? this.__verticesCount : index + vertCount;
        for (let i = index; i < last; ++i) {
          const pos = (i - index) * attrib.itemSize;
          if (attrib.itemSize === 2) {
            attrib.setXY(i, values[pos], values[pos + 1]);
          } else {
            attrib.setXYZ(i, values[pos], values[pos + 1], values[pos + 2]);
          }
        }

        attrib.needsUpdate = true;

        if (this.__verticesLabelsExist) {
          this.__changeVerticesLabels(index, vertCount, GlPointAction.Set);
        }

        this.geometry.computeBoundingSphere();
      }
    } else if (this.__recreateBufferGeometry) {
      this.__recreateBufferGeometry(type, array);
    }
  }

  // ---------------------------------------
  // __addAttributes()
  // ---------------------------------------
  __addAttributes(type, array) {
    // adjust values as: [x0, y0, z0, x1, y1, z1]
    const values = this.__validateArrayValues(type, array);
    if (values && values.length) {
      this.__createBufferGeometry(type, values);
    }
  }

  // -------------------------------------
  // getVertexAt()
  // -------------------------------------
  getVertexAt(index, asFlatArray) {
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
  // getVertices()
  // -------------------------------------
  getVertices(startIndex, endIndex, asFlatArray) {
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
  // getVerticesCount()
  // -------------------------------------
  getVerticesCount() {
    return this.__verticesCount;
  }

  // -------------------------------------
  // handle vertices
  // -------------------------------------
  addVertices(array) {
    this.__addAttributes(MeshAttributeType.POSITION, array);
  }

  setVertex(index, vertex) {
    this.setVertices(index, vertex);
  }

  setVertices(index, array) {
    this.__setAttributes(MeshAttributeType.POSITION, index, array);
  }

  isIndexed() {
    return this.geometry.index ? true : false;
  }

  findVertices(points, epsilon) {
    const vertIndices = [];
    const xyz = this.geometry.attributes.position;
    const coords = this.__validateArrayValues(MeshAttributeType.POSITION, points);
    if (coords && coords.length && xyz) {
      const ptCount = coords.length / xyz.itemSize;
      for (let i = 0; i < this.__verticesCount; i++) {
        // eslint-disable-next-line one-var
        const x = xyz.getX(i), y = xyz.getY(i), z = xyz.getZ(i);
        for (let j = 0; j < ptCount; j++) {
          if (this.__isEqual(coords[j * 3], x, epsilon) &&
              this.__isEqual(coords[j * 3 + 1], y, epsilon) &&
              this.__isEqual(coords[j * 3 + 2], z, epsilon)) {
            vertIndices.push(i);
            break;
          }
        }
        if (vertIndices.length === ptCount) break;
      }
    }
    return vertIndices;
  }

  // -------------------------------------
  // handle triangle faces
  // -------------------------------------
  setTriFaces(facesArray) {
    if (!(facesArray && facesArray.length > 0)) return;

    let version = 0;
    if (this.geometry.index) version = this.geometry.index.version + 1;

    if (facesArray instanceof Array) {
      this.geometry.setIndex(facesArray);
      this.geometry.index.version = version;
      if (facesArray.length > 0) this.geometry.setDrawRange(0, facesArray.length);
    } else if (ArrayBuffer.isView(facesArray)) {
      this.geometry.setIndex(new BufferAttribute(facesArray, 1));
      this.geometry.index.version = version;
      if (facesArray.length > 0) this.geometry.setDrawRange(0, facesArray.length);
    }

    this.__facesCount = facesArray.length;
  }

  getTriFaces(startIndex, endIndex) {
    const xyz = this.geometry.attributes.position;
    if (!startIndex) startIndex = 0;
    if (!endIndex) endIndex = (this.__facesCount / 3) - 1;
    if (xyz && this.__verticesCount > 2) {
      const isIndexed = this.geometry.index !== null;
      if (isIndexed) {
        const indArray = this.geometry.index.array.slice(startIndex * 3, (endIndex + 1) * 3);
        return indArray;
      }
    }
    return [];
  }

  getTriFacesCount() {
    let triFacesCnt = 0
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__verticesCount > 2) {
      const isIndexed = this.geometry.index !== null;
      if (isIndexed) {
        // triFacesCnt = Math.floor(this.geometry.index.array.length / 3);
        triFacesCnt = this.__facesCount / 3;
      } else {
        triFacesCnt = Math.floor(this.__verticesCount / 3);
      }
    }
    return triFacesCnt;
  }

  // -------------------------------------
  // handle colors
  // -------------------------------------
  addColors(array) {
    this.__addAttributes(MeshAttributeType.COLOR, array);
  }

  setColor(index, value) {
    this.setColors(index, value);
  }
  setColors(index, array) {
    this.__setAttributes(MeshAttributeType.COLOR, index, array);
  }

  setMeshColor(color) {
    if (color !== null || color !== undefined) {
      this.__color = color.isColor ? color.getHex() : color;
      if (this.material.vertexColors) {
        this.material.vertexColors = false;
        this.material.needsUpdate = true;
      }
      this.material.color.setHex(this.__color);
    }
  }

  getMeshColor() {
      return this.__color;
  }

  // -------------------------------------
  // handle normals
  // -------------------------------------
  addNormals(array) {
    this.__addAttributes(MeshAttributeType.NORMAL, array);
  }

  setNormal(index, normal) {
    this.setNormals(index, normal);
  }

  setNormals(index, array) {
    this.__setAttributes(MeshAttributeType.NORMAL, index, array);
  }

  // showFaceNormals
  showFaceNormals(flag, length) {
    if (flag) {
      // CREATE NORMALS
      // iterate over each face and create normal geometry
      const facesInd = this.getTriFaces();
      const matrixClone = this.matrixWorld.clone().invert();
      this.verticesNormals.count = this.__facesCount / 3;
      this.verticesNormals.setArrowGeometry(length);

      this.__m4.identity();
      const axisX = new Vector3();
      const axisY = new Vector3();
      const axisZ = new Vector3();
      for (let i = 0; i < this.__facesCount; i += 3) {
        const vert1 = this.getVertexAt(facesInd[i]);
        const vert2 = this.getVertexAt(facesInd[i + 1]);
        const vert3 = this.getVertexAt(facesInd[i + 2]);
        
        vert1.applyMatrix4(matrixClone);
        vert2.applyMatrix4(matrixClone);
        vert3.applyMatrix4(matrixClone);

        axisZ.copy(vert1).sub(vert3).normalize();
        axisX.copy(vert2).sub(vert3).normalize();
        axisZ.cross(axisX).normalize();
        axisY.crossVectors(axisZ, axisX).normalize();

        this.__m4.makeBasis(axisX, axisY, axisZ);
        
        const x = (vert1.x + vert2.x + vert3.x) / 3;
        const y = (vert1.y + vert2.y + vert3.y) / 3;
        const z = (vert1.z + vert2.z + vert3.z) / 3;
        this.__m4.setPosition(x, y, z);
        this.verticesNormals.setMatrixAt(i / 3, this.__m4);
      }

      this.add(this.verticesNormals);
      if (this.verticesNormals.getSegmentsCount()) this.__verticesNormalsExist = true;
    } else {
      // DELETE NORMALS
      this.verticesNormals.deleteAllSegments();
      this.remove(this.verticesNormals);
      this.verticesNormals.updateWorldMatrix()
      this.verticesNormals.length = 0;
      this.__verticesNormalsExist = false;
    }
  }

  invertNormals(startIndex, endIndex) {
    const indexes = this.geometry.index.array;

    let start = startIndex > 0 ? startIndex * 3 : 0;
    let end = endIndex < this.__facesCount ?  endIndex * 3 : this.__facesCount;
    this.__m4.identity();
    const axisX = new Vector3();
    const axisY = new Vector3();
    const axisZ = new Vector3();
    const matrixClone = this.matrixWorld.clone().invert();
    for (start; start < end; start += 3) {
      [indexes[start + 1], indexes[start + 2]] = [indexes[start + 2], indexes[start + 1]];
      if (this.isNormalsShown()) {
        // recreate normal
        const vert1 = this.getVertexAt(indexes[start]).applyMatrix4(matrixClone);
        const vert2 = this.getVertexAt(indexes[start + 1]).applyMatrix4(matrixClone);
        const vert3 = this.getVertexAt(indexes[start + 2]).applyMatrix4(matrixClone);

        axisZ.copy(vert1).sub(vert3).normalize();
        axisX.copy(vert2).sub(vert3).normalize();
        axisZ.cross(axisX).normalize();
        axisY.crossVectors(axisZ, axisX).normalize();

        this.__m4.makeBasis(axisX, axisY, axisZ);

        const x = (vert1.x + vert2.x + vert3.x) / 3;
        const y = (vert1.y + vert2.y + vert3.y) / 3;
        const z = (vert1.z + vert2.z + vert3.z) / 3;
        this.__m4.setPosition(x, y, z);
        this.verticesNormals.setMatrixAt(start / 3, this.__m4);
      } 
    }
    if (this.verticesNormals.instanceMatrix) {
      this.verticesNormals.instanceMatrix.needsUpdate = true;
    }
  }

  isNormalsShown() {
    return this.__verticesNormalsExist;
  }

  // -------------------------------------
  // handle UVs
  // -------------------------------------
  addUVs(array) {
    this.__addAttributes(MeshAttributeType.UV, array);
  }

  setUV(index, uv) {
    this.setUVs(index, uv);
  }
  setUVs(index, array) {
    this.__setAttributes(MeshAttributeType.UV, index, array);
  }

  applyBoxUV(transformMatrix) {
    const xyz = this.geometry.attributes.position;
    let bbox = this.geometry.boundingBox;
    if (!xyz || !bbox) return false;

    const boxSize = Math.max(
        bbox.max.x - bbox.min.x,
        bbox.max.y - bbox.min.y,
        bbox.max.z - bbox.min.z
    );

    bbox = new Box3(
        new Vector3(-boxSize / 2, -boxSize / 2, -boxSize / 2),
        new Vector3(boxSize / 2, boxSize / 2, boxSize / 2)
    );

    // const coords = [];
    // coords.length = 2 * xyz.array.length / 3;
    const coords = Array(2 * xyz.array.length / 3).fill(0);

    //
    const uv0 = new Vector2();
    const uv1 = new Vector2();
    const uv2 = new Vector2();
    const vtx0 = new Vector3();
    const vtx1 = new Vector3();
    const vtx2 = new Vector3();
    const norm = new Vector3();
    const tmpV1 = new Vector3();
    const tmpV2 = new Vector3();

    // maps 3 verts of 1 face on the better side of the cube
    // side of the cube can be XY, XZ or YZ
    const makeUVs = function(v0, v1, v2) {

      // pre-rotate the model so that cube sides match world axis
      if (transformMatrix) {
        v0.applyMatrix4(transformMatrix);
        v1.applyMatrix4(transformMatrix);
        v2.applyMatrix4(transformMatrix);
      }

      // get normal of the face, to know into which cube side it maps better
      tmpV1.copy(v1).sub(v0);
      tmpV2.copy(v1).sub(v2);
      norm.crossVectors(tmpV1, tmpV2).normalize();
      norm.x = Math.abs(norm.x);
      norm.y = Math.abs(norm.y);
      norm.z = Math.abs(norm.z);

      // xz mapping
      if (norm.y > norm.x && norm.y > norm.z) {
        uv0.x = (v0.x - bbox.min.x) / boxSize;
        uv0.y = (bbox.max.z - v0.z) / boxSize;

        uv1.x = (v1.x - bbox.min.x) / boxSize;
        uv1.y = (bbox.max.z - v1.z) / boxSize;

        uv2.x = (v2.x - bbox.min.x) / boxSize;
        uv2.y = (bbox.max.z - v2.z) / boxSize;

      } else
      if (norm.x > norm.y && norm.x > norm.z) {
        uv0.x = (v0.z - bbox.min.z) / boxSize;
        uv0.y = (v0.y - bbox.min.y) / boxSize;

        uv1.x = (v1.z - bbox.min.z) / boxSize;
        uv1.y = (v1.y - bbox.min.y) / boxSize;

        uv2.x = (v2.z - bbox.min.z) / boxSize;
        uv2.y = (v2.y - bbox.min.y) / boxSize;

      } else
      if (norm.z > norm.y && norm.z > norm.x) {
        uv0.x = (v0.x - bbox.min.x) / boxSize;
        uv0.y = (v0.y - bbox.min.y) / boxSize;

        uv1.x = (v1.x - bbox.min.x) / boxSize;
        uv1.y = (v1.y - bbox.min.y) / boxSize;

        uv2.x = (v2.x - bbox.min.x) / boxSize;
        uv2.y = (v2.y - bbox.min.y) / boxSize;
      }

      return {uv0, uv1, uv2};
    };

    if (this.geometry.index) { // is it indexed buffer geometry?
      for (let vi = 0; vi < this.geometry.index.array.length; vi += 3) {
        const idx0 = this.geometry.index.array[vi];
        const idx1 = this.geometry.index.array[vi + 1];
        const idx2 = this.geometry.index.array[vi + 2];

        const vx0 = xyz.array[3 * idx0];
        const vy0 = xyz.array[3 * idx0 + 1];
        const vz0 = xyz.array[3 * idx0 + 2];

        const vx1 = xyz.array[3 * idx1];
        const vy1 = xyz.array[3 * idx1 + 1];
        const vz1 = xyz.array[3 * idx1 + 2];

        const vx2 = xyz.array[3 * idx2];
        const vy2 = xyz.array[3 * idx2 + 1];
        const vz2 = xyz.array[3 * idx2 + 2];

        vtx0.set(vx0, vy0, vz0);
        vtx1.set(vx1, vy1, vz1);
        vtx2.set(vx2, vy2, vz2);

        const uvs = makeUVs(vtx0, vtx1, vtx2);

        coords[2 * idx0] = uvs.uv0.x;
        coords[2 * idx0 + 1] = uvs.uv0.y;

        coords[2 * idx1] = uvs.uv1.x;
        coords[2 * idx1 + 1] = uvs.uv1.y;

        coords[2 * idx2] = uvs.uv2.x;
        coords[2 * idx2 + 1] = uvs.uv2.y;
      }
    } else {
      for (let vi = 0; vi < xyz.array.length; vi += 9) {
        const vx0 = xyz.array[vi];
        const vy0 = xyz.array[vi + 1];
        const vz0 = xyz.array[vi + 2];

        const vx1 = xyz.array[vi + 3];
        const vy1 = xyz.array[vi + 4];
        const vz1 = xyz.array[vi + 5];

        const vx2 = xyz.array[vi + 6];
        const vy2 = xyz.array[vi + 7];
        const vz2 = xyz.array[vi + 8];

        vtx0.set(vx0, vy0, vz0);
        vtx1.set(vx1, vy1, vz1);
        vtx2.set(vx2, vy2, vz2);

        const uvs = makeUVs(vtx0, vtx1, vtx2);

        const idx0 = vi / 3;
        const idx1 = idx0 + 1;
        const idx2 = idx0 + 2;

        coords[2 * idx0] = uvs.uv0.x;
        coords[2 * idx0 + 1] = uvs.uv0.y;

        coords[2 * idx1] = uvs.uv1.x;
        coords[2 * idx1 + 1] = uvs.uv1.y;

        coords[2 * idx2] = uvs.uv2.x;
        coords[2 * idx2 + 1] = uvs.uv2.y;
      }
    }

    if (this.geometry.attributes.uv) {
      this.__setAttributes(MeshAttributeType.UV, 0, coords);
    } else {
      this.__addAttributes(MeshAttributeType.UV, coords);
    }
  }

  // -------------------------------------
  // showVertices()
  // -------------------------------------
  showVertices(flag) {
    if (flag) {
      if (!this.vertices && this.geometry.attributes.position) {
        const material = new THREE.PointsMaterial({
          size: 4.5,
          vertexColors: true,
        });

        const newRGB = new THREE.BufferAttribute(new Uint8Array(this.getVerticesCount() * 3), 3);
        
        this.geometry.setAttribute('color', newRGB);
        this.vertices = new THREE.Points();
        this.vertices.material = material;
        this.vertices.geometry.setAttribute('color', newRGB);
        this.vertices.geometry.setAttribute('position', this.geometry.attributes.position);

        this.vertices.name = "verticesPoints";
        this.vertices.raycast = function raycast(raycaster, intersects) {};

        this.add(this.vertices);
      } else if (this.vertices) {
        this.vertices.visible = true;
      }
    } else if (this.vertices) {
      this.vertices.visible = false;
    }
  }

  // -------------------------------------
  // ACTIONS ON LABELS
  // -------------------------------------

  // -------------------------------------
  // create or destroy vertices labels
  // -------------------------------------
  showVerticesLabels(flag) {
    this.__verticesLabelsBeforeSel = flag;
    if (flag && !this.__verticesLabelsExist) {
      this.__createVerticesLabels();
    } else if (!flag && this.__verticesLabelsExist) {
      this.__destroyVerticesLabels();
    }
  }

  __changeVerticesLabels(index, changedPointQuantity, action) {
    const xyz = this.geometry.attributes.position;
    if (xyz) {
      const syncPromises = [];
      if (action === GlPointAction.Delete) {
        for (let i = this.__verticesCount + changedPointQuantity - 1; i >= this.__verticesCount; i--) {
          // this.remove(this.verticesLabels[i]);
          this.verticesLabels[i].dispose();
        }

        this.verticesLabels.splice(this.__verticesCount, changedPointQuantity);

        for (let i = index; i < this.__verticesCount; i++) {
          this.verticesLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        }
      } else if (action === GlPointAction.Insert || action === GlPointAction.Add) {
        if (index !== this.__verticesCount - changedPointQuantity && action === GlPointAction.Insert) {
          for (let i = index; i < this.__verticesCount - changedPointQuantity; i++) {
            this.verticesLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
          }
        }

        for (let i = this.__verticesCount - changedPointQuantity; i < this.__verticesCount; i++) {
          const ind = i + 1;
          const coordLabel = ind.toString();

          const point = {
            x: xyz.getX(i),
            y: xyz.getY(i),
            z: xyz.getZ(i),
          };

          const label = new GlLabel({
            text: coordLabel,
            color: this.__verticesLabelsColor,
            font: this.__verticesLabelsFont,
            fontSize: 0.12,
            orientation: "camera"
          });

          // label.sync();
          syncPromises.push(label.sync());
          label.position.set(point.x, point.y, point.z);
          // this.add(label);
          this.verticesLabels.push(label);
        }
      } else if (action === GlPointAction.Set) {
        for (let i = index; i < index + changedPointQuantity; i++) {
          this.verticesLabels[i].position.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        }
      }
      this.executeOnLabelsUpdated(syncPromises);
    }
  }

  __createVerticesLabels() {
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__verticesCount > 0 && this.verticesLabels.length === 0) {
      const syncPromises = [];
      for (let i = 0; i < this.__verticesCount; ++i) {
        const ind = i + 1;
        const coordLabel = ind.toString();

        const point = {
          x: xyz.getX(i),
          y: xyz.getY(i),
          z: xyz.getZ(i),
        };
        const label = new GlLabel({
          text: coordLabel,
          color: this.__verticesLabelsColor,
          font: this.__verticesLabelsFont,
          fontSize: 0.12,
          orientation: "camera",
          scaleFactor: true
        });

        // label.sync();
        syncPromises.push(label.sync());
        label.position.set(point.x, point.y, point.z);
        // this.add(label);
        this.verticesLabels.push(label);
      }
      this.executeOnLabelsUpdated(syncPromises);
      this.__verticesLabelsExist = true;
    }
  }

  async executeOnLabelsUpdated(syncPromises) {
    await Promise.all(syncPromises);
    // all texts sync complete
    if (this.instancedLabel) {
      this.remove(this.instancedLabel);
      this.instancedLabel.dispose();
    }
    this.instancedLabel = mergeTextsIntoInstancedText(this.verticesLabels);
    if (this.instancedLabel) this.add(this.instancedLabel);
    this.handleLabel()();
  }

  __destroyVerticesLabels() {
    for (const label of this.verticesLabels) {
      // this.remove(label);
      label.dispose();
    }
    if (this.instancedLabel) {
      this.remove(this.instancedLabel);
      this.instancedLabel.dispose();
    }
    this.verticesLabels.length = 0;
    this.__verticesLabelsExist = false;
  }

  isVerticesLabelsShown() {
    return this.__verticesLabelsExist;
  }

  // -------------------------------------
  // setVerticesLabelsFont()
  // -------------------------------------
  setVerticesLabelsFont(font) {
    if (typeof font === 'string' && font.length > 5) {
      this.showVerticesLabels(false);
      this.__verticesLabelsFont = font;
      this.showVerticesLabels(true);
    }
  }

  getVerticesLabelsColor() {
    return this.__verticesLabelsColor;
  }

  // -------------------------------------
  // setVerticesLabelsColor()
  // -------------------------------------
  setVerticesLabelsColor(color) {
    if (!color) return;

    this.__verticesLabelsColor = color;
    if (this.__verticesLabelsExist) {
      for (const label of this.verticesLabels) {
        label.setColor(this.__verticesLabelsColor);
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
      if (!this.boundingBox) this.boundingBox = new Box3();

      if (xyz.count) {
        const bb = this.boundingBox;

        let minX = +Infinity;
        let minY = +Infinity;
        let minZ = +Infinity;

        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (let i = 0, l = xyz.count; i < l; i++) {
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
      if (this.boundingSphere === null) this.boundingSphere = new Sphere();

      this.computeBoundingBox();
      if (this.boundingBox.isEmpty()) {
        this.boundingSphere.radius = 0;
        this.boundingSphere.center.set(0, 0, 0);
        return;
      }

      // first, find the center of the bounding sphere
      const center = this.boundingSphere.center;
      this.boundingBox.getCenter(center);

      // second, try to find a boundingSphere with a radius smaller than the
      // boundingSphere of the boundingBox: sqrt(3) smaller in the best case
      let maxRadiusSq = 0;
      const _vector = new Vector3();

      for (let i = 0, il = xyz.count; i < il; i++) {
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
  // computeVertexNormals()
  // -------------------------------------
  computeVertexNormals() {
    this.geometry.computeVertexNormals();
  }

  // -------------------------------------
  // calculate the area
  // -------------------------------------
  getArea(offset) {
    const needOffset = offset !== null && offset !== undefined && offset.isVector3;
    let area = 0.0;
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__verticesCount > 2) {
      const isIndexed = this.geometry.index !== null;
      const p1 = new Vector3();
      const p2 = new Vector3();
      const p3 = new Vector3();
      if (!isIndexed) {
        const faces = xyz.count / 3;
        for (let i = 0; i < faces; i++) {
          p1.fromBufferAttribute(xyz, i * 3 + 0);
          p2.fromBufferAttribute(xyz, i * 3 + 1);
          p3.fromBufferAttribute(xyz, i * 3 + 2);
          p1.applyMatrix4(this.matrixWorld);
          p2.applyMatrix4(this.matrixWorld);
          p3.applyMatrix4(this.matrixWorld);
          if (needOffset) {
            p1.sub(offset);
            p2.sub(offset);
            p3.sub(offset);
          }
          const v1 = p2.sub(p1);
          const v2 = p3.sub(p1);

          area += (v1.cross(v2)).length() / 2.0;
        }
      } else {
        const indArray = this.geometry.index.array;
        const faces = this.geometry.index.count / 3;
        for (let i = 0; i < faces; i++) {
          p1.fromBufferAttribute(xyz, indArray[i * 3 + 0]);
          p2.fromBufferAttribute(xyz, indArray[i * 3 + 1]);
          p3.fromBufferAttribute(xyz, indArray[i * 3 + 2]);
          p1.applyMatrix4(this.matrixWorld);
          p2.applyMatrix4(this.matrixWorld);
          p3.applyMatrix4(this.matrixWorld);
          if (needOffset) {
            p1.sub(offset);
            p2.sub(offset);
            p3.sub(offset);
          }
          const v1 = p2.sub(p1);
          const v2 = p3.sub(p1);

          area += (v1.cross(v2)).length() / 2.0;
        }
      }
    }
    return area;
  }

  // -------------------------------------
  // calculate the projected area
  // -------------------------------------
  getProjectedArea(normal) {
    let area = 0.0;
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__verticesCount > 2) {
      const unitZ = new Vector3(0, 0, 1);
      let quat;
      if (normal && normal.isVector3) {
        quat = new Quaternion().setFromUnitVectors(normal, unitZ);
      }
      const firstPoint = new Vector3();
      const prevPoint = new Vector3();
      const nextPoint = new Vector3();

      firstPoint.set(xyz.getX(0), xyz.getY(0), xyz.getZ(0));
      if (quat) firstPoint.applyQuaternion(quat);
      prevPoint.copy(firstPoint);
      for (let i = 1; i < this.__verticesCount; i++) {
        nextPoint.set(xyz.getX(i), xyz.getY(i), xyz.getZ(i));
        if (quat) nextPoint.applyQuaternion(quat);
        area += (prevPoint.x * nextPoint.y) - (prevPoint.y * nextPoint.x);

        prevPoint.copy(nextPoint);
      }

      area += (prevPoint.x * firstPoint.y) - (prevPoint.y * firstPoint.x);
      area = Math.abs(area / 2);
    }
    this.silhoutteArea = area;

    return area;
  }

  getVolume(offset) {
    const needOffset = offset !== null && offset !== undefined && offset.isVector3;
    let sum = 0;
    const xyz = this.geometry.attributes.position;
    if (xyz && this.__verticesCount > 2) {
      const isIndexed = this.geometry.index !== null;
      const p1 = new Vector3();
      const p2 = new Vector3();
      const p3 = new Vector3();
      if (!isIndexed) {
        const faces = xyz.count / 3;
        for (let i = 0; i < faces; i++) {
          p1.fromBufferAttribute(xyz, i * 3 + 0);
          p2.fromBufferAttribute(xyz, i * 3 + 1);
          p3.fromBufferAttribute(xyz, i * 3 + 2);
          p1.applyMatrix4(this.matrixWorld);
          p2.applyMatrix4(this.matrixWorld);
          p3.applyMatrix4(this.matrixWorld);
          if (needOffset) {
            p1.sub(offset);
            p2.sub(offset);
            p3.sub(offset);
          }
          sum += p1.dot(p2.cross(p3)) / 6.0;
        }
      } else {
        const indArray = this.geometry.index.array;
        const faces = this.geometry.index.count / 3;
        for (let i = 0; i < faces; i++) {
          p1.fromBufferAttribute(xyz, indArray[i * 3 + 0]);
          p2.fromBufferAttribute(xyz, indArray[i * 3 + 1]);
          p3.fromBufferAttribute(xyz, indArray[i * 3 + 2]);
          p1.applyMatrix4(this.matrixWorld);
          p2.applyMatrix4(this.matrixWorld);
          p3.applyMatrix4(this.matrixWorld);
          if (needOffset) {
            p1.sub(offset);
            p2.sub(offset);
            p3.sub(offset);
          }

          sum += p1.dot(p2.cross(p3)) / 6.0;
        }
      }
    }
    if (this.isManifold) {
      this.volume = sum;
    }

    return sum;
  }

  // -------------------------------------
  // showWireFrame
  // -------------------------------------
  showWireFrame(flag) {
    if (flag && !this.wfMesh) {
      const wfMaterial = new MeshBasicMaterial({color: 0x000000, opacity: 0.3, wireframe: true, /*transparent: true*/});
      this.wfMesh = new GlMeshBase({ material: wfMaterial } );
      this.wfMesh.snappable = false;
      this.wfMesh.selectable = false;
      this.wfMesh.depthTest = this.depthTest;
      this.wfMesh.geometry = this.geometry;
      this.add(this.wfMesh);
    } else {
      this.remove(this.wfMesh);
      // this.wfMesh.geometry.dispose();
      this.wfMesh.material.dispose();
      this.wfMesh = null;
    }
  }

  // -------------------------------------
  // select / deselect on scene
  // -------------------------------------
  select(child) {
    if (!this.selectable || this.isSelected) return null;

    if (child && this.vertices && this.vertices.visible) {
      const found = this.selectedVertices.has(child.index);
      if (!found) {
        const rgb = this.geometry.attributes.color;
        const clr = {
          r: rgb.array[(child.index * 3)],
          g: rgb.array[(child.index * 3) + 1],
          b: rgb.array[(child.index * 3) + 2]
        };
        this.selectedVertices.set(child.index, clr);
        rgb.array[(child.index * 3)] = this.selectedColor.r;
        rgb.array[(child.index * 3) + 1] = this.selectedColor.g;
        rgb.array[(child.index * 3) + 2] = this.selectedColor.b;
        rgb.needsUpdate = true;
      }
    } else {
    if (!this.selectBySettingColor) {
      this.showWireFrame(true);
    } else {
      this.material.color.setHex(this.selectColor);
    }

    this.showPivotPoint();
    this.isSelected = true;
    }

    return null;
  }

  deselect(child) {
    const rgb = this.geometry.attributes.color;

    this.selectedVertices.forEach((value, i) => {
      rgb.array[(i * 3)] = value.r;
      rgb.array[(i * 3) + 1] = value.g;
      rgb.array[(i * 3) + 2] = value.b;
    });

    if (rgb) rgb.needsUpdate = true;

    if (this.wfMesh) {
      this.showWireFrame(false);
    } else {
      this.material.color.setHex(this.__color);
    }
      
    this.hidePivotPoint();
    this.isSelected = false;  
    
    this.selectedVertices.clear();
  }
  
  // -------------------------------------------
  // lock / unlock on scene
  // -------------------------------------------
  lock() {
    if (!this.selectable) return null;
    if (this.isSelected) this.deselect();
    this.selectable = false;
    return null;
  }
  unlock() {
    this.selectable = true;
  }

  // -------------------------------------------
  // frustumSelect on scene
  // -------------------------------------------
  frustumSelect(frustum, obb, multiSelect, view) {
    if (!frustum) return null;

    const xyz = this.geometry.attributes.position;
    const rgb = this.geometry.attributes.color;
    const normal = this.geometry.attributes.normal;
    if (xyz && rgb) {
      const point = new THREE.Vector3();
      const pntNormal = new THREE.Vector3();

      const sel = new THREE.Color(0xFF0000);

      for (let i = 0; i < this.__verticesCount; i++) {
        if (this.childIndexToSkip === i) continue;

        point.fromBufferAttribute(xyz, i);
        point.applyMatrix4(this.matrixWorld);
        const deselColor = this.selectedVertices.get(i);
        if (frustum.containsPoint(point) && this.visible && this.parent.visible) {
          // check if point is on the back side of mesh
          // if (normal) {
          //   pntNormal.fromBufferAttribute(normal, i);
          //   if (pntNormal.dot(view) > -this.EPS) continue;
          // }
          // check if point is inside section or not
          if (obb && !obb.containsPoint(point)) continue;
          if (this.selectedVertices.get(i)) continue;

          const clr = {
            r: rgb.array[(i * 3)],
            g: rgb.array[(i * 3) + 1],
            b: rgb.array[(i * 3) + 2]
          };
          this.selectedVertices.set(i, clr);
          rgb.array[(i * 3)] = sel.r;
          rgb.array[(i * 3) + 1] = sel.g;
          rgb.array[(i * 3) + 2] = sel.b;
        } else {
          // if (multiSelect) continue;
          if (deselColor) {
            rgb.array[(i * 3)] = deselColor.r;
            rgb.array[(i * 3) + 1] = deselColor.g;
            rgb.array[(i * 3) + 2] = deselColor.b;
            this.selectedVertices.delete(i);
          } else {
            rgb.array[(i * 3)] = this.verticesColor.r;
            rgb.array[(i * 3) + 1] = this.verticesColor.g;
            rgb.array[(i * 3) + 2] = this.verticesColor.b;
          }
        }
      }

      rgb.needsUpdate = true;
      return this.selectedVertices;
    }
    return null;
  }

  // -------------------------------------------
  // this function will be called by raycaster
  // -------------------------------------------
  raycast(raycaster, intersects) {
    // don't do raycasting if the object is not selectable
    if (!this.visible || (this.parent && !this.parent.visible) ||
        (!this.selectable && !this.snappable)) return;

    const snapMode = raycaster.params.snapMode;
    if (snapMode && !this.snappable && snapMode !== GlSnapMode.All) return;

    const geometry = this.geometry;
    const material = this.material;
    const matrixWorld = this.matrixWorld;
    if (material === undefined) return;

    // set the clipping sections obb
    const clippedSection = raycaster.params.clippedSection;
    if (clippedSection) this.__obb.copy(clippedSection.obb);

    // Checking boundingSphere distance to ray
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();

    _sphere.copy(geometry.boundingSphere);
    _sphere.applyMatrix4(matrixWorld);

    if (raycaster.ray.intersectsSphere(_sphere) === false) return;
    if (clippedSection && !this.__obb.intersectsRay(raycaster.ray)) return;
    _inverseMatrix.copy(matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);

    // Check boundingBox before continuing
    // if (geometry.boundingBox !== null) {
    //   if (_ray.intersectsBox(geometry.boundingBox) === false) return;
    // }

    if (clippedSection) this.__obb.applyMatrix4(_inverseMatrix);

    let intersection;
    const index = geometry.index;
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const uv2 = geometry.attributes.uv2;
    const groups = geometry.groups;
    const drawRange = geometry.drawRange;

    // if snapMode is points use position attr
    if (snapMode === GlSnapMode.Points || snapMode === GlSnapMode.Lines) {
      const inverseMatrix = new Matrix4();
      const ray = new Ray();
      const sphere = new Sphere();
      const precision = raycaster.params.Line.threshold;
      const threshold = raycaster.params.Points.threshold;

      // set the clipping sections obb
      const clippedSection = raycaster.params.clippedSection;
      if (clippedSection) this.__obb.copy(clippedSection.obb);

      const geometry = this.geometry;
      const matrixWorld = this.matrixWorld;

      sphere.copy(geometry.boundingSphere);
      sphere.applyMatrix4(matrixWorld);
      sphere.radius += precision;

      if (raycaster.ray.intersectsSphere(sphere) === false) return;
      if (clippedSection && !this.__obb.intersectsRay(raycaster.ray)) return;

      inverseMatrix.copy(matrixWorld).invert();
      ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

      if (clippedSection) this.__obb.applyMatrix4(inverseMatrix);

      const scale = this.scale;
      // threshold for point raycasting
      const localThreshold = threshold / ((scale.x + scale.y + scale.z) / 3);
      const localThresholdSq = localThreshold * localThreshold;

      const vStart = new Vector3();
      const xyz = geometry.attributes.position;
      for (let i = 0; i < this.__verticesCount; i++) {
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
              object: this,
              child: {
                distance: distance,
                distanceToRay: Math.sqrt(rayPointDistanceSq),
                point: vStart.clone().applyMatrix4(this.matrixWorld),
                index: i,
                object: this
              }
            });
          }
        }
      }
    } else {
      if (Array.isArray(material)) {
        for (let i = 0, il = groups.length; i < il; i++) {
          const group = groups[i];
          const groupMaterial = material[group.materialIndex];

          const start = Math.max(group.start, drawRange.start);
          const end = Math.min(index ? index.count : position.count, Math.min((group.start + group.count), (drawRange.start + drawRange.count)));

          for (let j = start, jl = end; j < jl; j += 3) {
            const a = index ? index.getX(j) : j;
            const b = index ? index.getX(j + 1) : j + 1;
            const c = index ? index.getX(j + 2) : j + 2;

            intersection = this.checkBufferGeometryIntersection(this, groupMaterial, raycaster, _ray, position, uv, uv2, a, b, c);
            if (intersection) {
              if (intersection.face) {
                intersection.face.index = Math.floor(j / 3); // triangle number in indexed buffer semantics
                intersection.face.materialIndex = group.materialIndex;
              }
              intersects.push(intersection);
            }
          }
        }
      } else {
        const start = Math.max(0, drawRange.start);
        const end = Math.min(index ? index.count : position.count, (drawRange.start + drawRange.count));

        for (let i = start, il = end; i < il; i += 3) {
          const a = index ? index.getX(i) : i;
          const b = index ? index.getX(i + 1) : i + 1;
          const c = index ? index.getX(i + 2) : i + 2;

          intersection = this.checkBufferGeometryIntersection(this, material, raycaster, _ray, position, uv, uv2, a, b, c);
          if (intersection) {
            if (intersection.face) intersection.face.index = Math.floor(i / 3); // triangle number in indexed buffer semantics
            intersects.push(intersection);
          }
        }
      }

    }
  }

  checkIntersection(object, material, raycaster, ray, pA, pB, pC, point) {
    let intersect;
    if (material.side === BackSide) {
      intersect = ray.intersectTriangle(pC, pB, pA, true, point);
    } else {
      intersect = ray.intersectTriangle(pA, pB, pC, material.side !== DoubleSide, point);
    }

    if (intersect === null) return null;
    if (raycaster.params.clippedSection && !this.__obb.containsPoint(point)) return null;

    const retIntersect = {};
    _intersectionPointWorld.copy(point);
    _intersectionPointWorld.applyMatrix4(object.matrixWorld);

    const distance = raycaster.ray.origin.distanceTo(_intersectionPointWorld);
    if (distance < raycaster.near || distance > raycaster.far) return null;

    const scale = this.scale;
    const snapMode = raycaster.params.snapMode;
    let threshold = raycaster.params.Points.threshold;
    const localThreshold = threshold / ((scale.x + scale.y + scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;

    const interSegment = new Vector3();
    const interRay = new Vector3();
    const distSq1 = ray.distanceSqToSegment(pA, pB, interRay, interSegment);
    if (snapMode !== GlSnapMode.Lines && distSq1 < localThresholdSq) {
      const distSqToStart = interSegment.distanceToSquared(pA);
      const distSqToEnd = interSegment.distanceToSquared(pB);
      if (distSqToStart < localThreshold || distSqToEnd < localThreshold) {
        retIntersect.child = {
          point: (distSqToStart < distSqToEnd) ? pA.clone().applyMatrix4(this.matrixWorld) : pB.clone().applyMatrix4(this.matrixWorld),
          index: (distSqToStart < distSqToEnd) ? 0 : 1
        }
      } 
    }

    const distSq2 = ray.distanceSqToSegment(pB, pC, interRay, interSegment);
    if (snapMode !== GlSnapMode.Lines && distSq2 < localThresholdSq) {
      const distSqToStart = interSegment.distanceToSquared(pB);
      const distSqToEnd = interSegment.distanceToSquared(pC);
      if (distSqToStart < localThreshold || distSqToEnd < localThreshold) {
        retIntersect.child = {
          point: (distSqToStart < distSqToEnd) ? pB.clone().applyMatrix4(this.matrixWorld) : pC.clone().applyMatrix4(this.matrixWorld),
          index: (distSqToStart < distSqToEnd) ? 1 : 2
        }
      } 
    }
    
    const distSq3 = ray.distanceSqToSegment(pC, pA, interRay, interSegment);
    if (snapMode !== GlSnapMode.Lines && distSq3 < localThresholdSq) {
      const distSqToStart = interSegment.distanceToSquared(pC);
      const distSqToEnd = interSegment.distanceToSquared(pA);
      if (distSqToStart < localThreshold || distSqToEnd < localThreshold) {
        retIntersect.child = {
          point: (distSqToStart < distSqToEnd) ? pC.clone().applyMatrix4(this.matrixWorld) : pA.clone().applyMatrix4(this.matrixWorld),
          index: (distSqToStart < distSqToEnd) ? 2 : 0
        }
      }
    }

    retIntersect.distance = distance;
    retIntersect.point = _intersectionPointWorld.clone();
    retIntersect.object = object;
    return retIntersect;
  }

  checkBufferGeometryIntersection(object, material, raycaster, ray, position, uv, uv2, a, b, c) {
    _vA.fromBufferAttribute(position, a);
    _vB.fromBufferAttribute(position, b);
    _vC.fromBufferAttribute(position, c);

    const intersection = this.checkIntersection(object, material, raycaster, ray, _vA, _vB, _vC, _intersectionPoint);
    
    if (intersection && intersection.child) {
      const vrtxInd = intersection.child.index;
      // set vertexindex according to points
      if (vrtxInd === 1) { 
        intersection.child.index = b;
      } else if (vrtxInd === 2) {
        intersection.child.index = c;
      } else {
        intersection.child.index = a;
      }
    };
    
    if (intersection) {
      if (uv) {
        _uvA.fromBufferAttribute(uv, a);
        _uvB.fromBufferAttribute(uv, b);
        _uvC.fromBufferAttribute(uv, c);
        intersection.uv = Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2());
      }

      if (uv2) {
        _uvA.fromBufferAttribute(uv2, a);
        _uvB.fromBufferAttribute(uv2, b);
        _uvC.fromBufferAttribute(uv2, c);
        intersection.uv2 = Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2());
      }

      const faceNormal = new THREE.Vector3();
      Triangle.getNormal(_vA, _vB, _vC, faceNormal);

      // if snapped to point do not need to give face information
      if (!intersection.child) {
        intersection.face = {
          a: a,
          b: b,
          c: c,
          normal: faceNormal,
          materialIndex: 0
        };
      }
    }

    return intersection;
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
        type: 'GlMeshBase',
        generator: 'GlMeshBase.toJSON'
      };
      if (this.isGlMesh) {
        output.metadata.type = 'GlMesh';
        output.metadata.generator = 'GlMesh.toJSON';
      } else if (this.isGlGraph) {
        output.metadata.type = 'GlGraph';
        output.metadata.generator = 'GlGraph.toJSON';
      }
    }

    //  'o' ->  'Orientable'
    //  'md' ->  'Manifold'
    //  'a' ->  'area'
    //  'sA' ->  'silhoutteArea'
    //  'vl' ->  'volume'
    //  'eP' ->  'eulerPoincare'
    //  'tCt' ->  'triCount' 
    //  'eCt' ->  'Orientable'
    //  'vCt' ->  'verticesCount'
    //  'vCr' ->  'verticesColor'
    //  'vr' ->  'vertices'
    //  'vLC' ->  'verticesLabelsColor'
    //  'vLE' ->  'verticesLabelsExist'
    //  'vV' ->  'verticesVisible'
    //  'mCr' ->  'material color'    

    const object = {};
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    // topology and geometry info
    object.o  = this.isOrientable;
    object.md  = this.isManifold;
    object.a = this.area;
    object.sA = this.silhoutteArea;
    object.vl = this.isManifold ? this.volume : 0;
    object.eP = this.eulerPoincare;
    object.tCt = this.triCount;
    object.eCt = this.edgesCount;

    object.vCt = this.__verticesCount;
    object.vCr = this.verticesColor.getHex();
    object.vr = (this.vertices && this.vertices.length > 0) ? true : false;
    object.vLC = this.__verticesLabelsColor;
    if (this.__verticesLabelsExist) object.vLE = this.__verticesLabelsExist;

    // material color
    object.mCr = this.__color;

    if (this.attributes.size > 0) object.uA = this.attributes.toJSON();

    this.geometry.verticesCount = this.__verticesCount;
    object.geom = GlUtils.bufferGeometryToJson(this.geometry);

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
      o: Primitive_Type.Uint8, // isOriantable
      md: Primitive_Type.Uint8, // isManifold 
      a: Primitive_Type.Uint32, // area
      sA: Primitive_Type.Uint32, // silhoutteArea
      vl: Primitive_Type.Uint32, // volume
      eP: Primitive_Type.Int32, // eulerPoincare
      tCt: Primitive_Type.Uint32, // triCount
      eCt: Primitive_Type.Uint32, // edgesCount
      vCt: Primitive_Type.Uint32, // verticesCount
      vCr: Primitive_Type.Uint32, // verticesColor
      vVC: Primitive_Type.Uint8, // vertexColors
      vr: Primitive_Type.Uint32, // vertices
      vLC: Primitive_Type.Uint32, // verticesLabelsColor
      vLE: Primitive_Type.Uint8, // verticesLabelsExist
      mCr: Primitive_Type.Uint32, // materialColor
      uA: Primitive_Type.Object, // attributes
      geom: Primitive_Type.Object // geometry
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

    // topology and geometry info
    writeToDv('o', this.isOrientable);
    writeToDv('md', this.isManifold);
    writeToDv('a', this.area);
    writeToDv('sA', this.silhoutteArea);
    writeToDv('vl', this.isManifold ? this.volume : 0);
    writeToDv('eP', this.eulerPoincare);
    writeToDv('tCt', this.triCount);
    writeToDv('eCt', this.edgesCount);

    writeToDv('vCt', this.__verticesCount);
    writeToDv('vCr', this.verticesColor.getHex());
    writeToDv('vVC', this.material.vertexColors);
    writeToDv('vr', (this.vertices && this.vertices.length > 0) ? true : false);
    writeToDv('vLC', this.__verticesLabelsColor);
    if (this.__verticesLabelsExist) writeToDv('vLE', this.__verticesLabelsExist);

    // material color
    writeToDv('mCr', this.__color);

    if (this.attributes.size > 0) {
      writeToDv('uA', null);
      this.attributes.toArrayBuffer(myDv);
    }

    writeToDv('geom', null);
    GlUtils.bufferGeometryToArrayBuffer(this.geometry, myDv);
    writeToDv('endObj');
  }
}
