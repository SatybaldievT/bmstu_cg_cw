import {
  Vector3,
  Matrix4,
  Matrix3,
  Quaternion,
  Mesh,
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  DoubleSide,
  Object3D,
  Box3
} from 'three';

const __unitY = new Vector3(0, 1, 0);
const __viewDir = new Vector3();
const __upDir = new Vector3();
const __rightDir = new Vector3();
const __m4 = new Matrix4();
const __m3 = new Matrix3();
const __v3 = new Vector3();
const __q1 = new Quaternion();

const __EPS = 1.e-6;

export class GlPlaneHelper extends Mesh {
  constructor(plane, size, hex) {

    const color = (hex !== undefined) ? hex : 0xACBFFF;
    // create plane's mesh
    const vertices = [1, 1, 0, - 1, 1, 0, - 1, - 1, 0, 1, - 1, 0];
    const faces = [0, 1, 2, 0, 2, 3];
    const meshGeom = new BufferGeometry();
    meshGeom.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    meshGeom.setIndex(faces);


    meshGeom.computeBoundingSphere();

    const meshMat = new MeshBasicMaterial({
      color: color,
      opacity: 0.3,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false});

    super(meshGeom, meshMat);

    this.lookAt(plane.normal);

    this.type = 'GlPlaneHelper';
    this.isGlPlaneHelper = true;
    this.plane = plane;
    this.width = (size === undefined) ? 1 : size;
    this.height = this.width;
  }

  setSize(width, height) {
    this.width = (!width) ? 1 : width;
    this.height = (!height) ? 1 : height;
  }

  // ------------------------------
  // updateMatrixWorld(force)
  // ------------------------------
  updateMatrixWorld(force) {
    this.scale.set(0.5 * this.width, 0.5 * this.height, 0.5 * this.height);
    Object3D.prototype.updateMatrixWorld.call(this, force);
  }

  // -------------------------
  // dispose
  // -------------------------
  dispose() {
    this.remove(this._planeMesh);
    this.geometry.dispose();
    this.material.dispose();
  }

  // ----------------------------------------
  // rotate grid towards the 'viewDirection'
  // 'viewDirection' must be a unit vector
  // ----------------------------------------
  rotate(viewDir, upDir) {
    __m4.identity();

    // if viewDir is a rotation matrix
    if (viewDir && viewDir.isMatrix3) {
      __m3.copy(viewDir);
      __m4.setFromMatrix3(__m3);

    } else {
      // if viewDir and upDir are Vector3
      if (viewDir && viewDir.isVector3 && viewDir.lengthSq() > __EPS) {
        __viewDir.copy(viewDir);
      } else {
        return;
      }

      if (upDir && upDir.isVector3 && upDir.lengthSq() > __EPS) {
        __upDir.copy(upDir);
      } else {
        __upDir.copy(__unitY);
      }

      this.updateMatrixWorld(true);

      __viewDir.normalize();
      __rightDir.crossVectors(__viewDir, __upDir);

      if (__rightDir.lengthSq() < __EPS) {
        // __upDir and __viewDir are parallel
        if (Math.abs(__upDir.z - 1) < __EPS) {
          __viewDir.x += 0.0001;
        } else {
          __viewDir.z += 0.0001;
        }

        __viewDir.normalize();
        __rightDir.crossVectors(__viewDir, __upDir);
      }

      __rightDir.normalize();
      __upDir.crossVectors(__rightDir, __viewDir);

      __viewDir.negate();
      __m4.makeBasis(__rightDir, __upDir, __viewDir);
    }

    this.quaternion.setFromRotationMatrix(__m4);
  }

  // -------------------------------------
  // get vertices' and their amount
  // -------------------------------------
  getVertices(asFlatArray = true) {
    const result = [];
    const vertices = [1, 1, 0, - 1, 1, 0, - 1, - 1, 0, 1, - 1, 0];
    for (let i = 0; i < 12; i += 3) {
      __v3.set(vertices[i], vertices[i + 1], vertices[i + 2]);
      __v3.applyMatrix4(this.matrixWorld);
      if (asFlatArray) {
        result.push(__v3.x, __v3.y, __v3.z);
      } else {
        result.push(new Vector3(__v3.x, __v3.y, __v3.z));
      }
    }
    return result;
  }

  getVerticesCount() {
    return 4;
  }

  // -------------------------------------
  // get faces and their amount
  // -------------------------------------
  getTriFacesCount() {
    return 2;
  }

  getTriFaces() {
    return [0, 1, 2, 0, 2, 3];
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

  // ---------------------------------------
  // checks if a plane intersects with box
  // ---------------------------------------
  intersectsBox(bbox) {
    if (bbox && bbox.isBox3) {
      const bb = this.getBoundingBox();
      return bbox.intersectsBox(bb);
    }
    return false;
  }

  // ---------------------------------------
  // checks if a plane intersects with obb
  // ---------------------------------------
  intersectsOBB(obb) {
    if (obb && obb.isOBB) {
      return obb.intersectsPlane(this.plane);
    }
    return false;
  }

  toJSON(meta) {
    return null;
  }
}
