/* eslint-disable no-undef */
import {GlUtils} from '../utils/gl-utils';
import {GlOrientation, GlClickMode} from './gl-constants'
import {
  Vector3,
  EventDispatcher,
  Vector2,
  Quaternion,
  Spherical,
  MathUtils,
  MOUSE,
  TOUCH
} from 'three';
import { GlRaycaster } from './gl-raycaster';

const STATE = {NONE: - 1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY_PAN: 4, FOCUS: 5, ANIMATION_FOCUS: 6};
const __unitZ = new Vector3(0, 0, 1);
const __unitY = new Vector3(0, 1, 0);
const __offset = new Vector3();
const __twoPI = 2 * Math.PI;
const _Raycaster = new GlRaycaster();
const _offset = new Vector3();
const _center = new Vector3();
const _v2_1 = new Vector3();
const _targetTemp = new Vector3();
const _cameraPosTemp = new Vector3();
const _v_pan = new Vector3();

export class OrbitControls extends EventDispatcher {

  constructor(glScene, domElement) {
    super();

    this.isOrbitControls = true;
    this.glScene = glScene;
    this.camera = glScene.context.camera;
    this.sceneSettings = glScene.context.config.settings;
    this.domElement = (domElement !== undefined) ? domElement : document;
    this._glCanvas = this.domElement;

    // get the WebGlRenderer's canvas
    for (const child of this.domElement.children) {
      if (child.localName === 'canvas') {
        this._glCanvas = child;
        break;
      }
    }

    // Set to false to disable this control
    this.enabled = true;

    // "target" sets the location of focus, where the object orbits around
    this.target = new Vector3();

    // How far you can dolly in and out ( PerspectiveCamera only )
    this.minDistance = 0;
    this.maxDistance = Infinity;

    // How far you can zoom in and out ( OrthographicCamera only )
    this.minZoom = 0;
    this.maxZoom = Infinity;

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    // How far you can orbit horizontally, upper and lower limits.
    // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
    this.minAzimuthAngle = - Infinity; // radians
    this.maxAzimuthAngle = Infinity; // radians

    // Set to true to enable damping (inertia)
    // If damping is enabled, you must call controls.update() in your animation loop
    this.enableDamping = false;
    this.dampingFactor = 0.25;

    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    // Set to false to disable zooming
    this.enableZoom = true;
    this.zoomSpeed = 2.0;

    // Set to true to zoom to cursor
    this.zoomToCursor = true;
    this.mouseNorm = new Vector2();

    // Set to false to disable rotating
    this.enableRotate = true;
    this.enableRotateWithLeft = true;
    this.rotateSpeed = 1.0;

    // Set to false to disable panning
    this.enablePan = true;
    this.panSpeed = 1.0;
    this.screenSpacePanning = false; // if true, pan in screen-space
    this.keyPanSpeed = 7.0; // pixels moved per arrow key push

    this.enableFocus = true;

    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    // Set to false to disable use of the keys
    this.enableKeys = true;

    // The four arrow keys
    this.keys = {LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40};

    // Mouse buttons
    this.mouseButtons = {LEFT: MOUSE.LEFT, MIDDLE: MOUSE.MIDDLE, RIGHT: MOUSE.RIGHT};

    // Touch fingers
    this.touches = {ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN};

    // for reset
    this.target0 = this.target.clone();
    this.position0 = this.camera.position.clone();
    this.zoom0 = this.camera.zoom;

    // events
    this.changeEvent = {type: 'change'};
    this.startEvent = {type: 'start'};
    this.endEvent = {type: 'end'};

    this.state = STATE.NONE;

    this.EPS = 0.0001;

    // so camera.up is the orbit axis
    this.quat = new Quaternion().setFromUnitVectors(this.camera.up, __unitY);
    this.quatInverse = this.quat.clone().invert();

    this.lastPos = new Vector3();
    this.lastQuat = new Quaternion();

    // current position in spherical coordinates
    this.spherical = new Spherical();
    this.sphericalDelta = new Spherical();

    this.scale = 1;
    this.panOffset = new Vector3();
    this.zoomChanged = false;
    this.zoomFactor = 1;

    this.rotateStart = new Vector2();
    this.rotateEnd = new Vector2();
    this.rotateDelta = new Vector2();

    this.panStart = new Vector2();
    this.panEnd = new Vector2();
    this.panDelta = new Vector2();

    this.dollyStart = new Vector2();
    this.dollyEnd = new Vector2();
    this.dollyDelta = new Vector2();

    // double tap
    this._devPxRatio = 0;
    this._downValid = true;
    this._nclicks = 0;
    this._downEvents = [];
    this._downStart = 0;	//pointerDown time
    this._clickStart = 0;	//first click time
    this._maxDownTime = 250;
    this._maxInterval = 300;
    this._posThreshold = 24;
    this._movementThreshold = 24;

    // animations
    this.enableAnimations = true;
    this._timeStart = - 1; //initial time
    this._animationId = - 1;
    this.focusAnimationTime = 500; //duration of focus animation in ms
    this._zoomTemp = 0;

    // parameters
    this.scaleFactor = 1.1;	//zoom/distance multiplier

    // event listeners
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);

    this.domElement.addEventListener('contextmenu', this.onContextMenu, false);
    this.domElement.addEventListener('mousedown', this.onMouseDown, false);
    this.domElement.addEventListener('wheel', this.onMouseWheel, false);
    this.domElement.addEventListener('touchstart', this.onTouchStart, false);
    this.domElement.addEventListener('touchend', this.onTouchEnd, false);
    this.domElement.addEventListener('touchmove', this.onTouchMove, false);

    window.addEventListener('keydown', this.onKeyDown, false);

    // make sure element can receive keys.
    if (this.domElement.tabIndex === - 1) {
      this.domElement.tabIndex = 0;
    }

    // force an update at start
    this.update();
  }

  isInAction() {
    return this.state !== STATE.NONE ? true : false;
  }

  dispose() {
    this.domElement.removeEventListener('contextmenu', this.onContextMenu, false);
    this.domElement.removeEventListener('mousedown', this.onMouseDown, false);
    this.domElement.removeEventListener('wheel', this.onMouseWheel, false);

    this.domElement.removeEventListener('touchstart', this.onTouchStart, false);
    this.domElement.removeEventListener('touchend', this.onTouchEnd, false);
    this.domElement.removeEventListener('touchmove', this.onTouchMove, false);

    document.removeEventListener('mousemove', this.onMouseMove, false);
    document.removeEventListener('mouseup', this.onMouseUp, false);

    window.removeEventListener('keydown', this.onKeyDown, false);
    // this.dispatchEvent( { type: 'dispose' } ); // should this be added here?
  }

  getPolarAngle() {
    return this.spherical.phi;
  }

  getAzimuthalAngle() {
    return this.spherical.theta;
  }

  saveState() {
    this.target0.copy(this.target);
    this.position0.copy(this.camera.position);
    this.zoom0 = this.camera.zoom;
  }

  reset() {
    this.target.copy(this.target0);
    this.camera.position.copy(this.position0);
    this.camera.zoom = this.zoom0;

    this.camera.updateProjectionMatrix();
    this.dispatchEvent(this.changeEvent);

    this.update();

    this.state = STATE.NONE;
  }

  // this method is exposed, but perhaps it would be better if we can make it private...
  update(dispatchChangeEvent = true) {
    const position = this.camera.position;

    __offset.copy(position).sub(this.target);

    // rotate offset to "y-axis-is-up" space
    __offset.applyQuaternion(this.quat);

    // angle from z-axis around y-axis
    this.spherical.setFromVector3(__offset);

    if (this.autoRotate && this.state === STATE.NONE) {
      this.rotateLeft(this.getAutoRotationAngle());
    }

    if (this.enableDamping) {
      this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
      this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;
    } else {
      this.spherical.theta += this.sphericalDelta.theta;
      this.spherical.phi += this.sphericalDelta.phi;
    }

    // restrict theta to be between desired limits
    let min = this.minAzimuthAngle;
    let max = this.maxAzimuthAngle;
    if (isFinite(min) && isFinite(max)) {
      if (min < - Math.PI) min += __twoPI; else if (min > Math.PI) min -= __twoPI;
      if (max < - Math.PI) max += __twoPI; else if (max > Math.PI) max -= __twoPI;
      if (min < max) {
        this.spherical.theta = Math.max(min, Math.min(max, this.spherical.theta));
      } else {
        this.spherical.theta = (this.spherical.theta > (min + max) / 2) ?
          Math.max(min, this.spherical.theta) :
          Math.min(max, this.spherical.theta);
      }
    }

    // restrict phi to be between desired limits
    this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
    this.spherical.makeSafe();
    this.spherical.radius *= this.scale;

    // restrict radius to be between desired limits
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

    // move target to panned location
    if (this.enableDamping) {
      this.target.addScaledVector(this.panOffset, this.dampingFactor);
    } else {
      this.target.add(this.panOffset);
    }

    __offset.setFromSpherical(this.spherical);

    // rotate offset back to "camera-up-vector-is-up" space
    __offset.applyQuaternion(this.quatInverse);

    position.copy(this.target).add(__offset);

    this.camera.lookAt(this.target);

    if (this.enableDamping) {
      this.sphericalDelta.theta *= (1 - this.dampingFactor);
      this.sphericalDelta.phi *= (1 - this.dampingFactor);
      this.panOffset.multiplyScalar(1 - this.dampingFactor);

    } else {
      this.sphericalDelta.set(0, 0, 0);
      this.panOffset.set(0, 0, 0);
    }

    this.scale = 1;

    // update condition is:
    // min(camera displacement, camera rotation in radians)^2 > EPS
    // using small-angle approximation cos(x/2) = 1 - x^2 / 8
    if (this.zoomChanged ||
      this.lastPos.distanceToSquared(this.camera.position) > this.EPS ||
      8 * (1 - this.lastQuat.dot(this.camera.quaternion)) > this.EPS) {

      if (dispatchChangeEvent) this.dispatchEvent(this.changeEvent);

      this.lastPos.copy(this.camera.position);
      this.lastQuat.copy(this.camera.quaternion);
      this.zoomChanged = false;
      this.zoomFactor = 1;

      return true;
    }

    return false;
  }

  setViewDirection(viewDir, viewPlanesUp) {
    const errEPS = 1.e-16;
    const viewDirection = __unitZ.clone().negate();
    const upDirection = __unitY.clone();
    if (viewDir && viewDir.isVector3) {
      viewDirection.copy(viewDir);
      viewDirection.normalize();
      if (viewDirection.lengthSq() < errEPS) return;
    }

    viewDirection.negate();

    // set the view plane's up direction if it needs to be set
    if (viewPlanesUp && viewPlanesUp.isVector3) upDirection.copy(viewPlanesUp);
    const dotZ = viewDirection.dot(__unitZ);
    const dotY = upDirection.dot(__unitY);
    if ((dotZ < 0 && dotY >= 0) || (dotZ >= 0 && dotY < 0)) upDirection.negate();

    upDirection.projectOnPlane(viewDirection);
    upDirection.normalize();
    if (upDirection.lengthSq() < errEPS) {
      // define the vector perpendicular to viewDirection
      if (Math.abs(viewDirection.y) > errEPS) upDirection.set(1, -(viewDirection.x + viewDirection.z), 1);
      else if (Math.abs(viewDirection.x) > errEPS) upDirection.set(-(viewDirection.y + viewDirection.z), 1, 1);
      else upDirection.set(1, 1, -(viewDirection.x + viewDirection.y));
      upDirection.normalize();
    }

    // Calculates the angles to rotate camera from the current view to the target view
    // camera.up is the orbit axis
    viewDirection.applyQuaternion(this.quat);
    const sphViewDir = new Spherical();
    sphViewDir.setFromVector3(viewDirection);

    this.sphericalDelta.theta = sphViewDir.theta - this.spherical.theta;
    this.sphericalDelta.phi = sphViewDir.phi - this.spherical.phi;

    // update the camera view
    this.update();
    const camera = this.camera;
    camera.updateMatrixWorld();

    // get the orbit control's up direction
    const orbitUpDir = new Vector3();
    orbitUpDir.setFromMatrixColumn(camera.matrixWorld, 1);

    // calculate the angle between target up vector and orbit control's up vector
    const angleV = upDirection.angleTo(orbitUpDir) * MathUtils.RAD2DEG;
    if (Math.abs(angleV) > 1) {
      orbitUpDir.applyQuaternion(this.quat);
      sphViewDir.setFromVector3(orbitUpDir);

      upDirection.applyQuaternion(this.quat);
      const sphViewDirUp = new Spherical();
      sphViewDirUp.setFromVector3(upDirection);

      this.sphericalDelta.phi = sphViewDirUp.phi - sphViewDir.phi;
      this.sphericalDelta.theta = sphViewDirUp.theta - sphViewDir.theta;

      // restrict phi to be between desired limits
      const sumPhi = this.spherical.phi + this.sphericalDelta.phi;
      const angleDiff = sumPhi > Math.PI ? (sumPhi - Math.PI) * MathUtils.RAD2DEG : 
                        sumPhi < 0 ? - sumPhi * MathUtils.RAD2DEG : 0;
      if (angleDiff <= 1) {
        // // rotate 'viewDirection' back to "camera-up-vector-is-up" space
        // viewDirection.applyQuaternion(this.quatInverse);

        // // create the camera's new matrix world
        // const crossProd = new Vector3();
        // crossProd.crossVectors(upDirection, viewDirection);
        // crossProd.normalize();
        // const newMatrixWorld = new Matrix4();
        // newMatrixWorld.makeBasis(crossProd, upDirection, viewDirection);

        // // set the camera's new quaternion
        // camera.quaternion.setFromRotationMatrix(newMatrixWorld);
        // camera.updateMatrixWorld();

        this.update();

      } else {
        this.sphericalDelta.phi = 0;
        this.sphericalDelta.theta = 0;
      }
    }
  }

  getAutoRotationAngle() {
    return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
  }

  getZoomScale() {
    return Math.pow(0.95, this.zoomSpeed);
  }

  rotateLeft(angle) {
    this.sphericalDelta.theta -= angle;
  }

  rotateUp(angle) {
    this.sphericalDelta.phi -= angle;
  }

  panLeft(distance, objectMatrix) {
    _v_pan.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
    _v_pan.multiplyScalar(- distance);

    this.panOffset.add(_v_pan);
  }

  panUp(distance, objectMatrix) {
    if (this.screenSpacePanning === true) {
      _v_pan.setFromMatrixColumn(objectMatrix, 1);
    } else {
      _v_pan.setFromMatrixColumn(objectMatrix, 0);
      _v_pan.cross_v_panectors(this.camera.up, _v_pan);
    }

    _v_pan.multiplyScalar(distance);
    this.panOffset.add(_v_pan);
  }

  // deltaX and deltaY are in pixels; right and down are positive
  pan(deltaX, deltaY) {
    const offset = new Vector3();
    const element = this._glCanvas;

    if (this.camera.isPerspectiveCamera) {
      // perspective
      const position = this.camera.position;
      offset.copy(position).sub(this.target);
      let targetDistance = offset.length();

      // half of the fov is center to top of screen
      targetDistance *= Math.tan((this.camera.fov / 2) * Math.PI / 180.0);

      // we use only clientHeight here so aspect ratio does not distort speed
      this.panLeft(2 * deltaX * targetDistance / element.clientHeight, this.camera.matrix);
      this.panUp(2 * deltaY * targetDistance / element.clientHeight, this.camera.matrix);

    } else if (this.camera.isOrthographicCamera) {
      // orthographic
      this.panLeft(deltaX * (this.camera.right - this.camera.left) / this.camera.zoom / element.clientWidth, this.camera.matrix);
      this.panUp(deltaY * (this.camera.top - this.camera.bottom) / this.camera.zoom / element.clientHeight, this.camera.matrix);
    } else {
      // camera neither orthographic nor perspective
      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
      this.enablePan = false;
    }
  }

  dollyIn(dollyScale) {
    if (this.camera.isPerspectiveCamera) {
      this.scale /= dollyScale;
    } else if (this.camera.isOrthographicCamera) {
      this.zoomFactor = this.camera.zoom;
      this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.camera.zoom * dollyScale));
      this.zoomFactor /= this.camera.zoom;
      this.camera.updateProjectionMatrix();
      this.zoomChanged = true;
    } else {
      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
      this.enableZoom = false;
    }
  }

  dollyOut(dollyScale) {
    if (this.camera.isPerspectiveCamera) {
      this.scale *= dollyScale;
    } else if (this.camera.isOrthographicCamera) {
      this.zoomFactor = this.camera.zoom;
      this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.camera.zoom / dollyScale));
      this.zoomFactor /= this.camera.zoom;
      this.camera.updateProjectionMatrix();
      this.zoomChanged = true;
    } else {
      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
      this.enableZoom = false;
    }
  }


  // ----------------------------------------------
  // event callbacks - update the object state
  // ----------------------------------------------

  handleMouseDownRotate(event) {
    // console.log( 'handleMouseDownRotate' );
    this.rotateStart.set(event.clientX, event.clientY);
  }

  handleMouseDownDolly(event) {
    // console.log( 'handleMouseDownDolly' );
    this.dollyStart.set(event.clientX, event.clientY);
  }

  handleMouseDownPan(event) {
    // console.log( 'handleMouseDownPan' );
    this.panStart.set(event.clientX, event.clientY);
  }

  handleMouseMoveRotate(event) {
    // console.log( 'handleMouseMoveRotate' );
    this.rotateEnd.set(event.clientX, event.clientY);

    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);

    const element = this._glCanvas;

    this.rotateLeft(2 * Math.PI * this.rotateDelta.x / element.clientHeight); // yes, height

    this.rotateUp(2 * Math.PI * this.rotateDelta.y / element.clientHeight);

    this.rotateStart.copy(this.rotateEnd);

    this.update(false);

    this.camera.updateMatrixWorld();
    this.glScene.handleControlsRotate(event);
    this.dispatchEvent(this.changeEvent);
  }

  handleMouseMoveDolly(event) {
    // console.log( 'handleMouseMoveDolly' );
    this.dollyEnd.set(event.clientX, event.clientY);

    this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

    if (this.dollyDelta.y > 0) {
      this.dollyIn(this.getZoomScale());
    } else if (this.dollyDelta.y < 0) {
      this.dollyOut(this.getZoomScale());
    }

    this.dollyStart.copy(this.dollyEnd);

    this.glScene.handleControlsZoom(event);

    this.update();
  }

  handleMouseMovePan(event) {
    // console.log( 'handleMouseMovePan' );
    this.panEnd.set(event.clientX, event.clientY);

    this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);

    this.pan(this.panDelta.x, this.panDelta.y);

    this.panStart.copy(this.panEnd);

    this.update(false);

    this.camera.updateMatrixWorld();
    this.glScene.handleControlsPanMove(event);
    this.dispatchEvent(this.changeEvent);
  }

  handleMouseUp(event) {
    // console.log( 'handleMouseUp' );

    if (this._downValid) {
      const downTime = event.timeStamp - this._downEvents[this._downEvents.length - 1].timeStamp;
      if (downTime <= this._maxDownTime) {
        if (this._nclicks == 0) {
          //first valid click detected
          this._nclicks = 1;
          this._clickStart = performance.now();

        } else {
          const clickInterval = event.timeStamp - this._clickStart;
          const movement = this.calculatePointersDistance(this._downEvents[1], this._downEvents[0]) * this._devPxRatio;

          if (clickInterval <= this._maxInterval && movement <= this._posThreshold) {
            //second valid click detected
            //fire double tap and reset values
            this._nclicks = 0;
            this._downEvents.splice(0, this._downEvents.length);
            this.onDoubleTap(event);

          } else {
            //new 'first click'
            this._nclicks = 1;
            this._downEvents.shift();
            this._clickStart = performance.now();
          }
        }
      } else {
        this._downValid = false;
        this._nclicks = 0;
        this._downEvents.splice(0, this._downEvents.length);
      }
    } else {
      this._nclicks = 0;
      this._downEvents.splice(0, this._downEvents.length);
    }

    if (this.state === STATE.PAN) {
      this.glScene.handleControlsPanEnd();
      this.glScene.renderHelperScene();
    }
  }

  handleMouseWheel(event) {
    if (this.sceneSettings.invertMouse) {
      if (event.deltaY > 0) {
        this.dollyIn(this.getZoomScale());
      } else if (event.deltaY < 0) {
        this.dollyOut(this.getZoomScale());
      }
    } else {
      if (event.deltaY < 0) {
        this.dollyIn(this.getZoomScale());
      } else if (event.deltaY > 0) {
        this.dollyOut(this.getZoomScale());
      }
    }

    // suport zoomToCursor (mouse only)
    if (this.zoomToCursor) {
      const rect = this._glCanvas.getBoundingClientRect();
      this.mouseNorm.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNorm.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

      // convert the normalized position to CSS coordinates
      this.panStart.set(
          (this.mouseNorm.x * .5 + .5) * rect.width,
          (this.mouseNorm.y * -.5 + .5) * rect.height
      );

      this.mouseNorm.multiplyScalar(this.zoomFactor);
      this.panEnd.set(
          (this.mouseNorm.x * .5 + .5) * rect.width,
          (this.mouseNorm.y * -.5 + .5) * rect.height
      );

      this.panDelta.subVectors(this.panEnd, this.panStart);
      this.panDelta.multiplyScalar(this.panSpeed / this.zoomFactor);
      this.pan(this.panDelta.x, this.panDelta.y);
    }

    this.update(!this.zoomToCursor);

    if (this.zoomToCursor) {
      this.camera.updateMatrixWorld();
      this.glScene.handleControlsZoomAndPan(event);
      this.dispatchEvent(this.changeEvent);
    }
  }

  handleKeyDown(event) {
    // console.log( 'handleKeyDown' );

    switch (event.keyCode) {
      case this.keys.UP:
        this.pan(0, this.keyPanSpeed);
        this.update();
        break;

      case this.keys.BOTTOM:
        this.pan(0, - this.keyPanSpeed);
        this.update();
        break;

      case this.keys.LEFT:
        this.pan(this.keyPanSpeed, 0);
        this.update();
        break;

      case this.keys.RIGHT:
        this.pan(- this.keyPanSpeed, 0);
        this.update();
        break;
    }
  }

  handleTouchStartRotate(event) {
    // console.log( 'handleTouchStartRotate' );
    this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
  }

  handleTouchStartDollyPan(event) {
    // console.log( 'handleTouchStartDollyPan' );
    if (this.enableZoom) {
      const dx = event.touches[0].pageX - event.touches[1].pageX;
      const dy = event.touches[0].pageY - event.touches[1].pageY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      this.dollyStart.set(0, distance);
    }

    if (this.enablePan) {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
      this.panStart.set(x, y);
    }
  }

  handleTouchMoveRotate(event) {
    // console.log( 'handleTouchMoveRotate' );
    this.rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);

    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);

    const element = this._glCanvas;

    this.rotateLeft(2 * Math.PI * this.rotateDelta.x / element.clientHeight); // yes, height

    this.rotateUp(2 * Math.PI * this.rotateDelta.y / element.clientHeight);

    this.rotateStart.copy(this.rotateEnd);

    this.update(false);

    this.camera.updateMatrixWorld();
    this.glScene.handleControlsRotate(event);
    this.dispatchEvent(this.changeEvent);
  }

  handleTouchMoveDollyPan(event) {
    // console.log( 'handleTouchMoveDollyPan' );
    if (this.enableZoom) {
      const dx = event.touches[0].pageX - event.touches[1].pageX;
      const dy = event.touches[0].pageY - event.touches[1].pageY;

      const distance = Math.sqrt(dx * dx + dy * dy);

      this.dollyEnd.set(0, distance);

      this.dollyDelta.set(0, Math.pow(this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed));

      this.dollyIn(this.dollyDelta.y);

      this.dollyStart.copy(this.dollyEnd);
    }

    if (this.enablePan) {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

      this.panEnd.set(x, y);

      this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);

      this.pan(this.panDelta.x, this.panDelta.y);

      this.panStart.copy(this.panEnd);
    }

    this.update(false);

    this.camera.updateMatrixWorld();
    this.glScene.handleControlsZoomAndPan(event);
    this.dispatchEvent(this.changeEvent);
  }

  handleTouchEnd(event) {
    // console.log( 'handleTouchEnd' );
  }

  onDoubleTap(event, hitPoint) {
    if (this.enabled && this.enableFocus && this.enablePan && this.glScene != null) {
      this.dispatchEvent(this.startEvent);

      this.setCenter(event.clientX, event.clientY);

      const pWU = this.glScene.getScenesPerWorldUnit()
      const raycaster = this.getRaycaster();
      raycaster.params.Line.threshold = 6 / pWU;
      raycaster.params.Points.threshold = 10 / pWU;

      let hitP = null;
      if (hitPoint && hitPoint.isVector3)
        hitP = hitPoint;
      else
        hitP = this.unprojectOnObj(this.getCursorNDC(_center.x, _center.y, this._glCanvas), this.camera);

      if (hitP != null && this.enableAnimations) {
        this._zoomTemp = this.camera.zoom;
        _targetTemp.copy(this.target);
        _cameraPosTemp.copy(this.camera.position);

        const self = this;
        if (this._animationId != - 1) {
          window.cancelAnimationFrame(this._animationId);
        }

        this._timeStart = - 1;
        this._animationId = window.requestAnimationFrame(function (t) {
          self.state = STATE.ANIMATION_FOCUS;
          self.onFocusAnim(t, hitP);
        });

      } else if (hitP != null && !this.enableAnimations) {
        this.state = STATE.FOCUS;
        this.focus(hitP, this.scaleFactor);
        this.glScene.handleControlsFocus();
        this.state = STATE.NONE;
        this.dispatchEvent(this.changeEvent);
      }
    }
    
    this.dispatchEvent(this.endEvent);
  }

  /**
   * Perform animation for focus operation
   * @param {Number} time Instant in which this function is called as performance.now()
   * @param {Vector3} point Point of interest for focus operation
   */
  onFocusAnim(time, point) {

    if (this._timeStart === - 1) {
      //animation start
      this._timeStart = time;
    }

    if (this.state === STATE.ANIMATION_FOCUS) {
      const deltaTime = time - this._timeStart;
      const animTime = deltaTime / this.focusAnimationTime;

      if (animTime >= 1) {
        //animation end
        this.focus(point, this.scaleFactor);
        this.glScene.handleControlsFocus();

        this._timeStart = - 1;
        this.state = STATE.NONE;
        this.dispatchEvent(this.changeEvent);
      } else {
        const amount = this.easeOutCubic(animTime);
        const size = ((1 - amount) + (this.scaleFactor * amount));
        this.focus(point, size, amount);
        this.dispatchEvent(this.changeEvent);
        const self = this;
        this._animationId = window.requestAnimationFrame(function (t) {
          self.onFocusAnim(t, point);
        });
      }
    } else {
      //interrupt animation
      this._animationId = - 1;
      this._timeStart = - 1;
    }

    this.glScene.handleControlsFocus();
  }

  /**
   * Compute the easing out cubic function for ease out effect in animation
   * @param {Number} t The absolute progress of the animation in the bound of 0 (beginning of the) and 1 (ending of animation)
   * @returns {Number} Result of easing out cubic at time t
   */
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  
  /**
   * Focus operation consist of positioning the point of interest in front of the camera and a slightly zoom in
   * @param {Vector3} point The point of interest
   * @param {Number} size Scale factor
   * @param {Number} amount Amount of operation to be completed (used for focus animations, default is complete full operation)
   */
  focus(point, size, amount = 1) {
    _offset.copy(point).sub(_targetTemp).multiplyScalar(amount);
    
    this.target.copy(_targetTemp).add(_offset);
    this.camera.position.copy(_cameraPosTemp).add(_offset);

    if (this.camera.isGlOrthographicCamera) {
      this.camera.focalPoint.copy(this.target);
    }

    if (this.enableZoom) {
      this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this._zoomTemp * size));
      this.camera.updateProjectionMatrix();
    }
  }

  calculatePointersDistance(p0, p1) {
    return Math.sqrt(Math.pow(p1.clientX - p0.clientX, 2) + Math.pow(p1.clientY - p0.clientY, 2));
  }

  getRaycaster() {
    return _Raycaster;
  }

  /**
   * Set _center's x/y coordinates
   * @param {Number} clientX
   * @param {Number} clientY
   */
  setCenter(clientX, clientY) {
    _center.x = clientX;
    _center.y = clientY;
  }

  /**
   * Calculate the cursor position in NDC
   * @param {number} x Cursor horizontal coordinate within the canvas
   * @param {number} y Cursor vertical coordinate within the canvas
   * @param {HTMLElement} canvas The canvas where the renderer draws its output
   * @returns {Vector2} Cursor normalized position inside the canvas
   */
  getCursorNDC(cursorX, cursorY, canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    _v2_1.setX(((cursorX - canvasRect.left) / canvasRect.width) * 2 - 1);
    _v2_1.setY(((canvasRect.bottom - cursorY) / canvasRect.height) * 2 - 1);
    return _v2_1;
  }

  /**
   * Unproject the cursor on the 3D object surface
   * @param {Vector2} cursor Cursor coordinates in NDC
   * @param {Camera} camera Virtual camera
   * @returns {Vector3} The point of intersection with the model, if exist, null otherwise
   */
  unprojectOnObj(cursor, camera) {
    const Raycaster = this.getRaycaster();
    Raycaster.near = camera.near;
    Raycaster.far = camera.far;
    Raycaster.setFromCamera(cursor, camera);

    const intersect = Raycaster.intersectObjects(this.glScene.objects, true);

    for (let i = 0; i < intersect.length; i++) {
      if (intersect[i].point != null) {
        return intersect[i].point.clone();
      }
    }

    return null;
  }

  // ---------------------------------------------------------
  // event handlers - FSM: listen for events and reset state
  // ---------------------------------------------------------

  onMouseDown(event) {
    if (this.enabled === false) return;

    // Prevent the browser from scrolling
    event.preventDefault();

    this.pointerDown = this.getCursorNDC(event.clientX, event.clientY, this._glCanvas);
    this._downStart = performance.now();

    if (event.button == 0) {
      this._downValid = true;
      this._downEvents.push(event);
    } else {
      this._downValid = false;
    }

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.
    this.domElement.focus ? this.domElement.focus() : window.focus();

    switch (event.button) {
      case this.mouseButtons.LEFT:
        if (this.enableRotate === false || this.enableRotateWithLeft === false) {
          return;
        }

        this.handleMouseDownRotate(event);

        this.state = STATE.ROTATE;
        break;
      case this.mouseButtons.RIGHT:
        if (this.enableRotate === false) {
          return;
        }

        this.handleMouseDownRotate(event);
        
        this.state = STATE.ROTATE;

        break;
        // if (this.enableZoom === false) {
        //   return;
        // }

        // this.handleMouseDownDolly(event);

        // this.state = STATE.DOLLY;
        // break;

      case this.mouseButtons.MIDDLE:
        if (event.metaKey) {
          if (this.enablePan === false) {
            return;
          }

          this.handleMouseDownPan(event);

          this.state = STATE.PAN;
        } else {
          if (this.enablePan === false) {
            return;
          }

          this.handleMouseDownPan(event);
          this.state = STATE.PAN;
        }
        break;

      default:
        this.state = STATE.NONE;
    }

    if (this.state !== STATE.NONE) {
      this.domElement.addEventListener('mousemove', this.onMouseMove, false);
      this.domElement.addEventListener('mouseup', this.onMouseUp, false);
      this.dispatchEvent(this.startEvent);
    }
  }

  onMouseMove(event) {
    if (this.enabled === false) {
      return;
    }

    event.preventDefault();

    switch (this.state) {
      case STATE.ROTATE:
        if (this.enableRotate === false) {
          return;
        }
        const cursorPos = this.getCursorNDC(event.clientX, event.clientY, this._glCanvas);
        const timeElapsed = performance.now() - this._downStart;
        if (timeElapsed < 120 && this.pointerDown.distanceTo(cursorPos) <= 0.05 && event.buttons !== 1) return;

        this.glScene.glWindow.style.cursor = 'grabbing';
        this.handleMouseMoveRotate(event);
        break;

      case STATE.DOLLY:
        if (this.enableZoom === false) {
          return;
        }

        this.handleMouseMoveDolly(event);
        break;

      case STATE.PAN:
        if (this.enablePan === false) {
          return;
        }

        this.glScene.glWindow.style.cursor = 'grabbing';
        this.handleMouseMovePan(event);
        break;
    }
  }

  onMouseUp(event) {
    if (this.enabled === false) {
      return;
    }
    
    this.glScene.glWindow.style.cursor = 'auto';
    this.handleMouseUp(event);

    this.domElement.removeEventListener('mousemove', this.onMouseMove, false);
    this.domElement.removeEventListener('mouseup', this.onMouseUp, false);

    this.dispatchEvent(this.endEvent);

    this.state = STATE.NONE;
  }

  onMouseWheel(event) {
    if (this.enabled === false || this.enableZoom === false ||
      (this.state !== STATE.NONE && this.state !== STATE.ROTATE)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.dispatchEvent(this.startEvent);

    this.handleMouseWheel(event);

    this.dispatchEvent(this.endEvent);
  }

  onKeyDown(event) {
    if (this.enabled === false || this.enableKeys === false ||
      this.enablePan === false) {
      return;
    }

    const pathLen = event.composedPath().length < 5 ? event.composedPath().length : 5;
    let skip = pathLen === 5;
    for (let i = 0; i < pathLen && skip; i++) {
      if (event.composedPath()[i].localName === "tg-gl-scene") skip = false;
    }
    if (!skip && event.target.parentElement.id === "dynamicInput") skip = true;
    if (skip) return;

    this.handleKeyDown(event);
  }

  onTouchStart(event) {
    if (this.enabled === false) {
      return;
    }

    event.preventDefault();

    switch (event.touches.length) {
      case 1: // one-fingered touch: rotate
        if (this.enableRotate === false || !this.enableTouchRotation) {
          return;
        }

        this.handleTouchStartRotate(event);

        this.state = STATE.TOUCH_ROTATE;
        break;

      case 2: // two-fingered touch: dolly-pan
        if (this.enableZoom === false && this.enablePan === false) {
          return;
        }

        this.handleTouchStartDollyPan(event);

        this.state = STATE.TOUCH_DOLLY_PAN;
        break;

      default:
        this.state = STATE.NONE;
    }

    if (this.state !== STATE.NONE) {
      this.dispatchEvent(this.startEvent);
    }

  }

  onTouchMove(event) {
    if (this.enabled === false) {
      return;
    }

    if (this.glScene.mouseClickMode !== GlClickMode.Edit &&
        this.glScene.mouseClickMode !==  GlClickMode.SelectArea) {
      event.preventDefault();
      event.stopPropagation();
    }

    switch (event.touches.length) {
      case 1: // one-fingered touch: rotate
        if (this.enableRotate === false) return;
        if (this.state !== STATE.TOUCH_ROTATE) return; // is this needed?

        this.handleTouchMoveRotate(event);
        break;

      case 2: // two-fingered touch: dolly-pan
        if (this.enableZoom === false && this.enablePan === false) return;
        if (this.state !== STATE.TOUCH_DOLLY_PAN) return; // is this needed?

        this.handleTouchMoveDollyPan(event);
        break;

      default:
        this.state = STATE.NONE;
    }
  }

  onTouchEnd(event) {
    if (this.enabled === false) return;

    this.handleTouchEnd(event);

    this.dispatchEvent(this.endEvent);
    this.state = STATE.NONE;
  }

  onContextMenu(event) {
    if (this.enabled === false) return;
    event.preventDefault();
  }

}
