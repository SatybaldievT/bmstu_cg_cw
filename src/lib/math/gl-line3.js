/* eslint-disable no-undef */
import {
  Line3,
  Vector3,
  MathUtils,
} from 'three';

export class GlLine3 extends Line3 {
  constructor(start, end) {
    super(start, end);
  }

  azimuth() {
    const delta = new Vector3();
    this.delta(delta);

    let azimuth = Math.atan2(delta.x, delta.y) * MathUtils.RAD2DEG;
    if (azimuth < 0) azimuth += 360.0;

    return azimuth;
  }

  dip() {
    const delta = new Vector3();
    this.delta(delta);

    let dip = 0;
    const sqDist = (delta.x * delta.x + delta.y * delta.y);
    if (sqDist === 0) dip = delta.z < 0 ? -90 : 90;
    else dip = Math.atan(delta.z / Math.sqrt(sqDist)) * MathUtils.RAD2DEG;

    return dip;
  }

  gradient() {
    const delta = new Vector3();
    this.delta(delta);

    let gradient = 0;
    const sqDist = (delta.x * delta.x + delta.y * delta.y);
    if (sqDist > 0.000001) {
      gradient = delta.z / Math.sqrt(sqDist);
    }

    return gradient;
  }

  distanceProjected(normal) {
    let projectedLength = 0;

    if (normal && normal.isVector3) {
      const prStart = this.start.clone();
      const prEnd = this.end.clone();
      prStart.projectOnPlane(normal);
      prEnd.projectOnPlane(normal);
      projectedLength = prStart.distanceTo(prEnd);
    }

    return projectedLength;
  }

}