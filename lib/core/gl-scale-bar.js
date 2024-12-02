import { GlGridLabel } from "./gl-grid-label";
import { GlEvents } from "./gl-events";
import {
  Object3D,
  CanvasTexture,
  SpriteMaterial,
  Sprite,
  NearestFilter
} from 'three';

export class GlScaleBar extends Object3D {
  constructor(cellSpacing, fovHeight) {
    super();

    function getSpriteMaterial() {
      const canvas = document.createElement('canvas');
      const resolution = 32;
      canvas.width = resolution * 10;
      const fifth = canvas.width / 5;
      canvas.height = resolution / 2;
      const halfHeight = canvas.height / 2;
      const context = canvas.getContext('2d');
      context.fillStyle = "black";
      context.fillRect(0, 0, fifth / 2, halfHeight);
      context.fillRect(fifth / 2, halfHeight, fifth / 2, halfHeight);
      context.fillRect(fifth, 0, fifth, halfHeight);
      context.fillRect(2 * fifth, halfHeight, fifth, halfHeight);
      context.fillRect(3 * fifth, 0, fifth, halfHeight);
      context.fillRect(4 * fifth, halfHeight, fifth, halfHeight);
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, canvas.height);
      context.lineTo(canvas.width, canvas.height);
      context.lineTo(canvas.width, 0);
      context.lineTo(0, 0);
      context.lineTo(0, canvas.height);
      context.stroke();
      const texture = new CanvasTexture(canvas);
      texture.magFilter = NearestFilter;
      texture.minFilter = NearestFilter;
      return new SpriteMaterial({ map: texture, toneMapped: false, depthTest: false, sizeAttenuation: false });
    }

    this.matrixWorldAutoUpdate = false;

    this.frustumCulled = false;

    this._bar = new Sprite(getSpriteMaterial());
    this._bar.renderOrder = 998;
    this._bar.frustumCulled = false;
    this._bar.center.set(0, 0);
    this._bar.scale.set(cellSpacing * 5, cellSpacing / 4, 1);

    this._cellSpacing = cellSpacing;
    this._cellSpacing0 = cellSpacing;
    this._fovHeight0 = fovHeight;

    this.labelsCountToSync = 2;

    // Create the scale bar's labels
    this._label0 = new GlGridLabel({ text: '0' });
    this._label0.renderOrder = 999;
    this._label0.frustumCulled = false;
    this._label0.material.depthTest = false;

    this._label1 = new GlGridLabel();
    this._label1.position.x = cellSpacing;
    this._label1.anchorX = 'center';
    this._label1.setLabel(cellSpacing > 1000 ? cellSpacing / 1000 + "km" : cellSpacing + 'm');
    this._label1.renderOrder = 999;
    this._label1.frustumCulled = false;
    this._label1.material.depthTest = false;

    const num = cellSpacing * 5;
    this._label2 = new GlGridLabel();
    this._label2.position.x = cellSpacing * 5;
    this._label2.anchorX = 'center';
    this._label2.setLabel(num > 1000 ? num / 1000 + "km" : num + 'm');
    this._label2.renderOrder = 999;
    this._label2.frustumCulled = false;
    this._label2.material.depthTest = false;

    this.add(this._label0);
    this.add(this._label1);
    this.add(this._label2)

    this._bar.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      this.position.set(-0.95, -0.95, 0).unproject(camera);
      this.quaternion.setFromRotationMatrix(camera.matrixWorld);
      this.scale.set(1, 1, 1).divideScalar(camera.zoom);
      this._bar.scale.x = this._cellSpacing * 5 * camera.zoom;
      this.updateMatrixWorld();
    }
    this.add(this._bar);
  }

  dispose() {
    this._bar.geometry.dispose();
    this._label0.dispose();
    this._label1.dispose();
    this._label2.dispose();
  }

  updateScaleBar(camera, cellSpacing) {
    const newText = cellSpacing > 1000 ? cellSpacing / 1000 + "km" : cellSpacing + 'm';
    if (this._label1.text !== newText) {
      this.labelsCountToSync = 2;
      this._label1.setLabel(newText);
      const num = cellSpacing * 5;
      this._label2.setLabel(num > 1000 ? num / 1000 + "km" : num + 'm');
    }

    this._cellSpacing = cellSpacing;
    this._label1.position.x = cellSpacing * camera.zoom;
    this._label2.position.x = cellSpacing * 5 * camera.zoom;
  }

  // updateInitSize(fovHeight) {
  //   const sclAdjust = fovHeight / this._fovHeight0;
  //   this._bar.scale.y = this._cellSpacing0 / 4 * sclAdjust;
  //   this._label0.scale.set(1, 1, 1).multiplyScalar(sclAdjust);
  //   this._label1.scale.set(1, 1, 1).multiplyScalar(sclAdjust);
  //   this._label2.scale.set(1, 1, 1).multiplyScalar(sclAdjust);
  // }

  updateInitSize(scenesSizePerCm) {
    this._bar.scale.y = scenesSizePerCm / 4;
  }

  notifyLabelUpdated() {
    this.labelsCountToSync--;
    if (this.labelsCountToSync <= 0) {
      this.labelsCountToSync = 0;
      this.dispatchEvent({ type: GlEvents.gridHelperUpdated });
    }
  }
}