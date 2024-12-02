/* eslint-disable no-undef */
import {
  Group,
  Vector3,
  Box3,
} from 'three';

export class GlPlotTemplate extends Group {
  constructor() {
    super();
    this.bbox = new Vector3(1, 1, 1);

    this.selectable = false;
    this.isSelected = false;
    this.snappable = true;
    this.visible = true;

    this.type = "GLPlotTemplate";
    this.isGlPlotTemplate = true;
  }

  addChild(object) {
    if (Array.isArray(object)) {
      for (let i = 0; i < object.length; i++) {
        this.add(object[i]);
      }
    } else {
      this.add(object);
    }
  }

  removeChild(object) {
    if (Array.isArray(object)) {
      for (let i = 0; i < object.length; i++) {
        this.remove(object[i]);
      }
    } else {
      this.remove(object);
    }
  }

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox() {
    const plotSetBB = new Box3();

    for (const object of this.children) {
      if (object.getBoundingBox) {
        const objectBB = object.getBoundingBox();
        if (objectBB) {
          const min = objectBB.min.clone();
          const max = objectBB.max.clone();
          plotSetBB.expandByPoint(min);
          plotSetBB.expandByPoint(max);
        }
      }
    }
    if (!plotSetBB.isEmpty()) {
      plotSetBB.getSize(this.bbox);
      if (this.bbox.length() < 1) this.bbox.set(1, 1, 1);
    }
    return plotSetBB.isEmpty() ? null : plotSetBB;
  }

  dispose() {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].dispose();
    }
  }

  raycast(raycaster, intersects) {
    if (!this.visible || !this.selectable || !this.snappable) return;
    for (const child of this.children) {
      if (child.visible && child.selectable && typeof child.raycast === 'function') {
        child.raycast(raycaster, intersects);
      }
    }
  }
}