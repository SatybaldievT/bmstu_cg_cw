/* eslint-disable no-undef */
import { GlLineHelper } from '../tools/gl-line-helper';
import { GlPlaneHelper } from './gl-plane-helper';
import { GlPolyline } from './gl-polyline';
import { GlSnapMode, GlClickMode, GlDynamicInput, GlObjectFactoryType, Tool_Priority, Tool_Types } from './gl-constants';
import { GlEvents } from './gl-events';
import { GlObjectFactory } from '../objects/gl-object-factory';
import { GlMultiScene } from '@tangens/gl-components/controls/gl-multi-scene';
import {
  Vector2,
  Vector3,
  Ray,
  EventDispatcher,
  Plane,
  Raycaster,
  Quaternion,
  EllipseCurve,
  Path,
  LineBasicMaterial,
  Line,
} from 'three';
import { GlRaycaster } from './gl-raycaster';

// module closure variables
const __mouseNorm = new Vector2();
const __mouseEvent = new Vector2();
const __sceneRect = new Vector2();
const __rightDir = new Vector3();
const __pt1 = new Vector3();
const __pt2 = new Vector3();
const __ray = new Ray();

export class GlWorkingPlane extends EventDispatcher {
  constructor(glScene) {
    super();

    this._glScene = glScene;
    this._context = glScene.context;
    this.isMultiSceneUsed = glScene instanceof GlMultiScene;

    if (this.isMultiSceneUsed) {
      this._domElement = glScene.glCanvas;
      this._glCanvas = glScene.glCanvas;
    } else {
      // this._camera = glScene.context.camera;
      this._domElement = glScene.glWindow;

      // get the WebGlRenderer's canvas
      for (const child of this._domElement.children) {
        if (child.localName === 'canvas') {
          this._glCanvas = child;
          break;
        }
      }
    }

    this.type = Tool_Types.GlWorkingPlane;
    this.isGlWorkingPlane = true;

    // indicates is the tool active
    this._active = false;

    // working plane
    this._workPlaneAttached = false;
    this._workPlanePinned = false;
    this._workPlane = new Plane();
    this._workPlaneHelper = new GlPlaneHelper(this._workPlane, 1, 0xACBFFF);

    this._workPlanePreferred = false;

    // create a normal helper
    const objectFact = new GlObjectFactory({ geometryType: GlObjectFactoryType.Arrow });
    this._workPlaneHelper.arrow = objectFact.getObject({
      direction: new Vector3(0,0,-1),
      length: 0.3,
      hex: 0xFF0000,
      perpToDir: new Vector3(0,1,0),
      doubleArrow: false
    });
    this._workPlaneHelper.add(this._workPlaneHelper.arrow);

    this._planeHelperSize = 0;

    // current actions
    this._canMove = false;

    // dynamic input mode events
    this._dynInputEvent = 'none';
    this._dynMode = GlDynamicInput.None;

    // members related to raycasting
    this._raycaster = new GlRaycaster();
    this._plane = new Plane();
    this._mouse = new Vector2();
    this._intersection = new Vector3();

    // other members
    this._lastIndex = -1;
    this._polyline = new GlPolyline();
    this._lineHelper = new GlLineHelper(this._polyline.material);

    this._isTouchScreen = false;
    this._isStarted = false;
    this._timeElapsed = 0;
    this._hovered = null;
  }

  get glScene() {
    return this._glScene;
  }

  get glContext() {
    return this._context;
  }

  get camera() {
    if (this.isMultiSceneUsed) {
      return this._glScene.activeScene.userData.camera;
    } else {
      return this._glScene.context.camera;
    }
  }

  isActive() {
    return this._active;
  }

  isInAction() {}

  // ----------------------------------
  // activate
  // ----------------------------------
  activate() {

    // initialize status bar
    this._glScene.showStatusBar(true);
    this._glScene.mouseCoord.fill(0);
    this._glScene.lineLength = 0;
    this._glScene.segmentLength = 0;
    this._glScene.updateStatusBar();

    // prepare local working plane
    const normal = this.camera.getViewDirection();
    normal.negate();
    this._plane.setFromNormalAndCoplanarPoint(normal, this.camera.focalPoint);
    this._workPlaneHelper.arrow.scale.z = 1;

    // add line draw helpers
    if (this.isMultiSceneUsed) {

    } else {
      this._context.sceneHelpers.add(this._polyline);
      this._context.sceneHelpers.add(this._lineHelper);
    }

    this._domElement.style.cursor = 'crosshair';
    this._active = true;
    this._context.notifyToolActivated(this);
  }

  // ----------------------------------
  // deactivate
  // ----------------------------------
  deactivate() {
    this.onKeyUp({ key: 'Esc' });

    // hide dynamic mode inputs
    if (this._dynMode !== GlDynamicInput.None && this._dynInputEvent !== 'over') {
      this._dynInputEvent = 'over';
      this._updateStatusBar();
    }

    // hide status bar
    this._glScene.showStatusBar(false);

    // destruct draw helpers
    this._polyline.deleteAllPoints();
    this._lineHelper.deleteAllPoints();
    this._polyline.dispose();
    this._lineHelper.dispose();
    this._context.sceneHelpers.remove(this._polyline);
    this._context.sceneHelpers.remove(this._lineHelper);

    this._domElement.style.cursor = 'auto';
    this._active = false;
    this._context.notifyToolDeactivated(this);
  }

  // ----------------------------------
  // dispose
  // ----------------------------------
  dispose() {
    this.deactivate();
    this._workPlaneHelper.arrow.dispose();
    this._workPlaneHelper.dispose();
  }

  // -----------------------------------------
  // get the working plane / transform matrix
  // -----------------------------------------
  getPlane(pointOnPlane) {
    if (this._workPlanePinned) {
      return this._workPlane;
    }
    if (!this._workPlanePreferred && this._workPlaneAttached) {
      return this._workPlane;
    }

    const camera = this.camera;
    const normal = camera.getViewDirection().clone();
    normal.negate();
    this._workPlane.setFromNormalAndCoplanarPoint(normal, pointOnPlane ?? camera.focalPoint);
    this._workPlaneHelper.arrow.scale.z = 1;
    const upDir = camera.up.clone();
    const dot = normal.dot(upDir);
    if (1 - Math.abs(dot) < 1.e-2) {
      upDir.set(0, 1, 0);
    }

    if (this._workPlaneHelper.visible) {
      this._workPlaneHelper.rotate(normal, upDir);
      this._workPlaneHelper.position.copy(pointOnPlane ?? camera.focalPoint);
      const size = this._planeHelperSize > 1 ? this._planeHelperSize : this._context.fovSize / 2;
      this._workPlaneHelper.setSize(size, size);
    }
    if (this._workPlane.upDir) this._workPlane.upDir.copy(upDir);
    else this._workPlane.upDir = upDir;
    
    return this._workPlane;
  }

  // --------------------------------------------
  // attach/detach a plane to/from working plane
  // --------------------------------------------
  attachPlaneFromPlane(plane, position, size) {
    if (!this._workPlanePinned) {
      this.setPlaneFromPlane(plane, position, size);
      this._workPlaneAttached = true;
    }
  }

  // --------------------------------------------
  // attach/detach a plane to/from working plane
  // --------------------------------------------
  attachPlaneFromPolyline(polyline) {
    if (!this._workPlanePinned) {
      this.setPlaneFromPolyline(polyline);
      this._workPlaneAttached = true;
    }
  }

  detachPlane() {
    this._workPlaneAttached = false;
  }

  isPlaneAttached() {
    return this._workPlaneAttached;
  }

  // -----------------------------
  // set the working plane from
  // a plane
  // -----------------------------
  setPlaneFromPlane(plane, position, size) {
    if (plane && plane.isPlane) {
      this._workPlane.copy(plane);
      this._workPlaneHelper.arrow.scale.z = 1;
      this._workPlane.upDir = new Vector3(0,0,1);
      if (plane.upDir && plane.upDir.isVector3) this._workPlane.upDir.copy(plane.upDir);

      const dot = plane.normal.dot(this._workPlane.upDir);
      if (1 - Math.abs(dot) < 1.e-2) {
        this._workPlane.upDir.set(0, 1, 0);
      }

      if (!size || (size && size < 1)) {
        size = this._planeHelperSize > 1 ? this._planeHelperSize : this._context.fovSize / 2;
      }
      this._workPlaneHelper.setSize(size, size);
      if (position && position.isVector3) {
        this._workPlaneHelper.position.copy(position);
      }
      this._workPlaneHelper.rotate(plane.normal, this._workPlane.upDir);
    }
  }

  // -------------------------------
  // set the working plane from
  // a polyline and make it pinned
  // -------------------------------
  setPlaneFromPolyline(polyline) {
    if (polyline && polyline.isGlPolyline) {
      const ptCount = polyline.getPointsCount();
      const points = polyline.getPoints(0, ptCount > 0 ? ptCount - 1 : 0, true);
      if (points.length > 6) {
        this._polyline.deleteAllPoints();
        this._polyline.addPoints(points);
        this._polyline.position.copy(polyline.position);
        this._setPlane();
      }
    }
  }

  pinPlane(flag, notify = false) {
    this._workPlanePinned = flag ? true : false;
    if (notify) {
      this.dispatchEvent({ type: GlEvents.pinWorkingPlane, detail: {action: flag}, object: null });
    }
  }

  isPlanePinned() {
    return this._workPlanePinned;
  }

  setPlanePreference(flag) {
    this._workPlanePreferred = flag;
  }

  isPlanePreferred() {
    return this._workPlanePreferred;
  }

  // -------------------------------
  // show/hide the working plane
  // -------------------------------
  showPlane(flag, notify = false) {
    if (flag) {
      if (!this._workPlanePinned && !this._workPlaneAttached) {
        const camera = this.camera;
        const normal = camera.getViewDirection();
        normal.negate();
        this._workPlane.setFromNormalAndCoplanarPoint(normal, camera.focalPoint);
        this._workPlaneHelper.arrow.scale.z = 1;
        const upDir = camera.up.clone();
        const dot = normal.dot(upDir);
        if (1 - Math.abs(dot) < 1.e-2) {
          upDir.set(0, 1, 0);
        }

        this._workPlaneHelper.rotate(normal, upDir);

        this._workPlaneHelper.position.copy(camera.focalPoint);
      }
      const size = this._planeHelperSize > 1 ? this._planeHelperSize : this._context.fovSize / 2;
      this._workPlaneHelper.setSize(size, size);
      this._workPlaneHelper.visible = true;
    } else {
      this._workPlaneHelper.visible = false;
    }
    if (notify) {
        this.dispatchEvent({ type: GlEvents.showWorkingPlane, detail: {action: flag}, object: null });
    }
  }

  isPlaneShown() {
    return this._workPlaneHelper.visible;
  }

  setPlaneSize(size) {
    if (size) {
      const newSize = parseInt(size);
      if (!isNaN(newSize)) this._planeHelperSize = newSize;
    }
  }

  getPlaneSize() {
    return this._planeHelperSize;
  }

  getPlanePosition() {
    return this._workPlaneHelper.position.clone();
  }

  // ----------------------------------
  // set working plane from polyline
  // ----------------------------------
  _setPlane() {
    const camera = this.camera;
    const upDir = new Vector3(0,0,1);  //camera.up.clone();
    const ptCount = this._polyline.getPointsCount();
    if (ptCount > 1) {
      if (ptCount === 2) {
        const pt1 = this._polyline.getPointAt(0);
        const pt2 = this._polyline.getPointAt(1);
        const pt3 = pt1.clone();
        pt3.add(pt2);
        pt3.divideScalar(2);

        const len = this._polyline.getLength();
        const normal = this.camera.getViewDirection();
        upDir.copy(normal).negate();
        normal.multiplyScalar(len);
        pt3.add(normal);
        this._polyline.addPoint(pt3);
      }

      this._polyline.close();
      const polyPlane = this._polyline.getPlane();
      this._workPlane.setFromNormalAndCoplanarPoint(polyPlane.normal, polyPlane.centroid);
      this._workPlaneHelper.arrow.scale.z = 1;
      const dot = polyPlane.normal.dot(upDir);
      if (1 - Math.abs(dot) < 1.e-2) {
        upDir.set(0, 1, 0);
      }
      this._workPlane.upDir = upDir;

      this.pinPlane(true, true);

      this._workPlaneHelper.rotate(polyPlane.normal, upDir);
      this._workPlaneHelper.position.copy(polyPlane.centroid);
      const bb = this._polyline.getBoundingBox();
      if (bb) {
        const sizePoint = new Vector3();
        bb.getSize(sizePoint);
        this._planeHelperSize = sizePoint.length();
      }
      const size = this._planeHelperSize > 1 ? this._planeHelperSize : this._context.fovSize / 2;
      this._workPlaneHelper.setSize(size, size);

      this._glScene.renderHelperScene();
    }
  }

  invertPlane() {
    this._workPlane.negate();
    this._workPlaneHelper.arrow.scale.z *= -1;
    this._glScene.renderHelperScene();
  }

  // ----------------------------------
  // get coords from dynamic input
  // ----------------------------------
  _getCoordsFromDynamicInput(event) {
    const glScene = this._glScene;
    const ptNew = new Vector3();
    const dynMode = glScene.dynamicInputMode;
    const inputSlots = event.target.parentElement.children;
    const first = parseFloat(inputSlots[1].value);
    const second = parseFloat(inputSlots[2].value);
    const third = parseFloat(inputSlots[3].value);

    if (this._dynInputEvent === 'draw' && (dynMode & GlDynamicInput.PolarAbs || dynMode & GlDynamicInput.PolarRel)) {
      const snapModeActive = glScene.snapMode !== GlSnapMode.None && glScene.markPoint && glScene.markPoint.visible;
      const linePtCount = this._lineHelper.getPointsCount();
      if (snapModeActive && linePtCount > 1) {
        const pt1 = this._lineHelper.getPointAt(0);
        const pt2 = this._lineHelper.getPointAt(1);
        __rightDir.subVectors(pt2, pt1);
        __rightDir.normalize().multiplyScalar(first);
        const ptLast = this._polyline.getPointAt(this._polyline.getPointsCount() - 1);
        ptNew.addVectors(ptLast, __rightDir);

      } else {
        const viewDir = this.camera.getViewDirection();
        // this._plane = this._getWorkingPlane();

        // prepare rotation
        const angle = second * Math.PI / 180.0;
        const rotation = new Quaternion();
        rotation.setFromAxisAngle(viewDir, -angle);

        // prepare right direction vector
        __rightDir.set(1, 0, 0);
        __rightDir.transformDirection(this.camera.matrixWorld);
        __rightDir.applyQuaternion(rotation);
        __rightDir.multiplyScalar(first);

        // get the new point on a view plane
        const ptLast = this._polyline.getPointAt(this._polyline.getPointsCount() - 1);
        const ptOrigin = ptLast.clone().add(__rightDir);
        __pt1.copy(viewDir).multiplyScalar(this.camera.far - this.camera.near);
        __pt1.negate();
        ptOrigin.add(__pt1);
        __ray.set(ptOrigin, viewDir);
        __ray.intersectPlane(this._plane, __pt2);

        // adjust right direction vector
        __rightDir.subVectors(__pt2, ptLast);
        __rightDir.normalize().multiplyScalar(first);

        ptNew.addVectors(ptLast, __rightDir);
      }
    } else {
      ptNew.set(first, second, third);
    }

    return ptNew;
  }

  // ----------------------------------
  // handle dynamic input mode
  // ----------------------------------
  _handleDynamicInput(worldCoord) {
    const dynMode = this._glScene.dynamicInputMode;
    let event = this._dynInputEvent;
    if (event === "none") {
      return;
    } else if (dynMode === GlDynamicInput.None) {
      if (this._dynMode === GlDynamicInput.None) return;
      else {
        this._dynMode = GlDynamicInput.None;
        event = 'over';
      }
    } else {
      this._dynMode = dynMode;
    }

    const dynInput = this._glScene.dynamicInput;
    dynInput.mouse.copy(__mouseEvent);
    dynInput.sceneRect.copy(__sceneRect);
    dynInput.first = worldCoord.x;
    dynInput.second = worldCoord.y;
    dynInput.third = worldCoord.z;

    if (event === 'draw' && (dynMode & GlDynamicInput.PolarAbs || dynMode & GlDynamicInput.PolarRel)) {
      event = 'drawPolar';
      dynInput.first = this._glScene.segmentLength;
      dynInput.second = this._glScene.segmentAngle;
      dynInput.third = 0.0;
    }

    this._glScene.drawDynamicInput(event);
  }

  // ----------------------------------
  // update scene's status bar
  // ----------------------------------
  _updateStatusBar() {
    const polyPtCount = this._polyline.getPointsCount();
    const linePtCount = this._lineHelper.getPointsCount();

    let angle = 0;
    let polyLen = this._polyline.getLength();
    let lineLen = this._lineHelper.getLength();

    const point = linePtCount > 1 ? this._lineHelper.getPointAt(1) : this._intersection.clone();

    if (linePtCount === 0) {
      if (polyPtCount > 1) {
        const pt = this._polyline.getPointAt(polyPtCount - 1);
        point.copy(pt);
        pt.sub(this._polyline.getPointAt(polyPtCount - 2));
        lineLen = pt.length();
      }
    } else if (linePtCount > 1) {
      const dynMode = this._glScene.dynamicInputMode;
      if (dynMode & GlDynamicInput.PolarAbs || dynMode & GlDynamicInput.PolarRel) {
        angle = this._lineHelper.getPolarAngle(0, this.camera);
      }
      polyLen += lineLen;
    }

    // round the values up to 3 decimal digits
    point.x = Math.round((point.x + Number.EPSILON) * 1000) / 1000;
    point.y = Math.round((point.y + Number.EPSILON) * 1000) / 1000;
    point.z = Math.round((point.z + Number.EPSILON) * 1000) / 1000;
    polyLen = Math.round((polyLen + Number.EPSILON) * 1000) / 1000;
    lineLen = Math.round((lineLen + Number.EPSILON) * 1000) / 1000;
    angle = Math.round((angle + Number.EPSILON) * 1000) / 1000;

    this._glScene.mouseCoord[0] = point.x;
    this._glScene.mouseCoord[1] = point.y;
    this._glScene.mouseCoord[2] = point.z;
    this._glScene.lineLength = polyLen;
    this._glScene.segmentLength = lineLen;
    this._glScene.segmentAngle = angle;

    this._handleDynamicInput(point);

    this._glScene.updateStatusBar();
  }

  // ----------------------------------
  // get mouse position on screen
  // ----------------------------------
  _getMousePosition(event) {
    const rect = this._glCanvas.getBoundingClientRect();
    __mouseNorm.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    __mouseNorm.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;
    __mouseEvent.x = event.x;
    __mouseEvent.y = event.y;
    __sceneRect.x = rect.x;
    __sceneRect.y = rect.y;
  }

  // ----------------------------------
  // onMouseMove event handler
  // ----------------------------------
  onMouseMove(event) {
    event.preventDefault();

    let success = false;
    let needRender = true;
    const glScene = this._glScene;

    this._getMousePosition(event);

    if (glScene.snapMode !== GlSnapMode.None &&
      glScene.markPoint && glScene.markPoint.visible) {
      const pos = glScene.markPoint.position;
      if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
        this._intersection.copy(pos);
        success = true;
        needRender = false;
      }
    }
    if (!success) {
      this._raycaster.setFromCamera(__mouseNorm, this.camera);
      this._raycaster.near = this.camera.near;
      this._raycaster.far = this.camera.far;
      success = this._raycaster.ray.intersectPlane(this._plane, this._intersection) !== null;
    }
    if (success) {
      if (this._isStarted) {
        this._dynInputEvent = this._canMove ? 'none' : 'draw';
        this._lineHelper.setPoint(1, this._intersection);
      }
      if (!this._canMove) {
        this._domElement.style.cursor = 'crosshair';
        if (!this._isStarted) this._dynInputEvent = 'start';
      }
      this._updateStatusBar();

      if (needRender) glScene.renderHelperScene();
    }
  }

  // ----------------------------------
  // onMouseDown event handler
  // ----------------------------------
  onMouseDown(event) {
    event.preventDefault();
    // if (this._isTouchScreen) return;

    let success = false;
    const glScene = this._glScene;
    if (glScene.snapMode !== GlSnapMode.None &&
      glScene.markPoint && glScene.markPoint.visible) {
      const pos = glScene.markPoint.position;
      if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
        this._intersection.copy(glScene.markPoint.position);
        success = true;
      }
    }
    if (!success) {
      this._raycaster.setFromCamera(__mouseNorm, this.camera);
      this._raycaster.near = this.camera.near;
      this._raycaster.far = this.camera.far;
      success = this._raycaster.ray.intersectPlane(this._plane, this._intersection) !== null;
    }
    if (success && event.which !== 2) {
      if (!this._isStarted) {
        this._isStarted = true;
        // this._domElement.style.cursor = 'crosshair';

        // delete all points in polyline and lineHelper
        this._polyline.deleteAllPoints();
        if (this._lineHelper.getPointsCount() > 0) this._lineHelper.deleteAllPoints();

        // set the intersection point as a position
        this._polyline.position.copy(this._intersection);
        this._polyline.addPoint(this._intersection);
        this._polyline.showPoints(true);

        this._lineHelper.addPoints([this._intersection, this._intersection]);
        this._updateStatusBar();

        this.dispatchEvent({ type: GlEvents.actionStart, detail: event, object: this._polyline });
      } else {
        this._lineHelper.setPoint(1, this._intersection);
        // if mouse right button was clicked
        if (event.which === 3) {
          this._lineHelper.deleteAllPoints();
          this._updateStatusBar();
        } else {
          this._updateStatusBar();
          this._polyline.addPoint(this._intersection);
          this._lineHelper.setPoints(0, [this._intersection, this._intersection]);
        }
      }

      this._lastIndex = this._polyline.getPointsCount() - 1;
      glScene.renderHelperScene();
    }
  }

  // ----------------------------------
  // onMouseCancel event handler
  // ----------------------------------
  onMouseUp(event) {
    event.preventDefault();
    // if (this._isTouchScreen) return;

    if (this._isStarted && event.which !== 2) {
      // if mouse right button was clicked
      if (event.which === 3) {

        this._isStarted = false;
        this._setPlane();
        this.dispatchEvent({ type: GlEvents.actionEnd, detail: event, object: this._polyline });
      }
    }
  }

  // ----------------------------------
  // onKeyUp event handler
  // ----------------------------------
  onKeyUp(event) {
    let handleDynInput = false;
    const isEscPressed = event.key === "Escape" || event.key === "Esc";
    const isCPressed = event.key === "c" && event.keyCode === 67;

    if (event.preventDefault) {
      event.preventDefault();
      handleDynInput = !isEscPressed && !isCPressed && event.target.parentElement.id === 'dynamicInput';
    }

    if (handleDynInput) {
      if (!this._isStarted) {
        this._isStarted = true;
        const ptNew = this._getCoordsFromDynamicInput(event);
        const ptTemp = this._intersection.clone();
        this._dynInputEvent = 'draw';

        // delete all points in polyline and lineHelper
        this._polyline.deleteAllPoints();
        if (this._lineHelper.getPointsCount() > 0) this._lineHelper.deleteAllPoints();

        // set the intersection point as a position
        this._polyline.position.copy(ptNew);
        this._polyline.addPoint(ptNew);
        this._polyline.showPoints(true);
        this._intersection.copy(ptTemp);

        this._lineHelper.addPoints([ptNew, this._intersection]);
        this._updateStatusBar();

        this.dispatchEvent({ type: GlEvents.actionStart, detail: event, object: this._polyline });
        this._context.notifySceneGraphChanged();
      } else {
        this._lineHelper.setPoint(1, this._intersection);
        const ptNew = this._getCoordsFromDynamicInput(event);
        const ptTemp = this._intersection.clone();

        // if mouse right button was clicked
        if (event.which === 3) {
          this._lineHelper.deleteAllPoints();
          this._updateStatusBar();
        } else {
          this._updateStatusBar();
          this._polyline.addPoint(ptNew);
          this._intersection.copy(ptTemp);
          this._lineHelper.setPoints(0, [ptNew, this._intersection]);
          this._context.notifySceneGraphChanged();
        }
      }
    } else if (this._isStarted && (isEscPressed || isCPressed)) {
      this._isStarted = false;
      this._lineHelper.deleteAllPoints();
      this._setPlane();
      this.dispatchEvent({ type: GlEvents.actionEnd, detail: event, object: this._polyline });
      this._domElement.style.cursor = 'auto';
      this._context.notifySceneGraphChanged();
    }
  }

  // ----------------------------------
  // onTouchStart event handler
  // ----------------------------------
  onTouchStart(event) {
    event.preventDefault();
    if (event.touches.length > 1) return;

    this._isTouchScreen = true;
    this._timeElapsed = event.timeStamp;
    event = event.changedTouches[0];

    const rect = this._glCanvas.getBoundingClientRect();

    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);
    this._raycaster.near = this.camera.near;
    this._raycaster.far = this.camera.far;
    const success = this._raycaster.ray.intersectPlane(this._plane, this._intersection) !== null;

    if (success) {
      if (!this._isStarted) {
        this._isStarted = true;

        // delete all points in polyline and lineHelper
        this._polyline.deleteAllPoints();
        if (this._lineHelper.getPointsCount() > 0) this._lineHelper.deleteAllPoints();

        // set the intersection point as a position
        this._polyline.position.copy(this._intersection);
        this._polyline.addPoint(this._intersection);
        this._polyline.showPoints(true);

        this._lineHelper.addPoints([this._intersection, this._intersection]);
        this._updateStatusBar();

        this.dispatchEvent({ type: GlEvents.actionStart, detail: event, object: this._polyline });
      } else {
        this._lineHelper.setPoint(1, this._intersection);
        this._updateStatusBar();
        this._polyline.addPoint(this._intersection);
        this._lineHelper.setPoints(0, [this._intersection, this._intersection]);
      }

      this._lastIndex = this._polyline.getPointsCount() - 1;
      this._glScene.renderHelperScene();
    }
  }

  // ----------------------------------
  // onTouchMove event handler
  // ----------------------------------
  onTouchMove(event) {
    event.preventDefault();
    if (event.touches.length > 1) return;

    event = event.changedTouches[0];

    let success = false;
    let needRender = true;
    const glScene = this._glScene;
    if (glScene.snapMode !== GlSnapMode.None &&
      glScene.markPoint && glScene.markPoint.visible) {
      const pos = glScene.markPoint.position;
      if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
        this._intersection.copy(pos);
        success = true;
        needRender = false;
      }
    }
    if (!success) {
      const rect = this._glCanvas.getBoundingClientRect();

      this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this._mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

      this._raycaster.setFromCamera(this._mouse, this.camera);
      this._raycaster.near = this.camera.near;
      this._raycaster.far = this.camera.far;
      success = this._raycaster.ray.intersectPlane(this._plane, this._intersection) !== null;
    }
    if (success) {
      if (this._isStarted) this._lineHelper.setPoint(1, this._intersection);
      this._updateStatusBar();
      if (needRender) glScene.renderHelperScene();
    }
  }

  // ----------------------------------
  // onTouchEnd event handler
  // ----------------------------------
  onTouchEnd(event) {
    event.preventDefault();
    this._timeElapsed = event.timeStamp - this._timeElapsed;

    if (this._isStarted) {
      if (this._timeElapsed > 1000) {
        this._lineHelper.deleteAllPoints();
        if (this._lastIndex >= 0) this._polyline.deletePoint(this._lastIndex);
        this._updateStatusBar();

        this._isStarted = false;
        this._setPlane();
        this.dispatchEvent({ type: GlEvents.actionEnd, detail: event, object: this._polyline });
      }
    }
  }
}