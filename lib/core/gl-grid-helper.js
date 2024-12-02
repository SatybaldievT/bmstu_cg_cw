import { GlGrid } from "../objects/gl-grid";
import { GlEvents } from "./gl-events";
import {
  Vector3,
  Object3D,
  MathUtils,
} from 'three';

const _xUnit = new Vector3(1, 0, 0);
const _yUnit = new Vector3(0, 1, 0);
const _zUnit = new Vector3(0, 0, 1);
const _normal = new Vector3();

const log10_2 = 0.3010299956639812;   // 0.30... == log10(2.0)
const log10_5 = 0.69897000433601886;  // 0.69... == log10(5.0)

export class GlGridHelper extends Object3D {
  constructor() {
    super();
    this.cellSize = 50;
    this.radius = 1000;
    this.sparseInterval = 5;
    this._pixelsPerCm = 38;

    this._gridXY = null;
    this._gridYZ = null;
    this._gridXZ = null;
    this.boxGridHelper = null;

    this.decimals = 0;
    this.shouldUpdateOpacity = true;
    this.showLabels = true;
    this.maxOpacity = 1;
    
    // fold or constant
    this.adjustCellMode = 'multiple';
    this.cellSpacing = 0;

    this._angleOfLabelVisibility = 0.95;
  }

  dispose() {
    if (this._gridXY) this._gridXY.dispose();
    if (this._gridXZ) this._gridXZ.dispose();
    if (this._gridYZ) this._gridYZ.dispose();
    if (this.parent) {
      this.parent.remove(this);
    }
    this.boxGridHelper = null;
  }

  // ---------------------------------------
  // Make main 3 grids as a box
  // ---------------------------------------
  __makeBoxGrid(sizeVector, camera) {
    if (!(sizeVector && sizeVector.isVector3)) return;

    // make grids and orient labels for readability
    const gridXY = new GlGrid(sizeVector.x, sizeVector.y, this.cellSize, this.sparseInterval);
    gridXY.setGridType('xy');
    
    const gridYZ = new GlGrid(sizeVector.y, sizeVector.z, this.cellSize, this.sparseInterval);
    gridYZ.setGridType('yz');
    
    const gridXZ = new GlGrid(sizeVector.x, sizeVector.z, this.cellSize, this.sparseInterval);
    gridXZ.setGridType('xz');
    
    const maxSize = Math.max(gridXY.width, gridYZ.width, gridXZ.height);
    this.radius = Math.sqrt(0.5 * maxSize * maxSize);
    
    gridXY.material.opacity = this.maxOpacity;
    gridYZ.material.opacity = this.maxOpacity;
    gridXZ.material.opacity = this.maxOpacity;
    
    this.add(gridXY);
    this.add(gridYZ);
    this.add(gridXZ);
    
    gridXY.addLabels();
    gridXZ.addLabels();
    gridYZ.addLabels();
    
    for (const label of gridXY.labelsV.children) {
      label.rotateZ(Math.PI);
    }
    gridXY.rotateZ(Math.PI);
    gridXY.position.set(gridXY.width / 2, gridXY.height / 2, 0);
    
    for (const label of gridYZ.labelsV.children) {
      label.rotateZ(Math.PI);
    }
    gridYZ.rotateX(Math.PI);
    gridYZ.position.set(0, gridYZ.width / 2, gridYZ.height / 2);

    for (const label of gridXZ.labelsV.children) {
      label.rotateZ(Math.PI);
    }
    gridXZ.rotateY(Math.PI);
    gridXZ.position.set(gridXZ.width / 2, 0, gridXZ.height / 2);
    
    this._gridXY = gridXY;
    this._gridYZ = gridYZ;
    this._gridXZ = gridXZ;

    this.updateLabels(camera, false, true);
  }

  // ---------------------------------------
  // Update the main 3 grids
  // ---------------------------------------
  updateGrids(camera, pixelsPerCm, vwHeight) {
    if (!(camera && camera.isGlOrthographicCamera &&
        pixelsPerCm > 1 && vwHeight > 1)) return;

    let showXY = false;
    let showXZ = false;
    let showYZ = false;
    if (this._gridXY) {
      showXY = this._gridXY.visible;
      this._gridXY.dispose();
      this.remove(this._gridXY);
    }
    if (this._gridXZ) {
      showXZ = this._gridXZ.visible;
      this._gridXZ.dispose();
      this.remove(this._gridXZ);
    }
    if (this._gridYZ) {
      showYZ = this._gridYZ.visible;
      this._gridYZ.dispose();
      this.remove(this._gridYZ);
    }

    const fovHeight = camera.getFovHeight();
    const aspectRatio = camera.getAspect();
    const perWorldUnit = vwHeight / fovHeight;
    const ptCentre = new Vector3();
    const axisScaling = new Vector3();
    const cellSize = pixelsPerCm / perWorldUnit;
    this.cellSize = cellSize;
    this.cellSpacing = cellSize;
    this._pixelsPerCm = pixelsPerCm;

    let maxSize = 0;

    let U = 'y', V = 'z', W = 'x';
    for (let axis = 0; axis < 3; axis++) {
      if (axis === 1) {
        U = 'x', V = 'z', W = 'y';
      } else if (axis === 2) {
        U = 'x', V = 'y', W = 'z';
      }

      const axesOffset = fovHeight * (aspectRatio > 1.0 ? aspectRatio : 1.0);
      axisScaling.set(1.0 / camera.scale.x, 1.0 / camera.scale.y, 1.0 / camera.scale.z);
      const vSize = axisScaling.multiplyScalar(axesOffset);

      ptCentre.copy(camera.focalPoint);
      ptCentre[W] = camera.fovCenter[W];
      const ptMin = ptCentre.clone().sub(vSize);
      const ptMax = ptCentre.clone().add(vSize);

      const widthU = ptMax[U] - ptMin[U];
      const widthV = ptMax[V] - ptMin[V];

      const sizeU = Math.ceil(widthU / cellSize) * cellSize;
      const sizeV = Math.ceil(widthV / cellSize) * cellSize;
      maxSize = Math.max(maxSize, sizeU, sizeV);

      if (axis === 0) {
        this._gridYZ = new GlGrid(sizeU, sizeV, cellSize, this.sparseInterval);
        this._gridYZ.material.opacity = this.maxOpacity;
        this._gridYZ.setGridType('yz');
      } else if (axis === 1) {
        this._gridXZ = new GlGrid(sizeU, sizeV, cellSize, this.sparseInterval);
        this._gridXZ.material.opacity = this.maxOpacity;
        this._gridXZ.setGridType('xz');
      } else {
        this._gridXY = new GlGrid(sizeU, sizeV, cellSize, this.sparseInterval);
        this._gridXY.material.opacity = this.maxOpacity;
        this._gridXY.setGridType('xy');
      }
    }
    this.radius = Math.sqrt(0.5 * maxSize * maxSize);

    this.add(this._gridXY);
    this.add(this._gridXZ);
    this.add(this._gridYZ);

    this._gridXY.addLabels();
    this._gridXZ.addLabels();
    this._gridYZ.addLabels();
    this._gridXY.visible = showXY;
    this._gridXZ.visible = showXZ;
    this._gridYZ.visible = showYZ;
  }

  updateLabels(camera, updatePositions = true, updateValues = false) {
    camera.updateMatrixWorld(true);
    this.updateMatrixWorld(true);
    const decimalDigits = this.decimals;
    if (this._gridXY && this._gridXY.visible) {
      this._gridXY.updateLabels(camera, updatePositions, updateValues, decimalDigits);
    }
    if (this._gridXZ && this._gridXZ.visible) {
      this._gridXZ.updateLabels(camera, updatePositions, updateValues, decimalDigits);
    }
    if (this._gridYZ && this._gridYZ.visible) {
      this._gridYZ.updateLabels(camera, updatePositions, updateValues, decimalDigits);
    }
  }

  notifyLabelsUpdated() {
    let needSync = 0;
    if (this._gridXY && this._gridXY.visible) {
      needSync += this._gridXY.labelsCountToSync;
    }
    if (this._gridXZ && this._gridXZ.visible) {
      needSync += this._gridXZ.labelsCountToSync;
    }
    if (this._gridYZ && this._gridYZ.visible) {
      needSync += this._gridYZ.labelsCountToSync;
    }
    if (needSync <= 0) {
      this.dispatchEvent({ type: GlEvents.gridHelperUpdated });
    }
  }

  updateOpacity(viewDir) {
    if (this.shouldUpdateOpacity) {
      this._gridXY.material.opacity = Math.abs(viewDir.dot(_zUnit)) * this.maxOpacity;
      this._gridXZ.material.opacity = Math.abs(viewDir.dot(_yUnit)) * this.maxOpacity;
      this._gridYZ.material.opacity = Math.abs(viewDir.dot(_xUnit)) * this.maxOpacity;
    }
  }

  updateLabelsOpacity(labels, unit, viewDir) {
    for (const child of labels.children) {
      child.material.opacity = Math.abs(viewDir.dot(unit)) > this._angleOfLabelVisibility ? 0 : 1;
    }
  }

  resetLabelsOpacity(labels) {
    for (const child of labels.children) {
      child.material.opacity = 1;
    }
  }

  // ---------------
  // Toggle XY grid
  // ---------------
  toggleXYGrid() {
    const flag = this._gridXY.visible ? false : true;
    this._gridXY.visible = flag;
  }
  
  // ---------------
  // Toggle YZ grid
  // ---------------
  toggleYZGrid() {
    const flag = this._gridYZ.visible ? false : true;
    this._gridYZ.visible = flag; 
  }
  
  // ---------------
  // Toggle XZ grid
  // ---------------
  toggleXZGrid() {
    const flag = this._gridXZ.visible ? false : true;
    this._gridXZ.visible = flag;
  }

  // ------------------
  // Make new box grid
  // ------------------
  makeBoxGrid(bbox, perWorldUnit, pixelsPerCm, camera) {
    if (!(bbox && bbox.isBox3 && pixelsPerCm > 1 && perWorldUnit > 0)) return;

    const sizeVector = new Vector3();
    bbox.getSize(sizeVector);

    if (this.boxGridHelper !== null) {
      this.boxGridHelper.dispose();
    }

    const cellSpacing = pixelsPerCm / perWorldUnit;
    this.boxGridHelper = new GlGridHelper();
    this.boxGridHelper.cellSize = cellSpacing;
    this.boxGridHelper.position.copy(bbox.min);
    this.boxGridHelper.__makeBoxGrid(sizeVector, camera);

    return this.boxGridHelper;
  }
  
  // -------------------------
  // Show all grids and labels
  // -------------------------
  makeAllGridsAndLabelsVisible() {
    this._gridXY.visible = true;
    this._gridXZ.visible = true;
    this._gridYZ.visible = true;
  }

  // ----------------
  // Adjust cell size
  // ----------------
  adjustCellSize(camera, vwHeight, forceToUpdateLabels = true) {
    if (this.adjustCellMode === 'multiple') {
      const ppc = this._pixelsPerCm > 1 ? this._pixelsPerCm : 38;
      const coeff = vwHeight / (ppc * this.sparseInterval * 2);
      const fovHeight = camera.getFovHeight();
      const cellSpacing = this._calculateHeightSpacing(fovHeight / coeff);
      const gridScale = cellSpacing / this.cellSize;
      this.scale.set(gridScale, gridScale, gridScale);
      const needUpdateValues = cellSpacing !== this.cellSpacing;
      this._calcDecimals(cellSpacing);
      if (forceToUpdateLabels) {
        this.updateLabels(camera, true, needUpdateValues);
      }
      this.cellSpacing = cellSpacing;
      return cellSpacing;

    } else {
      // const scaleMag = currentCellSize / this.cellSize / camera.zoom;
      // this.scale.set(scaleMag, scaleMag, scaleMag);
      // this._updateFractions(scaleMag);
      // // this.updateLabels(camera, true, true);
      // return currentCellSize;
    }
  }

  _calcDecimals(cellSpacing) {
    const decimals = Math.floor(Math.log10(cellSpacing));
    this.decimals = decimals >= 0 ? 0 : -decimals;
  }

  // ----------------------------------------
  // _calculateHeightSpacing
  // ----------------------------------------
  _calculateHeightSpacing(height) {
    const gridLevel = Math.log10(height);
    const fractPart = MathUtils.euclideanModulo(gridLevel, 1);
    const intPart = Math.floor(gridLevel);

    let spacing = 10.0;
    if (Math.abs(fractPart) < this.EPS) {
      spacing = 1.0;
    } else if (fractPart <= log10_2) {
      spacing = 2.0;
    } else if (fractPart <= log10_5) {
      spacing = 5.0;
    }

    return spacing * Math.pow(10.0, intPart - 1);
  }

  adjustPositionToNearestLevel(camera, cellSpacing) {
    const point = camera.focalPoint;
    const dx1 = -point.x % cellSpacing;
    const dx2 = cellSpacing + dx1;
    const dy1 = -point.y % cellSpacing;
    const dy2 = cellSpacing + dy1;
    const dz1 = -point.z % cellSpacing;
    const dz2 = cellSpacing + dz1;
    let dx = -dx1 < dx2 ? dx1 : dx2;
    let dy = -dy1 < dy2 ? dy1 : dy2;
    let dz = -dz1 < dz2 ? dz1 : dz2;
    this.position.copy(point).add({x: dx, y: dy, z: dz});
    this.updateLabels(camera, true, true);
  }

  setLabelSize(size) {
    this._gridXY.setLabelSize(size);
    this._gridXZ.setLabelSize(size);
    this._gridYZ.setLabelSize(size);
  }

  getWorldRadius() {
    return this.radius * this.scale.x;
  }
}