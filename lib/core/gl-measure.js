/* eslint-disable no-undef */
import {MathUtils} from '../utils/math-utils';
import {GlLine3} from '../math/gl-line3';
import {
  Vector3,
  MathUtils as ThreeMathUtils
} from 'three';

export class GlMeasure {
  constructor(name) {
    this.name = name ? name : "Measure";
    this.type = "GlMeasure";
    this.precision = 4;
    this._polyline = null;

    this.__init();
  }

  __init() {
    this._valuesUpdated = false;
    this._projectedValuesUpdated = false;

    this._totalLength = '';
    this._projectedLength = '';
    this._segmentLength = '';
    this._projectedSegmentLength = '';
    this._azimuth = '';
    this._azimuthDms = '';
    this._internalAngle = '';
    this._internalAngleDms = '';
    this._projectedInternalAngle = '';
    this._projectedInternalAngleDms = '';
    this._inclination = '';
    this._inclinationFL = '';
    this._gradient = '';
    this._gradientFL = '';
    this._gradientPercent = '';
    this._gradientPercentFL = '';
    this._area = '';
    this._projectedArea = '';
  }

  set needsUpdate(value) {
    this._valuesUpdated = !value ? true : false;
    this._projectedValuesUpdated = !value ? true : false;
  }

  // -----------------------
  // attachPolyline()
  // -----------------------
  attachPolyline(poly) {
    if (poly && poly.isGlPolyline) {
      this._polyline = poly;
      this.__init();
    }
  }

  // -----------------------
  // detachPolyline()
  // -----------------------
  detachPolyline() {
    this._polyline = null;
    this.__init();
  }

  // -----------------------
  // __updateValues()
  // -----------------------
  __updateValues() {
    if (!this._polyline) return;

    this._totalLength = '';
    this._segmentLength = '';
    this._azimuth = '';
    this._azimuthDms = '';
    this._inclination = '';
    this._inclinationFL = '';
    this._area = '';
    this._gradient = '';
    this._gradientPercent = '';
    this._gradientFL = '';
    this._gradientPercentFL = '';
    this._internalAngle = '';
    this._internalAngleDms = '';

    const pntCount = this._polyline.getPointsCount();
    if (pntCount > 1) {
      const prec = this.precision;

      const first = this._polyline.getPointAt(0);
      const prev = this._polyline.getPointAt(pntCount - 2);
      const last = this._polyline.getPointAt(pntCount - 1);

      const deltaLast = new Vector3();
      deltaLast.subVectors(last, prev);
      const deltaFl = new Vector3();
      deltaFl.subVectors(last, first);

      const segmentLast = new GlLine3(prev, last);
      const segmentFl = new GlLine3(first, last);

      // total length, segment length
      this._totalLength = this._polyline.getLength().toFixed(prec);
      this._segmentLength = segmentLast.distance().toFixed(prec);

      const azimuth = segmentLast.azimuth();
      const azimuthRad = ThreeMathUtils.degToRad(azimuth);
      // const azimuthDms = MathUtils.radToDms(azimuthRad);

      // azimuth, azimuthDms
      this._azimuth = azimuth.toFixed(prec);
      this._azimuthDms = MathUtils.radToDms(azimuthRad, true);

      // inclinations
      this._inclination = segmentLast.dip().toFixed(prec);
      this._inclinationFL = segmentFl.dip().toFixed(prec);

      // area
      this._area = this._polyline.getArea().toFixed(prec);

      // gradient and gradient in %
      let tmp = 0;
      let len2d = Math.sqrt(deltaLast.x * deltaLast.x + deltaLast.y * deltaLast.y);
      if (Math.abs(deltaLast.z) > 1.e-4) {
        tmp = len2d / Math.abs(deltaLast.z);
        this._gradient = tmp.toFixed(4);
      }

      if (len2d > 1.e-4) {
        tmp = 100.0 * deltaLast.z / len2d;
        this._gradientPercent = tmp.toFixed(4) + '%';
      }

      // gradient and gradient in % (for the segment formed from the first and last points)
      len2d = Math.sqrt(deltaFl.x * deltaFl.x + deltaFl.y * deltaFl.y);
      if (Math.abs(deltaFl.z) > 1.e-4) {
        tmp = len2d / Math.abs(deltaFl.z);
        this._gradientFL = tmp.toFixed(4);
      }

      if (len2d > 1.e-4) {
        tmp = 100.0 * deltaFl.z / len2d;
        this._gradientPercentFL = tmp.toFixed(4) + '%';
      }

      // internal angles
      if (pntCount > 2) {
        const prevPt = this._polyline.getPointAt(pntCount - 3);
        const deltaPrev = new Vector3();
        deltaPrev.subVectors(prevPt, prev);

        const angle = Math.acos(deltaLast.dot(deltaPrev) / (deltaLast.length() * deltaPrev.length()));
        const angleDeg = ThreeMathUtils.radToDeg(angle);
        // const angleDms = MathUtils.radToDms(angle);

        this._internalAngle = isNaN(angleDeg) ? '' : angleDeg.toFixed(prec);
        this._internalAngleDms = isNaN(angle) ? '' : MathUtils.radToDms(angle, true);
      }

      this._valuesUpdated = true;
    }
  }

  // ----------------------------
  // __updateProjectedValues()
  // ----------------------------
  __updateProjectedValues(normal) {
    if (!(this._polyline && normal && normal.isVector3)) return;

    this._projectedLength = '';
    this._projectedSegmentLength = '';
    this._projectedArea = '';
    this._projectedInternalAngle = '';
    this._projectedInternalAngleDms = '';

    const pntCount = this._polyline.getPointsCount();
    if (pntCount > 1) {
      const prec = this.precision;

      const prev = this._polyline.getPointAt(pntCount - 2);
      const last = this._polyline.getPointAt(pntCount - 1);
      const segmentLast = new GlLine3(prev, last);

      // projected length, segment length, and area
      this._projectedLength = this._polyline.getProjectedLength(normal).toFixed(prec);
      this._projectedSegmentLength = segmentLast.distanceProjected(normal).toFixed(prec);
      this._projectedArea = this._polyline.getProjectedArea(normal).toFixed(prec);

      // projected internal angles
      if (pntCount > 2) {
        const prevPt = this._polyline.getPointAt(pntCount - 3);
        prevPt.projectOnPlane(normal);
        prev.projectOnPlane(normal);
        last.projectOnPlane(normal);

        const deltaLast = new Vector3();
        deltaLast.subVectors(last, prev);

        const deltaPrev = new Vector3();
        deltaPrev.subVectors(prevPt, prev);

        const angle = Math.acos(deltaLast.dot(deltaPrev) / (deltaLast.length() * deltaPrev.length()));
        const angleDeg = ThreeMathUtils.radToDeg(angle);
        // const angleDms = MathUtils.radToDms(angle);

        this._projectedInternalAngle = isNaN(angleDeg) ? '' : angleDeg.toFixed(prec);
        this._projectedInternalAngleDms = isNaN(angle) ? '' : MathUtils.radToDms(angle, true);
      }

      this._projectedValuesUpdated = true;
    }
  }

  // ----------------------------------------------------
  // getDelta(firstLast)
  // Returns the last segment of a polyline as a vector.
  // If the 'firstLast' is true then returns the vector
  // formed from the first and last points
  // ----------------------------------------------------
  getDelta(firstLast) {
    let delta = null;
    if (this._polyline) {
      const pntCount = this._polyline.getPointsCount();
      if (pntCount > 1) {
        delta = new Vector3();
        const start = firstLast ? this._polyline.getPointAt(0) : this._polyline.getPointAt(pntCount - 2);
        const end = this._polyline.getPointAt(pntCount - 1);
        delta.subVectors(end, start);
      }
    }
    return delta;
  }

  getLength() {
    if (!this._valuesUpdated) this.__updateValues();
    return this._totalLength;
  }

  getProjectedLength(normal) {
    if (!this._projectedValuesUpdated) this.__updateProjectedValues(normal);
    return this._projectedLength;
  }

  getSegmentLength() {
    if (!this._valuesUpdated) this.__updateValues();
    return this._segmentLength;
  }

  getProjectedSegmentLength(normal) {
    if (!this._projectedValuesUpdated) this.__updateProjectedValues(normal);
    return this._projectedSegmentLength;
  }

  getAzimuth() {
    if (!this._valuesUpdated) this.__updateValues();
    return this._azimuth;
  }

  getAzimuthDms() {
    if (!this._valuesUpdated) this.__updateValues();
    return this._azimuthDms;
  }

  getInclination() {
    if (!this._valuesUpdated) this.__updateValues();
    return this._inclination;
  }

  getInternalAngle() {
    if (!this._valuesUpdated) this.__updateValues();
    return this._internalAngle;
  }

  getInternalAngleDms() {
    if (!this._valuesUpdated) this.__updateValues();
    return this._internalAngleDms;
  }

  getProjectedInternalAngle(normal) {
    if (!this._projectedValuesUpdated) this.__updateProjectedValues(normal);
    return this._projectedInternalAngle;
  }

  getProjectedInternalAngleDms(normal) {
    if (!this._projectedValuesUpdated) this.__updateProjectedValues(normal);
    return this._projectedInternalAngleDms;
  }

  getGradient() {
    if (!this._valuesUpdated) this.__updateValues();
    return this._gradient;
  }

  getGradientPercent() {
    if (!this._valuesUpdated) this.__updateValues();
    return this._gradientPercent;
  }

  getArea() {
    if (!this._valuesUpdated) this.__updateValues();
    return this._area;
  }

  getProjectedArea(normal) {
    if (!this._projectedValuesUpdated) this.__updateProjectedValues(normal);
    return this._projectedArea;
  }

}