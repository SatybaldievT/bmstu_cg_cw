import { GlMesh } from "./gl-mesh";
import { MathUtils } from "../utils/math-utils";
import { GlSnapMode, Primitive_Type } from "./gl-constants";
import { GlUtils } from "../utils/gl-utils";
import { GlImagePin } from "./gl-image-pins";
import {
  Matrix4,
  Ray,
  Vector3,
  Sphere,
  Plane,
  Object3D,
  TextureLoader,
  NearestFilter,
  SRGBColorSpace
} from 'three';

const _inverseMatrix = new Matrix4();
const _ray = new Ray();
const _intersect = new Vector3();
const _sphere = new Sphere();

export class GlImage extends GlMesh {
  constructor(params, fromJSON) {
    super(params, fromJSON);

    this.isGlImage = true;
    this.type = 'GlImage';
    this.name = '';

    this.material.polygonOffset = true;
    this.material.polygonOffsetUnits = 1;
    this.material.polygonOffsetFactor = 1;

    // image dimensions
    this.imageWidth = 0;
    this.imageHeight = 0;

    // selection color
    this.selectBySettingColor = true;
    this.selectColor = 0xffffff;

    // file name
    this.fileName = '';

    // plane of this image
    this.plane = new Plane();
    this.upDir = new Vector3();
    this.centroid = new Vector3();

    this.pinSet = new Object3D();
    this.add(this.pinSet);

    // storage for binding world coords to image
    this.bindPairs = [];
    this.imageTransformed = false;

    if (fromJSON) {
      this.__initFromJson(fromJSON);
    }
  }

  // ------------------------------------------------
  // initialize an object from JSON
  // ------------------------------------------------
  __initFromJson(fromJSON) {
    // name
    if (fromJSON.n) this.name = fromJSON.n;

    // set's visibility
    if (!fromJSON.v) this.visible = false;

    if (fromJSON.bP) this.bindPairs = fromJSON.bP;
    if (fromJSON.iT) this.imageTransformed = fromJSON.iT;
    if (fromJSON.vCt) this.__verticesCount = fromJSON.vCt;

    this.geometry.computeVertexNormals();

    if (fromJSON.iS) {
      new TextureLoader().load(fromJSON.iS, (texture) => {
        texture.minFilter = NearestFilter;
        texture.magFilter = NearestFilter;
        texture.colorSpace = SRGBColorSpace;

        this.imageWidth = texture.image.width;
        this.imageHeight = texture.image.height;

        if (this.material.map) this.material.map.dispose();
        texture.anisotropy = 4;
        this.material.polygonOffset = true;
        this.material.polygonOffsetFactor = 1;
        this.material.polygonOffsetUnits = -1;
        this.material.map = texture;
        this.material.needsUpdate = true;

      }, undefined, (error) => {
        console.log(error);
      });
    }

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

  }

  // ---------------
  // clone()
  // ---------------
  clone(keepUuid, keepParent) {
    const clone = super.clone(keepUuid, keepParent);
    clone.imageWidth = this.imageWidth;
    clone.imageHeight = this.imageHeight;
    clone.plane = this.plane;
    clone.upDir = this.upDir;
    clone.pinSet = this.pinSet;
    clone.bindPairs = this.bindPairs;
    clone.imageTransformed = this.imageTransformed;
    clone.fileName = this.fileName;
    console.log("clone");
    return clone;
  }

  getPlane() {
    this.updateMatrixWorld();
    const cnt = this.__verticesCount;
    if (cnt === 0) return null;

    // Get all vertices and compute centroid.
    // We assume that an image has 4 vertices
    //   0-----1
    //   |     |
    //   |     |
    //   3-----2
    const vs = this.getVertices(0, cnt - 1);
    const centroid = new Vector3();
    for (let i = 0; i < cnt; i++) {
      centroid.add(vs[i]);
    }
    centroid.divideScalar(cnt);
    this.centroid.copy(centroid);

    // compute the plane's normal and create a plane
    const v1 = vs[1].sub(vs[0]);
    const v2 = vs[2].sub(vs[0]);

    const normal = v2.cross(v1);
    normal.normalize();
    this.plane.setFromNormalAndCoplanarPoint(normal, centroid);

    // define the up direction of the image
    const ud = vs[0].sub(vs[3])
    ud.normalize();
    this.upDir.copy(ud);

    return this.plane;
  }

  transform() {
    if (this.bindPairs.length < 3) return;

    const pointsA = this.bindPairs.map(o => o.a);
    const pointsB = this.bindPairs.map(o => o.b);

    this.updateMatrixWorld();
    const matrixInv = this.matrixWorld.clone().invert();

    if (!this.imageTransformed) {
      // find local coordinates
      for (const p of pointsB) {
        p.applyMatrix4(matrixInv);
      }
    }

    this.applyMatrix4(matrixInv);

    const {
      rotationMatrix, scale, translation
    } = MathUtils.paramsToAlignPointPatterns(pointsA, pointsB);

    this.__m4.makeScale(scale.x, scale.y, scale.z);
    this.applyMatrix4(this.__m4);
    this.__m4.setFromMatrix3(rotationMatrix);
    this.__m4.setPosition(translation);
    this.applyMatrix4(this.__m4);
    this.imageTransformed = true;
  }

  showPins(flag) {
    this.pinSet.visible = flag;
  }

  addPin(point) {
    const v1 = new Vector3();
    v1.fromBufferAttribute(this.geometry.attributes.position, 0);
    const v2 = new Vector3();
    v2.fromBufferAttribute(this.geometry.attributes.position, 2);
    const imgDiag = v1.sub(v2).length();
    const pin = new GlImagePin(imgDiag);
    this.pinSet.add(pin);
    this.worldToLocal(point);
    pin.position.copy(point);
    pin.userData.position = point.clone();
  }

  deletePin(index) {
    this.bindPairs.splice(index, 1);
    this.pinSet.children[index].removeFromParent();
  }

  getImageBasis() {
    // We assume that an image has 4 vertices
    //   0-----1
    //   |     |
    //   |     |
    //   3-----2
    const vs = this.getVertices(0, cnt - 1);

    // compute the image's basis
    const xAxis = vs[2].sub(vs[3]).normalize();
    const yAxis = vs[0].sub(vs[3]).normalize();
    const zAxis = xAxis.clone().cross(yAxis).normalize();

    // all axis must be orthogonal
    yAxis.crossVectors(zAxis, xAxis).normalize();

    // define the up direction of the image
    this.upDir.copy(yAxis);

    return new Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(this.position);
  }

  // ----------------------------------
  // diagonal from vertex 2 to vertex 0
  // ----------------------------------
  getDiagonal() {
    if (this.getVerticesCount() != 0) {
      return new Vector3().subVectors(this.getVertexAt(0), this.getVertexAt(2));
    }
  }

  prepareUndoData() {
    const bindPairs = this.bindPairs.map(e => {
      return { a: e.a.clone(), b: e.b.clone() }
    })
    return {
      matrix: this.matrix.clone(),
      bindPairs,
      imageTransformed: this.imageTransformed,
    }
  }

  toJSON(meta, keepUuid = false) {
    const output = {};

    // meta is a string when called from JSON.stringify
    const isRootObject = (meta === undefined || meta === null || typeof meta === 'string');
    if (isRootObject) {
      output.metadata = {
        version: 5.0,
        type: 'GlImage',
        generator: 'GlImage.toJSON'
      };
    }

    const object = {};
    if (keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    if (this.bindPairs.length > 0) object.bP = this.bindPairs;

    if (this.imageTransformed) object.iT = this.imageTransformed;

    object.vCt = this.__verticesCount;
    this.geometry.verticesCount = this.__verticesCount;

    object.geom = GlUtils.bufferGeometryToJson(this.geometry);
    if (this.material.map) object.iS = this.material.map.source.data.currentSrc;

    output.object = object;
    return output;
  }

  get properties() {
    return {
      type: Primitive_Type.String, // type
      n: Primitive_Type.String, // name
      v: Primitive_Type.Uint8, // visible
      l: Primitive_Type.Int32, // layers.mask
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      bP: Primitive_Type.ObjectString, //bindPairs
      iT: Primitive_Type.Uint8, //imageTransformed
      vCt: Primitive_Type.Uint32, // verticesCount
      iS: Primitive_Type.String,
      geom: Primitive_Type.Object // goemtry
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

    if (this.bindPairs.length > 0) writeToDv('bP', this.bindPairs);

    if (this.imageTransformed) writeToDv('iT', this.imageTransformed);

    writeToDv('vCt', this.__verticesCount);

    if (this.material.map) writeToDv('iS', this.material.map.source.data.currentSrc);

    this.geometry.verticesCount = this.__verticesCount;
    writeToDv('geom', null);
    GlUtils.bufferGeometryToArrayBuffer(this.geometry, myDv);
    writeToDv('endObj');
  }
}