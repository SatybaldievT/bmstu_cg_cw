import {
  Vector3,
  Quaternion,
  Matrix4,
  Euler,
  Object3D,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  DoubleSide,
  LineBasicMaterial,
  CylinderGeometry,
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  OctahedronGeometry,
  TorusGeometry,
  SphereGeometry,
  Color,
} from 'three';

import {GlRaycaster} from './gl-raycaster';

const _parentPosition = new Vector3();
const _cameraPosition = new Vector3();
const _parentQuaternion = new Quaternion();
const _cameraQuaternion = new Quaternion();
const _cameraScale = new Vector3();
const _worldScale = new Vector3();
const _offset = new Vector3();
const _mW = new Matrix4();
const _unitX = new Vector3(1, 0, 0);
const _unitY = new Vector3(0, 1, 0); 
const _unitZ = new Vector3(0, 0, 1);
const _unit = {
  X: _unitX,
  Y: _unitY,
  Z: _unitZ
};
const unitX = new Vector3(1, 0, 0);
const unitY = new Vector3(0, 1, 0);
const unitZ = new Vector3(0, 0, 1);
const _identityQuaternion = new Quaternion();

const _raycaster = new GlRaycaster();
const _tempVector = new Vector3();
const _tempVector2 = new Vector3();
const _tempQuaternion = new Quaternion();
const _tempQuaternion2 = new Quaternion();
const _tempEuler = new Euler();

const _rotationAxis = new Vector3();
const _startNorm = new Vector3();
const _endNorm = new Vector3();
const _pStartEndOffset = new Vector3();

const _dirVector = new Vector3(0, 0, 0);
const _alignVector = new Vector3(0, 1, 0);
const _zeroVector = new Vector3(0, 0, 0);
const _lookAtMatrix = new Matrix4();

export class GlTransformControls extends Object3D {
  constructor(glScene, domElement) {
    super();

    this._glScene = glScene;
    this._context = glScene.context;
    this.domElement = (domElement !== undefined) ? domElement : document;

    this.visible = false;
    this.isGlTransformControls = true;
    this.type = 'GlTransformControls';

    this._gizmo = new GlTransformControlsGizmo();
    this.add(this._gizmo);

    this._plane = new GlTransformControlsPlane();
    this.add(this._plane);

    const scope = this;

    // Define properties with getters/setter
    // Setting the defined property will automatically trigger change event
    // Defined properties are passed down to gizmo and plane
    this.__defineProperty("camera", glScene.context.camera);
    this.__defineProperty("object", undefined);
    this.__defineProperty("enabled", true);
    this.__defineProperty("axis", null);
    this.__defineProperty("mode", "translate");
    this.__defineProperty("translationSnap", null);
    this.__defineProperty("rotationSnap", null);
    this.__defineProperty("scaleSnap", null);
    this.__defineProperty("space", "world");
    this.__defineProperty("size", 0.7);
    this.__defineProperty("dragging", false);
    this.__defineProperty("showX", true);
    this.__defineProperty("showY", true);
    this.__defineProperty("showZ", true);

    this.objectChild = null;
    this.pointStart = new Vector3();
    this.pointEnd = new Vector3();

    this.parentScale = new Vector3();
    this.parentQuaternionInv = new Quaternion();

    this.worldPosition = new Vector3();
    this.worldPositionStart = new Vector3();

    this.worldQuaternion = new Quaternion();
    this.worldQuaternionStart = new Quaternion();
    this.worldQuaternionInv = new Quaternion();

    this.eye = new Vector3();

    this.positionStart = new Vector3();
    this.quaternionStart = new Quaternion();
    this.scaleStart = new Vector3();

    // events
    this.changeEvent = {type: "change"};
    this.mouseDownEvent = {type: "mouseDown"};
    this.mouseUpEvent = {type: "mouseUp", mode: scope.mode};
    this.objectChangeEvent = {type: "objectChange"};
    this.mouseMoveEvent = {type: "mouseMove"};
    this.mouseKeyUpEvent = {type: "keyUp"};

    // define event listeners
    this.pointerHoverListener = (e) => scope.onPointerHover(e);
    this.pointerDownListener = (e) => scope.onPointerDown(e);
    this.pointerMoveListener = (e) => scope.onPointerMove(e);
    this.pointerUpListener = (e) => scope.onPointerUp(e);
    this.copyCreateListener = (e) => scope.onCopyCreate(e);
    this.keyUpListener = (e) => scope.onKeyUpListener(e);
    this.__addEventListeners();
  }

  // -------------------------------------------------
  // Define getter / setter and store for a property
  // -------------------------------------------------
  __defineProperty(propName, defaultValue) {
    const scope = this;
    let propValue = defaultValue;

    Object.defineProperty(scope, propName, {
      get: function() {
        return propValue !== undefined ? propValue : defaultValue;
      },

      set: function(value) {
        if (propValue !== value) {
          propValue = value;
          scope._plane[propName] = value;
          scope._gizmo[propName] = value;

          scope.dispatchEvent({type: propName + "-changed", value: value});
          scope.dispatchEvent(scope.changeEvent);
        }
      }
    });

    this[propName] = defaultValue;
    this._plane[propName] = defaultValue;
    this._gizmo[propName] = defaultValue;
  }

  // --------------------------
  // add event listeners
  // --------------------------
  __addEventListeners() {
    this.domElement.addEventListener("mousedown", this.pointerDownListener, false);
    this.domElement.addEventListener("mouseup", this.pointerUpListener, false);
    this.domElement.addEventListener("touchstart", this.pointerDownListener, false);
    this.domElement.addEventListener("mousemove", this.pointerHoverListener, false);
    this.domElement.addEventListener("touchmove", this.pointerHoverListener, false);
    this.domElement.addEventListener("touchmove", this.pointerMoveListener, false);
    this.domElement.addEventListener("touchend", this.pointerUpListener, false);
    this.domElement.addEventListener("touchcancel", this.pointerUpListener, false);
    this.domElement.addEventListener("copy", this.copyCreateListener, false);
    this.domElement.addEventListener("keyup", this.keyUpListener, false);
  }

  // -----------
  // dispose
  // -----------
  dispose() {
    this.domElement.removeEventListener("mousedown", this.pointerDownListener);
    this.domElement.removeEventListener("touchstart", this.pointerDownListener);
    this.domElement.removeEventListener("mousemove", this.pointerHoverListener);
    this.domElement.removeEventListener("touchmove", this.pointerHoverListener);
    this.domElement.removeEventListener("touchmove", this.pointerMoveListener);
    this.domElement.removeEventListener("mouseup", this.pointerUpListener);
    this.domElement.removeEventListener("touchend", this.pointerUpListener);
    this.domElement.removeEventListener("touchcancel", this.pointerUpListener);
    this.domElement.removeEventListener("copy", this.copyCreateListener, false);
    this.domElement.removeEventListener("keyup", this.keyUpListener, false);
    this.detach();
    this.traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }

  // --------------------
  // Set current object
  // --------------------
  attach(object) {
    this.object = object;

    if (this.object.parent.partOfPlot) {
      this._gizmo.spaceLocal = true;
      this._plane.spaceLocal = true;
    }

    // this.objectSnappable = this.object.snappable;
    // this.object.snappable = false;
    this.visible = true;
    return this;
  }

  // --------------------
  // Detatch from object
  // --------------------
  detach() {
    // if (this.objectSnappable) {
    //   this.object.snappable = this.objectSnappable;
    //   this.objectSnappable = null;
    // }
    this.object = undefined;
    this.objectChild = null;
    this.visible = false;
    this.axis = null;
    this._gizmo.spaceLocal = false;
    this._plane.spaceLocal = false;
    return this;
  }

  // ---------------------------------------------------------
  // updateMatrixWorld  updates key transformation variables
  // ---------------------------------------------------------
  updateMatrixWorld() {
    if (this.object !== undefined) {
      this.object.updateMatrixWorld();
      this.object.parent.matrixWorld.decompose(_parentPosition, _parentQuaternion, this.parentScale);
      this.object.matrixWorld.decompose(this.worldPosition, this.worldQuaternion, _worldScale);
      
      if (this.object.pivotOffset) {
        _offset.copy(this.object.pivotOffset);
        _mW.copy(this.object.matrixWorld);
        _mW.setPosition(0, 0, 0);
        _offset.applyMatrix4(_mW);
        this.worldPosition.add(_offset);
      }

      this.parentQuaternionInv.copy(_parentQuaternion).invert();
      this.worldQuaternionInv.copy(this.worldQuaternion).invert();
    }

    this.camera.updateMatrixWorld();
    this.camera.matrixWorld.decompose(_cameraPosition, _cameraQuaternion, _cameraScale);

    this.eye.copy(_cameraPosition).sub(this.worldPosition).normalize();

    this._gizmo.eye.copy(this.eye);
    this._gizmo.cameraPosition.copy(_cameraPosition);
    this._gizmo.worldPosition.copy(this.worldPosition);
    this._gizmo.worldQuaternion.copy(this.worldQuaternion);

    this._plane.eye.copy(this.eye);
    this._plane.cameraQuaternion.copy(_cameraQuaternion);
    this._plane.worldPosition.copy(this.worldPosition);
    this._plane.worldQuaternion.copy(this.worldQuaternion);

    Object3D.prototype.updateMatrixWorld.call(this);
  }

  // -----------------------
  // Mouse / Touch handlers
  // -----------------------
  pointerHover(pointer) {
    if (this.object === undefined || this.dragging === true ||
       (pointer.button !== undefined && pointer.button !== 0)) {
      return;
    }

    _raycaster.setFromCamera(pointer, this.camera);

    const intersect = _raycaster.intersectObjects(this._gizmo.picker[this.mode].children, true)[0] || false;
    if (intersect) {
      this.axis = intersect.object.name;
      if (!this.showX || !this.showY || !this.showZ) {
        if (this.axis === "Y" && this.showY || this.axis === "X" && this.showX || this.axis === "Z" && this.showZ) {
          this.axis = intersect.object.name;
        } else {
          this.axis = null;
        }
      }
    } else {
      this.axis = null;
    }

    this.changeEvent.mouseEvent = null;
    this.changeEvent.sceneRect = null;
  }

  pointerDown(pointer) {
    if (this.object === undefined || this.dragging === true ||
       (pointer.button !== undefined && pointer.button !== 0)) {
      return;
    }

    if ((pointer.button === 0 || pointer.button === undefined) && this.axis !== null) {
      const worldScaleStart = new Vector3();
      _raycaster.setFromCamera(pointer, this.camera);

      const planeIntersect = _raycaster.intersectObjects([this._plane], true)[0] || false;
      if (planeIntersect) {
        let space = this.space;
        if (this.mode === 'scale' || this.object.parent.partOfPlot) {
          space = 'local';
        } else if (this.axis === 'E' || this.axis === 'XYZE' || this.axis === 'XYZ') {
          space = 'world';
        }

        if (space === 'local' && this.mode === 'rotate') {
          const snap = this.rotationSnap;
          if (this.axis === 'X' && snap) this.object.rotation.x = Math.round(this.object.rotation.x / snap) * snap;
          if (this.axis === 'Y' && snap) this.object.rotation.y = Math.round(this.object.rotation.y / snap) * snap;
          if (this.axis === 'Z' && snap) this.object.rotation.z = Math.round(this.object.rotation.z / snap) * snap;
        }

        this.object.updateMatrixWorld();
        this.object.parent.updateMatrixWorld();

        this.positionStart.copy(this.object.position);
        this.quaternionStart.copy(this.object.quaternion);
        this.scaleStart.copy(this.object.scale);

        this.object.matrixWorld.decompose(this.worldPositionStart, this.worldQuaternionStart, worldScaleStart);
        if (this.object.pivotOffset) {
          _offset.copy(this.object.pivotOffset);
          _mW.copy(this.object.matrixWorld);
          _mW.setPosition(0, 0, 0);
          _offset.applyMatrix4(_mW);
          this.worldPositionStart.add(_offset);
        }

        this.pointStart.copy(planeIntersect.point).sub(this.worldPositionStart);

        this._gizmo.worldPositionStart.copy(this.worldPositionStart);
        this._gizmo.worldQuaternionStart.copy(this.worldQuaternionStart);
      }

      this.dragging = true;
      this.mouseDownEvent.mode = this.mode;
      this.dispatchEvent(this.mouseDownEvent);
    }
  }

  pointerMove(pointer) {
    const axis = this.axis;
    const mode = this.mode;
    const object = this.object;
    let space = this.space;

    if (mode === 'scale' || (object && object.parent.partOfPlot)) space = 'local';
    else if (axis === 'E' || axis === 'XYZE' || axis === 'XYZ') space = 'world';

    if (object === undefined || axis === null || this.dragging === false ||
       (pointer.button !== undefined && pointer.button !== 0)) {
      return;
    }

    _raycaster.setFromCamera(pointer, this.camera);
    
    const planeIntersect = _raycaster.intersectObjects([this._plane], true)[0] || false;
    if (planeIntersect === false) return;

    this.pointEnd.copy(planeIntersect.point).sub(this.worldPositionStart);

    if (mode === 'translate') {
      // Apply translate
      // offset.copy(this.pointEnd).sub(this.pointStart);
      _pStartEndOffset.copy(this.pointEnd).sub(this.pointStart);

      if (space === 'local' && axis !== 'XYZ') {
        // offset.applyQuaternion(this.worldQuaternionInv);
        _pStartEndOffset.applyQuaternion(this.worldQuaternionInv);
      }

      if (axis.indexOf('X') === - 1) _pStartEndOffset.x = 0;
      if (axis.indexOf('Y') === - 1) _pStartEndOffset.y = 0;
      if (axis.indexOf('Z') === - 1) _pStartEndOffset.z = 0;

      if (space === 'local' && axis !== 'XYZ') {
        _pStartEndOffset.applyQuaternion(this.quaternionStart).divide(this.parentScale);
      } else {
        _pStartEndOffset.applyQuaternion(this.parentQuaternionInv).divide(this.parentScale);
      }

      object.position.copy(_pStartEndOffset).add(this.positionStart);

      // Apply translation snap
      if (this.translationSnap) {
        if (space === 'local') {

          object.position.applyQuaternion(_tempQuaternion.copy(this.quaternionStart).invert());

          if (axis.search('X') !== - 1) object.position.x = Math.round(object.position.x / this.translationSnap) * this.translationSnap;
          if (axis.search('Y') !== - 1) object.position.y = Math.round(object.position.y / this.translationSnap) * this.translationSnap;
          if (axis.search('Z') !== - 1) object.position.z = Math.round(object.position.z / this.translationSnap) * this.translationSnap;

          object.position.applyQuaternion(this.quaternionStart);
        }

        if (space === 'world') {

          if (object.parent) object.position.add(_tempVector.setFromMatrixPosition(object.parent.matrixWorld));

          if (axis.search('X') !== - 1) object.position.x = Math.round(object.position.x / this.translationSnap) * this.translationSnap;
          if (axis.search('Y') !== - 1) object.position.y = Math.round(object.position.y / this.translationSnap) * this.translationSnap;
          if (axis.search('Z') !== - 1) object.position.z = Math.round(object.position.z / this.translationSnap) * this.translationSnap;

          if (object.parent) object.position.sub(_tempVector.setFromMatrixPosition(object.parent.matrixWorld));
        }
      }

    } else if (mode === 'scale') {

      if (axis.search('XYZ') !== - 1) {
        let d = this.pointEnd.length() / this.pointStart.length();
        if (this.pointEnd.dot(this.pointStart) < 0) d *= - 1;
        _tempVector2.set(d, d, d);
      } else {
        _tempVector.copy(this.pointStart);
        _tempVector.applyQuaternion(this.worldQuaternionInv);
        _tempVector2.copy(this.pointEnd);
        _tempVector2.applyQuaternion(this.worldQuaternionInv);

        _tempVector2.divide(_tempVector);

        if (axis.search('X') === - 1) _tempVector2.x = 1;
        if (axis.search('Y') === - 1) _tempVector2.y = 1;
        if (axis.search('Z') === - 1) _tempVector2.z = 1;
      }

      // Apply scale
      object.scale.copy(this.scaleStart).multiply(_tempVector2);

      if (this.scaleSnap) {
        if (axis.search('X') !== - 1) object.scale.x = Math.round(object.scale.x / this.scaleSnap) * this.scaleSnap || this.scaleSnap;
        if (axis.search('Y') !== - 1) object.scale.y = Math.round(object.scale.y / this.scaleSnap) * this.scaleSnap || this.scaleSnap;
        if (axis.search('Z') !== - 1) object.scale.z = Math.round(object.scale.z / this.scaleSnap) * this.scaleSnap || this.scaleSnap;
      }
    } else if (mode === 'rotate') {

      let rotationAngle = 0;

      _pStartEndOffset.copy(this.pointEnd).sub(this.pointStart);

      const ROTATION_SPEED = 20 / this.worldPosition.distanceTo(_tempVector.setFromMatrixPosition(this.camera.matrixWorld));

      if (axis === 'E') {
        _rotationAxis.copy(this.eye);
        rotationAngle = this.pointEnd.angleTo(this.pointStart);

        _startNorm.copy(this.pointStart).normalize();
        _endNorm.copy(this.pointEnd).normalize();

        rotationAngle *= (_endNorm.cross(_startNorm).dot(this.eye) < 0 ? 1 : - 1);

      } else if (axis === 'XYZE') {

        _rotationAxis.copy(_pStartEndOffset).cross(this.eye).normalize();
        rotationAngle = _pStartEndOffset.dot(_tempVector.copy(_rotationAxis).cross(this.eye)) * ROTATION_SPEED;

      } else if (axis === 'X' || axis === 'Y' || axis === 'Z') {

        _rotationAxis.copy(_unit[axis]);
        _tempVector.copy(_unit[axis]);

        if (space === 'local') {
          _tempVector.applyQuaternion(this.worldQuaternion);
        }
        rotationAngle = _pStartEndOffset.dot(_tempVector.cross(this.eye).normalize()) * ROTATION_SPEED;
      }

      // Apply rotation snap
      if (this.rotationSnap) rotationAngle = Math.round(rotationAngle / this.rotationSnap) * this.rotationSnap;

      // Apply rotate
      if (space === 'local' && axis !== 'E' && axis !== 'XYZE') {
        object.quaternion.copy(this.quaternionStart);
        object.quaternion.multiply(_tempQuaternion.setFromAxisAngle(_rotationAxis, rotationAngle)).normalize();
      } else {
        _rotationAxis.applyQuaternion(this.parentQuaternionInv);
        object.quaternion.copy(_tempQuaternion.setFromAxisAngle(_rotationAxis, rotationAngle));
        object.quaternion.multiply(this.quaternionStart).normalize();
      }

      object.rotationAngle = rotationAngle;
      this._gizmo.rotationAxis.copy(_rotationAxis);
    }

    this.changeEvent.sceneRect = pointer.rect;

    this.dispatchEvent(this.changeEvent);
    this.dispatchEvent(this.objectChangeEvent);
  }

  pointerUp(pointer) {
    if (pointer.button !== undefined && pointer.button !== 0 && pointer.button !== 2) {
      return;
    }

    if (this.dragging) {
      this.mouseUpEvent.mode = this.mode;
      this.dispatchEvent(this.mouseUpEvent);
    } else if (this.mouseUpEvent.mouseEvent.shiftKey) {
      this.mouseUpEvent.mode = 'shift';
      this.dispatchEvent(this.mouseUpEvent);
    }

    this.dragging = false;
    if (pointer.button === undefined) this.axis = null;
  }

  // ---------------------------------------------------------------
  // normalize mouse / touch pointer and remap {x,y} to view space.
  // ---------------------------------------------------------------
  __getPointer(event) {
    if (document.pointerLockElement) {
      return {x: 0, y: 0, button: event.button};
    } else {
      const pointer = event.changedTouches ? event.changedTouches[0] : event;
      // domElement is div (glWindow) which accepts key events,
      // canvas does not, but to get correct mouse position
      // we need to account canvas posiiton, since canvas can be offset from parent glWindow
      // const rect = this.domElement.getBoundingClientRect();
      const rect = this._glScene.glCanvas.getBoundingClientRect();

      return {
        x: (pointer.clientX - rect.left) / rect.width * 2 - 1,
        y: - (pointer.clientY - rect.top) / rect.height * 2 + 1,
        button: event.button,
        rect
      };
    }
  }

  // -------------------------------
  // mouse / touch event handlers
  // -------------------------------
  onPointerHover(event) {
    if (!this.enabled) return;
    this.pointerHover(this.__getPointer(event));
  }

  onPointerDown(event) {
    event.preventDefault();
    if (!this.enabled) return;
    this.domElement.addEventListener("mousemove", this.pointerMoveListener, false);
    this.pointerHover(this.__getPointer(event));
    this.mouseDownEvent.mouseEvent = event;
    this.pointerDown(this.__getPointer(event));
  }

  onPointerMove(event) {
    event.preventDefault();
    if (!this.enabled) return;
    this.changeEvent.mouseEvent = event;
    this.pointerMove(this.__getPointer(event));
  }

  onPointerUp(event) {
    event.preventDefault();
    if (!this.enabled) return;
    this.domElement.removeEventListener("mousemove", this.pointerMoveListener, false);
    this.mouseUpEvent.mouseEvent = event;
    this.pointerUp(this.__getPointer(event));
  }

  onCopyCreate(event) {
    if (!this.enabled) return;
    const pointer = this.__getPointer(event);

    if (this.object === undefined || this.dragging === true ||
      (pointer.button !== undefined && pointer.button !== 0)) {
      return;
    }

    const handleCopy = (e) => {
      this.pointerUpListener(e);

      this.domElement.removeEventListener("mousedown", handleCopy);
      this.domElement.removeEventListener("touchstart", handleCopy);
      this.domElement.removeEventListener("keydown", handleAxis);
      this._glScene.disableTransformControls();
    };

    const handleAxis = (event) => {
      const keycode = event.keyCode;
      const shift = event.shiftKey;
      switch (keycode) {
        case 88:
          this.axis = "X";
          if (shift) this.axis = "YZ";
          break;
        case 89:
          this.axis = "Y";
          if (shift) this.axis = "XZ";
          break;
        case 90:
          this.axis = "Z";
          if (shift) this.axis = "XY";
          break;
        case 13:
          this.onKeyUpListener(event);
          this.domElement.removeEventListener("mousedown", handleCopy);
          this.domElement.removeEventListener("touchstart", handleCopy);
          this.domElement.removeEventListener("keydown", handleAxis);
          this._glScene.disableTransformControls();
          this._context.notifySceneGraphChanged();
          break;
      }
    };

    this.domElement.addEventListener("mousemove", this.pointerMoveListener, false);
    this.domElement.removeEventListener("mouseup", this.pointerUpListener);
    this.domElement.removeEventListener("touchend", this.pointerUpListener);
    this.domElement.addEventListener("mousedown", handleCopy);
    this.domElement.addEventListener("touchstart", handleCopy);
    this.domElement.addEventListener("keydown", handleAxis);

    this.axis = "XYZ";

    this.mouseDownEvent.mouseEvent = event;
    this.pointerDown(this.__getPointer(event));
  }

  onKeyUpListener(event) {
    if (event.key === "Enter") {
      const glScene = this._glScene;
      const dynInputActive = event.target.parentElement.id === 'dynamicInput';
      this.mouseKeyUpEvent.event = event;
      this.dispatchEvent(this.mouseKeyUpEvent);
    }
  }

  showGizmo(bool) {
    const gizmoChilds = this._gizmo.gizmo["translate"].children;
    gizmoChilds[0].material.visible = bool;
    gizmoChilds[3].material.visible = bool;
    gizmoChilds[6].material.visible = bool;

    gizmoChilds.forEach((child, index, arr) => {
      if (child.type !== "Line") arr[index].material.visible = bool;
    });
  }
}

// =============================================
// =============================================

// =============================================
// class GlTransformControlsPlane
// =============================================
class GlTransformControlsPlane extends Mesh {
  constructor() {
    const geometry = new PlaneGeometry(100000, 100000, 2, 2);
    const material = new MeshBasicMaterial({
      visible: false,
      wireframe: true,
      side: DoubleSide,
      transparent: true,
      opacity: 0.1
    });

    super(geometry, material);

    this.GlTransformControlsPlane = true;
    this.type = 'GlTransformControlsPlane';

    this.cameraQuaternion = new Quaternion();
    this.worldPosition = new Vector3();
    this.worldQuaternion = new Quaternion();
    this.eye = new Vector3();
    this.spaceLocal = false;
  }

  // -------------------------
  // updateMatrixWorld()
  // -------------------------
  updateMatrixWorld() {
    this.position.copy(this.worldPosition);

    let space = this.space;

    // scale always oriented to local rotation
    if (this.mode === 'scale') space = 'local';

    // translate
    // will be oriented to local rotation
    // when partOfPlot is attached
    if (this.spaceLocal && this.mode === "translate") space = 'local';

    unitX.copy(_unitX);
    unitY.copy(_unitY);
    unitZ.copy(_unitZ);

    unitX.applyQuaternion(space === "local" ? this.worldQuaternion : _identityQuaternion);
    unitY.applyQuaternion(space === "local" ? this.worldQuaternion : _identityQuaternion);
    unitZ.applyQuaternion(space === "local" ? this.worldQuaternion : _identityQuaternion);

    // Align the plane for current transform mode, axis and space.
    _alignVector.copy(unitY);

    switch (this.mode) {
      case 'translate':
      case 'scale':
        switch (this.axis) {

          case 'X':
            _alignVector.copy(this.eye).cross(unitX);
            _dirVector.copy(unitX).cross(_alignVector);
            break;
          case 'Y':
            _alignVector.copy(this.eye).cross(unitY);
            _dirVector.copy(unitY).cross(_alignVector);
            break;
          case 'Z':
            _alignVector.copy(this.eye).cross(unitZ);
            _dirVector.copy(unitZ).cross(_alignVector);
            break;
          case 'XY':
            _dirVector.copy(unitZ);
            break;
          case 'YZ':
            _dirVector.copy(unitX);
            break;
          case 'XZ':
            _alignVector.copy(unitZ);
            _dirVector.copy(unitY);
            break;
          case 'XYZ':
          case 'E':
            _dirVector.set(0, 0, 0);
            break;

        }
        break;
      case 'rotate':
      default:
        // special case for rotate
        _dirVector.set(0, 0, 0);
    }

    if (_dirVector.length() === 0) {
      // If in rotate mode, make the plane parallel to camera
      this.quaternion.copy(this.cameraQuaternion);
    } else {
      _tempVector.set(0, 0, 0);
      _lookAtMatrix.identity();
      _lookAtMatrix.lookAt(_tempVector, _dirVector, _alignVector);
      this.quaternion.setFromRotationMatrix(_lookAtMatrix);
    }

    Object3D.prototype.updateMatrixWorld.call(this);
  }
}

// =============================================
// =============================================

// =============================================
// class GlTransformControlsGizmo
// =============================================
class GlTransformControlsGizmo extends Object3D {
  constructor() {
    super();

    this.isGlTransformControlsGizmo = true;
    this.type = 'GlTransformControlsGizmo';

    this.rotationAxis = new Vector3();
    this.cameraPosition = new Vector3();
    this.worldPositionStart = new Vector3();
    this.worldQuaternionStart = new Quaternion();
    this.worldPosition = new Vector3();
    this.worldQuaternion = new Quaternion();
    this.eye = new Vector3();
    this.spaceLocal = false;

    // Gizmo creation
    this.gizmo = {};
    this.picker = {};
    this.helper = {};

    this.__createGizmo();
  }

  // ----------------
  // Gizmo creation
  // ----------------
  __createGizmo() {
    // shared materials
    const gizmoMaterial = new MeshBasicMaterial({
      depthTest: false,
      depthWrite: false,
      transparent: true,
      side: DoubleSide,
      fog: false
    });

    const gizmoLineMaterial = new LineBasicMaterial({
      depthTest: false,
      depthWrite: false,
      transparent: true,
      linewidth: 1,
      fog: false
    });

    // Make unique material for each axis/color
    const matInvisible = gizmoMaterial.clone();
    matInvisible.opacity = 0.15;

    const matHelper = gizmoMaterial.clone();
    matHelper.opacity = 0.33;
    matHelper.color.set(0x000000);

    const matRed = gizmoMaterial.clone();
    matRed.color.set(0xff0000);

    const matGreen = gizmoMaterial.clone();
    matGreen.color.set(0x00ff00);

    const matBlue = gizmoMaterial.clone();
    matBlue.color.set(0x0000ff);

    const matWhiteTransparent = gizmoMaterial.clone();
    matWhiteTransparent.color.set(0x787878);
    matWhiteTransparent.opacity = 0.15;

    const matBlueTransparent = matWhiteTransparent.clone();
    matBlueTransparent.color.set(0x0000ff);
    matBlueTransparent.opacity = 0.5;

    const matRedTransparent = matWhiteTransparent.clone();
    matRedTransparent.color.set(0xff0000);
    matRedTransparent.opacity = 0.5;

    const matGreenTransparent = matWhiteTransparent.clone();
    matGreenTransparent.color.set(0x00ff00);
    matGreenTransparent.opacity = 0.5;

    const matYellow = gizmoMaterial.clone();
    matYellow.color.set(0xffff00);

    const matLineRed = gizmoLineMaterial.clone();
    matLineRed.color.set(0xff0000);

    const matLineGreen = gizmoLineMaterial.clone();
    matLineGreen.color.set(0x00ff00);

    const matLineBlue = gizmoLineMaterial.clone();
    matLineBlue.color.set(0x0000ff);

    const matLineCyan = gizmoLineMaterial.clone();
    matLineCyan.color.set(0x00ffff);

    const matLineMagenta = gizmoLineMaterial.clone();
    matLineMagenta.color.set(0xff00ff);

    const matLineYellow = gizmoLineMaterial.clone();
    matLineYellow.color.set(0xffff00);

    const matLineGray = gizmoLineMaterial.clone();
    matLineGray.color.set(0x787878);

    const matLineYellowTransparent = matLineYellow.clone();
    matLineYellowTransparent.opacity = 0.25;

    // reusable geometry

    const arrowGeometry = new CylinderGeometry(0, 0.05, 0.2, 12, 1, false);

    const scaleHandleGeometry = new BoxGeometry(0.125, 0.125, 0.125);

    const lineGeometry = new BufferGeometry();
    lineGeometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));


    // Gizmo definitions - custom hierarchy definitions for __setupGizmo() function
    const gizmoTranslate = {
      X: [
        [new Mesh(arrowGeometry, matRed), [1, 0, 0], [0, 0, - Math.PI / 2], null, 'fwd'],
        [new Mesh(arrowGeometry, matRed), [1, 0, 0], [0, 0, Math.PI / 2], null, 'bwd'],
        [new Line(lineGeometry, matLineRed), null, null]
      ],
      Y: [
        [new Mesh(arrowGeometry, matGreen), [0, 1, 0], null, null, 'fwd'],
        [new Mesh(arrowGeometry, matGreen), [0, 1, 0], [Math.PI, 0, 0], null, 'bwd'],
        [new Line(lineGeometry, matLineGreen), null, [0, 0, Math.PI / 2]]
      ],
      Z: [
        [new Mesh(arrowGeometry, matBlue), [0, 0, 1], [Math.PI / 2, 0, 0], null, 'fwd'],
        [new Mesh(arrowGeometry, matBlue), [0, 0, 1], [- Math.PI / 2, 0, 0], null, 'bwd'],
        [new Line(lineGeometry, matLineBlue), null, [0, - Math.PI / 2, 0]]
      ],
      XYZ: [
        [new Mesh(new OctahedronGeometry(0.1, 0), matWhiteTransparent.clone()), [0, 0, 0], [0, 0, 0]]
      ],
      XY: [
        [new Mesh(new PlaneGeometry(0.200, 0.200), matBlueTransparent.clone()), [0.2, 0.2, 0]],
        [new Line(lineGeometry, matLineBlue), [0.175, 0.3, 0], null, [0.125, 1, 1]],
        [new Line(lineGeometry, matLineBlue), [0.3, 0.175, 0], [0, 0, Math.PI / 2], [0.125, 1, 1]],
      ],
      YZ: [
        [new Mesh(new PlaneGeometry(0.200, 0.200), matRedTransparent.clone()), [0, 0.2, 0.2], [0, Math.PI / 2, 0]],
        [new Line(lineGeometry, matLineRed), [0, 0.175, 0.3], [0, 0, Math.PI / 2], [0.125, 1, 1]],
        [new Line(lineGeometry, matLineRed), [0, 0.3, 0.175], [0, - Math.PI / 2, 0], [0.125, 1, 1]],
      ],
      XZ: [
        [new Mesh(new PlaneGeometry(0.200, 0.200), matGreenTransparent.clone()), [0.2, 0, 0.2], [- Math.PI / 2, 0, 0]],
        [new Line(lineGeometry, matLineGreen), [0.175, 0, 0.3], null, [0.125, 1, 1]],
        [new Line(lineGeometry, matLineGreen), [0.3, 0, 0.175], [0, - Math.PI / 2, 0], [0.125, 1, 1]],
      ]
    };

    const pickerTranslate = {
      X: [[new Mesh(new CylinderGeometry(0.2, 0, 1, 4, 1, false), matInvisible), [0.6, 0, 0], [0, 0, - Math.PI / 2]]],
      Y: [[new Mesh(new CylinderGeometry(0.2, 0, 1, 4, 1, false), matInvisible), [0, 0.6, 0]]],
      Z: [[new Mesh(new CylinderGeometry(0.2, 0, 1, 4, 1, false), matInvisible), [0, 0, 0.6], [Math.PI / 2, 0, 0]]],
      XYZ: [[new Mesh(new OctahedronGeometry(0.2, 0), matInvisible)]],
      XY: [[new Mesh(new PlaneGeometry(0.4, 0.4), matInvisible), [0.2, 0.2, 0]]],
      YZ: [[new Mesh(new PlaneGeometry(0.4, 0.4), matInvisible), [0, 0.2, 0.2], [0, Math.PI / 2, 0]]],
      XZ: [[new Mesh(new PlaneGeometry(0.4, 0.4), matInvisible), [0.2, 0, 0.2], [- Math.PI / 2, 0, 0]]]
    };

    const helperTranslate = {
      START: [[new Mesh(new OctahedronGeometry(0.01, 2), matHelper), null, null, null, 'helper']],
      END: [[new Mesh(new OctahedronGeometry(0.01, 2), matHelper), null, null, null, 'helper']],
      DELTA: [[new Line(this.__createTranslateHelperGeometry(), matHelper), null, null, null, 'helper']],
      X: [[new Line(lineGeometry, matHelper.clone()), [- 1e3, 0, 0], null, [1e6, 1, 1], 'helper']],
      Y: [[new Line(lineGeometry, matHelper.clone()), [0, - 1e3, 0], [0, 0, Math.PI / 2], [1e6, 1, 1], 'helper']],
      Z: [[new Line(lineGeometry, matHelper.clone()), [0, 0, - 1e3], [0, - Math.PI / 2, 0], [1e6, 1, 1], 'helper']]
    };

    const gizmoRotate = {
      X: [
        [new Line(this.__createCircleGeometry(1, 0.5), matLineRed)],
        [new Mesh(new OctahedronGeometry(0.04, 0), matRed), [0, 0, 0.99], null, [1, 3, 1]],
      ],
      Y: [
        [new Line(this.__createCircleGeometry(1, 0.5), matLineGreen), null, [0, 0, - Math.PI / 2]],
        [new Mesh(new OctahedronGeometry(0.04, 0), matGreen), [0, 0, 0.99], null, [3, 1, 1]],
      ],
      Z: [
        [new Line(this.__createCircleGeometry(1, 0.5), matLineBlue), null, [0, Math.PI / 2, 0]],
        [new Mesh(new OctahedronGeometry(0.04, 0), matBlue), [0.99, 0, 0], null, [1, 3, 1]],
      ],
      E: [
        [new Line(this.__createCircleGeometry(1.25, 1), matLineYellowTransparent), null, [0, Math.PI / 2, 0]],
        [new Mesh(new CylinderGeometry(0.03, 0, 0.15, 4, 1, false), matLineYellowTransparent), [1.17, 0, 0], [0, 0, - Math.PI / 2], [1, 1, 0.001]],
        [new Mesh(new CylinderGeometry(0.03, 0, 0.15, 4, 1, false), matLineYellowTransparent), [- 1.17, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.001]],
        [new Mesh(new CylinderGeometry(0.03, 0, 0.15, 4, 1, false), matLineYellowTransparent), [0, - 1.17, 0], [Math.PI, 0, 0], [1, 1, 0.001]],
        [new Mesh(new CylinderGeometry(0.03, 0, 0.15, 4, 1, false), matLineYellowTransparent), [0, 1.17, 0], [0, 0, 0], [1, 1, 0.001]],
      ],
      XYZE: [
        [new Line(this.__createCircleGeometry(1, 1), matLineGray), null, [0, Math.PI / 2, 0]]
      ]
    };

    const helperRotate = {
      AXIS: [[new Line(lineGeometry, matHelper.clone()), [- 1e3, 0, 0], null, [1e6, 1, 1], 'helper']]
    };

    const pickerRotate = {
      X: [[new Mesh(new TorusGeometry(1, 0.1, 4, 24), matInvisible), [0, 0, 0], [0, - Math.PI / 2, - Math.PI / 2]]],
      Y: [[new Mesh(new TorusGeometry(1, 0.1, 4, 24), matInvisible), [0, 0, 0], [Math.PI / 2, 0, 0]]],
      Z: [[new Mesh(new TorusGeometry(1, 0.1, 4, 24), matInvisible), [0, 0, 0], [0, 0, - Math.PI / 2]]],
      E: [[new Mesh(new TorusGeometry(1.25, 0.1, 2, 24), matInvisible)]],
      XYZE: [[new Mesh(new SphereGeometry(0.7, 10, 8), matInvisible)]]
    };

    const gizmoScale = {
      X: [
        [new Mesh(scaleHandleGeometry, matRed), [0.8, 0, 0], [0, 0, - Math.PI / 2]],
        [new Line(lineGeometry, matLineRed), null, null, [0.8, 1, 1]]
      ],
      Y: [
        [new Mesh(scaleHandleGeometry, matGreen), [0, 0.8, 0]],
        [new Line(lineGeometry, matLineGreen), null, [0, 0, Math.PI / 2], [0.8, 1, 1]]
      ],
      Z: [
        [new Mesh(scaleHandleGeometry, matBlue), [0, 0, 0.8], [Math.PI / 2, 0, 0]],
        [new Line(lineGeometry, matLineBlue), null, [0, - Math.PI / 2, 0], [0.8, 1, 1]]
      ],
      XY: [
        [new Mesh(scaleHandleGeometry, matBlueTransparent), [0.85, 0.85, 0], null, [2, 2, 0.2]],
        [new Line(lineGeometry, matLineBlue), [0.855, 0.98, 0], null, [0.125, 1, 1]],
        [new Line(lineGeometry, matLineBlue), [0.98, 0.855, 0], [0, 0, Math.PI / 2], [0.125, 1, 1]]
      ],
      YZ: [
        [new Mesh(scaleHandleGeometry, matRedTransparent), [0, 0.85, 0.85], null, [0.2, 2, 2]],
        [new Line(lineGeometry, matLineRed), [0, 0.855, 0.98], [0, 0, Math.PI / 2], [0.125, 1, 1]],
        [new Line(lineGeometry, matLineRed), [0, 0.98, 0.855], [0, - Math.PI / 2, 0], [0.125, 1, 1]]
      ],
      XZ: [
        [new Mesh(scaleHandleGeometry, matGreenTransparent), [0.85, 0, 0.85], null, [2, 0.2, 2]],
        [new Line(lineGeometry, matLineGreen), [0.855, 0, 0.98], null, [0.125, 1, 1]],
        [new Line(lineGeometry, matLineGreen), [0.98, 0, 0.855], [0, - Math.PI / 2, 0], [0.125, 1, 1]]
      ],
      XYZX: [[new Mesh(new BoxGeometry(0.125, 0.125, 0.125), matWhiteTransparent.clone()), [1.1, 0, 0]]],
      XYZY: [[new Mesh(new BoxGeometry(0.125, 0.125, 0.125), matWhiteTransparent.clone()), [0, 1.1, 0]]],
      XYZZ: [[new Mesh(new BoxGeometry(0.125, 0.125, 0.125), matWhiteTransparent.clone()), [0, 0, 1.1]]]
    };

    const pickerScale = {
      X: [[new Mesh(new CylinderGeometry(0.2, 0, 0.8, 4, 1, false), matInvisible), [0.5, 0, 0], [0, 0, - Math.PI / 2]]],
      Y: [[new Mesh(new CylinderGeometry(0.2, 0, 0.8, 4, 1, false), matInvisible), [0, 0.5, 0]]],
      Z: [[new Mesh(new CylinderGeometry(0.2, 0, 0.8, 4, 1, false), matInvisible), [0, 0, 0.5], [Math.PI / 2, 0, 0]]],
      XY: [[new Mesh(scaleHandleGeometry, matInvisible), [0.85, 0.85, 0], null, [3, 3, 0.2]]],
      YZ: [[new Mesh(scaleHandleGeometry, matInvisible), [0, 0.85, 0.85], null, [0.2, 3, 3]]],
      XZ: [[new Mesh(scaleHandleGeometry, matInvisible), [0.85, 0, 0.85], null, [3, 0.2, 3]]],
      XYZX: [[new Mesh(new BoxGeometry(0.2, 0.2, 0.2), matInvisible), [1.1, 0, 0]]],
      XYZY: [[new Mesh(new BoxGeometry(0.2, 0.2, 0.2), matInvisible), [0, 1.1, 0]]],
      XYZZ: [[new Mesh(new BoxGeometry(0.2, 0.2, 0.2), matInvisible), [0, 0, 1.1]]]
    };

    const helperScale = {
      X: [[new Line(lineGeometry, matHelper.clone()), [- 1e3, 0, 0], null, [1e6, 1, 1], 'helper']],
      Y: [[new Line(lineGeometry, matHelper.clone()), [0, - 1e3, 0], [0, 0, Math.PI / 2], [1e6, 1, 1], 'helper']],
      Z: [[new Line(lineGeometry, matHelper.clone()), [0, 0, - 1e3], [0, - Math.PI / 2, 0], [1e6, 1, 1], 'helper']]
    };

    this.add(this.gizmo["translate"] = this.__setupGizmo(gizmoTranslate));
    this.add(this.gizmo["rotate"] = this.__setupGizmo(gizmoRotate));
    this.add(this.gizmo["scale"] = this.__setupGizmo(gizmoScale));
    this.add(this.picker["translate"] = this.__setupGizmo(pickerTranslate));
    this.add(this.picker["rotate"] = this.__setupGizmo(pickerRotate));
    this.add(this.picker["scale"] = this.__setupGizmo(pickerScale));
    this.add(this.helper["translate"] = this.__setupGizmo(helperTranslate));
    this.add(this.helper["rotate"] = this.__setupGizmo(helperRotate));
    this.add(this.helper["scale"] = this.__setupGizmo(helperScale));

    // Pickers should be hidden always
    this.picker["translate"].visible = false;
    this.picker["rotate"].visible = false;
    this.picker["scale"].visible = false;
  }

  // ------------------------------------------
  // Creates an Object3D with gizmos
  // described in custom hierarchy definition.
  // ------------------------------------------
  __setupGizmo(gizmoMap) {
    const gizmo = new Object3D();

    for (const name in gizmoMap) {
      if (gizmoMap.hasOwnProperty(name)) {
        for (let i = gizmoMap[name].length; i--;) {
          const object = gizmoMap[name][i][0].clone();
          const position = gizmoMap[name][i][1];
          const rotation = gizmoMap[name][i][2];
          const scale = gizmoMap[name][i][3];
          const tag = gizmoMap[name][i][4];

          // name and tag properties are essential for picking and updating logic.
          object.name = name;
          object.tag = tag;
          if (position) {
            object.position.set(position[0], position[1], position[2]);
          }
          if (rotation) {
            object.rotation.set(rotation[0], rotation[1], rotation[2]);
          }
          if (scale) {
            object.scale.set(scale[0], scale[1], scale[2]);
          }

          object.updateMatrix();

          const tempGeometry = object.geometry.clone();
          tempGeometry.applyMatrix4(object.matrix);
          object.geometry = tempGeometry;
          object.renderOrder = Infinity;

          object.position.set(0, 0, 0);
          object.rotation.set(0, 0, 0);
          object.scale.set(1, 1, 1);

          gizmo.add(object);
        }
      }
    }

    return gizmo;
  }

  // -------------------------------------
  // create Circle Geometry
  // -------------------------------------
  __createCircleGeometry(radius, arc) {
    const geometry = new BufferGeometry();
    const vertices = [];

    for (let i = 0; i <= 64 * arc; ++i) {
      vertices.push(0, Math.cos(i / 32 * Math.PI) * radius, Math.sin(i / 32 * Math.PI) * radius);
    }
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    return geometry;
  }

  // ------------------------------------------------------
  // Special geometry for transform helper. If scaled with
  // position vector it spans from [0,0,0] to position
  // ------------------------------------------------------
  __createTranslateHelperGeometry() {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 1, 1], 3));
    return geometry;
  }

  // ------------------------------------------------
  // updateMatrixWorld will update transformations
  // and appearance of individual handles
  // ------------------------------------------------
  updateMatrixWorld() {
    let space = this.space;

    // scale always oriented to local rotation
    if (this.mode === 'scale') space = 'local';

    // translate
    // will be oriented to local rotation
    // when partOfPlot is attached
    if (this.spaceLocal && this.mode === "translate") space = 'local';

    unitX.copy(_unitX);
    unitY.copy(_unitY);
    unitZ.copy(_unitZ);

    const quaternion = space === "local" ? this.worldQuaternion : _identityQuaternion;

    // Show only gizmos for current transform mode
    this.gizmo["translate"].visible = this.mode === "translate";
    this.gizmo["rotate"].visible = this.mode === "rotate";
    this.gizmo["scale"].visible = this.mode === "scale";

    this.helper["translate"].visible = this.mode === "translate";
    this.helper["rotate"].visible = this.mode === "rotate";
    this.helper["scale"].visible = this.mode === "scale";


    let handles = [];
    handles = handles.concat(this.picker[this.mode].children);
    handles = handles.concat(this.gizmo[this.mode].children);
    handles = handles.concat(this.helper[this.mode].children);

    let factor;
    if ( this.camera.isOrthographicCamera ) {
      factor = ( this.camera.top - this.camera.bottom ) / this.camera.zoom;
    } else {
      factor = this.worldPosition.distanceTo( this.cameraPosition ) * Math.min( 1.9 * Math.tan( Math.PI * this.camera.fov / 360 ) / this.camera.zoom, 7 );
    }
    const scaleCoef = factor * this.size / 6;
    
    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      
      // hide aligned to camera
      handle.visible = true;
      handle.rotation.set(0, 0, 0);
      handle.position.copy(this.worldPosition);
      
      handle.scale.set(1, 1, 1).multiplyScalar(scaleCoef);
 
      // TODO: simplify helpers and consider decoupling from gizmo

      if (handle.tag === 'helper') {
        this.__updateHelper(handle, quaternion);
        // If updating helper, skip rest of the loop
        continue;
      }

      // Align handles to current local or world rotation
      handle.quaternion.copy(quaternion);

      if (this.mode === 'translate' || this.mode === 'scale') {
        // Hide translate and scale axis facing the camera
        const AXIS_HIDE_TRESHOLD = 0.99;
        const PLANE_HIDE_TRESHOLD = 0.2;
        const AXIS_FLIP_TRESHOLD = 0.0;

        if (handle.name === 'X' || handle.name === 'XYZX') {
          if (Math.abs(_alignVector.copy(unitX).applyQuaternion(quaternion).dot(this.eye)) > AXIS_HIDE_TRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }
        if (handle.name === 'Y' || handle.name === 'XYZY') {
          if (Math.abs(_alignVector.copy(unitY).applyQuaternion(quaternion).dot(this.eye)) > AXIS_HIDE_TRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }
        if (handle.name === 'Z' || handle.name === 'XYZZ') {
          if (Math.abs(_alignVector.copy(unitZ).applyQuaternion(quaternion).dot(this.eye)) > AXIS_HIDE_TRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }
        if (handle.name === 'XY') {
          if (Math.abs(_alignVector.copy(unitZ).applyQuaternion(quaternion).dot(this.eye)) < PLANE_HIDE_TRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }
        if (handle.name === 'YZ') {
          if (Math.abs(_alignVector.copy(unitX).applyQuaternion(quaternion).dot(this.eye)) < PLANE_HIDE_TRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }
        if (handle.name === 'XZ') {
          if (Math.abs(_alignVector.copy(unitY).applyQuaternion(quaternion).dot(this.eye)) < PLANE_HIDE_TRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }

        // Flip translate and scale axis ocluded behind another axis
        if (handle.name.search('X') !== - 1) {
          if (_alignVector.copy(unitX).applyQuaternion(quaternion).dot(this.eye) < AXIS_FLIP_TRESHOLD) {
            if (handle.tag === 'fwd') {
              handle.visible = false;
            } else {
              handle.scale.x *= - 1;
            }
          } else if (handle.tag === 'bwd') {
            handle.visible = false;
          }
        }

        if (handle.name.search('Y') !== - 1) {
          if (_alignVector.copy(unitY).applyQuaternion(quaternion).dot(this.eye) < AXIS_FLIP_TRESHOLD) {
            if (handle.tag === 'fwd') {
              handle.visible = false;
            } else {
              handle.scale.y *= - 1;
            }
          } else if (handle.tag === 'bwd') {
            handle.visible = false;
          }
        }

        if (handle.name.search('Z') !== - 1) {
          if (_alignVector.copy(unitZ).applyQuaternion(quaternion).dot(this.eye) < AXIS_FLIP_TRESHOLD) {
            if (handle.tag === 'fwd') {
              handle.visible = false;
            } else {
              handle.scale.z *= - 1;
            }
          } else if (handle.tag === 'bwd') {
            handle.visible = false;
          }
        }

      } else if (this.mode === 'rotate') {
        // Align handles to current local or world rotation
        _tempQuaternion2.copy(quaternion);
        _alignVector.copy(this.eye).applyQuaternion(_tempQuaternion.copy(quaternion).invert());

        if (handle.name.search("E") !== - 1) {
          handle.quaternion.setFromRotationMatrix(_lookAtMatrix.lookAt(this.eye, _zeroVector, unitY));
        }

        if (handle.name === 'X') {
          _tempQuaternion.setFromAxisAngle(unitX, Math.atan2(- _alignVector.y, _alignVector.z));
          _tempQuaternion.multiplyQuaternions(_tempQuaternion2, _tempQuaternion);
          handle.quaternion.copy(_tempQuaternion);
        }

        if (handle.name === 'Y') {
          _tempQuaternion.setFromAxisAngle(unitY, Math.atan2(_alignVector.x, _alignVector.z));
          _tempQuaternion.multiplyQuaternions(_tempQuaternion2, _tempQuaternion);
          handle.quaternion.copy(_tempQuaternion);
        }

        if (handle.name === 'Z') {
          _tempQuaternion.setFromAxisAngle(unitZ, Math.atan2(_alignVector.y, _alignVector.x));
          _tempQuaternion.multiplyQuaternions(_tempQuaternion2, _tempQuaternion);
          handle.quaternion.copy(_tempQuaternion);
        }
      }

      // Hide disabled axes
      handle.visible = handle.visible && (handle.name.indexOf("X") === - 1 || this.showX);
      handle.visible = handle.visible && (handle.name.indexOf("Y") === - 1 || this.showY);
      handle.visible = handle.visible && (handle.name.indexOf("Z") === - 1 || this.showZ);
      handle.visible = handle.visible && (handle.name.indexOf("E") === - 1 || (this.showX && this.showY && this.showZ));

      // highlight selected axis
      handle.material._opacity = handle.material._opacity || handle.material.opacity;
      handle.material._color = handle.material._color || handle.material.color.clone();

      handle.material.color.copy(handle.material._color);
      handle.material.opacity = handle.material._opacity;

      if (!this.enabled) {
        handle.material.opacity *= 0.5;
        handle.material.color.lerp(new Color(1, 1, 1), 0.5);
      } else if (this.axis) {
        if (handle.name === this.axis) {
          handle.material.opacity = 1.0;
          // handle.material.color.lerp(new Color(1, 1, 1), 0.5);
        } else if (this.axis.split('').some(function(a) {
          return handle.name === a;
        })) {
          handle.material.opacity = 1.0;
          // handle.material.color.lerp(new Color(1, 1, 1), 0.5);
        } else {
          handle.material.opacity *= 0.25;
          // handle.material.color.lerp(new Color(1, 1, 1), 0.5);
        }
      }
    }

    Object3D.prototype.updateMatrixWorld.call(this);
  }

  __updateHelper(handle, quaternion) {
    handle.visible = false;

    if (handle.name === 'AXIS') {
      handle.visible = !!this.axis;

      if (this.axis === 'X') {
        _tempQuaternion.setFromEuler(_tempEuler.set(0, 0, 0));
        handle.quaternion.copy(quaternion).multiply(_tempQuaternion);
        if (Math.abs(_alignVector.copy(_unitX).applyQuaternion(quaternion).dot(this.eye)) > 0.9) {
          handle.visible = false;
        }
        handle.material.color.setHex(0xff0000);
      }

      if (this.axis === 'Y') {
        _tempQuaternion.setFromEuler(_tempEuler.set(0, 0, Math.PI / 2));
        handle.quaternion.copy(quaternion).multiply(_tempQuaternion);
        if (Math.abs(_alignVector.copy(_unitY).applyQuaternion(quaternion).dot(this.eye)) > 0.9) {
          handle.visible = false;
        }
        handle.material.color.setHex(0x00ff00);
      }

      if (this.axis === 'Z') {
        _tempQuaternion.setFromEuler(_tempEuler.set(0, Math.PI / 2, 0));
        handle.quaternion.copy(quaternion).multiply(_tempQuaternion);
        if (Math.abs(_alignVector.copy(_unitZ).applyQuaternion(quaternion).dot(this.eye)) > 0.9) {
          handle.visible = false;
        }
        handle.material.color.setHex(0x0000ff);
      }

      if (this.axis === 'XYZE') {
        _tempQuaternion.setFromEuler(_tempEuler.set(0, Math.PI / 2, 0));
        _alignVector.copy(this.rotationAxis);
        handle.quaternion.setFromRotationMatrix(_lookAtMatrix.lookAt(_zeroVector, _alignVector, _unitY));
        handle.quaternion.multiply(_tempQuaternion);
        // handle.visible = this.dragging;
        handle.visible = false;
      }

      if (this.axis === 'E') {
        handle.visible = false;
      }
    } else if (handle.name === 'START') {
      handle.position.copy(this.worldPositionStart);
      handle.visible = this.dragging;
    } else if (handle.name === 'END') {
      handle.position.copy(this.worldPosition);
      handle.visible = this.dragging;
    } else if (handle.name === 'DELTA') {
      handle.position.copy(this.worldPositionStart);
      handle.quaternion.copy(this.worldQuaternionStart);
      _tempVector.set(1e-10, 1e-10, 1e-10).add(this.worldPositionStart).sub(this.worldPosition).multiplyScalar(- 1);
      _tempVector.applyQuaternion(this.worldQuaternionStart.clone().invert());
      handle.scale.copy(_tempVector);
      handle.visible = this.dragging;
    } else {
      handle.quaternion.copy(quaternion);
      if (this.dragging) {
        handle.position.copy(this.worldPositionStart);
      } else {
        handle.position.copy(this.worldPosition);
      }
      if (this.axis) {
        handle.visible = this.axis.search(handle.name) !== - 1;
        if (handle.name == 'X') handle.material.color.setHex(0xff0000);
        if (handle.name == 'Y') handle.material.color.setHex(0x00ff00);
        if (handle.name == 'Z') handle.material.color.setHex(0x0000ff);
      }
    }
  }
}
