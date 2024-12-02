import { GlTransformControls } from "./gl-transform-control";
import { GlTransformControlMode, GlSnapMode } from './gl-constants';
import { GlEvents } from './gl-events';
import { CmdMulti, CmdSetPosition, CmdSetRotation, CmdSetScale } from '../commands/gl-commands';
import { GlMultiScene } from '@tangens/gl-components/controls/gl-multi-scene';
import {
  EventDispatcher,
  Vector3,
  MathUtils,
  Quaternion,
  Object3D,
  Euler,
  Raycaster,
} from 'three';
import { Tool_Types, GlDynamicInput } from "./gl-constants";
import { GlGroup } from './gl-group';
import { GlUtils } from "../utils/gl-utils";

export class GlTransformControlsHandler extends EventDispatcher {
  constructor(glScene) {
    super();
    this.glScene = glScene;
    this._context = glScene.context;

    this.type = Tool_Types.GlTransformControlsHandler;
    this.isGlTransformControlsHandler = true;

    this.freezeAttach = false;

    this._object = new GlGroup("TransformControl.Object");
    Object.defineProperty(this._object, "snapObjects", {
      set(snap) {
        this.snappable = snap;
        for (let c = 0; c < this.children.length; c++) {
          const child = this.children[c];
          if (snap) {
            child.snappable = child.prevSnapM;
            if (child.pivotPoint) child.pivotPoint.snappable = child.snappable;
            delete child.prevSnapM;
          } else {
            child.prevSnapM = child.snappable;
            child.snappable = snap;
            if (child.pivotPoint) child.pivotPoint.snappable = child.snappable;
          }
        }
      },
      get () { return this.snappable }
    });

    // all referenced objects are in scene
    // this glgroup object used to handle their transformation
    // no need to be visible
    this._object.visible = false;

    // set raycaster parameters
    this._raycaster = new Raycaster();

    this._object.updateMatrixWorld = (force) => {
      const object = this._object;
      const mode = this._transformControls?.mode;
      if (!object.children.length) return;

      if (object.objectPositionDiff && mode === "translate") {
        for (let i = 0; i < object.children.length; i++) {
          object.children[i].setPivotOffset(object.position);

          const offsetPos = object.objectPositionDiff.clone().sub(object.objectPositionDiffPrev);
          object.children[i].position.add(offsetPos);
        }
        object.objectPositionDiffPrev = object.objectPositionDiff.clone();
      } else if (object.objectRotationDiff && mode === "rotate") {
        for (let i = 0; i < object.children.length; i++) {
          object.children[i].setPivotOffset(object.position);

          const offsetRot = object.objectRotationDiff.clone().sub(object.objectRotationDiffPrev);
          object.children[i].rotation.x += offsetRot.x;
          object.children[i].rotation.y += offsetRot.y;
          object.children[i].rotation.z += offsetRot.z;
        }
        object.objectRotationDiffPrev = object.objectRotationDiff.clone();
      } else if (object.objectScaleDiff && mode === "scale") {
        for (let i = 0; i < object.children.length; i++) {
          object.children[i].setPivotOffset(object.position);

          const offsetScale = object.objectScaleDiff.clone().sub(object.objectScaleDiffPrev);
          object.children[i].scale.add(offsetScale);
        }
        object.objectScaleDiffPrev = object.objectScaleDiff.clone();
      }

      Object3D.prototype.updateMatrixWorld.call(object, force);
    };

    this.transformChangeHandler = (e) => this.onTransformChange(e);
    this.scaleChangeHandler = (e) => this.onScaleChange(e);
    this.rotateChangeHandler = (e) => this.onRotateChange(e);

    this.transformMouseDownHandler = (e) => this.onTransformMouseDown(e);
    this.transformMouseUpHandler = (e) => this.onTransformMouseUp(e);
    this.transformKeyUpHandler = (e) => this.onTransformKeyUp(e);
  }

  get control() {
    return this._transformControls;
  }

  // transform controls
  getTransformControls() {
    return this._transformControls;
  }

  attach(objects, child) {
    if (this.freezeAttach) return;
    if (!objects) return;
    if (!Array.isArray(objects)) objects = [objects];

    if (this._transformControls) {
      const pivotPoint = this._object.position.clone();
      pivotPoint.multiplyScalar(this._object.children.length);

      for (let i = 0; i < objects.length; i++) {
        const found = this._object.children.findIndex((item) => item.uuid === objects[i].uuid);
        if (found == -1) {
          this._object.addChild(objects[i], { keepParent: true });
          pivotPoint.add(objects[i].getPivotPosition(true));
        }
      }

      pivotPoint.divideScalar(this._object.children.length);
      const cmd = new CmdSetPosition(this._object, pivotPoint);

      if (!this._transformControls.object) this._transformControls.attach(this._object);

      if (objects.length === 1) {
        // if one object is attached show as localy
        this._object.rotation.copy(objects[0].rotation);
      }

      cmd.updatable = false;
      this._context.execute(cmd, "attach", "prev");
    }
  }

  detach(objects) {
    if (this.freezeAttach) return;
    if (objects && !Array.isArray(objects)) objects = [objects];

    const cmdArr = [];
    if (this._transformControls) {
      if (objects && objects.length) {
        const pivotPoint = this._object.position.clone();
        pivotPoint.multiplyScalar(this._object.children.length);

        for (let i = 0; i < objects.length; i++) {
          const pivotPos = objects[i].getPivotPosition(true);
          this._object.removeChild(objects[i]);
          objects[i].setPivotPoint(pivotPos);
          objects[i].updateMatrixWorld(true);
          pivotPoint.sub(pivotPos);
        }

        pivotPoint.divideScalar(this._object.children.length);
        const cmd = new CmdSetPosition(this._object, pivotPoint);
        cmd.updatable = false;
        this._context.execute(cmd, "detachObject", "prev");
      } else if (this._object.children.length) {
        this._object.children.forEach(ch => {
          const pivotPos = ch.getPivotPosition(true);
          ch.setPivotPoint(pivotPos);
          ch.updateMatrixWorld(true);
        });
        this._object.children.length = 0;
        this._transformControls.detach();

        this._object.rotation.copy(new Euler());
        this._object.scale.copy(new Vector3(1, 1, 1));
        const cmd = new CmdSetPosition(this._object, new Vector3(0, 0, 0));

        cmd.updatable = false;
        this._context.execute(cmd, "detachAll", "prev");
        this.glScene.drawDynamicInput('over')
      }
    }
  }

  isActive() {
    return (this._transformControls) ? true : false;
  }

  isInAction() {
    return (this._transformControls) ? this._transformControls.dragging || this._transformControls.axis : false;
  }

  enableTransformControls(mode) {
    if (!this._transformControls) {
      this._transformControls = new GlTransformControls(this.glScene, this.glScene.glWindow);
      this._transformControls.addEventListener('mouseDown', this.transformMouseDownHandler);
      this._transformControls.addEventListener('mouseUp', this.transformMouseUpHandler);
      this._transformControls.addEventListener('keyUp', this.transformKeyUpHandler);
      if (mode === GlTransformControlMode.Rotate) {
        this._transformControls.addEventListener(GlEvents.controlChange, this.rotateChangeHandler);
        this._transformControls.mode = "rotate";
      } else if (mode === GlTransformControlMode.Scale) {
        this._transformControls.addEventListener(GlEvents.controlChange, this.scaleChangeHandler);
        this._transformControls.mode = "scale";
      } else {
        this._transformControls.addEventListener(GlEvents.controlChange, this.transformChangeHandler);
        this._transformControls.mode = "translate";
      }
      this.glScene.setDynamicInput(GlDynamicInput.Transform);
      this._context.sceneHelpers.add(this._transformControls);
      this._context.sceneHelpers.add(this._object);
      this._context.notifyToolActivated(this);
    }
  }

  disableTransformControls() {
    if (this._transformControls) {
      this._transformControls.removeEventListener(GlEvents.controlChange, this.transformChangeHandler);
      this._transformControls.removeEventListener('mouseDown', this.transformMouseDownHandler);
      this._transformControls.removeEventListener('mouseUp', this.transformMouseUpHandler);
      this._transformControls.removeEventListener('keyUp', this.transformKeyUpHandler);

      this._context.sceneHelpers.remove(this._transformControls);
      this._context.sceneHelpers.remove(this._object);

      this.detach();
      this._transformControls.dispose();
      this._transformControls = null;

      // set to prev mode
      const dynInput = this.glScene.dynamicInput;
      dynInput.label = '';
      dynInput.showTriple = true;
      this.glScene.drawDynamicInput('over');
      this.glScene.resetDynamicInput(GlDynamicInput.Transform);

      this._context.notifyToolDeactivated(this);
    }
  }

  onTransformChange(event) {
    const mouseEvent = event.mouseEvent;
    const sceneRect = event.sceneRect;
    const object = this._object;
    if (mouseEvent && object && this.objectPositionDiff) {
      const objectPos = object.getPivotPosition(true);
      this.objectPositionDiff.copy(objectPos).sub(this.objectPositionOnDown);

      object.objectPositionDiff = (this.objectPositionDiff.length() !== 0) ? this.objectPositionDiff : undefined;

      const dynInput = this.glScene.dynamicInput;
      dynInput.mouse.set(mouseEvent.x + 10, mouseEvent.y + 10);
      if (sceneRect) dynInput.sceneRect.set(sceneRect.x, sceneRect.y);

      const axis = event.target.axis;
      const dragging = event.target.dragging;
      if (dragging && axis) {
        // skip raycasting for the attached object
        // object.selectable = false;

        dynInput.showTriple = true;

        if (this.glScene.snapMode && this.glScene.markPoint.visible) {
          this.objectPositionDiff.copy(this.glScene.markPoint.position).sub(this.objectPositionOnDown);
        }

        // round the values up to 3 decimal digits
        const X = Math.round((this.objectPositionDiff.x + Number.EPSILON) * 1000) / 1000;
        const Y = Math.round((this.objectPositionDiff.y + Number.EPSILON) * 1000) / 1000;
        const Z = Math.round((this.objectPositionDiff.z + Number.EPSILON) * 1000) / 1000;

        this.glScene.mouseCoord[0] = Math.round((objectPos.x + Number.EPSILON) * 1000) / 1000;
        this.glScene.mouseCoord[1] = Math.round((objectPos.y + Number.EPSILON) * 1000) / 1000;
        this.glScene.mouseCoord[2] = Math.round((objectPos.z + Number.EPSILON) * 1000) / 1000;

        this.lineLength = Math.round((this.objectPositionDiff.length() + Number.EPSILON) * 1000) / 1000;
        this.segmentLength = this.lineLength;

        if (axis.length > 2) {
          dynInput.first = X;
          dynInput.second = Y;
          dynInput.third = Z;
          dynInput.label = 'X,Y,Z:';

        } else if (axis.length > 1) {
          dynInput.showCouple = true;
          dynInput.first = X;
          dynInput.second = Y;
          dynInput.label = 'X,Y:';

          if (axis === 'XZ') {
            dynInput.label = 'X,Z:';
            dynInput.second = Z;
          }
          else if (axis === 'YZ') {
            dynInput.label = 'Y,Z:';
            dynInput.first = Y;
            dynInput.second = Z;
          }

        } else {
          dynInput.showSingle = true;
          dynInput.first = X;
          dynInput.label = 'X:';
          if (axis === 'Y') {
            dynInput.first = Y;
            dynInput.label = 'Y:';
          }
          else if (axis === 'Z') {
            dynInput.first = Z;
            dynInput.label = 'Z:';
          }
        }

        this.glScene.drawDynamicInput('start');
        this.glScene.updateStatusBar();
      }
    }

    this.glScene.renderGl();
  }

  onRotateChange(event) {
    const mouseEvent = event.mouseEvent;
    const sceneRect = event.sceneRect;
    const object = this._object;
    if (mouseEvent && object && this.objectRotationDiff) {
      const rotation = new Vector3(object.rotation.x, object.rotation.y, object.rotation.z);
      this.objectRotationDiff.copy(rotation).sub(this.objectRotationOnDown);

      object.objectRotationDiff = (this.objectRotationDiff.lengthSq() > 0) ? this.objectRotationDiff : undefined;

      const dynInput = this.glScene.dynamicInput;
      dynInput.mouse.set(mouseEvent.x + 10, mouseEvent.y + 10);
      if (sceneRect) dynInput.sceneRect.set(sceneRect.x, sceneRect.y);

      const axis = event.target.axis;
      const dragging = event.target.dragging;
      if (dragging && axis) {
        // skip raycasting for the attached object
        // object.selectable = false;

        // round the values up to 3 decimal digits
        const angle = Math.round((object.rotationAngle + Number.EPSILON) * 1000) / 1000;
        this.glScene.mouseCoord[0] = Math.round((object.position.x + Number.EPSILON) * 1000) / 1000;
        this.glScene.mouseCoord[1] = Math.round((object.position.y + Number.EPSILON) * 1000) / 1000;
        this.glScene.mouseCoord[2] = Math.round((object.position.z + Number.EPSILON) * 1000) / 1000;

        this.lineLength = 0;
        this.segmentLength = this.lineLength;

        dynInput.showSingle = true;
        dynInput.first = (angle * 180 / Math.PI).toFixed(2);
        if (axis === 'X') {
          dynInput.label = this._context.stringResources.aroundX;
        } else if (axis === 'Y') {
          dynInput.label = this._context.stringResources.aroundY;
        } else if (axis === 'Z') {
          dynInput.label = this._context.stringResources.aroundZ;
        } else if (axis === 'E') {
          dynInput.label = this._context.stringResources.aroundCamera;
        }
        if (axis === 'XYZE') {
          this.glScene.drawDynamicInput('over');
        } else {
          this.glScene.drawDynamicInput('start');
        }

        this.glScene.updateStatusBar();
      }
    }
    this.glScene.renderGl();
  }

  onScaleChange(event) {
    const mouseEvent = event.mouseEvent;
    const sceneRect = event.sceneRect;
    const object = this._object;
    if (mouseEvent && object && this.objectScaleDiff) {
      const scale = new Vector3(object.scale.x, object.scale.y, object.scale.z);
      this.objectScaleDiff.copy(scale).sub(this.objectScaleOnDown);

      object.objectScaleDiff = (this.objectScaleDiff.length() !== 0) ? this.objectScaleDiff : undefined;

      const dynInput = this.glScene.dynamicInput;
      dynInput.mouse.set(mouseEvent.x + 10, mouseEvent.y + 10);
      if (sceneRect) dynInput.sceneRect.set(sceneRect.x, sceneRect.y);

      const axis = event.target.axis;
      const dragging = event.target.dragging;
      if (dragging && axis) {
        // skip raycasting for the attached object
        // object.selectable = false;

        dynInput.showTriple = true;

        // round the values up to 3 decimal digits
        const X = Math.round((object.scale.x + Number.EPSILON) * 1000) / 1000;
        const Y = Math.round((object.scale.y + Number.EPSILON) * 1000) / 1000;
        const Z = Math.round((object.scale.z + Number.EPSILON) * 1000) / 1000;

        this.glScene.mouseCoord[0] = Math.round((object.position.x + Number.EPSILON) * 1000) / 1000;
        this.glScene.mouseCoord[1] = Math.round((object.position.y + Number.EPSILON) * 1000) / 1000;
        this.glScene.mouseCoord[2] = Math.round((object.position.z + Number.EPSILON) * 1000) / 1000;
        this.lineLength = Math.round((object.scale.length() + Number.EPSILON) * 1000) / 1000;
        this.segmentLength = this.lineLength;

        if (axis.length > 2) {
          dynInput.first = X;
          dynInput.second = Y;
          dynInput.third = Z;
          dynInput.label = 'X,Y,Z:';

        } else if (axis.length > 1) {
          dynInput.showCouple = true;
          dynInput.first = X;
          dynInput.second = Y;
          dynInput.label = 'X,Y:';

          if (axis === 'XZ') {
            dynInput.label = 'X,Z:';
            dynInput.second = Z;
          }
          else if (axis === 'YZ') {
            dynInput.label = 'Y,Z:';
            dynInput.first = Y;
            dynInput.second = Z;
          }

        } else {
          dynInput.showSingle = true;
          dynInput.first = X;
          dynInput.label = 'X:';
          if (axis === 'Y') {
            dynInput.first = Y;
            dynInput.label = 'Y:';
          }
          else if (axis === 'Z') {
            dynInput.first = Z;
            dynInput.label = 'Z:';
          }
        }

        this.glScene.drawDynamicInput('start');
        this.glScene.updateStatusBar();
      }
    }

    this.glScene.renderGl();
  }

  onTransformMouseDown(event) {
    const object = this._object;
    const objectPos = object.getPivotPosition(true);

    this.objectPositionOnDown = new Vector3(objectPos.x, objectPos.y, objectPos.z);
    this.objectRotationOnDown = new Vector3(object.rotation.x, object.rotation.y, object.rotation.z);
    this.objectScaleOnDown = new Vector3(object.scale.x, object.scale.y, object.scale.z);

    switch (this._transformControls.mode) {
      case 'translate':
        object.snapObjects = false;
        object.objectPositionDiffPrev = new Vector3(0, 0, 0);
        this.objectPositionDiff = new Vector3(objectPos.x, objectPos.y, objectPos.z);
        break;
      case 'rotate':
        object.snapObjects = false;
        object.objectRotationDiffPrev = new Vector3(0, 0, 0);
        this.objectRotationDiff = new Vector3(object.rotation.x, object.rotation.y, object.rotation.z);
        break;
      case 'scale':
        object.snapObjects = false;
        object.objectScaleDiffPrev = new Vector3(0, 0, 0);
        this.objectScaleDiff = new Vector3(object.scale.x, object.scale.y, object.scale.z);
        break;
    }

    this.glScene.mouseCoord[0] = Math.round((this.objectPositionOnDown.x + Number.EPSILON) * 1000) / 1000;
    this.glScene.mouseCoord[1] = Math.round((this.objectPositionOnDown.y + Number.EPSILON) * 1000) / 1000;
    this.glScene.mouseCoord[2] = Math.round((this.objectPositionOnDown.z + Number.EPSILON) * 1000) / 1000;

    this.glScene.lineLength = 0;
    this.glScene.segmentLength = 0;
    this.glScene.segmentAngle = 0;

    this.glScene.showStatusBar(true);
    this.glScene.updateStatusBar();

    this.glScene._sceneControl.enabled = false;
  }

  onTransformMouseUp(event) {
    const context = this.glScene.context;
    const object = this._object;
    const objectPos = object.getPivotPosition(true);
    // object.selectable = true;

    if (!GlUtils.isEmpty(object)) {
      switch (event.mode) {
        case 'translate':
          if (!this.objectPositionOnDown.equals(objectPos)) {
            const snapModeActive = this.glScene.snapMode !== GlSnapMode.None && this.glScene.snappedObject;
            if (snapModeActive) {
              const pos = this.glScene.markPoint.position.clone();
              if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
                object.position.copy(pos);
                if (object.pivotOffset) {
                  object.position.add(object.pivotOffset.clone().negate());
                }
                this.onTransformChange(event);
              }
            }

            const cmdMulti = [];
            const movedOffset = this.objectPositionOnDown.clone().sub(object.position);
            const newPos = new Vector3();
            this._object.children.forEach((ch) => {
              const prevPosition = ch.position.clone().add(movedOffset);
              newPos.copy(ch.position);
              ch.position.copy(prevPosition);
              cmdMulti.push(new CmdSetPosition(ch, newPos, prevPosition));
            });
            const prevObjectPos = object.position.clone().add(object.pivotOffset).add(movedOffset);
            newPos.copy(this._object.position);
            this._object.position.copy(prevObjectPos);
            cmdMulti.push(new CmdSetPosition(this._object, newPos, prevObjectPos));

            if (cmdMulti.length) context.execute(new CmdMulti(cmdMulti), "translate");
          }

          object.snapObjects = true;
          this.objectPositionDiff = undefined;
          this._object.objectPositionDiff = undefined;
          break;

        case 'rotate':
          const rotation = new Vector3(object.rotation.x, object.rotation.y, object.rotation.z);
          if (!this.objectRotationOnDown.equals(rotation)) {
            const cmdMulti = [];
            const rotation = this.objectRotationOnDown.clone();
            rotation.x -= object.rotation.x;
            rotation.y -= object.rotation.y;
            rotation.z -= object.rotation.z;
            this._object.children.forEach((ch) => {
              const prevRotation = ch.rotation.clone();
              prevRotation.x += rotation.x;
              prevRotation.y += rotation.y;
              prevRotation.z += rotation.z;
              cmdMulti.push(new CmdSetRotation(ch, ch.rotation, prevRotation, object.position));
            });

            cmdMulti.push(new CmdSetRotation(object, rotation, this.objectRotationOnDown));
            if (cmdMulti.length) context.execute(new CmdMulti(cmdMulti), "rotate");
          }

          object.snapObjects = true;
          this.objectRotationDiff = null;
          this._object.objectRotationDiff = undefined;
          break;

        case 'scale':
          if (object.isGlPlotTemplate) {
            object.fitScale = object.scale.clone().multiplyScalar(context.camera.zoom);
          }
          if (!this.objectScaleOnDown.equals(object.scale)) {
            const cmdMulti = [];
            const scale = this.objectScaleOnDown.clone();
            scale.sub(object.scale);
            this._object.children.forEach((ch) => {
              const prevScale = ch.scale.clone();
              prevScale.add(scale);
              cmdMulti.push(new CmdSetScale(ch, ch.scale, prevScale, object.position));
            });

            cmdMulti.push(new CmdSetScale(object, object.scale, this.objectScaleOnDown));
            if (cmdMulti.length) context.execute(new CmdMulti(cmdMulti), "scale");
          }

          object.snapObjects = true;
          this.objectScaleDiff = null;
          this._object.objectScaleDiff = null;
          break;
        case 'shift':
          if (this.glScene.snapMode !== GlSnapMode.None) {
            this._object.position.copy(this.glScene.markPoint.position);
          } else {
            const intersects = this.glScene._getIntersects(this.glScene.onDownPosition);
            if (intersects.length > 0) {
              if (intersects[0].child?.point) {
                this._object.position.copy(intersects[0].child.point);
              } else {
                this._object.position.copy(intersects[0].point);
              }
              this._transformControls.updateMatrixWorld(true);
            }
          }

          break;
      }
    }

    if (!event.mouseEvent.shiftKey) {
      this.glScene.drawDynamicInput('over');
    }

    this.glScene._sceneControl.enabled = true;
    this.glScene.showStatusBar(false);
  }

  onTransformKeyUp(event) {
    event = event.event;
    const context = this.glScene.context;
    const object = this._object;
    const mode = this._transformControls.mode;
    const axis = this._transformControls.axis;
    let space = this._transformControls.space;
    if (mode === 'scale') space = 'local';
    else if (axis === 'E' || axis === 'XYZE' || axis === 'XYZ') space = 'world';

    const inputLabel = this.glScene.dynamicInput.label;
    const showSingle = this.glScene.dynamicInput.showSingle;
    const showCouple = this.glScene.dynamicInput.showCouple;
    const inputSlots = event.target.parentElement.children;
    const first = parseFloat(inputSlots[1]?.value);
    const second = parseFloat(inputSlots[2]?.value);
    const third = parseFloat(inputSlots[3]?.value);
    const tmpValue = new Vector3();

    if (object !== undefined) {
      switch (mode) {
        case 'translate':
          tmpValue.copy(this.objectPositionOnDown);
          if (showSingle) {
            if (inputLabel === 'X:') tmpValue.x += first;
            else if (inputLabel === 'Y:') tmpValue.y += first;
            else tmpValue.z += first;

          } else if (showCouple) {
            if (inputLabel === 'X,Y:') {
              tmpValue.x += first;
              tmpValue.y += second;
            } else if (inputLabel === 'X,Z:') {
              tmpValue.x += first;
              tmpValue.z += second;
            } else {
              tmpValue.y += first;
              tmpValue.z += second;
            }

          } else {
            tmpValue.x += first; tmpValue.y += second; tmpValue.z += third;
          }

          if (!this.objectPositionOnDown.equals(tmpValue)) {
            const cmdMulti = [];
            const movedOffset = this.objectPositionOnDown.sub(tmpValue);
            const prevObjectPos = tmpValue.clone().add(object.pivotOffset).add(movedOffset);

            this._object.position.set(tmpValue.x, tmpValue.y, tmpValue.z);
            this._object.updateMatrixWorld(true);

            this._object.children.forEach((ch) => {
              const prevPosition = ch.position.clone().add(movedOffset);
              cmdMulti.push(new CmdSetPosition(ch, ch.position, prevPosition));
            });
            cmdMulti.push(new CmdSetPosition(this._object, tmpValue, prevObjectPos));

            this._object.objectPositionDiff = tmpValue.clone().sub(prevObjectPos);

            if (cmdMulti.length) context.execute(new CmdMulti(cmdMulti), "key: translate", "prev");

            this._object.objectPositionDiff = null;
          }

          break;

        case 'rotate':
          // Apply rotate
          const rotationAngle = first * MathUtils.DEG2RAD;
          const quatAxisAngle = new Quaternion();
          quatAxisAngle.setFromAxisAngle(this._transformControls._gizmo.rotationAxis, rotationAngle);

          const quatStart = this._transformControls.quaternionStart;
          const quatEnd = new Quaternion();

          if (Math.abs(first) > 0) {
            if (space === 'local' && axis !== 'E' && axis !== 'XYZE') {
              quatEnd.copy(quatStart);
              quatEnd.multiply(quatAxisAngle).normalize();
            } else {
              quatEnd.copy(quatAxisAngle);
              quatEnd.multiply(quatStart).normalize();
            }

            const objRotation = object.rotation.clone().setFromQuaternion(quatEnd);
            const rotation = new Vector3(objRotation.x, objRotation.y, objRotation.z);

            const cmdMulti = [];
            this._object.children.forEach((ch) => {
              const prevRotation = ch.rotation.clone();
              prevRotation.x += rotation.x;
              prevRotation.y += rotation.y;
              prevRotation.z += rotation.z;
              cmdMulti.push(new CmdSetRotation(ch, ch.rotation, prevRotation, object.position));
            });

            this._object.objectRotationDiff = rotation.sub(this.objectRotationOnDown);
            cmdMulti.push(new CmdSetRotation(object, rotation, this.objectRotationOnDown));
            if (cmdMulti.length) context.execute(new CmdMulti(cmdMulti), "key: rotate", "prev");

            this._object.objectRotationDiff = null;
          }

          break;

        case 'scale':
          tmpValue.copy(this.objectScaleOnDown);
          if (showSingle) {
            if (inputLabel === 'X:') tmpValue.x = first;
            else if (inputLabel === 'Y:') tmpValue.y = first;
            else tmpValue.z = first;

          } else if (showCouple) {
            if (inputLabel === 'X,Y:') {
              tmpValue.x = first;
              tmpValue.y = second;
            } else if (inputLabel === 'X,Z:') {
              tmpValue.x = first;
              tmpValue.z = second;
            } else {
              tmpValue.y = first;
              tmpValue.z = second;
            }

          } else {
            tmpValue.x = first; tmpValue.y = second; tmpValue.z = third;
          }

          if (!this.objectScaleOnDown.equals(tmpValue)) {
            const cmdMulti = [];
            const scale = this.objectScaleOnDown.clone();
            scale.sub(object.scale);
            this._object.children.forEach((ch) => {
              const prevScale = ch.scale.clone();
              prevScale.add(scale);
              cmdMulti.push(new CmdSetScale(ch, ch.scale, prevScale, object.position));
            });

            this._object.objectScaleDiff = tmpValue.sub(this.objectScaleOnDown);
            cmdMulti.push(new CmdSetScale(object, tmpValue, this.objectScaleOnDown));
            if (cmdMulti.length) context.execute(new CmdMulti(cmdMulti), "key: scale", "prev");

            this._object.objectScaleDiff = null;
          }
          break;
      }
    }

    this.glScene.drawDynamicInput('over');
    this.glScene._sceneControl.enabled = true;
    this.glScene.showStatusBar(false);
  }
}