/* eslint-disable no-undef */
import { GlBase } from './gl-base';
import { GlIntervalGeometry } from './gl-interval-geometry';
import { GlIntervalMaterial } from './gl-interval-material';
import { GlLabel } from './gl-label';
import { ImageResources } from '../utils/image-resources';
import { MathUtils } from '../utils/math-utils';
import { GlPointsGeometry } from './gl-points-geometry';
import { GlSnapMode, Primitive_Type } from './gl-constants';
import { utils } from '@tangens/common/utils/dataUtils';
import { GlUtils } from '../utils/gl-utils';
import { GlRay } from './gl-ray';
import {
  Box3,
  Vector3,
  Color,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  BufferAttribute,
  PointsMaterial,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  Texture,
  LinearMipMapLinearFilter,
  LinearFilter,
  Matrix4,
  Ray,
  Sphere,
} from 'three';

export class GlTrace extends GlBase {
  constructor(params, fromJSON) {
    super();

    // create a GlTrace's geometry and material
    const geometry = new GlIntervalGeometry();
    const material = new GlIntervalMaterial({vertexColors: true});
    material.clipping = true;

    this.geometry = geometry;
    this.material = material;

    // set the object's type
    this.isMesh = true;         // this is needed to render this object via WebGlRenderer correctly
    this.isGlTrace = true;
    this.type = 'GlTrace';

    this.intervals = [];

    // traceLength stores all generated points
    this.traceLength = [];
    // traceLengthAuto stores all auto generated points
    this.traceLengthAuto = [];

    this.EPS = 1e-7;
    this.lenEPS = 1e-7;
    this.__changesCount = 0;

    this.length = 0;

    // collar label
    this.collarLabel;
    this.collarLabelColor = 0xff0000;

    // length label
    this.lengthLabel;
    this.lengthLabelColor = 0xff0000;

    // trace
    this.traceColor = 0x000000;
    this.traceWidth = 2;

    this.materialColor = 0xFFFFFF;

    // collar point
    this.collarPoint = null;
    this.collarPointColor = 0x0000ff;

    // point objects
    this.pointsGeometry = null;
    this.pointObjects = null;
    this.pointObjectsColor = 0x000000;

    // selection
    this.selectable = true;
    this.snappable = true;
    this.editable = false;

    if (params) {
      this.name = (params && params.name) ? params.name : "";
      if (params.uuid) this.uuid = params.uuid;

      if (params.traceColor) this.traceColor = params.traceColor;

      if (params.collarLabelColor) this.collarLabelColor = params.collarLabelColor;
      if (params.lengthLabelColor) this.lengthLabelColor = params.lengthLabelColor;
      if (params.collarPointColor) this.collarPointColor = params.collarPointColor;
      if (params.pointObjectsColor) this.pointObjectsColor = params.pointObjectsColor;

      this.material.color.setHex(this.materialColor);

      if (params.traceWidth) this.traceWidth = params.traceWidth;
      this.material.linewidth = this.traceWidth;

    } else if (fromJSON) {
      if(fromJSON.version !== 4.5) {
        this.__initTraceFromJson(fromJSON);
      } else {
        this.__initTraceFromJson_v4_5(fromJSON);
      };
    }
  }

  set name(name) {
    this._name = name;
    if (name.length) {
      this.__createCollarLabel();
    }
  }

  get name() {
    return this._name;
  }

  // ------------------------------------------------
  // initialize an object from JSON
  // ------------------------------------------------
  __initTraceFromJson(fromJSON) {
    //uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    // name
    if (fromJSON.n) this.name = fromJSON.n;

    if (fromJSON.mCr) {
      this.materialColor = fromJSON.mCr;
      this.material.color.setHex(this.materialColor);
    }

    if (!this._isEmpty(fromJSON.tCr)) this.setTraceColor(fromJSON.tCr);
    if (fromJSON.tW) {
      this.traceWidth = fromJSON.tW;
      this.material.linewidth = this.traceWidth;
    }

    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;

    // collar label
    if (fromJSON.cLC) this.collarLabelColor = fromJSON.cLC;
    // if (fromJSON.cL) this.showCollarLabel();

    // collar point
    if (fromJSON.cPC) this.collarPointColor = fromJSON.cPC;
    if (fromJSON.cPV) {
      this.showCollarPoint(fromJSON.cPI, fromJSON.cPC, fromJSON.cPS);
    }

    if (!fromJSON.v) this.visible = false;
    
    // depth label
    if (fromJSON.dPL) this.lengthLabelColor = fromJSON.dPL;
  }

  // ------------------------------------------------
  // initialize an object from JSON_v1
  // ------------------------------------------------
  __initTraceFromJson_v4_5(fromJSON) {

    this.name = fromJSON.name;
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;

    if (!this._isEmpty(fromJSON.materialColor)) {
      this.materialColor = fromJSON.materialColor;
      this.material.color.setHex(this.materialColor);
    }

    if (!this._isEmpty(fromJSON.traceColor)) this.traceColor = fromJSON.traceColor;
    if (fromJSON.traceWidth) {
      this.traceWidth = fromJSON.traceWidth;
      this.material.linewidth = this.traceWidth;
    }

    if (fromJSON.matrix !== undefined) {
      this.matrix.fromArray(fromJSON.matrix);
      if (fromJSON.matrixAutoUpdate !== undefined) this.matrixAutoUpdate = fromJSON.matrixAutoUpdate;
      if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);
    } else {
      if (fromJSON.position !== undefined) this.position.fromArray(fromJSON.position);
      if (fromJSON.rotation !== undefined) this.rotation.fromArray(fromJSON.rotation);
      if (fromJSON.quaternion !== undefined) this.quaternion.fromArray(fromJSON.quaternion);
      if (fromJSON.scale !== undefined) this.scale.fromArray(fromJSON.scale);
    }

    if (!this._isEmpty(fromJSON.renderOrder)) this.renderOrder = fromJSON.renderOrder;

    // collar label
    if (!this._isEmpty(fromJSON.collarLabelColor)) this.collarLabelColor = fromJSON.collarLabelColor;
    if (fromJSON.collarLabel) this.showCollarLabel();

    // collar point
    if (!this._isEmpty(fromJSON.collarPointColor)) this.collarPointColor = fromJSON.collarPointColor;
    if (fromJSON.collarPoint) {
      this.showCollarPoint(fromJSON.collarPointImage, fromJSON.collarPointColor, fromJSON.collarPointSize);
    }

    if (!fromJSON.visible) {
      this.visible = false;
    }
  }

  _isEmpty(value) {
    return value === null || value === undefined;
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

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox() {
    if (!this.geometry.boundingBox) this.geometry.computeBoundingBox();
    const boundingBox = new Box3();
    boundingBox.copy(this.geometry.boundingBox);
    boundingBox.applyMatrix4(this.matrixWorld);

    return boundingBox.isEmpty() ? null : boundingBox;
  }

  // -------------------------------------
  // set drillhole's material resolution
  // -------------------------------------
  setMaterialResolution(width, height) {
    this.material.resolution.set(width, height);
  }

  generateCoord(intervals) {
    const newPoints = [];
    const pointsCount = this.geometry.getPointsCount();
    const trace = this.getPoints(0, pointsCount - 1);
    for (let start = 0, size = intervals.length; start < size; ++start) {
      // loop through intervals and compute new coordinates
      let tracePos = 0;
      const interval = intervals[start];

      if (!(intervals[start].to - intervals[start].from >= this.lenEPS)) {
        // console.log(intervals[start].id + " unsuitable !");
        intervals.splice(start, 1);
        start--;
        size--;
        continue;
      } else if (!(intervals[start].to <= this.length && intervals[start].from < this.length)) {
        // console.log(intervals[start].id + " out of the depth !");
        intervals.splice(start, 1);
        start--;
        size--;
        continue;
      }

      // add trace coordinates lying above the current 'interval.from'
      while (tracePos < trace.length) {
        if (!(this.traceLength[tracePos] < interval.from + this.lenEPS)) {
          break;
        }
        tracePos++;
      }

      // if encountered end of the trace coordinates break the loop
      if (tracePos >= trace.length) {
        intervals.splice(size - 1, intervals.length);
        break;
      }

      let abovePos = trace[tracePos - 1];
      let aboveDepth = this.traceLength[tracePos - 1];

      let belowPos = trace[tracePos];
      let belowDepth = this.traceLength[tracePos];

      let p1, p2;
      // generate a new point for the value 'interval.from'
      let coeff = (interval.from - aboveDepth) / (belowDepth - aboveDepth);
      p1 = new Vector3(
        abovePos.x + (belowPos.x - abovePos.x) * coeff,
        abovePos.y + (belowPos.y - abovePos.y) * coeff,
        abovePos.z + (belowPos.z - abovePos.z) * coeff
      )

      // add trace coordinates lying between 'interval.from' and 'interval.to'
      while (tracePos < trace.length) {
        if (this.traceLength[tracePos] === interval.to) break;

        // if (!(this.traceLength[tracePos] < interval.to + this.lenEPS)) {
        if (!(this.traceLength[tracePos] < interval.to)) {
          break;
        }

        tracePos++;
      }

      // if encountered end of the trace coordinates break the loop
      if (tracePos >= trace.length) {
        intervals.splice(size - 1, intervals.length);
        break;
      }

      // generate a trace coordinates for the value 'interval.to'
      abovePos = trace[tracePos - 1];
      aboveDepth = this.traceLength[tracePos - 1];

      belowPos = trace[tracePos];
      belowDepth = this.traceLength[tracePos];

      coeff = (interval.to - aboveDepth) / (belowDepth - aboveDepth);
      p2 = new Vector3(
        abovePos.x + (belowPos.x - abovePos.x) * coeff,
        abovePos.y + (belowPos.y - abovePos.y) * coeff,
        abovePos.z + (belowPos.z - abovePos.z) * coeff
      );

      newPoints.push([p1, p2]);

    }

    return newPoints;
  }

  // -------------------------------------
  // add intervals
  // -------------------------------------
  addIntervals(array) {
    if (array instanceof Array && array.length > 0) {

      const intervals = [];
      array.forEach((item) => {
        let color;
        if (item.color) {
          if (typeof (item.color) === "object" && item.color.r !== undefined && item.color.g !== undefined && item.color.b !== undefined) {
            color = new Color(item.color.r, item.color.g, item.color.b);
          } else {
            color = new Color(item.color);
          }
        } else {
          color = new Color(this.traceColor);
        }

        const interval = {
          id: item.id,
          originId: item.originId,
          from: (!utils.isEmpty(item.depthFrom)) ? item.depthFrom : item.from,
          to: (!utils.isEmpty(item.depthTo)) ? item.depthTo : item.to,
          color: color,
          value: item.value
        };

        interval.labelId = interval.from + '' + interval.to;

        intervals.push(interval);
      });

      // validate the input intervals
      this._validateIntervals(intervals);
      if (intervals.length === 0) {
        return;
      }

      const pointsCount = this.geometry.getPointsCount();
      const trace = this.getPoints(0, pointsCount - 1);
      const newPoints = [];
      const interValues = new Map();

      for (let start = 0, size = intervals.length; start < size; ++start) {
        // loop through intervals and compute new coordinates
        let index = 0;
        let tracePos = 0;
        const interval = intervals[start];

        // add the current interval to the intervals array
        this.intervals.push({
          id: interval.id,
          from: interval.from,
          to: interval.to,
          color: interval.color,
          originId: interval.originId,
          labelId: interval.labelId,
        });

        if (interval.value) {
          interValues.set(interval.id, interval.value);
        }
        // add trace coordinates lying above the current 'interval.from'
        while (tracePos < trace.length) {
          if (!(this.traceLength[tracePos] < interval.from + this.lenEPS)) {
            break;
          }
          index += 3;
          tracePos++;
        }

        // if encountered end of the trace coordinates break the loop
        if (tracePos >= trace.length) {
          break;
        }

        const prevInterval = this.intervals.length > 0 ? this.intervals[this.intervals.length - 1] : {
          to: interval.from - 1.0
        };

        let abovePos = trace[tracePos - 1];
        let aboveDepth = this.traceLength[tracePos - 1];

        let belowPos = trace[tracePos];
        let belowDepth = this.traceLength[tracePos];

        // generate a new point for the value 'interval.from'
        if (Math.abs(interval.from - prevInterval.to) >= this.lenEPS &&
          Math.abs(interval.from - aboveDepth) >= this.lenEPS) {
          const coeff = (interval.from - aboveDepth) / (belowDepth - aboveDepth);
          if (newPoints.find((point) => point.length == intervals[start].from) == undefined) {
            newPoints.push({
              index: index / 3,
              coords: {
                x: abovePos.x + (belowPos.x - abovePos.x) * coeff,
                y: abovePos.y + (belowPos.y - abovePos.y) * coeff,
                z: abovePos.z + (belowPos.z - abovePos.z) * coeff
              },
              length: intervals[start].from
            });
          }
        }

        // add trace coordinates lying between 'interval.from' and 'interval.to'
        while (tracePos < trace.length) {
          if (!(this.traceLength[tracePos] < interval.to + this.lenEPS)) {
            break;
          }
          index += 3;
          tracePos++;
        }

        // if encountered end of the trace coordinates break the loop
        if (tracePos >= trace.length) {
          break;
        }

        // generate a trace coordinates for the value 'interval.to'
        abovePos = trace[tracePos - 1];
        aboveDepth = this.traceLength[tracePos - 1];

        belowPos = trace[tracePos];
        belowDepth = this.traceLength[tracePos];

        if (Math.abs(aboveDepth - interval.to) >= this.lenEPS) {
          const coeff = (interval.to - aboveDepth) / (belowDepth - aboveDepth);
          if (newPoints.find((point) => point.length == intervals[start].to) == undefined) {
            newPoints.push({
              index: index / 3,
              coords: {
                x: abovePos.x + (belowPos.x - abovePos.x) * coeff,
                y: abovePos.y + (belowPos.y - abovePos.y) * coeff,
                z: abovePos.z + (belowPos.z - abovePos.z) * coeff
              },
              length: intervals[start].to
            });
          }
        }

      }

      this.intervals.sort((a, b) => (a.from > b.from) ? 1 : -1);

      for (let start = 0; start < newPoints.length; start++) {
        this.insertPoint(newPoints[start].index += start, newPoints[start].coords);
        this.traceLength.splice(newPoints[start].index, 0, newPoints[start].length);
      }

      for (let start = 0; start < intervals.length; start++) {
        const colorToChange = this.__validateColors(intervals[start].color);
        const from = this.traceLength.findIndex((length) => MathUtils.isEqual(length, intervals[start].from));
        const to = this.traceLength.findIndex((length) => MathUtils.isEqual(length, intervals[start].to));
        this.geometry.setColorInRange(from, to, colorToChange);
      }

      this.material.needsUpdate = true;
      this.updateMatrix();
    }
  }

  // -------------------------------------
  // insertPoint() / insertPoint()
  // -------------------------------------
  insertPoint(index, array) {
    this.insertPoints(index, array);
  }

  insertPoints(index, array) {

    if (index > this.getPointsCount() - 1) {
      console.log("Ошибка: задан некорректный индекс");
      return;
    }

    const coords = this.__validateCoordinates(array);

    if (coords && coords.length) {
      const totCount = this.geometry.getPointsCount() + coords.length / 3;
      if (this.geometry.attributes.instanceStart.data.count < totCount) {
        this.__recreateGlIntervalGeometry(coords);
      }
      this.geometry.insertPoints(index, coords);
      if (this.pointObjects) {
        this.pointsGeometry.insertPoints(index, coords);
      }
      const color = this.__validateColors(new Color(this.traceColor));
      // * set the inserted point color to default
      this.geometry.setColorInRange(index, index + 1, color);
    }
  }

  // ------------------------------------------------
  // TODO [["0x00000"],["0xffff"],["0x...."],["0x00000.."]]
  // TODO [["rgb()"],["rgb()"],["rgb()"],["rgb()"]]
  // [[1,1,1],[1,0,0],[0,1,0]]
  // [{r0:,g0:,b0:},{r1:,g1:,b1:},{r2:,g2:,b2:}]

  // __validateColors()
  // validate and adjust colors as:
  // [r0, g0, b0, r1, g1, b1]
  // ------------------------------------------------
  __validateColors(colors) {
    if (!colors) return null;

    let error = '';
    let retCollors = null;

    if (colors instanceof Array) {
      if (typeof colors[0] === 'object') {
        // we'll assume that the 'colors' is an array of objects: [{r0:,g0:,b0:},{r1:,g1:,b1:},{r2:,g2:,b2:}]
        retCollors = Array(colors.length * 3).fill(0.0);
        for (let start = 0; start < colors.length; ++start) {
          if (colors[start].r === undefined || colors[start].g === undefined ||
            colors[start].b === undefined) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retCollors[start * 3] = colors[start].r;
            retCollors[start * 3 + 1] = colors[start].g;
            retCollors[start * 3 + 2] = colors[start].b;
          }
        }
      } else if (typeof colors[0][0] === 'number') {
        return colors.join();
      } else {
        // we'll assume that the 'colors' are given as: [r0, g0, b0, r1, g1, b1]
        const ptCount = Math.floor(colors.length / 3);
        retCollors = Array(ptCount * 3).fill(0.0);
        for (let start = 0; start < ptCount * 3; ++start) {
          retCollors[start] = colors[start];
        }
      }
    } else if (typeof colors === 'string') {
      const newcolor = new Color(colors);
      retCollors = [newcolor.r, newcolor.g, newcolor.b];
    } else {
      // we'll assume that the 'colors' is an object
      if (colors.r === undefined || colors.g === undefined || colors.b === undefined) {
        error = 'Ошибка: координаты заданы некорректно';
      } else {
        retCollors = [colors.r, colors.g, colors.b];
      }
    }

    if (error) {
      console.log(error);
    }

    return retCollors;
  }

  // -------------------------------------
  // remove intervals
  // -------------------------------------
  removeIntervals() {
    if (this.intervals.length) {
      while (this.intervals.length) {
        const interval = this.intervals[0];
        this.removeInterval(interval.id, true);
      }
    }
  }

  // -----------------------
  // _validateIntervals
  // -----------------------
  _validateIntervals(intervals) {
    if (!(intervals instanceof Array && intervals.length > 0)) {
      return;
    }
    // remove the elements that have invalid length
    // const newIntervals = intervals.filter((item) => (item.to - item.from) >= this.lenEPS);
    const newIntervals = [];
    for (let i = 0; i < intervals.length; i++) {
      if (!(intervals[i].to - intervals[i].from >= this.lenEPS)) {
        console.log(intervals[i].id + " unsuitable !");
        continue;
      } else if (!(intervals[i].to <= this.length + this.lenEPS && intervals[i].from < this.length + this.lenEPS)) {
        console.log(intervals[i].id + " out of the depth !");
        continue;
      }
      newIntervals.push(intervals[i]);
    }

    intervals.length = 0;

    if (newIntervals.length === 0) {
      return;
    }

    // sort the intervals on 'from'
    newIntervals.sort((a, b) => (a.from > b.from) ? 1 : -1);

    // validate intervals against existing ones
    if (this.intervals.length > 0) {
      const gaps = [];

      // gather gap intervals into a separate array 'gaps'
      let prev = this.intervals[0];
      if (prev.from > this.lenEPS) {
        gaps.push({
          from: 0.0,
          to: prev.from
        });
      }

      for (let start = 1, l = this.intervals.length; start < l; ++start) {
        if (this.intervals[start].from > prev.to + this.lenEPS) {
          gaps.push({
            from: prev.to,
            to: this.intervals[start].from
          });
        }
        prev = this.intervals[start];
      }

      if (prev.to + this.lenEPS < this.length) {
        gaps.push({
          from: prev.to,
          to: this.length
        });
      }

      // among new intervals pick up the ones that lie within the gap intervals
      newIntervals.forEach((item) => {
        let start = 0;
        const l = gaps.length;
        for (start, l; start < l; ++start) {
          if (item.from + this.lenEPS >= gaps[start].from &&
            item.to < gaps[start].to + this.lenEPS) {
            intervals.push(Object.assign({}, item));
            break;
          }
        }
        // if interval is overlapping
        if (start == l) {
          this.intervals.sort((a, b) => (a.from > b.from) ? 1 : -1);
          this.handleOverlappedIntervals(item, intervals);
          // if same interval exist already just change the color
          if (!this.intervals.find(interval => MathUtils.isEqual(interval.to, item.to) && MathUtils.isEqual(interval.from, item.from))) {
            intervals.push(Object.assign({}, item));
          }
        }
      });

      newIntervals.length = 0;
      for (let start = 0, l = intervals.length; start < l; ++start) {
        newIntervals.push(Object.assign({}, intervals[start]));
      }

      // sort the intervals on 'from'
      newIntervals.sort((a, b) => (a.from > b.from) ? 1 : -1);

      intervals.length = 0;
    }

    // gather valid intervals
    let prevIdx = 0;
    for (let start = 1, l = newIntervals.length; start < l; ++start) {
      if (Math.abs(newIntervals[start].from - newIntervals[prevIdx].from) > this.lenEPS) {
        let validIdx = -1;
        let maxTo = 0.0;
        for (let j = start - 1; j >= prevIdx; --j) {
          if (newIntervals[start].from + this.lenEPS > newIntervals[j].to &&
            (validIdx === -1 || (validIdx !== -1 && maxTo < newIntervals[j].to))) {
            validIdx = j;
            maxTo = newIntervals[j].to;
          }
        }

        if (validIdx !== -1) {
          intervals.push(Object.assign({}, newIntervals[validIdx]));
        }

        prevIdx = start;
      }
    }

    // handle the last interval
    let validIdx = -1;
    let maxTo = 0.0;
    for (let j = newIntervals.length - 1; j >= prevIdx; --j) {
      if (validIdx === -1 || (validIdx !== -1 && maxTo < newIntervals[j].to)) {
        validIdx = j;
        maxTo = newIntervals[j].to;
      }
    }

    if (validIdx !== -1) {
      intervals.push(Object.assign({}, newIntervals[validIdx]));
    }
  }

  // handleOverlappedIntervals given overlapped new interval
  // the overlapped intervals are updated
  handleOverlappedIntervals(givenInterval, intervals) {
    // take the nearest(less number) interval respect to from
    // let start = this.intervals.findIndex(inter => inter.from > givenInterval.from) - 1;
    let start = this.intervals.findIndex((inter) => inter.to > givenInterval.from);
    let end = this.intervals.findIndex((inter) => inter.from > givenInterval.to);

    start = (start < 0) ? 0 : start;
    end = (end < 0) ? this.intervals.length : (end == 0) ? 1 : end;

    // let coordsToRemove = [];

    for (start; start < end; start++) {
      const currentInterval = this.intervals[start];

      if (currentInterval == undefined || currentInterval.from > givenInterval.to) {
        // if we are after interval coords
        break;
      } else if (currentInterval.to < givenInterval.from) {
        // if we are before interval coords
        continue;
      }

      if (
        // if currentInterval is between giveninterval
        this.isBetween(givenInterval.from, givenInterval.to, currentInterval.from) &&
        this.isBetween(givenInterval.from, givenInterval.to, currentInterval.to) ||

        (MathUtils.isEqual(currentInterval.from, givenInterval.from) &&
          this.isBetween(givenInterval.from, givenInterval.to, currentInterval.to)) ||

        (MathUtils.isEqual(currentInterval.to, givenInterval.to) &&
          this.isBetween(givenInterval.from, givenInterval.to, currentInterval.from))
      ) {
        this.removeInterval(currentInterval.id);
        start--;
      } else if (
        // if givenInterval is between currentinterval
        this.isBetween(currentInterval.from, currentInterval.to, givenInterval.from) &&
        this.isBetween(currentInterval.from, currentInterval.to, givenInterval.to)
      ) {

        const col = this.getInternalColors(currentInterval.id);

        intervals.push({
          id: utils.uuid(),
          originId: currentInterval.originId ? currentInterval.originId : currentInterval.id,
          from: currentInterval.from,
          to: givenInterval.from,
          color: col,
          value: currentInterval.value,
        });

        const newInterval = [{
          id: utils.uuid(),
          originId: currentInterval.originId ? currentInterval.originId : currentInterval.id,
          depthFrom: givenInterval.to,
          depthTo: currentInterval.to,
          color: col,
          value: currentInterval.value,
        }];

        this.removeInterval(currentInterval.id, false, true);
        this.addIntervals(newInterval);

      } else if (this.isBetween(currentInterval.from, currentInterval.to, givenInterval.from)) {// if from point of newInterval is between another interval
        const col = this.getInternalColors(currentInterval.id);
        intervals.push({
          id: utils.uuid(),
          originId: currentInterval.originId ? currentInterval.originId : currentInterval.id,
          from: currentInterval.from,
          to: givenInterval.from,
          color: col,
          value: currentInterval.value,
        });

        this.removeInterval(currentInterval.id, false, true);
        // interval is removed this.intervals length decreased
        start--;
      } else if (this.isBetween(currentInterval.from, currentInterval.to, givenInterval.to)) {// if to point of newInterval is between another interval
        const col = this.getInternalColors(currentInterval.id);

        const newInterval = [{
          id: utils.uuid(),
          originId: currentInterval.originId ? currentInterval.originId : currentInterval.id,
          depthFrom: givenInterval.to,
          depthTo: currentInterval.to,
          color: col,
          value: currentInterval.value,
        }];

        this.removeInterval(currentInterval.id, false, true);
        this.addIntervals(newInterval);
      } else if (
        // if same interval
        MathUtils.isEqual(currentInterval.from, givenInterval.from) &&
        MathUtils.isEqual(currentInterval.to, givenInterval.to)
      ) {
        const colorToChange = this.__validateColors(givenInterval.color);
        const from = this.traceLength.findIndex((length) => MathUtils.isEqual(length, currentInterval.from));
        const to = this.traceLength.findIndex((length) => MathUtils.isEqual(length, currentInterval.to));
        this.geometry.setColorInRange(from, to, colorToChange);

        // this.removeInterval(currentInterval.id);
        // this.addIntervals([givenInterval]);
      }
    }
  }

  isBetween(start, end, value) {
    return (value > start && value < end);
  }

  // -------------------------------------
  // remove intervals
  // -------------------------------------
  removeInterval(id, rmAll = false) {
    if (!id) return;

    let index = undefined;
    const findIndex = () => {
      let i = utils.isEmpty(index) ? 0 : index;
      index = undefined;
      for (i = 0; i < this.intervals.length; i++) {
        if (this.intervals[i].id === id) {
          index = i;
          break;
        } else if (i === this.intervals.length - 1) {
          break;
        }

      }

      return index;
    }


    while (!utils.isEmpty(findIndex())) {
      // const index = this.intervals.findIndex((interval) => interval.id === id);
      const fromIndex = this.traceLength.findIndex((length) => MathUtils.isEqual(length, this.intervals[index].from));
      let toIndex = this.traceLength.findIndex((length) => MathUtils.isEqual(length, this.intervals[index].to));

      //* set new points to default color
      const color = this.__validateColors(new Color(this.traceColor));
      this.geometry.setColorInRange(fromIndex, toIndex, color);

      // remove point from
      if (!this.traceLengthAuto.includes(this.intervals[index].from) && fromIndex != -1) {
        if (!this.intervals.find(interval => MathUtils.isEqual(interval.to, this.intervals[index].from))) {
          this.geometry.removePoint(fromIndex);
          if (this.pointObjects) {
            this.pointsGeometry.removePoint(fromIndex);
          }
          toIndex--;
          this.traceLength.splice(fromIndex, 1);
        }
      }

      if (!this.traceLengthAuto.includes(this.intervals[index].to) && toIndex != -1) {
        // if any other starts after the interval we will not delete point of the another interval
        if (!this.intervals.find((interval) => MathUtils.isEqual(interval.from, this.intervals[index].to))) {
          this.geometry.removePoint(toIndex);
          if (this.pointObjects) {
            this.pointsGeometry.removePoint(toIndex);
          }

          this.traceLength.splice(toIndex, 1);
        }
      }

      // rmAll stands for removing the all intervals.
      // since intervals can be splitted into two parts, in some cases we dont have to remove second interval
      this.intervals.splice(index, 1)[0];
      if (!rmAll) {
        break;
      }

      // this.intervals.splice(index, 1);
    }
    return;
  }

  // -------------------------------------
  // getIntervalCoords
  // -------------------------------------
  getIntervalCoords(id) {
    let retVector = null;

    if (!id) return retVector;

    const interval = this.intervals.find((interval) => interval.id === id);

    if (interval === undefined) {
      console.log("Ошибка : интервал с таким id не существует");
      return retVector;
    }

    const startPos = this.traceLength.findIndex((length) => MathUtils.isEqual(length, interval.from)) * 6;
    const buffer = this.geometry.attributes.instanceStart.data;

    retVector = {
      start: new Vector3(buffer.array[startPos], buffer.array[startPos + 1], buffer.array[startPos + 2]),
      end: new Vector3(buffer.array[startPos + 3], buffer.array[startPos + 4], buffer.array[startPos + 5])
    };

    return retVector;
  }

  // -------------------------------------
  // getInternalColors
  // -------------------------------------
  getInternalColors(id) {
    let retValue = null;
    if (!id) return retValue;

    const interval = this.intervals.find((interval) => interval.id === id);

    if (interval === undefined) {
      console.log("Ошибка : интервал с таким id не существует");
      return retValue;
    }

    const startPos = this.traceLength.indexOf(interval.from) * 6;
    const buffer = this.geometry.attributes.instanceColorStart.data;
    retValue = new Color(buffer.array[startPos], buffer.array[startPos + 1], buffer.array[startPos + 2]);

    return retValue;
  }

  // ------------------------------------------------
  // __validateCoordinates()
  // validate and adjust coordinates as:
  // [x0, y0, z0, x1, y1, z1]
  // The method converts coordinates from world to local
  // ------------------------------------------------
  __validateCoordinates(coords) {
    if (!coords) return null;

    let retCoords = null;
    let error = '';
    if (coords instanceof Array) {
      if (typeof coords[0] === 'object') {
        // we'll assume that the 'coords' is an array of objects: [point1, point2, ...]
        retCoords = Array(coords.length * 3).fill(0.0);
        for (let i = 0; i < coords.length; ++i) {
          if (coords[i].x === undefined || coords[i].y === undefined ||
            coords[i].z === undefined) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retCoords[i * 3] = coords[i].x;
            retCoords[i * 3 + 1] = coords[i].y;
            retCoords[i * 3 + 2] = coords[i].z;
          }
        }
      } else {
        // we'll assume that the 'coords' are given as: [x0, y0, z0, x1, y1, z1]
        const ptCount = Math.floor(coords.length / 3);
        retCoords = Array(ptCount * 3).fill(0.0);
        for (let i = 0; i < ptCount * 3; ++i) {
          retCoords[i] = coords[i];
        }
      }
    } else {
      // we'll assume that the 'coords' is an object
      if (coords.x === undefined || coords.y === undefined || coords.z === undefined) {
        error = 'Ошибка: координаты заданы некорректно';
      } else {
        retCoords = [coords.x, coords.y, coords.z];
      }
    }

    if (retCoords && retCoords.length) {
      // set an objects position if it's needed
      if (this.geometry.getPointsCount() === 0) {
        this.pivotOffset.set(0,0,0);
        this.__v3.set(retCoords[0], retCoords[1], retCoords[2]);
        const diff = Math.abs(this.position.lengthSq() - this.__v3.lengthSq());
        if (diff > this.lenEPS) {
          this.__m4.copy(this.matrixWorld).invert();
          this.position.set(retCoords[0], retCoords[1], retCoords[2]);
          this.position.applyMatrix4(this.__m4);
          this.updateMatrixWorld();
        } else {
          this.matrixWorld.setPosition(this.position);
        }
      }

      this.__m4.copy(this.matrixWorld).invert();

      // convert coordinates from world to local
      for (let i = 0; i < retCoords.length; i += 3) {
        this.__v3.set(retCoords[i], retCoords[i + 1], retCoords[i + 2]);
        this.__v3.applyMatrix4(this.__m4);
        retCoords[i] = this.__v3.x;
        retCoords[i + 1] = this.__v3.y;
        retCoords[i + 2] = this.__v3.z;
      }
    }

    if (error) {
      console.log(error);
    }

    return retCoords;
  }

  // ----------------------------------------------------
  // __recreateGlIntervalGeometry(coords)
  // 'coords' must be the type of Array and contain
  // local coordinates as: [x0, y0, z0, x1, y1, z1]
  // ----------------------------------------------------
  __recreateGlIntervalGeometry(coords) {
    if (!(coords && coords instanceof Array)) return;

    const itemSize = 3;
    const newPointsCount = Math.floor(coords.length / itemSize);

    // define the size of new attributes
    const ptCount = this.geometry.getPointsCount();
    const newSize = (ptCount + newPointsCount + 10) * itemSize;

    // create the new buffer attributes
    const coordinatesBuffer = new InstancedInterleavedBuffer(new Float32Array(2 * newSize), 6, 1); // xyz, xyz
    const instanceStart = new InterleavedBufferAttribute(coordinatesBuffer, itemSize, 0);
    const instanceEnd = new InterleavedBufferAttribute(coordinatesBuffer, itemSize, 3);

    const colorsBuffer = new InstancedInterleavedBuffer(new Float32Array(2 * newSize), 6, 1); // rgb, rgb
    const instanceColorStart = new InterleavedBufferAttribute(colorsBuffer, itemSize, 0);
    const instanceColorEnd = new InterleavedBufferAttribute(colorsBuffer, itemSize, 3);


    // copy all existing coordinates from the current geometry to the new one
    let oldGeometry;
    if (this.geometry.attributes.instanceStart) {
      oldGeometry = this.geometry;
      const oldCoords = this.geometry.attributes.instanceStart.data;
      const oldColors = this.geometry.attributes.instanceColorStart.data;
      for (let i = 0; i < ptCount; ++i) {
        coordinatesBuffer.copyAt(i, oldCoords, i);
        colorsBuffer.copyAt(i, oldColors, i);
      }
    }

    if (oldGeometry) {
      this.geometry = new GlIntervalGeometry();
      this.geometry._pointsCount = ptCount;

      let oldPointGeometry;
      if (this.pointObjects) {
        oldPointGeometry = this.pointsGeometry;
        // recreating pointsGeometry
        const newXYZ = new BufferAttribute(new Float32Array(newSize), itemSize); // xyz
        const points = this.pointsGeometry.getPoints(0, ptCount - 1, null, true);
        // for (let i = 0; i < ptCount; ++i) {
        //   newXYZ.copyAt(i, this.pointsGeometry.attributes.position, i);
        // }
        newXYZ.copyArray(points);
        this.pointsGeometry = new GlPointsGeometry();
        this.pointsGeometry._pointsCount = ptCount;
        this.pointObjects.geometry = this.pointsGeometry;
        this.pointsGeometry.setAttribute('position', newXYZ);
      }
      if (oldPointGeometry) oldPointGeometry.dispose();
      oldGeometry.dispose();
    }

    this.geometry.setAttribute('instanceStart', instanceStart);
    this.geometry.setAttribute('instanceEnd', instanceEnd);
    this.geometry.setAttribute('instanceColorStart', instanceColorStart);
    this.geometry.setAttribute('instanceColorEnd', instanceColorEnd);
    this.geometry.instanceCount = this.geometry.attributes.instanceStart.data.count;
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (index !== undefined && index !== null &&
      index >= 0 && index < this.geometry.getPointsCount()) {
      return true;
    }
    return false;
  }

  // -------------------------------------
  // addPoint() / addPoints()
  // -------------------------------------
  addPoint(point) {
    this.addPoints(point);
  }

  addPoints(array) {
    // adjust coordinates as: [x0, y0, z0, x1, y1, z1]
    const coords = this.__validateCoordinates(array);
    if (coords && coords.length) {
      const totCount = this.geometry.getPointsCount() + coords.length / 3;
      if (!this.geometry.attributes.instanceStart || this.geometry.attributes.instanceStart.data.count < totCount) {
        this.__recreateGlIntervalGeometry(coords);
      }
      this.geometry.addPoints(coords);
      if (this.pointObjects) {
        this.pointsGeometry.addPoints(coords);
      }
    }
  }

  // -------------------------------------
  // setPoint() / setPoints()
  // -------------------------------------
  setPoint(index, coord) {
    this.setPoints(index, coord);
  }

  setPoints(index, array) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    // adjust coordinates as: [x0, y0, z0, x1, y1, z1]
    const coords = this.__validateCoordinates(array, index);
    if (coords && coords.length) {
      this.geometry.setPoints(index, coords);
      if (this.pointObjects) {
        this.pointsGeometry.setPoints(index, coords);
      }
    }

    if (index === 0) {
      if (this.collarLabel) this.collarLabel.position.set(coords[0], coords[1], coords[2]);
      if (this.collarPoint) this.collarPoint.position.set(coords[0], coords[1], coords[2]);
    }

    if (this.lengthLabel && index + coords.length / 3 === this.getPointsCount()) {
      this.updateLengthLabel(new Vector3(coords[0], coords[1], coords[2]));
    }
  }

  // -------------------------------------
  // deletePoint() / deletePoints()
  // -------------------------------------
  deletePoint(index) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    this.deletePoints(index, index);
  }

  deletePoints(startIndex, endIndex) {
    if (!this.__isValidIndex(startIndex)) {
      console.log('Ошибка: задан некорректный начальный индекс');
      return;
    }
    if (!this.__isValidIndex(endIndex)) {
      console.log('Ошибка: задан некорректный конечный индекс');
      return;
    }
    if (startIndex > endIndex) {
      console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
      return;
    }

    // this.geometry.deletePoints(startIndex, endIndex);
    let start = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      this.geometry.removePoint(start + i);
      start--;
    }
    if (this.geometry.getPointsCount() === 0) this.resetPivotPoint();

    if (this.pointObjects) {
      this.pointsGeometry.deletePoints(startIndex, endIndex);
    }
  }

  deleteAllPoints() {
    // this.geometry.deleteAllPoints();
    const pointsCount = this.geometry.getPointsCount();
    let start = 0;
    for (let i = 0; i < pointsCount; i++) {
      this.geometry.removePoint(start + i);
      start--;
    }
    this.resetPivotPoint();

    this.traceLength.length = 0;
    this.traceLengthAuto.length = 0;
    this.matrix.identity();
    if (this.collarLabel) {
      this.collarLabel.matrix.identity();
    }

    if (this.pointObjects) {
      this.pointsGeometry.deleteAllPoints();
      if (this.pointObjects.matrix) this.pointObjects.matrix.identity();
    }
    this.updateMatrixWorld(true);
  }

  //
  getPointAt(index, asFlatArray) {
    return this.geometry.getPointAt(index, this.matrixWorld, asFlatArray);
  }

  //
  getPoints(startIndex, endIndex, asFlatArray) {
    return this.geometry.getPoints(startIndex, endIndex, this.matrixWorld, asFlatArray);
  }

  //
  getPointsAsArray(startIndex, endIndex) {
    return this.geometry.getPointsAsArray(startIndex, endIndex, this.matrixWorld);
  }

  //
  getPointsCount() {
    return this.geometry.getPointsCount();
  }

  //
  getPlane() {
    return this.geometry.getPlane(this.matrixWorld);
  }

  //
  getLength() {
    return this.geometry.getLength();
  }

  //
  isPointsShown() {
    let shown = this.pointObjects && this.pointObjects.visible;
    if (shown && this.isSelected) {
      shown = this.__pointObjectsBeforeSel ? true : false;
    }

    return shown;
  }

  // -------------------------------------
  // get value that represents
  // if points shown without selection
  // -------------------------------------
  getPointObjectsBeforeSel() {
    return this.__pointObjectsBeforeSel;
  }

  // -------------------------------------
  // set value that represents
  // if points shown without selection
  // -------------------------------------
  setPointObjectsBeforeSel(flag) {
    this.__pointObjectsBeforeSel = flag;
  }

  //
  showPoints(flag) {
    if (flag) {
      if (!this.pointObjects && this.geometry.attributes.instanceStart) {
        const material = new PointsMaterial({
          size: 5,
          color: this.pointObjectsColor,
        });
        const pointsCount = this.geometry.getPointsCount();
        const start = this.geometry.attributes.instanceStart;
        const size = start.itemSize * start.count;
        const newXYZ = new BufferAttribute(new Float32Array(size), start.itemSize); // xyz
        let points = this.getPoints(0, pointsCount - 1);
        points = this.__validateCoordinates(points);
        this.pointsGeometry = new GlPointsGeometry();
        // const offset = this.position;
        // this.pointsGeometry.offset = offset;
        this.pointsGeometry.setAttribute('position', newXYZ);
        this.pointsGeometry.addPoints(points);
        this.pointObjects = new Points(this.pointsGeometry, material);
        this.add(this.pointObjects);
      } else if (this.pointObjects) {
        this.pointObjects.visible = true;
      }
    } else if (this.pointObjects && this.pointObjects.visible) {
      this.pointObjects.visible = false;
    }
  }

  // -------------------------------------
  // setTraceColor
  // -------------------------------------
  setTraceColor(color) {
    if (color) this.traceColor = color;
    this.geometry.setColors(null, new Color(this.traceColor));
  }

  // -------------------------------------
  // setMaterialColor
  // -------------------------------------
  setMaterialColor(color) {
    if (color) this.materialColor = color;
    if (!this.isSelected) {
      this.material.color.setHex(this.materialColor);
    }
  }

  // -------------------------------------
  // show / hide / update collar label
  // -------------------------------------
  showCollarLabel() {
    if (this.collarLabel) {
      this.collarLabel.matrix.identity();
      this.collarLabel.updateMatrixWorld();
      this.collarLabel.visible = true;
      this.__collarLabelBeforeSel = true;
    } else {
      this.__createCollarLabel();
      this.collarLabel.visible = true;
    }
  }

  hideCollarLabel() {
    if (this.collarLabel) {
      this.collarLabel.visible = this.isSelected;
      this.__collarLabelBeforeSel = false;
    }
  }

  getCollarLabelBeforeSel() {
    return this.__collarLabelBeforeSel;
  }

  updateCollarLabel() {
    if (this.collarLabel) {
      const isVisible = this.collarLabel.visible;
      this.collarLabel.visible = false;
      const lastPoint = this.getPointAt(0);
      const firstPoint = this.position;
      const offset = lastPoint.clone();
      offset.sub(firstPoint);
      this.collarLabel.position.copy(offset);
      this.collarLabel.setLabel(this.name);
      this.collarLabel.visible = isVisible;
    }
  }

  // -------------------------------------
  // setCollarLabelColor
  // -------------------------------------
  setCollarLabelColor(color) {
    this.collarLabelColor = color;
    if (this.collarLabel) {
      this.collarLabel.setColor(color);
    }
  }

  // -------------------------------------
  // __createCollarLabel
  // -------------------------------------
  __createCollarLabel(font) {
    if (!this.collarLabel && this.name.length) {
      this.collarLabel = new GlLabel({
        text: this.name,
        color: this.collarLabelColor,
        font: font,
        fontSize: 0.12,
        orientation: "camera",
        offsetH: 0.5,
        offsetV: -0.5,
        visible: false,
        scaleFactor: true,
      });

      this.collarLabel.sync(this.handleLabel());
      this.add(this.collarLabel);
    } else if (typeof font === 'string' && font.length > 5) {
      this.collarLabel.setFont(font);
    }
  }

  // -------------------------------------
  // setCollarLabelFont
  // -------------------------------------
  setCollarLabelFont(font) {
    this.__createCollarLabel(font);
  }

  // -------------------------------------
  // show/hide/update length label
  // -------------------------------------
  showLengthLabel() {
    if (this.lengthLabel) {
      this.lengthLabel.visible = true;
    } else {
      this.__createLengthLabel();
    }
  }

  hideLengthLabel() {
    if (this.lengthLabel) {
      this.lengthLabel.visible = false;
    }
  }

  updateLengthLabel(coords) {
    if (this.lengthLabel) {
      const isVisible = this.lengthLabel.visible;
      this.lengthLabel.visible = false;
      const pointsCount = this.getPointsCount();
      if (pointsCount > 0) {
        // const firstPoint = this.getPointAt(0);
        const firstPoint = this.position;
        const lastPoint = this.getPointAt(pointsCount - 1);
        const length = this.getLength().toFixed(2);
        if (this.lengthLabel.coords instanceof Array) {
          this.lengthLabel.coords[0].x = lastPoint.x;
          this.lengthLabel.coords[0].y = lastPoint.y;
          this.lengthLabel.coords[0].z = lastPoint.z;
        } else {
          this.lengthLabel.coords.x = lastPoint.x;
          this.lengthLabel.coords.y = lastPoint.y;
          this.lengthLabel.coords.z = lastPoint.z;
        }
        const offset = lastPoint.clone();
        offset.sub(firstPoint);
        this.lengthLabel.position.copy((coords) ? coords : offset);

        this.lengthLabel.setLabel(length);

        this.lengthLabel.visible = isVisible;
      }
    }
  }

  // -------------------------------------
  // setLengthLabelColor
  // -------------------------------------
  setLengthLabelColor(color) {
    this.lengthLabelColor = color;
    if (this.lengthLabel) {
      this.lengthLabel.setColor(color);
    }
  }

  // -------------------------------------
  // __createLengthLabel
  // -------------------------------------
  __createLengthLabel(font) {
    if (!this.lengthLabel) {
      const pointsCount = this.getPointsCount();
      if (pointsCount > 0) {
        const coords = this.geometry.getPointAt(pointsCount - 1);
        const length = this.traceLength[this.traceLength.length - 1].toFixed(2);
        this.lengthLabel = new GlLabel({
          text: length,
          color: this.lengthLabelColor,
          font: font,
          fontSize: 0.12,
          orientation: "camera",
          scaleFactor: true,
        });

        this.lengthLabel.sync(this.handleLabel());
        this.lengthLabel.position.set(coords.x, coords.y, coords.z);
        this.add(this.lengthLabel);
      }
    } else if (typeof font === 'string' && font.length > 5) {
      this.lengthLabel.setFont(font);
    }
  }

  // -------------------------------------
  // setLengthLabelFont
  // -------------------------------------
  setLengthLabelFont(font) {
    this.__createLengthLabel(font);
  }

  // -------------------------------------
  // showCollarPoint
  // -------------------------------------
  showCollarPoint(imgName, color, size) {
    if (!this.collarPoint) {
      this.__createCollarPoint(imgName, color, size);
    } else {
      this.collarPoint.visible = true;
    }
  }

  // -------------------------------------
  // hideCollarPoint
  // -------------------------------------
  hideCollarPoint() {
    if (this.collarPoint) {
      this.collarPoint.visible = false;
    }
  }

  // -------------------------------------
  // setCollarPointSize
  // -------------------------------------
  setCollarPointSize(size) {
    if (size < 1 && size > 100) return;
    if (this.collarPoint && this.collarPoint.material) {
      this.collarPoint.material.size = size;
      this.collarPoint.material.needsUpdate = true;
    }
  }

  // -------------------------------------
  // setCollarPointColor
  // -------------------------------------
  setCollarPointColor(color) {
    if (color !== undefined || color !== null) this.collarPointColor = color;
    if (this.collarPoint && this.collarPoint.material) {
      if (typeof this.collarPointColor === 'number' || typeof this.collarPointColor === 'bigint') {
        // we assume that color is hexadecimal
        this.collarPoint.material.color.setHex(this.collarPointColor);
      } else if (color instanceof Array) {
        // we assume that color is array of rgb
        this.collarPoint.material.color.setRGB(this.collarPointColor[0], this.collarPointColor[1], this.collarPointColor[2]);
        this.collarPointColor = this.collarPoint.material.color.getHex();
      } else {
        this.collarPoint.material.color = this.collarPointColor;
      }
      this.collarPoint.material.needsUpdate = true;
    }
  }

  // -------------------------------------
  // __createCollarPoint
  // -------------------------------------
  __createCollarPoint(imgName, color, size) {
    this.collarPointImage = imgName || 'circle_bold_dot_inside';
    // get an appropriate image, which will be used as a texture
    const symbolImage = ImageResources.getBase64(this.collarPointImage);
    if (symbolImage === null) {
      return;
    }

    // prepare the collar point geometry
    if (color) this.collarPointColor = color;
    const vertex = [0, 0, 0];
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertex, 3));

    this.collarPointSize = size || 15;
    const texture = new Texture(symbolImage);
    texture.needsUpdate = true;
    texture.minFilter = LinearMipMapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;

    const material = new PointsMaterial({
      size: this.collarPointSize,
      color: this.collarPointColor,
      map: texture,
      transparent: true,
      alphaTest: 0.1,
    });

    this.collarPoint = new Points(geometry, material);
    this.add(this.collarPoint);
  }

  // --------------------
  // setTraceWidth
  // --------------------
  setTraceWidth(width) {
    if (!isNaN(width) && width > 0 && width < 10) {
      this.traceWidth = width;
      this.material.linewidth = this.traceWidth;
    }
  }
  
  // -------------------------------------
  // select / deselect on scene
  // -------------------------------------
  select(child, isMultiSelect) {
    if (!this.selectable || this.isSelected) return null;

    const clrSelected = 0x0000FF;
    this.material.color.setHex(clrSelected);
    this.material.linewidth = this.traceWidth + 1;
    this.material.opacity = 0.4;
    this.__pointObjectsBeforeSel = this.pointObjects ? this.pointObjects.visible : false;


    // collar label
    if (this.collarLabel) {
      this.__collarLabelBeforeSel = this.collarLabel.visible;
      this.collarLabel.setColor(clrSelected);
      this.collarLabel.visible = true;
    }
    this.showPivotPoint();
    this.isSelected = true;
    return null;
  }

  deselect(child) {
    if (child && child.index !== undefined) return;

    this.material.color.setHex(this.materialColor);
    this.material.linewidth = this.traceWidth;
    this.material.opacity = 1;

    if (!this.__pointObjectsBeforeSel) {
      this.showPoints(false);
    }

    if (this.collarLabel) {
      this.collarLabel.setColor(this.collarLabelColor);
      if (!this.__collarLabelBeforeSel) this.collarLabel.visible = false;
    }
    if (!this.pivotPointVisible) this.hidePivotPoint();
    this.isSelected = false;
  }

  // -----------------------
  // raycast
  // -----------------------
  raycast(raycaster, intersects) {
    const geometry = this.geometry;
    const ptCount = geometry.getPointsCount();

    // don't do raycasting if the object is not selectable
    if (!this.visible || (this.parent && !this.parent.visible) ||
      (!this.selectable && !this.snappable) ||
      ptCount === 0) return;
    
    const inverseMatrix = new Matrix4();
    const ray = new GlRay();
    const sphere = new Sphere();
    const precision = raycaster.params.Line.threshold;
    const threshold = raycaster.params.Points.threshold;
    const snapMode = raycaster.params.snapMode;
    const perpPoints = raycaster.params.perpPoints;
    let childPnt = null;
    if (snapMode && snapMode !== GlSnapMode.None && !this.snappable) return;

    // set the clipping sections obb
    const clippedSection = raycaster.params.clippedSection;
    if (clippedSection) this.__obb.copy(clippedSection.obb);

    const matrixWorld = this.matrixWorld;

    sphere.copy(geometry.boundingSphere);
    sphere.applyMatrix4(matrixWorld);
    sphere.radius += precision;

    if (raycaster.ray.intersectsSphere(sphere) === false) return;
    if (clippedSection && !this.__obb.intersectsRay(raycaster.ray)) return;

    inverseMatrix.copy(matrixWorld).invert();
    ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);
    if (clippedSection) this.__obb.applyMatrix4(inverseMatrix);

    // precision for line raycasting
    const localPrecision = precision / ((this.scale.x + this.scale.y + this.scale.z) / 3);
    const localPrecisionSq = localPrecision * localPrecision;

    // threshold for point raycasting
    const localThreshold = threshold / ((this.scale.x + this.scale.y + this.scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;

    const vStart = new Vector3();
    const vEnd = new Vector3();
    const interSegment = new Vector3();
    const interRay = new Vector3();

    const start = geometry.attributes.instanceStart;
    const end = geometry.attributes.instanceEnd;
    for (let i = 0; i < ptCount - 1; i++) {
      vStart.fromBufferAttribute(start, i);
      vEnd.fromBufferAttribute(end, i);

      if (clippedSection &&
        (!this.__obb.containsPoint(vStart, i > 0) &&
          !this.__obb.containsPoint(vEnd, i > 0))) {
        continue;
      }

      // inspect for a point
      const distSq = ray.distanceSqToSegment(vStart, vEnd, interRay, interSegment);
      if (clippedSection && !this.__obb.containsPoint(interSegment, i > 0)) continue;

      if ((!snapMode || snapMode === GlSnapMode.Points || snapMode === GlSnapMode.All) && distSq < localThresholdSq) {
        const distSqToStart = interSegment.distanceToSquared(vStart);
        const distSqToEnd = interSegment.distanceToSquared(vEnd);
        let foundIndex = -1;
        if (distSqToStart < localThresholdSq) foundIndex = i;
        else if (distSqToEnd < localThresholdSq) foundIndex = i + 1;

        if (foundIndex !== -1) {
          // Move back to world space for distance calculation
          interRay.applyMatrix4(this.matrixWorld);
          const distance = raycaster.ray.origin.distanceTo(interRay);
          if (distance > raycaster.near && distance < raycaster.far) {
            intersects.push({
              distance: distance,
              point: interSegment.clone().applyMatrix4(this.matrixWorld),
              index: foundIndex,
              face: null,
              faceIndex: null,
              object: this,
              child: {
                distance: distance,
                point: foundIndex === i ? vStart.clone().applyMatrix4(this.matrixWorld) :
                  vEnd.clone().applyMatrix4(this.matrixWorld),
                index: foundIndex,
                face: null,
                object: this
              }
            });

            // skip the next segment
            if (foundIndex === i + 1) {
              i++;
              continue;
            }
          }
        }
      }

      // inspect for a line
      if (snapMode !== GlSnapMode.Points && distSq < localPrecisionSq) {
        // if point raycasting was skipped need to check extra conditions
        // in order to make sure that snapping to lines done correctly
        if (snapMode === GlSnapMode.Lines) {
          const distSqToStart = interSegment.distanceToSquared(vStart);
          const distSqToEnd = interSegment.distanceToSquared(vEnd);
          if (i > 0 && distSqToStart < this.EPS) continue;
          else if (i < ptCount - 2 && distSqToEnd < this.EPS) continue;
        } else if (snapMode === GlSnapMode.Perpendicular) {
          const distSqToStart = interSegment.distanceToSquared(vStart);
          const distSqToEnd = interSegment.distanceToSquared(vEnd);
          if (i > 0 && distSqToStart < this.EPS) continue;
          else if (i < ptCount - 2 && distSqToEnd < this.EPS) continue;
          // convert segment to world coords
          const startPoint = vStart.clone().applyMatrix4(this.matrixWorld);
          const endPoint = vEnd.clone().applyMatrix4(this.matrixWorld);
          if (perpPoints && perpPoints.length) {
            const point = [perpPoints[0]];
            if (perpPoints.length === 3) point.push(perpPoints[2]);
            for (let i = 0; i < point.length; i++) {
              const v1 = new Vector3().subVectors(endPoint, startPoint);
              const v2 = new Vector3().subVectors(point[i], startPoint);
              const perpV = v2.projectOnVector(v1);
              if (v1.dot(v2) > 0 && perpV.length() <= v1.length()) {
                perpV.addVectors(startPoint, perpV);
                childPnt = new Vector3().copy(perpV);
                break;
              }
            }
          }
        } else if (snapMode === GlSnapMode.Bisector) {
          const distSqToStart = interSegment.distanceToSquared(vStart);
          const distSqToEnd = interSegment.distanceToSquared(vEnd);
          if (i > 0 && distSqToStart < this.EPS) continue;
          else if (i < ptCount - 2 && distSqToEnd < this.EPS) continue;
          const startPoint = vStart.clone().applyMatrix4(this.matrixWorld);
          const endPoint = vEnd.clone().applyMatrix4(this.matrixWorld);
          const vTemp = new Vector3().subVectors(endPoint, startPoint).multiplyScalar(0.5);
          childPnt = new Vector3().addVectors(startPoint, vTemp);
        }

        // Move back to world space for distance calculation
        interRay.applyMatrix4(this.matrixWorld);

        const distance = raycaster.ray.origin.distanceTo(interRay);

        if (distance > raycaster.near && distance < raycaster.far) {
          intersects.push({
            distance: distance,
            // intersection point on the segment
            point: interSegment.clone().applyMatrix4(this.matrixWorld),
            index: i,
            face: null,
            child: childPnt ? {
              distance: distance,
              point: childPnt,
            } : null,
            faceIndex: null,
            object: this
          });
        }
      }
    }
  }

  // --------------------
  // dispose
  // --------------------
  dispose() {
    super.dispose();
    this.geometry.dispose();
    this.material.dispose();

    // point objects
    if (this.pointObjects) this.pointObjects.material.dispose();

    if (this.collarLabel) this.collarLabel.dispose();
    if (this.lengthLabel) this.lengthLabel.dispose();
    if (this.collarPoint) {
      const mat = this.collarPoint.material;
      mat.dispose();
      if (mat.map && mat.map.dispose) mat.map.dispose();
      this.collarPoint.geometry.dispose();
    }
    this.disposePivotPoint();
    
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].dispose) {
        this.children[i].dispose();
      }
    }
    this.children.length = 0;
  }

  // ------------------------
  // toJSON
  // ------------------------
  toJSON(meta, keepUuid = false) {
    const output = {};

    // meta is a string when called from JSON.stringify
    const isRootObject = (meta === undefined || typeof meta === 'string');
    if (isRootObject) {
      output.metadata = {
        version: 5.0,
        type: 'GlTrace',
        generator: 'GlTrace.toJSON'
      };
    }

    const object = {};

    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;


    object.tCr = this.traceColor;
    object.tW = this.traceWidth;

    object.mCr = this.materialColor;

    object.cLC = this.collarLabelColor;
    // if (this.collarLabel && this.collarLabel.visible) object.cL = true;

    object.lLC = this.lengthLabelColor;
    // if (this.lengthLabel && this.lengthLabel.visible) object.lL = true;

    if (this.collarPoint) {
      if(this.collarPoint.visible) object.cPV = this.collarPoint.visible;
      object.cPC = this.collarPointColor;
      object.cPI = this.collarPointImage;
      object.cPS = this.collarPointSize;
    }

    // if (this.intervals && this.intervals.length > 0) {
    //   object.in = [];
    //   for (const interval of this.intervals) {
    //     object.in.push(Object.assign({}, interval));
    //   }
    // }

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
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      mCr: Primitive_Type.Uint32, // materialColor
      cLC: Primitive_Type.Uint32, // collarLabelsColor
      lLC: Primitive_Type.Uint32, // lengthLabelColor
      cPS: Primitive_Type.Uint8, // collarPointSize
      cPC: Primitive_Type.Uint32, // collarPointColor
      cPI: Primitive_Type.Uint8, // collarPointSize
      cPV: Primitive_Type.Uint8, // collarPointVisible
      tCr: Primitive_Type.Uint32, // traceColor
      tW: Primitive_Type.Uint8, // traceWidth
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

    writeToDv('tCr', this.traceColor);
    writeToDv('tW', this.traceWidth);

    writeToDv('mCr', this.materialColor);

    writeToDv('cLC', this.collarLabelColor);
    // if (this.collarLabel && this.collarLabel.visible) writeToDv('cL', true);

    writeToDv('lLC', this.lengthLabelColor);
    // if (this.lengthLabel && this.lengthLabel.visible) writeToDv('lL', true);

    if (this.collarPoint) {
      if(this.collarPoint.visible) writeToDv('cPV', this.collarPoint.visible);
      writeToDv('cPC', this.collarPointColor);
      writeToDv('cPI', this.collarPointImage);
      writeToDv('cPS', this.collarPointSize);
    }

    writeToDv('endObj');
  }

}