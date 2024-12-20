import { Vector3, Ray } from "three";

const _segCenter = /*@__PURE__*/ new Vector3();
const _segDir = /*@__PURE__*/ new Vector3();
const _diff = /*@__PURE__*/ new Vector3();
const __EPS = 1.e-6;

export class GlRay extends Ray {


  distanceSqToSegment(v0, v1, optionalPointOnRay, optionalPointOnSegment) {

    // from https://github.com/pmjoniak/GeometricTools/blob/master/GTEngine/Include/Mathematics/GteDistRaySegment.h
    // It returns the min distance between the ray and the segment
    // defined by v0 and v1
    // It can also set two optional targets :
    // - The closest point on the ray
    // - The closest point on the segment

    _segCenter.copy(v0).add(v1).multiplyScalar(0.5);
    _segDir.copy(v1).sub(v0).normalize();
    _diff.copy(this.origin).sub(_segCenter);

    const segExtent = v0.distanceTo(v1) * 0.5;
    const a01 = - this.direction.dot(_segDir);
    const b0 = _diff.dot(this.direction);
    const b1 = - _diff.dot(_segDir);
    const c = _diff.lengthSq();
    const det = Math.abs(1 - a01 * a01);
    let s0, s1, sqrDist, extDet;

    if (det > __EPS) {
      // The ray and segment are not parallel.
      s0 = a01 * b1 - b0;
      s1 = a01 * b0 - b1;
      extDet = segExtent * det;

      if (s0 >= 0) {
        if (s1 >= - extDet) {
          if (s1 <= extDet) {
            // region 0
            // Minimum at interior points of ray and segment.
            const invDet = 1 / det;
            s0 *= invDet;
            s1 *= invDet;
            sqrDist = s0 * (s0 + a01 * s1 + 2 * b0) + s1 * (a01 * s0 + s1 + 2 * b1) + c;
          }
          else {
            // region 1
            s1 = segExtent;
            s0 = Math.max(0, - (a01 * s1 + b0));
            sqrDist = - s0 * s0 + s1 * (s1 + 2 * b1) + c;
          }
        }
        else {
          // region 5
          s1 = - segExtent;
          s0 = Math.max(0, - (a01 * s1 + b0));
          sqrDist = - s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }
      }
      else {
        if (s1 <= - extDet) {
          // region 4
          s0 = Math.max(0, - (- a01 * segExtent + b0));
          s1 = (s0 > 0) ? - segExtent : Math.min(Math.max(- segExtent, - b1), segExtent);
          sqrDist = - s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }
        else if (s1 <= extDet) {
          // region 3
          s0 = 0;
          s1 = Math.min(Math.max(- segExtent, - b1), segExtent);
          sqrDist = s1 * (s1 + 2 * b1) + c;

        } else {
          // region 2
          s0 = Math.max(0, - (a01 * segExtent + b0));
          s1 = (s0 > 0) ? segExtent : Math.min(Math.max(- segExtent, - b1), segExtent);
          sqrDist = - s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }
      }
    }
    else {
      // Ray and segment are parallel.
      s1 = (a01 > 0) ? - segExtent : segExtent;
      s0 = Math.max(0, - (a01 * s1 + b0));
      sqrDist = - s0 * s0 + s1 * (s1 + 2 * b1) + c;
    }

    if (optionalPointOnRay) {
      optionalPointOnRay.copy(this.origin).addScaledVector(this.direction, s0);
    }

    if (optionalPointOnSegment) {
      optionalPointOnSegment.copy(_segCenter).addScaledVector(_segDir, s1);
    }

    return sqrDist;
  }
}
