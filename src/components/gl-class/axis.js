import { Text } from "../../lib/troika/troika-three-text/Text";

import {
  BufferGeometry,
  MathUtils,
  Vector3,
  LineSegments,
  Color,
  Object3D,
  Group,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  DoubleSide,
} from "three";
import { AxisScale } from "../../lib/core/gl-constants";

const __EPS = 1.e-8;
function isNumeric(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}
export class Axis extends Object3D {
  constructor(sceneControls, options = {}) {
    super();

    if (sceneControls &&
      (sceneControls.isArcballControls || sceneControls.isOrbitControls)) {
      this.sceneControls = sceneControls;
    }

    // Merge default and custom options
    const allOptions = { ...Axis.defaultOptions, ...options };

    // Set options
    this.min = allOptions.min;
    this.max = allOptions.max;
    this.gradationCount = allOptions.gradationCount;
    this.side = allOptions.side;
    this.axisScale = allOptions.axisScale;
    this.hyphenSize = allOptions.hyphenSize;
    this.adjustRange = allOptions.adjustRange;
    this.percent = allOptions.percent;
    this.anchorX = allOptions.anchorX;
    this.anchorY = allOptions.anchorY;
    this.gridLength = allOptions.gridLength;
    this.staticRange = allOptions.staticRange;
    this.hyphenLength = (this.max - this.min) * this.hyphenSize;
    this.visibleMinMax = allOptions.visibleMinMax;
    this.isAxis = true;
    // Data-related Properties
    this.range = null; // Dynamic data range
    this.range0 = null; // Initial range for reference

    // Visual Components
    this.textPool = new ObjectPool(Text);
    // init and set on queue end callback
    const ts = []
    for (let i = 0; i < 30; i++) {
      const t = this.textPool.acquire()
      t.onQueueEnd = () => {
        const context = this.sceneControls ? this.sceneControls.context : null;
        if (context) {
          context.notifySceneGraphChanged();
        }
      };
      ts.push(t)
    }
    for (let i = 0; i < 30; i++) {
      this.textPool.release(ts[i])
    }

    this.labels = [];
    this.hyphens = null;
    this.gridLines = null;
    this.gridLinesColor = new Color('steelblue');
    this.title = null;

    // Create Axis Line
    this.createAxisLine();

    this.coloredAreas = null;
    this.coloredMeshes = null;

    const self = this;
    this.onCameraUpdateListener = (e) => self.onCameraUpdate(e);
    if (this.sceneControls) {
      sceneControls.addEventListener("end", this.onCameraUpdateListener);
    }
  }

  dispose() {
    if (this.axisLine) {
      this.remove(this.axisLine);
      this.axisLine.geometry.dispose();
      this.axisLine.material.dispose();
    }

    if (this.gridLines) {
      this.remove(this.gridLines);
      this.gridLines.geometry.dispose();
      this.gridLines.material.dispose();
    }

    if (this.hyphens) {
      this.remove(this.hyphens);
      this.hyphens.geometry.dispose();
      this.hyphens.material.dispose();
    }

    if (this.labels.length > 0) {
      for (const l of this.labels) {
        l.dispose();
        this.remove(l);
      }
      this.labels.length = 0;
    }

    this.textPool.dispose();
    if (this.sceneControls) {
      this.sceneControls.removeEventListener("end", this.onCameraUpdateListener);
    }
  }

  createAxisLine() {
    const axisLinePoints = [];
    if (this.side === 'left' || this.side === 'right') {
      axisLinePoints.push(new Vector3(this.anchorX, this.min), new Vector3(this.anchorX, this.max))
    } else if (this.side === 'bottom' || this.side === 'top') {
      axisLinePoints.push(new Vector3(this.min, this.anchorY), new Vector3(this.max, this.anchorY))
    }
    const axisLineGeometry = new BufferGeometry().setFromPoints(axisLinePoints)
    const axisLine = new LineSegments(axisLineGeometry);
    axisLine.material.color.setColorName('black');

    this.add(axisLine);
    axisLine.renderOrder = 1;
    this.axisLine = axisLine;
  }

  forceUpdate() {
    this.onCameraUpdate(null, true);
  }

  onCameraUpdate(e, force = false) {
    const camera = this.sceneControls ? this.sceneControls.camera : null;
    if (camera === null) return;

    // console.log('camera change')
    if (!this.range) {
      // categorical
      this.updateCategoricalLabels()
    } else if (!this.staticRange) {
      const r00 = this.range0[0]
      const r01 = this.range0[1]
      const cameraCoord = this.side === 'left' || this.side === 'right' ? camera.position.y : camera.position.x;
      const valAt0 = MathUtils.mapLinear(0, this.min, this.max, r00, r01)
      const offset = MathUtils.mapLinear(cameraCoord, this.min, this.max, r00, r01)
      camera.Array
      const r0 = (r00 - valAt0) / camera.zoom + offset;
      const r1 = (r01 - valAt0) / camera.zoom + offset;
      const newRange = [r0, r1]
      if (!force && this.range[0] === newRange[0] && this.range[1] === newRange[1]) {
        return;
      }
      if (this.axisScale === AxisScale.Logarithmic) {
        newRange[0] = Math.exp(r0)
        newRange[1] = Math.exp(r1)
      }
      this._setRange(newRange);
      this.setRegularLabels();
      this.setHyphensAtLabels();
      this.setGridLinesAtLabels(this.gridLength)
    } else {
      /*this.setRegularLabels();
      this.setHyphensAtLabels();
      this.setGridLinesAtLabels(this.gridLength)
      */
    }
  }

  copy(axis) {
    this.min = axis.min;
    this.max = axis.max;
    this.gradationCount = axis.gradationCount;
    this.side = axis.side;
    this.axisScale = axis.axisScale;
    this.hyphenSize = axis.hyphenSize;
    this.adjustRange = axis.adjustRange;
    this.percent = axis.percent;
    this.anchorX = axis.anchorX;
    this.anchorY = axis.anchorY;
    this.gridLength = axis.gridLength;
    this.staticRange = axis.staticRange;
    this.hyphenLength = axis.hyphenLength;
    this.visibleMinMax = axis.visibleMinMax;
    let scale = false;
    if (this.range0 && axis.range0) {
      scale = ((axis.range0[1] - axis.range0[0]) > __EPS) ? Math.abs(this.range0[1] - this.range0[0]) / Math.abs(axis.range0[1] - axis.range0[0]) : 1;
    }
    this.range = axis.range;
    this.range0 = axis.range0;
    return scale
  }

  isValid(axes){
    if (axes.isAxis) {
      const axis = axes;
      if (this.side !== axis.side) {
        return false;
      }
      if (this.axisScale !== axis.axisScale) {
        return false;
      }
      return true;
    }
    else if (Array.isArray(axes)) {
      if (axes.reduce((acc, axis) => acc && this.side !== axis.side, true)) {
        return false;
      }
      if (axes.reduce((acc, axis) => acc && this.axisScale !== axis.axisScale, true)) {
        return false;
      }
      return true;
    }
  }

  copyArray(axes) {
    this.min = axes.reduce((acc, axis) => Math.min(acc, axis.min), axes[0].min);
    this.max = axes.reduce((acc, axis) => Math.max(acc, axis.max), axes[0].max);
    this.gradationCount = axes.reduce((acc, axis) => Math.max(acc, axis.gradationCount), axes[0].gradationCount);
    this.side = axes[0].side;
    this.axisScale = axes[0].axisScale;
    this.hyphenSize = axes.reduce((acc, axis) => Math.max(acc, axis.hyphenSize), axes[0].hyphenSize);
    this.adjustRange = axes.reduce((acc, axis) => acc || axis.adjustRange, axes[0].adjustRange);
    this.percent = axes.reduce((acc, axis) => acc || axis.percent, axes[0].percent);
    this.anchorX = axes.reduce((acc, axis) => Math.min(acc, axis.anchorX), axes[0].anchorX);
    this.anchorY = axes.reduce((acc, axis) => Math.min(acc, axis.anchorY), axes[0].anchorY);
    this.gridLength = axes[0].gridLength;
    this.staticRange = axes.reduce((acc, axis) => acc || axis.staticRange, axes[0].staticRange);
    this.hyphenLength = axes.reduce((acc, axis) => Math.max(acc, axis.hyphenLength), axes[0].hyphenLength);
    this.visibleMinMax = axes.reduce((acc, axis) => acc || axis.visibleMinMax, axes[0].visibleMinMax);
    let scale = false;
    const newRange = [axes.reduce((acc, axis) => Math.min(acc, axis.range0[0]), axes[0].range0[0]), axes.reduce((acc, axis) => Math.max(acc, axis.range0[1]), axes[0].range0[1])];
    scale = (newRange[1] - newRange[0]) > __EPS ? Math.abs(this.range0[1] - this.range0[0]) / Math.abs(newRange[1] - newRange[0]) : 1;
    this.range0 = newRange;
    this.range = this.range0;
    return scale
  }

  union(axes) {
    if (axes.isAxis) {
      const axis = axes;
      if (this.side !== axis.side) {
        return false;
      }
      if (this.axisScale !== axis.axisScale) {
        return false;
      }

      this.min = Math.min(this.min, axis.min);
      this.max = Math.max(this.max, axis.max);
      this.width = Math.max(this.width, axis.width);
      this.gradationCount = Math.max(this.gradationCount, axis.gradationCount);
      this.hyphenSize = Math.max(this.hyphenSize, axis.hyphenSize);
      this.adjustRange = this.adjustRange || axis.adjustRange;
      this.percent = this.percent || axis.percent;
      this.anchorX = Math.min(this.anchorX, axis.anchorX);
      this.anchorY = Math.min(this.anchorY, axis.anchorY);
      this.staticRange = this.staticRange || axis.staticRange;
      this.hyphenLength = Math.max(this.hyphenLength, axis.hyphenLength);
      this.visibleMinMax = this.visibleMinMax || axis.visibleMinMax;

      const newRange = [Math.min(this.range0[0], axis.range0[0]), Math.max(this.range0[1], axis.range0[1])];
      const scale = (newRange[1] - newRange[0]) > __EPS ? Math.abs(this.range0[1] - this.range0[0]) / Math.abs(newRange[1] - newRange[0]) : 1;
      this.range0 = newRange;
      this.range = this.range0;
      //this.onCameraUpdate();

      return scale
    }
    else if (Array.isArray(axes)) {
      if (axes.reduce((acc, axis) => acc && this.side !== axis.side, true)) {
        return false;
      }
      if (axes.reduce((acc, axis) => acc && this.axisScale !== axis.axisScale, true)) {
        return false;
      }
      this.min = axes.reduce((acc, axis) => Math.min(acc, axis.min), this.min);
      this.max = axes.reduce((acc, axis) => Math.max(acc, axis.max), this.max);
      this.gradationCount = axes.reduce((acc, axis) => Math.max(acc, axis.gradationCount), this.gradationCount);
      this.hyphenSize = axes.reduce((acc, axis) => Math.max(acc, axis.hyphenSize), this.hyphenSize);
      this.adjustRange = axes.reduce((acc, axis) => acc || axis.adjustRange, this.adjustRange);
      this.percent = axes.reduce((acc, axis) => acc || axis.percent, this.percent);
      this.anchorX = axes.reduce((acc, axis) => Math.min(acc, axis.anchorX), this.anchorX);
      this.anchorY = axes.reduce((acc, axis) => Math.min(acc, axis.anchorY), this.anchorY);
      this.staticRange = axes.reduce((acc, axis) => acc || axis.staticRange, this.staticRange);
      this.hyphenLength = axes.reduce((acc, axis) => Math.max(acc, axis.hyphenLength), this.hyphenLength);
      this.visibleMinMax = axes.reduce((acc, axis) => acc || axis.visibleMinMax, this.visibleMinMax);
      const newRange = [axes.reduce((acc, axis) => Math.min(acc, axis.range0[0]), this.range0[0]), axes.reduce((acc, axis) => Math.max(acc, axis.range0[1]), this.range0[1])];
      const scale = (newRange[1] - newRange[0]) > __EPS ? Math.abs(this.range0[1] - this.range0[0]) / Math.abs(newRange[1] - newRange[0]) : 1;
      this.range0 = newRange;
      this.range = this.range0;
      return scale
    }
  }

  setRange(range) {
    this._setRange(range);
    this.range0 = this.range;
  }

  _setRange(range) {
    if (!range || !Number.isFinite(range[0]) || !Number.isFinite(range[1])) {
      console.error('Invalid range');
      return;
    }
    const min = range[0] < range[1] ? range[0] : range[1];
    const max = range[0] < range[1] ? range[1] : range[0];
    if (this.axisScale === AxisScale.Linear) {
      this.range = [min, max];
      if (this.adjustRange) {
        this.adjustRangeForIntegerIntervals();
      }
    } else if (this.axisScale === AxisScale.Logarithmic) {
      const lowerPower = Math.log(min <= 0 ? 0.1 : min);
      const upperPower = Math.log(max <= 0 ? 1 : max);
      this.range = [lowerPower, upperPower]
    }
  }

  setRegularLabels() {
    if (this.labels.length > 0) {
      for (const l of this.labels) {
        // l.dispose();
        this.textPool.release(l);
        this.remove(l);
      }
      this.labels.length = 0;
    }

    const syncpromises = [];
    let spacing, adjRangeMin, adjRangeMax;
    if (this.axisScale === AxisScale.Logarithmic) {
      spacing = 1;
      adjRangeMin = Math.ceil(Math.log10(Math.exp(this.range[0])) / spacing) * spacing
      adjRangeMax = Math.floor(Math.log10(Math.exp(this.range[1])) / spacing) * spacing
    } else {
      const n = 5;
      spacing = parseFloat(((this.range[1] - this.range[0]) / n).toPrecision(1));
      adjRangeMin = Math.ceil(this.range[0] / spacing) * spacing
      adjRangeMax = Math.floor(this.range[1] / spacing) * spacing
    }
    let tMax, tMin;
    if (this.visibleMinMax) {
      tMax = this.textPool.acquire()
      tMin = this.textPool.acquire()
      tMax.text = this.range[1].toFixed(2);
      tMin.text = this.range[0].toFixed(2);
      tMax.fontSize = 18;
      tMin.fontSize = 18;
      tMax.color = 'black';
      tMin.color = 'black';

      if (this.side === 'left') {
        tMax.anchorX = 'right';
        tMax.anchorY = 'middle';
        tMin.anchorX = 'right';
        tMin.anchorY = 'middle';
        tMax.position.set(this.anchorX - this.hyphenLength, this.mapToAxisValue(this.range[1]), 0)
        tMin.position.set(this.anchorX - this.hyphenLength, this.mapToAxisValue(this.range[0]), 0)
      } else if (this.side === 'bottom') {
        tMax.anchorX = 'center';
        tMax.anchorY = 'top';
        tMin.anchorX = 'center';
        tMin.anchorY = 'top';
        tMax.position.set(this.mapToAxisValue(this.range[1]), this.anchorY - this.hyphenLength, 0)
        tMin.position.set(this.mapToAxisValue(this.range[0]), this.anchorY - this.hyphenLength, 0)
      } else if (this.side === 'top') {
        tMax.anchorX = 'center';
        tMax.anchorY = 'bottom';
        tMin.anchorX = 'center';
        tMin.anchorY = 'bottom';
        tMax.position.set(this.mapToAxisValue(this.range[1]), this.anchorY + this.hyphenLength, 0)
        tMin.position.set(this.mapToAxisValue(this.range[0]), this.anchorY + this.hyphenLength, 0)
      }
      this.labels.push(tMin);
      syncpromises.push(tMin.sync());
      this.add(tMin);
    }

    for (let val = adjRangeMin; val <= adjRangeMax; val += spacing) {
      // const t = new Text();
      const t = this.textPool.acquire()

      let realVal;
      if (this.axisScale === AxisScale.Logarithmic) {
        realVal = parseFloat(Math.pow(10, val).toPrecision(1))
        t.text = realVal < 0.001 ? realVal.toExponential() : realVal.toString();
      } else {
        realVal = val
        if (this.percent) {
          let p = Math.floor(Math.log10(spacing * 100))
          const val100 = val * 100;
          t.text = Math.abs(val100 % 1) < 1e-5 ? val100.toFixed(0) + '%' : val100.toFixed(p >= 0 ? 2 : -p) + '%';
        } else {
          let p = Math.floor(Math.log10(spacing))
          t.text = Math.abs(val % 1) < 1e-6 ? val.toFixed(0) : val.toFixed(p >= 0 ? 2 : -p);
        }
      }
      const axisVal = this.mapToAxisValue(realVal);
      t.fontSize = 18;
      t.color = 'black';
      if (this.side === 'left') {
        t.anchorX = 'right';
        t.anchorY = 'middle';
        t.position.set(this.anchorX - this.hyphenLength, axisVal, 0)
      } else if (this.side === 'bottom') {
        t.anchorX = 'center';
        t.anchorY = 'top';
        t.position.set(axisVal, this.anchorY - this.hyphenLength, 0)
      } else if (this.side === 'top') {
        t.anchorX = 'center';
        t.anchorY = 'bottom';
        t.position.set(axisVal, this.anchorY + this.hyphenLength, 0)
      } else if (this.side === 'right') {
        t.anchorX = 'left';
        t.anchorY = 'middle';
        t.position.set(this.anchorX + this.hyphenLength, axisVal, 0)
      }
      this.labels.push(t);

      syncpromises.push(t.sync())
      this.add(t);
    }
    if (this.visibleMinMax) {
      this.labels.push(tMax);
      syncpromises.push(tMax.sync());
      this.add(tMax);
    }

    Promise.all(syncpromises)
      .then(() => {
        const context = this.sceneControls ? this.sceneControls.context : null;
        if (context) {
          context.notifySceneGraphChanged();
        }
      });
  }

  setTitle(titleString) {
    if (this.title) {
      this.remove(this.title)
      this.title.dispose();
    }
    const title = new Text();
    title.text = titleString;
    title.fontSize = 25;
    title.anchorX = 'center';
    title.color = 'black';
    if (this.side === 'left') {
      title.rotateZ(Math.PI / 2);
      title.position.set(this.anchorX - this.hyphenLength - 70, this.min + (this.max - this.min) / 2, 0);
    } else if (this.side === 'bottom') {
      title.position.set(this.min + (this.max - this.min) / 2, this.anchorY - this.hyphenLength - 30, 0);
    } else if (this.side === 'top') {
      title.position.set(this.min + (this.max - this.min) / 2, this.anchorY - this.hyphenLength + 70, 0);
    }
    this.title = title;
    this.add(title);
    title.sync().then(() => {
      const context = this.sceneControls ? this.sceneControls.context : null;
      if (context) {
        context.notifySceneGraphChanged();
      }
    })
  }

  setLabelsAtPositions(labels) {
    if (this.labels.length > 0) {
      for (const l of this.labels) {
        // l.dispose();
        this.textPool.release(l);
        this.remove(l);
        l.position0 = null;
      }
      this.labels.length = 0;
    }

    const syncpromises = [];
    for (const label of labels) {
      const t = this.textPool.acquire()
      t.text = label.text;
      t.fontSize = 18;
      t.color = 'black';
      t.visible = false;
      if (this.side === 'left') {
        t.anchorX = 'right';
        t.anchorY = 'middle';
        t.position.set(this.anchorX - this.hyphenLength, label.position, 0)
        if (!t.position0) {
          t.position0 = label.position
        }
      } else if (this.side === 'bottom') {
        t.anchorX = 'center';
        t.anchorY = 'top';
        t.position.set(label.position, this.anchorY - this.hyphenLength, 0)
        if (!t.position0) {
          t.position0 = label.position
        }
      } else if (this.side === 'top') {
        t.anchorX = 'center';
        t.anchorY = 'bottom';
        t.position.set(label.position, this.anchorY - this.hyphenLength, 0)
        if (!t.position0) {
          t.position0 = label.position
        }
      }

      this.labels.push(t);
      this.add(t);
      syncpromises.push(t.sync())
    }
    Promise.all(syncpromises)
      .then(() => {
        const context = this.sceneControls ? this.sceneControls.context : null;
        if (context) {
          context.notifySceneGraphChanged();
        }
      });
  }

  setGridLinesAtLabels() {
    if (!this.gridLines) {
      const gridLines = new LineSegments();
      gridLines.material.color.copy(this.gridLinesColor);
      gridLines.material.transparent = true;
      gridLines.material.opacity = 0.4;
      gridLines.renderOrder = -1;
      gridLines.raycast = () => { };
      this.add(gridLines);
      this.gridLines = gridLines;
    }
    const segments = [];

    for (let i = 0; i < this.labels.length; i++) {
      if (!this.labels[i].visible) continue;

      if (this.side === 'left') {
        segments.push(new Vector3(this.anchorX, this.labels[i].position.y), new Vector3(this.anchorX + this.gridLength, this.labels[i].position.y))
      } else if (this.side === 'bottom') {
        segments.push(new Vector3(this.labels[i].position.x, this.anchorY), new Vector3(this.labels[i].position.x, this.anchorY + this.gridLength))
      } else if (this.side === 'top') {
        segments.push(new Vector3(this.labels[i].position.x, this.anchorY), new Vector3(this.labels[i].position.x, this.anchorY - this.gridLength))
      } else if (this.side === 'right') {
        segments.push(new Vector3(this.anchorX, this.labels[i].position.y), new Vector3(this.anchorX - this.gridLength, this.labels[i].position.y))
      }
    }

    this.gridLines.geometry.setFromPoints(segments);
  }

  setHyphensAtLabels() {
    if (!this.hyphens) {
      const hyphens = new LineSegments();
      hyphens.material.color.setColorName('black');
      this.add(hyphens);
      this.hyphens = hyphens;
    }
    const segments = [];

    for (let i = 0; i < this.labels.length; i++) {
      if (!this.labels[i].visible) continue;

      if (this.side === 'left') {
        segments.push(new Vector3(this.anchorX - this.hyphenLength, this.labels[i].position.y), new Vector3(this.anchorX, this.labels[i].position.y))
      } else if (this.side === 'bottom') {
        segments.push(new Vector3(this.labels[i].position.x, this.anchorY - this.hyphenLength), new Vector3(this.labels[i].position.x, this.anchorY))
      } else if (this.side === 'top') {
        segments.push(new Vector3(this.labels[i].position.x, this.anchorY + this.hyphenLength), new Vector3(this.labels[i].position.x, this.anchorY))
      } else if (this.side === 'right') {
        segments.push(new Vector3(this.anchorX + this.hyphenLength, this.labels[i].position.y), new Vector3(this.anchorX, this.labels[i].position.y))
      }
    }

    this.hyphens.geometry.setFromPoints(segments);
  }

  setColoredAreas(areas) {
    if (!this.coloredMeshes) {
      this.coloredAreas = []
      this.coloredMeshes = new Group();
      this.coloredMeshes.renderOrder = -Infinity;
      this.add(this.coloredMeshes)
    } else {
      this.coloredAreas = []
      this.coloredMeshes.children.map(c => { c.geometry.dispose(); c.material.dispose(); })
      this.coloredMeshes.clear();
      // for (const c of this.coloredMeshes.children) {
      //   this.coloredMeshes.remove(c);
      //   c.geometry.dispose();
      //   c.material.dispose();
      // }
    }
    for (const area of areas) {
      this.coloredAreas.push(area);
      const mesh = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({
        side: DoubleSide,
        color: area.color,
      }));
      mesh.raycast = () => { }
      this.coloredMeshes.add(mesh);
    }

    this.updateColoredAreas();
  }

  updateColoredAreas() {
    if (this.coloredAreas) {
      for (let i = 0; i < this.coloredAreas.length; i++) {
        const mesh = this.coloredMeshes.children[i];
        const posA = mesh.geometry.getAttribute('position')
        const ca = this.coloredAreas[i];

        if (this.side === 'left') {
          const yStart = isNumeric(ca.lstart) ? ca.lstart : MathUtils.clamp(ca.lstart.position.y, this.min, this.max)
          const yEnd = isNumeric(ca.lend) ? ca.lend : MathUtils.clamp(ca.lend.position.y, this.min, this.max)
          posA.setXYZ(0, this.anchorX, yStart, 0)
          posA.setXYZ(1, this.anchorX + this.gridLength, yStart, 0)
          posA.setXYZ(2, this.anchorX, yEnd, 0)
          posA.setXYZ(3, this.anchorX + this.gridLength, yEnd, 0)
          posA.needsUpdate = true;
        } else if (this.side === 'top') {
          const xStart = isNumeric(ca.lstart) ? ca.lstart : MathUtils.clamp(ca.lstart.position.x, this.min, this.max)
          const xEnd = isNumeric(ca.lend) ? ca.lend : MathUtils.clamp(ca.lend.position.x, this.min, this.max)
          posA.setXYZ(0, xStart, this.anchorY, 0)
          posA.setXYZ(1, xStart, this.anchorY - this.gridLength, 0)
          posA.setXYZ(2, xEnd, this.anchorY, 0)
          posA.setXYZ(3, xEnd, this.anchorY - this.gridLength, 0)
          posA.needsUpdate = true;
        }
      }
    }
  }

  setColoredAreasColor(color) {
    if (this.coloredMeshes && color && color.isColor) {
      for (const c of this.coloredMeshes.children) {
        c.material.color = color;
      }
    }
  }

  updateCategoricalLabels() {
    const camera = this.sceneControls ? this.sceneControls.camera : null;
    if (camera === null) return;

    const cameraCoord = this.side === 'left' ? camera.position.y : camera.position.x;
    const center = (this.max + this.min) / 2 + cameraCoord;
    const visWidth = (this.max - this.min) / camera.zoom
    for (const l of this.labels) {
      const newPos = MathUtils.mapLinear(l.position0, center - visWidth / 2, center + visWidth / 2, this.min, this.max)
      if (newPos > this.max || newPos < this.min) {
        l.visible = false;
      } else {
        l.visible = true;
      }

      if (this.side === 'left') {
        l.position.set(this.anchorX - this.hyphenLength, newPos, 0)
      } else if (this.side === 'bottom') {
        l.position.set(newPos, this.anchorY - this.hyphenLength, 0)
      } else if (this.side === 'top') {
        l.position.set(newPos, this.anchorY + this.hyphenLength, 0)
      }
    }
    this.updateColoredAreas();
    this.setHyphensAtLabels();
    this.setGridLinesAtLabels(this.gridLength)
  }

  adjustRangeForIntegerIntervals() {
    const interval = Math.ceil((this.range[1] - this.range[0]) / this.gradationCount);

    // Adjust the minimum and maximum values
    this.range[0] = Math.floor(this.range[0] / interval) * interval;
    this.range[1] = Math.ceil(this.range[1] / interval) * interval;
    this.gradationCount = Math.round((this.range[1] - this.range[0]) / interval)
  }

  mapToAxisValue(originalValue, isLog = false, useRange0 = false) {
    const range = useRange0 ? this.range0 : this.range
    if (this.axisScale === AxisScale.Logarithmic) {

      if (isLog) {
        return MathUtils.mapLinear(originalValue, range[0], range[1], this.min, this.max);
      }
      if (originalValue <= 0) originalValue = __EPS;
      return MathUtils.mapLinear(Math.log(originalValue), range[0], range[1], this.min, this.max);

    } else if (this.axisScale === AxisScale.Linear) {
      return MathUtils.mapLinear(originalValue, range[0], range[1], this.min, this.max);
    } else if (this.axisScale === AxisScale.Probability) {
      return MathUtils.mapLinear(jStat.normal.inv(originalValue, 0, 1), -4, 4, this.min, this.max);
    }
  }

  mapToAxis0Value(originalValue, isLog = false) {
    return this.mapToAxisValue(originalValue, isLog, true)
  }

  mapToOriginalValue(axisValue) {
    if (this.axisScale === AxisScale.Logarithmic) {
      const power = MathUtils.mapLinear(axisValue, this.min, this.max, this.range0[0], this.range0[1])
      return Math.exp(power);
    } else if (this.axisScale === AxisScale.Linear) {
      return MathUtils.mapLinear(axisValue, this.min, this.max, this.range0[0], this.range0[1]);
    }
  }

  symlog(value) {
    return Math.sign(value) * Math.log(1 + Math.abs(value))
  }

  updateMatrixWorld(force) {
    const camera = this.sceneControls ? this.sceneControls.camera : null;
    if (camera) {
      this.position.copy(camera.focalPoint);
      this.scale.setScalar(1 / camera.zoom);
    }

    super.updateMatrixWorld(force);
  }
}

Axis.defaultOptions = {
  min: -500,
  max: 500,
  gradationCount: 10,
  side: "left",
  axisScale: AxisScale.Linear,
  hyphenSize: 0.025,
  adjustRange: false,
  percent: false,
  anchorX: 0,
  anchorY: 0,
  gridLength: 1000,
  staticRange: false
};

class ObjectPool {
  constructor(factory) {
    this.factory = factory; // Function to create new objects
    this.pool = []; // Array to store objects
  }

  // Acquire an object from the pool
  acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    } else {
      return new this.factory();
    }
  }

  // Release an object back to the pool
  release(obj) {
    this.pool.push(obj);
  }

  // Dispose all objects contained in the pool
  dispose() {
    for (const obj of this.pool) {
      if (typeof obj.dispose === 'function') {
        obj.dispose();
      }
    }
    this.pool.length = 0;
  }
}