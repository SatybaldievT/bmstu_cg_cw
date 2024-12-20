import { ImageResources } from '../utils/image-resources';
import { OBB } from '../math/obb';
import { GlAttributes } from './gl-attribute';

import {
  Object3D,
  Matrix3,
  Matrix4,
  Vector3,
  Quaternion,
  BufferGeometry,
  Float32BufferAttribute,
  Texture,
  LinearMipMapLinearFilter,
  LinearFilter,
  PointsMaterial,
  Points,
  Ray,
  Sphere,
  Plane,
} from 'three';

export class GlBase extends Object3D {
  constructor() {
    super();

    this.isGlBase = true;
    this.type = 'GlBase';

    // for internal use only
    this.__m3 = new Matrix3();
    this.__m4 = new Matrix4();
    this.__v3 = new Vector3();
    this.__obb = new OBB();

    // selection
    this.selectable = false;
    this.isSelected = false;
    this.snappable = false;

    this._depthTest = true;

    // pivot point
    this.pivotOffset = new Vector3();
    this.pivotPoint = null;
    this.pivotPointColor = 0xFFFFFF;
    this.alwaysHidePivotPoint = false;
    /*
    __pivotPointVisible affects on object when
    not selected -> this.__pivotPointVisible
    selected -> always visible
    */
    this.__pivotPointVisible = false;
    this._metadata = null;

    // user attributes
    this.attributes = new GlAttributes();
    this._labelCounter = 0;
  }

  set depthTest(value) {
    this._depthTest = value;

    if (this.material && this.material.depthTest !== this._depthTest) {
      this.material.depthTest = this._depthTest;
      this.material.depthWrite = this._depthTest;
      this.material.needsUpdate = true;

      if (this._depthTest) {
        this.renderOrder = 0;
        if (this._transparent !== undefined) this.material.transparent = this._transparent;
      } else {
        this.renderOrder = 1;
        // since transparent objects are rendered last set to true
        this._transparent = this.material.transparent;
        this.material.transparent = true;
      }
    }


    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];
      const childMaterial = child.material;
      if (child.depthTest != undefined) {
        child.depthTest = this._depthTest;
      } else if (childMaterial) {
        childMaterial.depthTest = this._depthTest;
        childMaterial.depthWrite = this._depthTest;
        child.renderOrder = this.renderOrder;
        if (this._depthTest) {
          if (child._transparent !== undefined) childMaterial.transparent = child._transparent;
        } else {
          child._transparent = childMaterial.transparent;
          childMaterial.transparent = true;
        }
      }
    }
  }

  get depthTest() {
    return this._depthTest;
  }

  get metadata() {
    let metadata = {};

    for (let i = 0; i < this.children.length; i++) {
      metadata = { ...this._metadata, ...this.children[i].metadata };
    }

    return metadata;
  }

  set metadata(metadata) {
    this._metadata = metadata;
  }

  set pivotPointVisible(flag) {
    this.__pivotPointVisible = flag;
    if (this.pivotPoint) this.pivotPoint.snappable = flag;
  }

  get pivotPointVisible() {
    return this.__pivotPointVisible;
  }

  dispose() {
    this.disposePivotPoint();
    this.attributes.dispose();
  }

  setDepthTest(val) {
    if (this.material) this.depthTest = val;
  }

  // -------------------------------------
  // updateMatrix()
  // -------------------------------------
  updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    const px = this.pivotOffset.x,
          py = this.pivotOffset.y,
          pz = this.pivotOffset.z;

    if (!(px === 0 && py === 0 && pz === 0)) {
      const te = this.matrix.elements;
      te[12] += px - te[0] * px - te[4] * py - te[8] * pz;
      te[13] += py - te[1] * px - te[5] * py - te[9] * pz;
      te[14] += pz - te[2] * px - te[6] * py - te[10] * pz;
    }
    this.matrixWorldNeedsUpdate = true;
  };

  // -------------------------------------
  // showPivotPoint
  // -------------------------------------
  showPivotPoint(imageName, color, size) {
    if (this.alwaysHidePivotPoint) return;

    if (!this.pivotPoint) {
      this.__createPivotPoint(imageName, color, size);
    } else {
      this.pivotPoint.visible = true;
    }
  }

  // -------------------------------------
  // setPivotPoint
  // -------------------------------------
  setPivotPoint(pivotWorldCoord) {
    if (pivotWorldCoord && pivotWorldCoord.isVector3) {
      const __quat = new Quaternion();
      const __scale = new Vector3();

      const prevValue = this.matrixAutoUpdate;

      this.matrix.decompose(this.__v3, __quat, __scale);

      // calculate the new pivotOffset (pivot) vector
      this.__m4.copy(this.matrix);
      this.__m4.setPosition(0, 0, 0).invert();
      this.__m4.makeScale(1, 1, 1);
      this.pivotOffset.subVectors(pivotWorldCoord, this.__v3);
      this.pivotOffset.applyMatrix4(this.__m4);

      // Compose the transformation matrix that defines the local
      // coordinate system without position offset
      this.__m4.compose(this.position, this.quaternion, this.scale);

      // Calculate the new origin of imaginable rotation if the
      // pivotOffset had these values
      const px = this.pivotOffset.x,
            py = this.pivotOffset.y,
            pz = this.pivotOffset.z;

      const newOrigin = this.position.clone();
      const te = this.__m4.elements;
      newOrigin.x += px - te[0] * px - te[4] * py - te[8] * pz;
      newOrigin.y += py - te[1] * px - te[5] * py - te[9] * pz;
      newOrigin.z += pz - te[2] * px - te[6] * py - te[10] * pz;

      // Compute the shift vector that needs to define a new origin
      // with the new pivotOffset
      const shiftV = this.__v3.clone().sub(newOrigin);

      // Define the new origin that takes into account a newly set pivot point
      this.position.add(shiftV);

      this.matrixAutoUpdate = true;
      this.updateMatrixWorld();
      this.matrixAutoUpdate = prevValue;

      if (this.pivotPoint) {
        this.__m4.copy(this.matrixWorld).invert();
        this.__v3.copy(pivotWorldCoord).applyMatrix4(this.__m4);
        this.pivotPoint.position.copy(this.__v3);
      }
    }
  }

  // -------------------------------------
  // setPivotOffset
  // -------------------------------------
  setPivotOffset(pivotWorldCoord) {
    if (pivotWorldCoord && pivotWorldCoord.isVector3) {
      const __quat = new Quaternion();
      const __scale = new Vector3();

      this.matrix.decompose(this.__v3, __quat, __scale);

      this.__m4.copy(this.matrix);
      this.__m4.setPosition(0, 0, 0).invert();
      this.pivotOffset.subVectors(pivotWorldCoord, this.__v3);
      this.pivotOffset.applyMatrix4(this.__m4);

      this.__m4.compose(this.position, this.quaternion, this.scale);

      const px = this.pivotOffset.x,
        py = this.pivotOffset.y,
        pz = this.pivotOffset.z;

      const newOrigin = this.position.clone();
      const te = this.__m4.elements;
      newOrigin.x += px - te[0] * px - te[4] * py - te[8] * pz;
      newOrigin.y += py - te[1] * px - te[5] * py - te[9] * pz;
      newOrigin.z += pz - te[2] * px - te[6] * py - te[10] * pz;

      const shiftV = this.__v3.clone().sub(newOrigin);

      this.position.add(shiftV);
    }
  }

  // -------------------------------------
  // getPivotPosition
  // -------------------------------------
  getPivotPosition(wordlCoord) {
    if (!this.pivotPoint) {
      if (!this.pivotOffset.length()) return this.position.clone();
      this.__createPivotPoint();
    }

    const pvtPosition = this.pivotPoint.position.clone();
    const m4 = this.matrixWorld;
    return (wordlCoord) ? pvtPosition.applyMatrix4(m4) : pvtPosition
  }

  // -------------------------------------
  // resetPivotPoint
  // -------------------------------------
  resetPivotPoint() {
    if (this.pivotPoint) {
      this.pivotPoint.visible = false;
      this.pivotPoint.position.set(0, 0, 0);
    }
    this.pivotOffset.set(0, 0, 0);
    this.position.set(0, 0, 0);
    this.scale.set(1, 1, 1);
    this.quaternion.identity();
  }

  // -------------------------------------
  // hidePivotPoint
  // -------------------------------------
  hidePivotPoint() {
    if (this.pivotPoint) {
      this.pivotPoint.visible = false;
    }
  }

  // -------------------------------------
  // setPivotPointSize
  // -------------------------------------
  setPivotPointSize(size) {
    if (size < 1 && size > 100) return;
    if (this.pivotPoint && this.pivotPoint.material) {
      this.pivotPoint.material.size = size;
      this.pivotPoint.material.needsUpdate = true;
    }
  }

  // -------------------------------------
  // setPivotPointColor
  // -------------------------------------
  setPivotPointColor(color) {
    if (color !== undefined && color !== null) {
      this.pivotPointColor = color;
      if (this.pivotPoint && this.pivotPoint.material) {
        if (typeof this.pivotPointColor === 'number' || typeof this.pivotPointColor === 'bigint') {
          // we assume that color is hexadecimal
          this.pivotPoint.material.color.setHex(this.pivotPointColor);
        } else if (color instanceof Array) {
          // we assume that color is array of rgb
          this.pivotPoint.material.color.setRGB(this.pivotPointColor[0], this.pivotPointColor[1], this.pivotPointColor[2]);
          this.pivotPointColor = this.pivotPoint.material.color.getHex();
        } else {
          this.pivotPoint.material.color = this.pivotPointColor;
        }
        this.pivotPoint.material.needsUpdate = true;
      }
    }
  }

  // notify to parent when labels are updated
  handleLabel() {
    if (typeof this._labelCounter === 'number') {
      this._labelCounter++;
      const self = this;
      return function () {
        if (!(self._labelCounter - 1) && self.parent) {
          // find top parent which listens to this event
          let temp = self.parent
          while (temp) {
            if (temp._listeners && temp._listeners['handleLabel']) {
              break;
            }
            temp = temp.parent;
          }
          if (temp) temp.dispatchEvent({ type: 'handleLabel', message: 'handleLabelUpdate' });
        }
        self._labelCounter -= 1;
      };
    }
  }

  // -----------------------
  // update scene when all labels are ready
  onChildLabelChanged(context) {
    const glContext = context;
    const self = this;
    return (event) => {
      if (self.childLabelCount) {
        if (!(self.childLabelCount - 1)) {
          glContext.notifySceneGraphChanged();
        }
        self.childLabelCount -= 1;
        if (!self.childLabelCount) self.childLabelCount = null;
      } else {
        glContext.notifySceneGraphChanged();
      }
    };
  }

  // -------------------------------------
  // methods related to changes
  // -------------------------------------
  changed() {
    this.__changesCount++;
    if (this.parent && this.parent.childChanged) {
      this.parent.childChanged(this);
    }
  }

  undoChange() {
    this.__changesCount--;
    if (this.__changesCount < 0) this.__changesCount = 0;
    if (this.parent && this.parent.childChanged) {
      this.parent.childChanged(this);
    }
  }

  isChanged() {
    return this.__changesCount > 0;
  }

  changesSaved() {
    this.__changesCount = 0;
  }

  getChangesCount() {
    return this.__changesCount;
  }

  setChangesCount(changesCount) {
    this.__changesCount = changesCount;
  }

  // -------------------------------------
  // __createPivotPoint
  // -------------------------------------
  __createPivotPoint(imageName, color, size) {
    const pivotPointImage = imageName || 'sphere_blue';
    // get an appropriate image, which will be used as a texture
    const symbolImage = ImageResources.getBase64(pivotPointImage);
    if (symbolImage === null) {
      return;
    }

    // prepare the pivot point geometry
    if (color !== undefined && color !== null) this.pivotPointColor = color;
    const vertex = [0, 0, 0];
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertex, 3));

    this.pivotPointSize = size || 7;
    const texture = new Texture(symbolImage);
    texture.minFilter = LinearMipMapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;

    const material = new PointsMaterial({
      size: this.pivotPointSize,
      color: this.pivotPointColor,
      map: texture,
      transparent: true
    });

    this.pivotPoint = new Points(geometry, material);
    this.pivotPoint.snappable = this.pivotPointVisible;
    this.pivotPoint.raycast = function (raycaster, intersects) {
      if (!this.visible || (!this.parent || !this.parent.visible) || !this.snappable) return;
      const _inverseMatrix = new Matrix4();
      const _ray = new Ray();
      const _sphere = new Sphere();
      const _position = new Vector3();

      const geometry = this.geometry;
      const matrixWorld = this.matrixWorld;
      const threshold = raycaster.params.Points.threshold;

      // Checking boundingSphere distance to ray
      if (geometry.boundingSphere === null) geometry.computeBoundingSphere();

      _sphere.copy(geometry.boundingSphere);
      _sphere.applyMatrix4(matrixWorld);
      _sphere.radius += threshold;

      if (raycaster.ray.intersectsSphere(_sphere) === false) return;

      _inverseMatrix.copy(matrixWorld).invert();
      _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);

      const localThreshold = threshold / ((this.scale.x + this.scale.y + this.scale.z) / 3);
      const localThresholdSq = localThreshold * localThreshold;

      _position.fromBufferAttribute(geometry.attributes.position, 0);

      const rayPointDistanceSq = _ray.distanceSqToPoint(_position);
      if (rayPointDistanceSq < localThresholdSq) {

        const intersectPoint = new Vector3();

        _ray.closestPointToPoint(_position, intersectPoint);
        intersectPoint.applyMatrix4(matrixWorld);

        const distance = raycaster.ray.origin.distanceTo(intersectPoint);

        if (distance < raycaster.near || distance > raycaster.far) return;

        intersects.push({
          distance: distance,
          distanceToRay: Math.sqrt(rayPointDistanceSq),
          point: _position.clone().applyMatrix4(this.matrixWorld),
          object: this,
          child: {
            point: _position.clone().applyMatrix4(this.matrixWorld),
          }
        });
      }
    };
    this.pivotPoint.dispose = () => {
      this.pivotPoint.geometry.dispose();
      this.pivotPoint.material.dispose();
    }

    this.pivotPoint.name = "pivotPoint";
    this.pivotPoint.position.copy(this.pivotOffset);
    this.add(this.pivotPoint);
  }

  // -------------------------------------
  // disposePivotPoint
  // -------------------------------------
  disposePivotPoint() {
    if (this.pivotPoint) {
      const mat = this.pivotPoint.material;
      mat.dispose();
      if (mat.map && mat.map.dispose) mat.map.dispose();
      this.pivotPoint.geometry.dispose();
      this.remove(this.pivotPoint);
    }
  }

  // ------------------------
  // toArrayBuffer
  // ------------------------
  toArrayBuffer(myDv) { }

  // -----------------------------------------------------------------------------
  // setClippingPlanes
  // Sets local clipping planes based on minPoint, maxPoint, viewDir, and upDir.
  // viewDir and upDir must be the normalized vectors (if they are provided)
  // -----------------------------------------------------------------------------
  setClippingPlanes(ptMin, ptMax, viewDir, upDir) {
    if (this.material && ptMin && ptMin.isVector3 && ptMax && ptMax.isVector3) {
      const viewV = viewDir && viewDir.isVector3 ? viewDir : new Vector3(0, 0, -1);
      const upV = upDir && upDir.isVector3 ? upDir : new Vector3(0, 1, 0);
      const normal = viewV.clone().cross(upV).normalize();

      this.removeClippingPlanes();

      this.material.clipping = true;
      this.material.clippingPlanes = [new Plane(), new Plane(), new Plane(), new Plane()];
      const cp = this.material.clippingPlanes;
      const leftPl = cp[0];
      const rightPl = cp[1];
      const topPl = cp[2];
      const bottomPl = cp[3];

      leftPl.setFromNormalAndCoplanarPoint(normal, ptMin);
      normal.negate();
      rightPl.setFromNormalAndCoplanarPoint(normal, ptMax);
      normal.cross(viewV).normalize();
      topPl.setFromNormalAndCoplanarPoint(normal, ptMax);
      normal.negate();
      bottomPl.setFromNormalAndCoplanarPoint(normal, ptMin);

      this.material.minPoint = ptMin.clone();
      this.material.maxPoint = ptMax.clone();
      this.material.planePoint = new Vector3();
    }

    // make sure childrens are also updated
    for (const child of this.children) {
      if (child.setClippingPlanes) child.setClippingPlanes(ptMin, ptMax, viewDir, upDir);
    }
  }

  removeClippingPlanes() {
    if (this.material && Array.isArray(this.material.clippingPlanes)) {
      this.material.clipping = false;
      this.material.clippingPlanes = null;
      this.material.minPoint = null;
      this.material.maxPoint = null;
      this.material.planePoint = null;
    }
    // make sure childrens are also updated
    for (const child of this.children) {
      if (child.removeClippingPlanes) child.removeClippingPlanes();
    }
  }
}

