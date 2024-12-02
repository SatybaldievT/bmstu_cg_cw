import {
  Vector3,
  OrthographicCamera,
  Plane,
  Object3D,
} from 'three';

const _v1 = new Vector3();
const _v2 = new Vector3();
const _vDiff = new Vector3();

export class GlOrthographicCamera extends OrthographicCamera {
  constructor(left, right, top, bottom, near, far) {
    super(left, right, top, bottom, near, far);

    this.type = 'GlOrthographicCamera';
    this.isGlOrthographicCamera = true;

    this.focalPoint = new Vector3();
    this.fovCenter = new Vector3();
    this.__planes = [
      new Plane(),  // left plane
      new Plane(),  // right plane
      new Plane(),  // top plane
      new Plane(),  // bottom plane
    ]
  }

  get frustumPlanes() {
    return this.__planes;
  }

  // ----------------------------
  // copy 
  // ----------------------------
  copy(source, recursive) {
    OrthographicCamera.prototype.copy.call(this, source, recursive);

    if (!source.focalPoint) {
      this.focalPoint = null;
    } else {
      this.focalPoint.copy(source.focalPoint);
    }

    return this;
  }

  // ------------------------------
  // update the frustum parameters
  // ------------------------------
  updateFrustum(fovSize, aspect, farValue) {
    const fovWidth = aspect >= 1.0 ? fovSize * aspect : fovSize;
    const fovHeight = aspect >= 1.0 ? fovSize : fovSize / aspect;

    this.left = fovWidth / - 2;
    this.right = fovWidth / 2;
    this.top = fovHeight / 2;
    this.bottom = fovHeight / -2;
    this.near = 0;
    if (farValue && farValue > 1) {
      this.far = farValue;
    } else {
      this.far = fovWidth > fovHeight ? fovWidth : fovHeight;
    }
    this.updateProjectionMatrix();

    this.__updateFrustumPlanes();
  }

  // ----------------------------
  // Get the height of the FOV 
  // ----------------------------
  getFovHeight() {
    return (this.top - this.bottom) / this.zoom;
  }

  // ----------------------------
  // Get the width of the FOV 
  // ----------------------------
  getFovWidth() {
    return (this.right - this.left) / this.zoom;
  }

  // -------------------------------------------
  // Get the view direction vector (unit)
  // -------------------------------------------
  getViewDirection() {
    const viewDir = this.focalPoint.clone();
    viewDir.sub(this.position);
    viewDir.normalize();
    return viewDir;
  }

  getUpDirection() {
    const upDir = new Vector3();
    upDir.setFromMatrixColumn(this.matrixWorld, 2);
    return upDir;
  }

  // ------------------------------------
  // Extends 'lookAt' of Object3D
  // ------------------------------------
  lookAt(x, y, z) {
    if (x.isVector3) {
      this.focalPoint.copy(x);
    } else {
      this.focalPoint.set(x, y, z);
    }

    Object3D.prototype.lookAt.call(this, x, y, z);
  }

  // ----------------------------------
  // Get width / height aspect ratio
  // ----------------------------------
  getAspect() {
    const width = this.right - this.left;
    const height = this.top - this.bottom;

    return width / height;
  }

  // --------------------------
  // update the frustum planes
  // --------------------------
  __updateFrustumPlanes() {
    const ptL = new Vector3(-1, 0, 0);
    const ptR = new Vector3(1, 0, 0);
    const ptT = new Vector3(0, 1, 0);
    const ptB = new Vector3(0, -1, 0);

    // get the frustum space coordinates of the above points 
    // from the camera's normalized device coordinate (NDC) space
    ptL.applyMatrix4(this.projectionMatrixInverse).multiplyScalar(this.zoom);
    ptR.applyMatrix4(this.projectionMatrixInverse).multiplyScalar(this.zoom);
    ptT.applyMatrix4(this.projectionMatrixInverse).multiplyScalar(this.zoom);
    ptB.applyMatrix4(this.projectionMatrixInverse).multiplyScalar(this.zoom);

    // compute normals
    const vLeft = ptR.clone().sub(ptL).normalize();
    const vRight = vLeft.clone().negate();
    const vTop = ptB.clone().sub(ptT).normalize();
    const vBottom = vTop.clone().negate();

    // update the frustum planes' parameters
    const left = this.__planes[0];
    left.setFromNormalAndCoplanarPoint (vLeft, ptL);
    const right = this.__planes[1];
    right.setFromNormalAndCoplanarPoint (vRight, ptR);
    const top = this.__planes[2];
    top.setFromNormalAndCoplanarPoint (vTop, ptT);
    const bottom = this.__planes[3];
    bottom.setFromNormalAndCoplanarPoint(vBottom, ptB);
  }

  // --------------------------------
  // clip a line to camera's frustum
  // --------------------------------
  clipLineToFrustum(ptStart, ptEnd) {
    if (!(ptStart && ptStart.isVector3 &&
        ptEnd && ptEnd.isVector3)) return false;

    _v1.copy(ptStart);
    _v2.copy(ptEnd);
    _v1.applyMatrix4(this.matrixWorldInverse);
    _v2.applyMatrix4(this.matrixWorldInverse);

    let bInside = true;
    let lastClipPlaneIndex1 = -1;
    let lastClipPlaneIndex2 = -1;
    let index = 0;
    for (const plane of this.__planes) {
      const coeff = plane.constant / this.zoom;
      const normal = plane.normal;
      const startDist = normal.dot(_v1) + coeff;
      const endDist = normal.dot(_v2) + coeff;

      if (startDist < 0 && endDist < 0) {
        bInside = false;
        break;
      }
      if (startDist < 0) {
        const dRange = endDist - startDist;
        const dFactor = -startDist / dRange;
        _vDiff.copy(_v2).sub(_v1).multiplyScalar(dFactor) ;
        _v1.add(_vDiff);
        lastClipPlaneIndex1 = index;
      }
      else if (endDist < 0) {
        const dRange = startDist - endDist;
        const dFactor = -endDist / dRange;
        _vDiff.copy(_v1).sub(_v2).multiplyScalar(dFactor) ;
        _v2.add(_vDiff);
        lastClipPlaneIndex2 = index;
      }
      index++;
    }

    _v1.applyMatrix4(this.matrixWorld);
    _v2.applyMatrix4(this.matrixWorld);
    ptStart.copy(_v1);
    ptEnd.copy(_v2);

    return {bInside, lastClipPlaneIndex1, lastClipPlaneIndex2};
  }

  // ------------------------
  // toJSON
  // ------------------------
  toJSON(meta) {
    const data = super.toJSON(meta);
    data.object.focalPoint = this.focalPoint.clone();
    return data;
  }
}