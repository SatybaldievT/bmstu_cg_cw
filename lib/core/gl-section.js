/* eslint-disable no-undef */
import {GlPlaneHelper} from './gl-plane-helper';
import {OBB} from '../math/obb';
import {GlObb} from '../objects/gl-obb';
import {
  Plane,
  Vector3,
  Matrix3,
} from 'three';

export class GlSection {
  constructor(params) {
    this.leftPlane = params.leftPlane;
    this.rightPlane = params.rightPlane;
    this.towardPlane = params.towardPlane;
    this.awayPlane = params.awayPlane;
    this.width = params.width;
    this.height = params.height;
    this.depth = params.depth;
    this.upDir = params.sectionUp;
    this.viewDir = params.sectionView;
    this.center = params.sectionCenter;
    this.boxCenter = params.spaceCenter;

    this.plane = new Plane();
    this.planeHelper = new GlPlaneHelper(this.plane, 1, 0xACBFFF);

    const halfSize = new Vector3(this.width/2 + 0.01, this.depth/2 + 0.01, this.height/2 + 0.01);

    const axisX = new Vector3();
    axisX.crossVectors(this.viewDir, this.upDir).normalize();

    const rotation = new Matrix3();
    rotation.set( 
      axisX.x, this.viewDir.x, this.upDir.x,
      axisX.y, this.viewDir.y, this.upDir.y,
      axisX.z, this.viewDir.z, this.upDir.z
    );

    this.obb = new OBB();
    this.obb.set(this.boxCenter, halfSize, rotation);

    this.boxHelper = new GlObb({name: "boxHelper"});
    const shrinkedSize = halfSize.clone();
    shrinkedSize.x -= 0.02;
    shrinkedSize.y -= 0.02;
    shrinkedSize.z -= 0.02;
    this.boxHelper.set(this.boxCenter, shrinkedSize, rotation);
    this.boxHelper.material.copy(this.planeHelper.material);
    this.boxHelper.material.opacity = 0.8;

    this._init();
  }

  _init() {
    const viewDir = this.viewDir.clone();
    viewDir.negate();
    this.plane.setFromNormalAndCoplanarPoint(viewDir, this.center);

    // position the plane helper
    this.planeHelper.rotate(this.viewDir, this.upDir);
    this.planeHelper.position.copy(this.center);
    this.planeHelper.setSize(this.width, this.height);
  }

  dispose() {
    this.planeHelper.dispose();
    this.boxHelper.dispose();
  }

  showSection(flag) {
    if (flag) this.planeHelper.visible = true;
    else this.planeHelper.visible = false;
  }

  isShown() {
    return this.planeHelper.visible;
  }
}

GlSection.prototype.isGlSection = true;