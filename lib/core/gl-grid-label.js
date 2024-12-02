import { Text } from "../troika/troika-three-text/Text";
import {
  Vector3,
  FrontSide,
} from 'three';

const _v1 = new Vector3();

export class GlGridLabel extends Text {
  constructor(params) {
    super();

    this.isGlGridLabel = true;
    this.type = 'isGlGridLabel';

    this.material.color.setHex(0x000000);
    this.fontSize = 1;

    if (!params) params = {};
    if (params.color !== null && params.color !== undefined) this.material.color.setHex(params.color);
    if (params.text) this.text = params.text;
    if (params.fontSize) this.fontSize = params.fontSize;

    const self = this;
    this.onSyncCallback = () => self.onAfterSync();
  }

  /**
   * Initiate a sync if needed - note it won't complete until next frame at the
   * earliest so if possible it's a good idea to call sync() manually as soon as
   * all the properties have been set.
   * @override
   */
   onBeforeRender(renderer, scene, camera, geometry, material, group) {
    this.sync()

    // This may not always be a text material, e.g. if there's a scene.overrideMaterial present
    if (material.isTroikaTextMaterial) {
      this._prepareForRender(material, camera.matrixWorld, camera);
      const fovHeight = camera.getFovHeight();
      material.uniforms.uTroikaScaleFactor.value = fovHeight / 64;
    }

    // We need to force the material to FrontSide to avoid the double-draw-call performance hit
    // introduced in Three.js r130: https://github.com/mrdoob/three.js/pull/21967 - The sidedness
    // is instead applied via drawRange in the GlyphsGeometry.
    material._hadOwnSide = material.hasOwnProperty('side')
    this.geometry.setSide(material._actualSide = material.side)
    material.side = FrontSide
  }

  setFontSize(size) {
    if (Number.isNaN(size)) return;

    this.fontSize = size;
    this.sync(this.onSyncCallback);
  }

  /**
   * Set a new label
   * @param {String} newLabel - new label to setz text of the GlLabel
   */
  setLabel(newLabel) {
    if (typeof newLabel === 'string') {
      this.text = newLabel;
      this.sync(this.onSyncCallback);
    }
  }

  // notify an object when the label is updated
  onAfterSync() {
    const slf = this && this.parent ? this.parent : null;
    if (!slf) return;

    const parent = slf.labelsCountToSync ? slf : slf.parent;
    if (parent && parent.labelsCountToSync && parent.notifyLabelUpdated) {
      parent.notifyLabelUpdated();
    }
  }

  // override Object3D.updateMatrixWorld and remove scale
  updateMatrixWorld() {
    super.updateMatrixWorld();

    const te = this.matrixWorld.elements;

    // since scale if proportional it is enough to use sx
    let sx = _v1.set(te[0], te[1], te[2]).length();

    const invSX = 1 / sx;

    te[0] *= invSX;
    te[1] *= invSX;
    te[2] *= invSX;

    te[4] *= invSX;
    te[5] *= invSX;
    te[6] *= invSX;

    te[8] *= invSX;
    te[9] *= invSX;
    te[10] *= invSX;
  }
}