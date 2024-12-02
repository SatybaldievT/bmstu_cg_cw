/* eslint-disable no-undef */
import { GlUtils } from '../utils/gl-utils';
import { Primitive_Type } from './gl-constants';
import {GlLayer} from './gl-layer';
import {
  Vector3,
  Box3,
} from 'three';

export class GlMeshSet extends GlLayer {
  constructor(params, fromJSON) {
    super();
    this.isGlMeshSet = true;
    this.type = 'GlMeshSet';
    this.name = '';

    this.EPS = 1e-8;
    this.bbox = new Vector3(1, 1, 1);

    // selection
    this.selectable = true;

    // vertices
    this.verticesColor = 0x000000;
    this.verticesVisible = false;

    // vertices' labels
    this.verticesLabelsColor = 0x0000ff;
    this.verticesLabelsVisible = false;

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
      if (params.verticesColor) this.verticesColor = params.verticesColor;
      if (params.verticesLabelsColor) this.verticesLabelsColor = params.verticesLabelsColor;
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

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    // dataSource
    if (fromJSON.dS) this.dataSource = fromJSON.dS;

    // vertices
    this.verticesColor = fromJSON.vCr;
    if (fromJSON.vV) this.verticesVisible = true;

    // vertices' labels
    this.verticesLabelsColor = fromJSON.vLC;
    if (fromJSON.vLV) this.verticesLabelsVisible = true;

    if (!fromJSON.v) this.visible = false;
  }

  // ------------------------------------------------
  // initialize an object from JSON_v1
  // ------------------------------------------------
  __initFromJson_v4_5(fromJSON) {
    // uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.name) this.name = fromJSON.name;

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

    // dataSource
    if (fromJSON.dataSource) this.dataSource = fromJSON.dataSource;

    // vertices
    this.verticesColor = fromJSON.verticesColor;
    if (fromJSON.verticesVisible) this.verticesVisible = true;

    // vertices' labels
    this.verticesLabelsColor = fromJSON.verticesLabelsColor;
    if (fromJSON.verticesLabelsVisible) this.verticesLabelsVisible = true;

    if (!fromJSON.visible) this.visible = false;
  }

  // -------------------------------------
  // adds a mesh to this set
  // -------------------------------------
  addChild(mesh, params) {
    if (!mesh.isGlMesh) return;
    params = params || {};

    const meshUuid = mesh.uuid;
    const found = params.unique ? -1 : this.children.findIndex((item) => item.uuid === meshUuid);
    if (found === -1) {
      if (!params.keepProperties) {
        mesh.showVertices(this.verticesVisible);
        mesh.showVerticesLabels(this.verticesLabelsVisible);
        mesh.setVerticesLabelsColor(this.verticesLabelsColor);
        mesh.setDepthTest(this.depthTest);
      }

      if (params && params.keepParent) {
        this.addKeepingParent(mesh);
      } else {
        this.add(mesh);
      }
    } else {
      console.log('Object already exist!');
    }

    return found === -1;
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (Number.isInteger(index) && index >= 0 && index < this.children.length) {
      return true;
    }
    return false;
  }

  // -------------------------------------
  // show/hide(with children) set
  // -------------------------------------
  showSet(flag) {
    if (flag === true || flag === false) {
      this.visible = flag;
    }
  }

  // -------------------------------------
  // makes GlMeshSet's properties
  // default to children.
  // e.g.: if the set's default point color is yellow,
  // then changes all children's point color to yellow
  // -------------------------------------
  setDefaults() {
    this.showVertices(null, null, true);
    this.showVerticesLabels(null, null, true);
    this.setVerticesLabelsColor(null, null, true);
  }

  // -------------------------------------
  // getPointAt()
  // -------------------------------------
  getPointAt(meshIndex, pointIndex, allChildren) {
    if (allChildren) {
      const points = [];
      for (let i = 0; i < this.children.length; i++) {
        const point = this.children[i].getPointAt(pointIndex);
        points.push(point);
      }
      return points;
    }

    if (this.__isValidIndex(meshIndex)) {
      return this.children[meshIndex].getPointAt(pointIndex);
    }
    return null;
  }

  // -------------------------------------
  // getVerticesCount()
  // -------------------------------------
  getVerticesCount(meshIndex, allChildren) {
    if (allChildren) {
      const verCount = [];
      for (let i = 0; i < this.children.length; i++) {
        const cnt = this.children[i].getVerticesCount();
        verCount.push(cnt);
      }
      return verCount;
    }

    if (this.__isValidIndex(meshIndex)) {
      return this.children[meshIndex].getVerticesCount();
    }
    return null;
  }

  // -------------------------------------
  // handle vertices
  // -------------------------------------
  addVertices(meshIndex, array, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].addVertices(array);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].addVertices(array);
    }
  }

  setVertex(meshIndex, vertexIndex, vertex) {
    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setVertices(vertexIndex, vertex);
    }
  }
  setVertices(meshIndex, vertexIndex, array) {
    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setVertices(vertexIndex, array);
    }
  }

  // -------------------------------------
  // handle triangle faces
  // -------------------------------------
  setTriFaces(meshIndex, facesArray, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].setTriFaces(facesArray);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setTriFaces(facesArray);
    }
  }

  // -------------------------------------
  // handle colors
  // -------------------------------------
  addColors(meshIndex, array, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].addColors(array);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].addColors(array);
    }
  }

  setColor(meshIndex, colorIndex, value, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].setColor(colorIndex, value);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setColor(colorIndex, value);
    }
  }
  setColors(meshIndex, colorIndex, array, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].setColors(colorIndex, array);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setColors(colorIndex, array);
    }
  }

  // -------------------------------------
  // handle normals
  // -------------------------------------
  addNormals(meshIndex, array, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].addNormals(array);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].addNormals(array);
    }
  }

  setNormal(meshIndex, vertexIndex, normal, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].setNormal(vertexIndex, normal);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setNormal(vertexIndex, normal);
    }
  }
  setNormals(meshIndex, vertexIndex, array, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].setNormals(vertexIndex, array);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setNormals(vertexIndex, array);
    }
  }

  // -------------------------------------
  // handle UVs
  // -------------------------------------
  addUVs(meshIndex, array, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].addUVs(array);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].addUVs(array);
    }
  }

  setUV(meshIndex, vertexIndex, uv, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].setUv(vertexIndex, uv);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setUV(vertexIndex, uv);
    }
  }
  setUVs(meshIndex, vertexIndex, array, allChildren) {
    if (allChildren) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].setUvs(vertexIndex, array);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setUVs(vertexIndex, array);
    }
  }

  // -------------------------------------
  // showVertices()
  // -------------------------------------
  showVertices(meshIndex, flag, allChildren) {
    if (flag === undefined || flag === null) {
      flag = this.verticesVisible;
    } else {
      this.verticesVisible = flag;
    }

    if (allChildren) {
      for (let i =0; i < this.children.length; i++) {
        this.children[i].showVertices(flag);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].showVertices(flag);
    }
  }

  // -------------------------------------
  // ACTIONS ON LABELS
  // -------------------------------------

  // -------------------------------------
  // create or destroy vertices labels
  // -------------------------------------
  showVerticesLabels(meshIndex, flag, allChildren) {
    if (flag === undefined || flag === null) {
      flag = this.verticesLabelsVisible;
    } else {
      this.verticesLabelsVisible = flag;
    }

    if (allChildren) {
      for (let i =0; i < this.children.length; i++) {
        this.children[i].showVerticesLabels(flag);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].showVerticesLabels(flag);
    }
  }

  isVerticesLabelsShown(vertexIndex, allChildren) {
    if (allChildren) {
      const verticesShown = [];
      for (let i =0; i < this.children.length; i++) {
        const shown = this.children[i].isVerticesLabelsShown();
        verticesShown.push(shown);
      }
      return verticesShown;
    }

    if (this.__isValidIndex(vertexIndex)) {
      return this.children[vertexIndex].isVerticesLabelsShown();
    }
  }

  // -------------------------------------
  // setVerticesLabelsFont()
  // -------------------------------------
  setVerticesLabelsFont(meshIndex, font, allChildren) {
    if (allChildren) {
      for (let i =0; i < this.children.length; i++) {
        this.children[i].setVerticesLabelsFont(font);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setVerticesLabelsFont(font);
    }
  }

  // -------------------------------------
  // setVerticesLabelsColor()
  // -------------------------------------
  setVerticesLabelsColor(meshIndex, color, allChildren) {
    if (color === undefined || color === null) {
      color = this.verticesLabelsColor;
    } else {
      this.verticesLabelsColor = color;
    }

    if (allChildren) {
      for (let i =0; i < this.children.length; i++) {
        this.children[i].setVerticesLabelsColor(color);
      }
      return;
    }

    if (this.__isValidIndex(meshIndex)) {
      this.children[meshIndex].setVerticesLabelsColor(color);
    }
  }

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox(includeAll) {
    const meshSetBB = new Box3();

    for (const object of this.children) {
      const skip = includeAll ? false : !(object.visible && object.getVerticesCount());
      if (object.getBoundingBox && !skip) {
        const objectBB = object.getBoundingBox();
        if (objectBB) {
          const min = objectBB.min.clone();
          const max = objectBB.max.clone();
          meshSetBB.expandByPoint(min);
          meshSetBB.expandByPoint(max);
        }
      }
    }
    if (!meshSetBB.isEmpty()) {
      meshSetBB.getSize(this.bbox);
      if (this.bbox.length() < 1) this.bbox.set(1, 1, 1);
    }
    return meshSetBB.isEmpty() ? null : meshSetBB;
  }

  // -------------------------------------
  // calculate the area
  // -------------------------------------
  getArea(meshIndex, allChildren) {
    if (allChildren) {
      const area = [];
      for (let i = 0; i < this.children.length; i++) {
        const meshArea = this.children[i].getArea();
        area.push(meshArea);
      }
      return area;
    }

    if (this.__isValidIndex(meshIndex)) {
      return this.children[meshIndex].getArea();
    }
  }

  // -------------------------------------
  // calculate the projected area
  // -------------------------------------
  getProjectedArea(meshIndex, normal, allChildren) {
    if (allChildren) {
      const area = [];
      for (let i = 0; i < this.children.length; i++) {
        const meshArea = this.children[i].getProjectedArea(normal);
        area.push(meshArea);
      }
      return area;
    }

    if (this.__isValidIndex(meshIndex)) {
      return this.children[meshIndex].getProjectedArea(normal);
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
        type: 'GlMeshSet',
        generator: 'GlMeshSet.toJSON'
      };
    }

    //  'vCt' ->  'verticesCount'
    //  'vCr' ->  'verticesColor'
    //  'vr' ->  'vertices'
    //  'vLC' ->  'verticesLabelsColor'
    //  'vLV' ->  'verticesLabelsVisible'
    //  'vV' ->  'verticesVisible'
    //  'vLC' ->  'verticesLabelsColor'    


    const object = {};
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    object.vCt = this.__verticesCount;
    object.vCr = this.verticesColor;
    object.vr = (this.vertices && this.vertices.length > 0) ? true : false;
    object.vLC = this.verticesLabelsColor;
    if(this.verticesLabelsVisible) object.vLV = this.verticesLabelsVisible;
    object.vV = this.verticesVisible;

    if (this.children.length) {
      object.ch = [];
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlMesh) {
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
      rO: Primitive_Type.Uint8, // renderOrder
      v: Primitive_Type.Uint8, // visible
      l: Primitive_Type.Int32, // layers.mask
      m: Primitive_Type.Float64Array, //matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      vCt: Primitive_Type.Uint32, // verticesCount
      vCr: Primitive_Type.Uint32, // verticesColor
      vr: Primitive_Type.Uint32, // vertices
      vLC: Primitive_Type.Uint32, // verticesLabelsColor
      vLV: Primitive_Type.Uint8, // verticesLabelsVisible
      vV: Primitive_Type.Uint8, // verticesVisible
      uA: Primitive_Type.Object, // attributes
      ch: Primitive_Type.Int32, // children
    }
  }

  // ------------------------
  // toArrayBuffer
  // ------------------------
  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);
  
    writeToDv("type", this.type);
    if (this.name !== '') writeToDv("n", this.name);
    if (this.renderOrder !== 0) writeToDv("rO", this.renderOrder);
    writeToDv("v", this.visible);
    writeToDv("l", this.layers.mask);
    writeToDv("m", this.matrix.toArray());
    if (this.matrixAutoUpdate === false) writeToDv("mAU", false);

    writeToDv("vCt", this.__verticesCount);
    writeToDv("vCr", this.verticesColor);
    writeToDv("vr", (this.vertices && this.vertices.length > 0) ? true : false);
    writeToDv("vLC", this.verticesLabelsColor);
    if(this.verticesLabelsVisible) writeToDv("vLV", this.verticesLabelsVisible);
    writeToDv("vV", this.verticesVisible);
    
    if (this.attributes.size > 0) {
      writeToDv('uA', null);
      this.attributes.toArrayBuffer(myDv);
    }

    if (this.children.length) {
      writeToDv('ch', this.children.length);
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlMesh) {
          this.children[i].toArrayBuffer(myDv);
        }
      }
      writeToDv('chEnd');
    }
    writeToDv('endObj');
  }
}