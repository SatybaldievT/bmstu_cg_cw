/* eslint-disable no-undef */
import { GlEvents } from './gl-events';
import { GlClickMode, Tool_Types } from '../core/gl-constants';
import { GlUtils } from '../utils/gl-utils';
import { GlMultiScene } from '@tangens/gl-components/controls/gl-multi-scene';
import {
  EventDispatcher,
  Vector2,
  Vector3,
  Frustum,
  Matrix4,
} from 'three';

export class GlSelectionBox extends EventDispatcher {
  constructor(glScene) {
    super();

    this._glScene = glScene;
    this._context = glScene.context;
    this.isMultiSceneUsed = glScene instanceof GlMultiScene;

    if (this.isMultiSceneUsed) {
      this._glCanvas = glScene.glCanvas;
    } else {
      // get the WebGlRenderer's canvas
      for (const child of glScene.glWindow.children) {
        if (child.localName === 'canvas') {
          this._glCanvas = child;
          break;
        }
      }
    }

    this.type = Tool_Types.GlSelectionBox;
    this.isGlSelectionBox = true;

    this._active = false;
    this._scenesClickMode = GlClickMode.None;

    this._topLeft = this._glScene.selectionBox.startPoint;
    this._bottomRight = this._glScene.selectionBox.endPoint;
    this._sceneRect = this._glScene.selectionBox.sceneRect;

    this._isStarted = false;

    this._mouse = new Vector2();
    this._startPoint = new Vector3();
    this._endPoint = new Vector3();
    this._zAspect = 0;

    this._cameraFrustum = new Frustum();
    this._selectionFrustum = new Frustum();

    this._selectedObjects = new Map();
    this._selectedCenters = new Map();
    this._objectCenters = new Map();
    this._deselectedObjects = new Map();
  }

  get glScene() {
    return this._glScene;
  }

  get glContext() {
    return this._context;
  }

  get camera() {
    if (this.isMultiSceneUsed) {
      const scene = this._glScene.activeScene;
      if (scene) return scene.userData.camera;
    } else {
      return this._glScene.context.camera;
    }
    return null;
  }

  isActive() {
    return this._active;
  }

  // ----------------------------------
  // activate
  // ----------------------------------
  activate() {
    this._active = true;

    this._topLeft.set(0, 0);
    this._bottomRight.set(0, 0);
    this._glScene.setSelectionBoxState(true);
    this._context.notifyToolActivated(this);
  }

  // ----------------------------------
  // deactivate
  // ----------------------------------
  deactivate() {
    this._active = false;

    // just in case set stop drawing
    this._glScene.drawSelectionBox('over');
    this._glScene.setSelectionBoxState(false);
    this._context.notifyToolDeactivated(this);
  }

  // ----------------------------------
  // dispose
  // ----------------------------------
  dispose() {
    this.deactivate();
  }

  // ----------------------------------
  // _updateSelectionFrustum
  // ----------------------------------
  _updateSelectionFrustum() {
    const camPlanes = this._cameraFrustum.planes;
    const selPlanes = this._selectionFrustum.planes;

    const startPoint = this._startPoint.clone();
    const endPoint = this._endPoint.clone();
    startPoint.unproject(this.camera);
    endPoint.unproject(this.camera);

    if (this._startPoint.x >= this._endPoint.x) {
      selPlanes[1].setFromNormalAndCoplanarPoint(camPlanes[1].normal, endPoint); // left side
      selPlanes[0].setFromNormalAndCoplanarPoint(camPlanes[0].normal, startPoint); // right side
    } else {
      selPlanes[1].setFromNormalAndCoplanarPoint(camPlanes[1].normal, startPoint); // left side
      selPlanes[0].setFromNormalAndCoplanarPoint(camPlanes[0].normal, endPoint); // right side
    }
    if (this._startPoint.y >= this._endPoint.y) {
      selPlanes[3].setFromNormalAndCoplanarPoint(camPlanes[3].normal, startPoint); // top side
      selPlanes[2].setFromNormalAndCoplanarPoint(camPlanes[2].normal, endPoint); // bottom side
    } else {
      selPlanes[3].setFromNormalAndCoplanarPoint(camPlanes[3].normal, endPoint); // top side
      selPlanes[2].setFromNormalAndCoplanarPoint(camPlanes[2].normal, startPoint); // bottom side
    }

    // if (!this.planeHelpersCreated) {
    //   this.planeHelpers = [];
    //   const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0x0f0f0f];
    //   let i = 0;
    //   for (const plane of selPlanes) {
    //     const pHelper = new PlaneHelper(plane, 1, colors[i++]);
    //     this.planeHelpers.push(pHelper);
    //     this._context.sceneHelpers.add(pHelper);
    //   }
    //   this.planeHelpersCreated = true;
    // } else {
    //   for (let i = 0; i < this.planeHelpers.length; i++) {
    //     this.planeHelpers[i].plane.copy(selPlanes[i]);
    //   }
    // }
  }

  // ----------------------------------
  // _updateSelectionList
  // ----------------------------------
  _updateSelectionList(multiSelect) {
    const center = new Vector3();
    const wasSectionApplied = this._glScene.section !== null && this._glScene.glRenderer.clippingPlanes.length > 0;
    const obb = (wasSectionApplied) ? this._glScene.section.obb : null;

    let objects = [];
    if (this.isMultiSceneUsed) {
      const scene = this._glScene.activeScene;
      if (scene) objects = scene.userData.objects;
    } else {
      objects = this._glScene.objects;
    }

    for (const object of objects) {
      let isLayerHandled = false;

      const handleGlObject = (object) => {
        if (object.isLight || !object.visible) return;

        // if the object is a point cloud we need to process it separately
        if (object.isGlPoints || object.isGlBlocks || (object.isGlMesh && object.vertices?.visible)) {
          const selIndices = object.frustumSelect(this._selectionFrustum, obb, multiSelect, this._context.camera.getViewDirection());
          if (selIndices && selIndices.size) {
            this._selectedObjects.set(object.uuid, object);
            this._deselectedObjects.delete(object.uuid);
          } else {
            this._selectedObjects.delete(object.uuid);
            this._deselectedObjects.set(object.uuid, object);
          }

          return;
        }

        // if the object has already been added to the list
        // need to confirm that it's still in selection box or removed
        let objCenter = this._selectedCenters.get(object.uuid);
        if (objCenter !== undefined) {
          if (!this._selectionFrustum.containsPoint(objCenter)) {
            this._selectedObjects.delete(object.uuid);
            this._selectedCenters.delete(object.uuid);
            this._deselectedObjects.set(object.uuid, object);
            // console.log('deleted: ', object.name);
          }
        } else {
          // otherwise need to check if the object inside the box
          objCenter = this._objectCenters.get(object.uuid);
          if (objCenter === undefined && object.getBoundingBox) {
            const objectBB = object.getBoundingBox();
            if (objectBB) {
              objectBB.getCenter(center);
              // center.applyMatrix4(object.matrixWorld);
              objCenter = center.clone();
              this._objectCenters.set(object.uuid, objCenter);
            }
          }

          if (objCenter) {
            if (this._selectionFrustum.containsPoint(objCenter)) {
              // ? should we check all points of object in order to distingush if object inside section or not
              if (obb && !obb.containsPoint(objCenter)) return;
              this._selectedObjects.set(object.uuid, object);
              this._selectedCenters.set(object.uuid, objCenter);
              this._deselectedObjects.delete(object.uuid);
              // console.log('added: ', object.name);
            }
          }
        }
      }

      const handleGlLayer = (object) => {
        isLayerHandled = true;
        if (!object.visible) return;
        const childs = object.children;
        for (let i = 0; i < childs.length; i++) {
          if (childs[i].isChart) {
            handleGlGroup(childs[i])
          } else {
            handleGlObject(childs[i]);
          }
        }
      };

      const handleGlGroup = (group) => {
        isLayerHandled = true;
        if (!group.visible) return;
        const childs = group.children;
        for (let i = 0; i < childs.length; i++) {
          if (childs[i].isGlGroup || childs[i].isChartLayer) {
            handleGlGroup(childs[i]);
          } else if (GlUtils.isGlObjectSet(childs[i])) {
            handleGlLayer(childs[i]);
          } else if (GlUtils.isGlObject(childs[i])) {
            handleGlObject(childs[i]);
          }
        }
      };

      // if plot is exist objects that are in plot can be selected
      // otherwise any object
      const plot = this._context.plot;
      if (plot && plot.selectable) {
        if (object.isGlPlotTemplate) {
          handleGlGroup(object);
        }
      } else {
        if (object.isGlGroup) { //
          handleGlGroup(object);
        } else if (object.isGlLayer) {
          handleGlLayer(object);
        }
      }

      if (isLayerHandled) continue;

      // if the object is a point cloud we need to process it separately
      if (object.isGlPoints) {
        const selIndices = object.frustumSelect(this._selectionFrustum, obb);
        if (selIndices && selIndices.size) {
          this._selectedObjects.set(object.uuid, object);
          this._deselectedObjects.delete(object.uuid);
        } else {
          this._selectedObjects.delete(object.uuid);
          this._deselectedObjects.set(object.uuid, object);
        }

        continue;
      }

      // if the object has already been added to the list
      // need to confirm that it's still in selection box or removed
      let objCenter = this._selectedCenters.get(object.uuid);
      if (objCenter !== undefined) {
        if (!this._selectionFrustum.containsPoint(objCenter)) {
          this._selectedObjects.delete(object.uuid);
          this._selectedCenters.delete(object.uuid);
          this._deselectedObjects.set(object.uuid, object);
          // console.log('deleted: ', object.name);
        }
      } else {
        // otherwise need to check if the object inside the box
        objCenter = this._objectCenters.get(object.uuid);
        if (objCenter === undefined && object.getBoundingBox) {
          const objectBB = object.getBoundingBox();
          if (objectBB) {
            objectBB.getCenter(center);
            // center.applyMatrix4(object.matrixWorld);
            objCenter = center.clone();
            this._objectCenters.set(object.uuid, objCenter);
          }
        }

        if (objCenter) {
          if (this._selectionFrustum.containsPoint(objCenter)) {
            this._selectedObjects.set(object.uuid, object);
            this._selectedCenters.set(object.uuid, objCenter);
            this._deselectedObjects.delete(object.uuid);
            // console.log('added: ', object.name);
          }
        }
      }
    }
  }

  // ----------------------------------
  // get mouse position on screen
  // ----------------------------------
  _getMousePosition(event) {
    const rect = this._glCanvas.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._sceneRect.x = rect.x;
    this._sceneRect.y = rect.y;
  }

  // ----------------------------------
  // onMouseDown event handler
  // ----------------------------------
  onMouseDown(event) {
    event.preventDefault();

    this._isStarted = false;
    if (event.which === 1 && !event.shiftKey) {
      this._getMousePosition(event);

      this._isStarted = true;
      this._glScene.setSceneRotation(false);

      // prepare points to draw selection box
      this._topLeft.set(event.x, event.y);
      this._bottomRight.set(event.x, event.y);

      this._glScene.setSelectionBoxState(true);
      this._glScene.drawSelectionBox('start');

      // get the mouse position in world space
      this._zAspect = (this.camera.near + this.camera.far) / (this.camera.near - this.camera.far);
      this._startPoint.set(this._mouse.x, this._mouse.y, this._zAspect);

      // prepare selection box frustum
      const screenProjectionMatrix = new Matrix4();
      screenProjectionMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      this._cameraFrustum.setFromProjectionMatrix(screenProjectionMatrix);
      this._selectionFrustum.copy(this._cameraFrustum);

      // clear maps containing selected objects info
      this._selectedObjects.clear();
      this._selectedCenters.clear();
      this._objectCenters.clear();
      this._deselectedObjects.clear();

      this.dispatchEvent({ type: GlEvents.selectionStart, detail: event });
      this._context.notifySceneGraphChanged();
    }
  }

  // ----------------------------------
  // onMouseMove event handler
  // ----------------------------------
  onMouseMove(event) {
    event.preventDefault();
    if (this._isStarted) {
      this._getMousePosition(event);
      this._bottomRight.set(event.x, event.y);
      this._glScene.drawSelectionBox('move');

      this._endPoint.set(this._mouse.x, this._mouse.y, this._zAspect);
    }
  }

  // ----------------------------------
  // onMouseCancel event handler
  // ----------------------------------
  onMouseUp(event) {
    event.preventDefault();
    if (this._isStarted) {
      this._isStarted = false;

      this._getMousePosition(event);
      this._bottomRight.set(event.x, event.y);
      this._glScene.drawSelectionBox('move');

      this._endPoint.set(this._mouse.x, this._mouse.y, this._zAspect);

      if (this._startPoint.distanceTo(this._endPoint) >= 0.05) {
        // update selection list
        this._updateSelectionFrustum();
        this._updateSelectionList(event.ctrlKey ? (event.altKey ? -1 : 1) : 0 );
      }

      this._glScene.drawSelectionBox('over');
      this._glScene.setSelectionBoxState(false);

      this.dispatchEvent({ type: GlEvents.selectionEnd, detail: event, selected: this._selectedObjects, deselected: this._deselectedObjects });
      this._context.notifySceneGraphChanged();
      this._glScene.setSceneRotation(true);
    }
  }

  // ----------------------------------
  // onTouchStart event handler
  // ----------------------------------
  onTouchStart(event) {
    event.preventDefault();
    if (event.touches.length > 1) return;

    this._timeElapsed = event.timeStamp;
    const changedTouch = event.changedTouches[0];

    this._getMousePosition(changedTouch);

    this._isStarted = true;
    this._glScene.setSceneRotation(false);

    // prepare points to draw selection box
    this._topLeft.set(changedTouch.clientX, changedTouch.clientY);
    this._bottomRight.set(changedTouch.clientX, changedTouch.clientY);

    this._glScene.setSelectionBoxState(true);
    this._glScene.drawSelectionBox('start');

    // get the mouse position in world space
    this._zAspect = (this.camera.near + this.camera.far) / (this.camera.near - this.camera.far);
    this._startPoint.set(this._mouse.x, this._mouse.y, this._zAspect);

    // prepare selection box frustum
    const screenProjectionMatrix = new Matrix4();
    screenProjectionMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this._cameraFrustum.setFromProjectionMatrix(screenProjectionMatrix);
    this._selectionFrustum.copy(this._cameraFrustum);

    // clear maps containing selected objects info
    this._selectedObjects.clear();
    this._selectedCenters.clear();
    this._objectCenters.clear();
    this._deselectedObjects.clear();

    this.dispatchEvent({ type: GlEvents.selectionStart, detail: changedTouch });
    this._context.notifySceneGraphChanged();

  }

  // ----------------------------------
  // onTouchMove event handler
  // ----------------------------------
  onTouchMove(event) {
    if (this._isStarted) {
      this._getMousePosition(event);
      this._bottomRight.set(event.clientX, event.clientY);
      this._glScene.drawSelectionBox('move');

      this._endPoint.set(this._mouse.x, this._mouse.y, this._zAspect);
    }
  }

  // ----------------------------------
  // onTouchEnd event handler
  // ----------------------------------
  onTouchEnd(event) {
    event.preventDefault();
    this._timeElapsed = event.timeStamp - this._timeElapsed;
    const changedTouch = event.changedTouches[0];

    if (this._isStarted) {
      this._isStarted = false;

      this._getMousePosition(changedTouch);
      this._bottomRight.set(changedTouch.clientX, changedTouch.clientY);
      this._glScene.drawSelectionBox('move');

      this._endPoint.set(this._mouse.x, this._mouse.y, this._zAspect);

      // update selection list
      this._updateSelectionFrustum();
      this._updateSelectionList();

      this._glScene.drawSelectionBox('over');
      this._glScene.setSelectionBoxState(false);

      this.dispatchEvent({ type: GlEvents.selectionEnd, detail: changedTouch, selected: this._selectedObjects, deselected: this._deselectedObjects });
      this._context.notifySceneGraphChanged();
      this._glScene.setSceneRotation(true);
    }
  }
}

