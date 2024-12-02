/* eslint-disable no-undef */
import {GlLineHelper} from '../tools/gl-line-helper';
import {GlPolyline} from './gl-polyline';
import {GlSnapMode, GlDynamicInput, GlSectionType, Tool_Types} from './gl-constants';
import {GlEvents} from './gl-events';
import {GlSection} from './gl-section';
import {GlMultiSection} from './gl-multi-section';
import {GlObb} from '../objects/gl-obb';
import { GlRaycaster } from './gl-raycaster';
import {
  Vector2,
  Plane,
  Vector3,
  EventDispatcher,
  Raycaster,
  LineDashedMaterial,
  Matrix3,
} from 'three';

// scope's closure variables
const __mouseNorm = new Vector2();
const __mouseEvent = new Vector2();
const __sceneRect = new Vector2();
const __sectPlane = new Plane();
const __v3 = new Vector3();

export class GlSectionTool extends EventDispatcher {
  constructor(glScene) {
    super();

    this._glScene = glScene;
    this._context = glScene.context;
    this._camera = glScene.context.camera;
    this._domElement = glScene.glWindow;

    // get the WebGlRenderer's canvas
    for (const child of this._domElement.children) {
      if (child.localName === 'canvas') {
        this._glCanvas = child;
        break;
      }
    }

    this.type = Tool_Types.GlSectionTool;
    this.isGlSectionTool = true;

    // indicates is the tool active
    this._active = false;

    // section size attributes
    this._showDynInput = true;
    this._dynInputEvent = 'none';
    this._toward = 5;
    this._away = 5;
    this._planeHelperSize = 0;

    this._sectionType = GlSectionType.Single;

    // section segments
    this._sections = [];

    // multi section
    this._multiSection = null;

    // members related to raycasting
    this._raycaster = new GlRaycaster();
    this._plane = null;
    this._pinnedPlane = null;
    this._wasPlaneAttached = false;
    this._wasPlanePinned =  false;
    this._isWorkPlaneSet = false;

    // members used to draw a section
    const mat1 = new LineDashedMaterial({color: 0x000000, dashSize: 2, gapSize: 0.5});
    const mat2 = new LineDashedMaterial({color: 0xff0000, dashSize: 2, gapSize: 0.5});
    const mat3 = new LineDashedMaterial({color: 0x000fff, dashSize: 2, gapSize: 0.5});
    this._polyCenter = new GlPolyline({material: mat1});
    this._polyToward = new GlPolyline({material: mat2});
    this._polyAway = new GlPolyline({material: mat3});
    this._polyCenter.depthTest = false;
    this._polyToward.depthTest = false;
    this._polyAway.depthTest = false;
    this._lhCenter = new GlLineHelper(mat1);
    this._lhToward = new GlLineHelper(mat2);
    this._lhAway = new GlLineHelper(mat3);

    // mouse' state
    this._intersection = new Vector3();
    this._isCoordSet = false;

    this._isTouchScreen = false;
    this._isStarted = false;
    this._timeElapsed = 0;
  }

  get glScene() {
    return this._glScene;
  }

  get glContext() {
    return this._context;
  }

  get sections() {
    return this._sections;
  }

  isActive() {
    return this._active;
  }

  isInAction() {}

  // ----------------------------------
  // activate
  // ----------------------------------
  activate() {
    // get the tool's working plane
    const wpTool = this._glScene.getWorkPlaneTool();
    this._plane = wpTool.getPlane();

    // add line draw helpers
    this._context.sceneHelpers.add(this._polyCenter);
    this._context.sceneHelpers.add(this._polyToward);
    this._context.sceneHelpers.add(this._polyAway);
    this._context.sceneHelpers.add(this._lhCenter);
    this._context.sceneHelpers.add(this._lhToward);
    this._context.sceneHelpers.add(this._lhAway);

    this._domElement.style.cursor = 'crosshair';

    // activate dynamic input mode
    this._dynInputEvent = 'drawSection';
    this._glScene.dynamicInput.showCouple = true;
    this._glScene.setDynamicInput(GlDynamicInput.SectionTool);

    this._active = true;
    this._context.notifyToolActivated(this);
  }

  // ----------------------------------
  // deactivate
  // ----------------------------------
  deactivate() {
    this.onKeyUp({key: 'Esc'});

    // destruct draw helpers
    this._reset();
    this._polyCenter.dispose();
    this._polyToward.dispose();
    this._polyAway.dispose();
    this._lhCenter.dispose();
    this._lhToward.dispose();
    this._lhAway.dispose();

    this._context.sceneHelpers.remove(this._polyCenter);
    this._context.sceneHelpers.remove(this._polyToward);
    this._context.sceneHelpers.remove(this._polyAway);
    this._context.sceneHelpers.remove(this._lhCenter);
    this._context.sceneHelpers.remove(this._lhToward);
    this._context.sceneHelpers.remove(this._lhAway);

    this._domElement.style.cursor = 'auto';

    this._plane = null;

    // deactivate dynamic input mode
    this._glScene.dynamicInput.showTriple = true;
    this._dynInputEvent = 'over';
    this._updateTowardAway();
    this._glScene.resetDynamicInput(GlDynamicInput.SectionTool);
    this._dynInputEvent = 'none';

    this._active = false;
    this._context.notifyToolDeactivated(this);
  }

  // ----------------------------------
  // dispose
  // ----------------------------------
  dispose() {
    this.deactivate();
    this.removeSections();
  }

  // ----------------------------------
  // set the section type to create
  // ----------------------------------
  setSectionType(type) {
    if (type === GlSectionType.Single || type === GlSectionType.Multi ||
        type === GlSectionType.Poly) {
      this._sectionType = type;
    }
  }

  // ------------------------------------------
  // set a single section from GlMultiSection
  // ------------------------------------------
  setFromGlMultiSection(glMultiSection, childUuid) {
    if (!(glMultiSection && glMultiSection.isGlMultiSection &&
          typeof childUuid === 'string')) return;

    const glObb = glMultiSection.getChild(childUuid);
    if (!(glObb && glObb.sectionPlane)) return;

    this.saveWorkingPlaneState();

    // prepare the needed variables
    const planeHelper = glObb.sectionPlane;
    const obb = glObb.getOBB(true);

    const tempV = new Vector3();
    const planeCenter = new Vector3();
    const planeNormal = new Vector3();

    // prepare the left and right planes
    planeNormal.crossVectors(planeHelper.plane.normal, planeHelper.plane.upDir);
    planeNormal.normalize();
    tempV.copy(planeNormal).multiplyScalar(obb.halfSize.x);
    planeCenter.addVectors(obb.center, tempV.negate());

    const leftPlane = new Plane();
    leftPlane.setFromNormalAndCoplanarPoint(planeNormal, planeCenter);

    planeCenter.addVectors(obb.center, tempV.negate());
    const rightPlane = new Plane();
    rightPlane.setFromNormalAndCoplanarPoint(planeNormal.negate(), planeCenter);

    // prepare the away plane and toward planes
    planeNormal.copy(planeHelper.plane.normal);
    tempV.copy(planeNormal).multiplyScalar(obb.halfSize.y);
    planeCenter.addVectors(obb.center, tempV.negate());

    const towardPlane = new Plane();
    towardPlane.setFromNormalAndCoplanarPoint(planeNormal, planeCenter);

    planeCenter.addVectors(obb.center, tempV.negate());
    const awayPlane = new Plane();
    awayPlane.setFromNormalAndCoplanarPoint(planeNormal.negate(), planeCenter);

    const sctnAttribute = {
      leftPlane, rightPlane, towardPlane, awayPlane,
      width: obb.halfSize.x * 2,
      height: obb.halfSize.z * 2,
      depth: obb.halfSize.y * 2,
      sectionUp: planeHelper.plane.upDir.clone(),
      sectionView: planeHelper.plane.normal.clone(),
      sectionCenter: planeHelper.position.clone(),
      spaceCenter: obb.center.clone()
    };

    // create a section
    this._sections.length = 0;
    this._sections.push(new GlSection(sctnAttribute));
    const section = this._sections[0];

    // add a section to the helper scene
    this._context.sceneHelpers.add(section.planeHelper);
    this._context.sceneHelpers.add(section.boxHelper);
        
    // make planehelper invisible by default
    section.planeHelper.visible = false;

    // this._glScene.setScenesRotateAxis(section.center);
    this._glScene.setViewDirection(section.viewDir, section.upDir);

    // set clipping planes
    this._glScene.setClippingPlanes(section);

    // attach the section plane as a scene's working plane
    this._plane = null;

    const wpTool = this._glScene.getWorkPlaneTool();
    // wpTool.detachPlane();
    // wpTool.pinPlane(false);
    wpTool.attachPlaneFromPlane(section.plane, section.center, section.width);
    wpTool.pinPlane(true, true);

    // if there is a saved pinned plane need to check if that plane 
    // intersects the current section and if it does need to repair that plane
    let attachSectionPlane = true;
    if (this._pinnedPlane) {
      const pPlane = this._pinnedPlane.clone();
      if (obb.intersectsPlane(pPlane)) {
        __v3.copy(this._pinnedPlane.planePos);
        pPlane.upDir = section.upDir.clone();
        wpTool.attachPlaneFromPlane(pPlane, __v3, section.width);
        attachSectionPlane = false;
      }
    }
    if (attachSectionPlane) {
      section.plane.upDir = section.upDir.clone();
      wpTool.attachPlaneFromPlane(section.plane, section.center, section.width);
    }

    if (this._isSceneWpVisible) wpTool.showPlane(true);
  }

  // -----------------------------
  // show/hide sections
  // -----------------------------
  showSections(flag) {
    for (const section of this._sections) {
      section.showSection(flag);
    }
  }

  // ---------------------------------------
  // remove sections from the helper scene
  // ---------------------------------------
  removeSections() {
    for (const section of this._sections) {
      this._context.sceneHelpers.remove(section.planeHelper);
      this._context.sceneHelpers.remove(section.boxHelper);
      section.dispose();
    }

    if (this._multiSection) {
      this._context.executeRemove(this._multiSection);
      this._multiSection.dispose();
      this._multiSection = null;
    }
  }

  // -------------------------------------
  // reset members used to draw a section
  // -------------------------------------
  _reset() {
    this._polyCenter.deleteAllPoints();
    this._polyToward.deleteAllPoints();
    this._polyAway.deleteAllPoints();
    this._lhCenter.deleteAllPoints();
    this._lhToward.deleteAllPoints();
    this._lhAway.deleteAllPoints();
  }

  // ---------------------------------------------------
  // save/reset/repair the scene's working plane state
  // ---------------------------------------------------
  saveWorkingPlaneState() {
    if (this._pinnedPlane) return;

    const wpTool = this._glScene.getWorkPlaneTool();
    this._wasPlaneAttached = wpTool.isPlaneAttached();
    this._wasPlanePinned =  wpTool.isPlanePinned();
    this._isSceneWpVisible = wpTool.isPlaneShown();
    if (this._wasPlanePinned) {
      const pPlane = wpTool.getPlane();
      this._pinnedPlane = pPlane.clone();
      this._pinnedPlane.upDir = pPlane.upDir.clone();
      this._pinnedPlane.planeSize = wpTool.getPlaneSize();
      this._pinnedPlane.planePos = wpTool.getPlanePosition();
    }
  }

  resetWorkingPlaneState(resetPin = true, resetVisibility = true) {
    if (resetVisibility) this._isSceneWpVisible = false;
    if (resetPin) {
      this._wasPlaneAttached = false;
      this._wasPlanePinned =  false;
      this._pinnedPlane = null;
    }
  }

  repairWorkingPlaneState() {
    const wpTool = this._glScene.getWorkPlaneTool();
    const pPlane = this._pinnedPlane;
    if (this._wasPlanePinned && pPlane) {
      wpTool.pinPlane(false);
      __v3.copy(pPlane.planePos);
      const size = pPlane.planeSize > 0 ? pPlane.planeSize : 1;
      if (this._wasPlaneAttached)
        wpTool.attachPlaneFromPlane(pPlane, __v3, size);
      else
        wpTool.setPlaneFromPlane(pPlane, __v3, size);
      wpTool.pinPlane(true, true);
    }

    if (this._isSceneWpVisible) wpTool.showPlane(true);

    this.resetWorkingPlaneState();
  }

  // -------------------------------------
  // set/reset the tool's working plane
  // -------------------------------------
  _setWorkingPlane() {
    this.saveWorkingPlaneState();

    const wpTool = this._glScene.getWorkPlaneTool();
    wpTool.showPlane(false);
    wpTool.detachPlane();
    wpTool.pinPlane(false, true);

    const camera = this._context.camera;
    const normal = camera.getViewDirection();
    normal.negate();
    const bbox = this._glScene.calculateSceneBB();
    if (bbox) {
      bbox.getCenter(__v3);
      __sectPlane.setFromNormalAndCoplanarPoint(normal, __v3);

      wpTool.attachPlaneFromPlane(__sectPlane, __v3, 1);
    }

    this._plane = wpTool.getPlane();
  }


  // ----------------------------------
  // reset section defined earlier
  // ----------------------------------
  resetSections() {
    // remove clipping planes
    this._glScene.removeClippingPlanes();

    // hide sections
    this.showSections(false);

    // remove sections from the helper scene
    this.removeSections();
    this._sections.length = 0;

    // need to detach the scene's working plane
    const wpTool = this._glScene.getWorkPlaneTool();
    wpTool.detachPlane();

    // if the scene's working plane was visible show it,
    if (this._isSceneWpVisible) wpTool.showPlane(true);
  }

  // --------------------------------------
  // set a line section
  // --------------------------------------
  _setLineSection() {
    const ptCount = this._polyCenter.getPointsCount();
    if (ptCount > 1) {

      const ptStart = this._polyCenter.getPointAt(0);
      const ptEnd = this._polyCenter.getPointAt(1);

      // don't allow really small rectangle
      if (Math.abs(ptStart.x - ptEnd.x) > 0.05 || Math.abs(ptStart.y - ptEnd.y) > 0.05) {

        // calculate the attributes of a section
        const attrib = this._calcSectionAttributes(0);
        this._context.notifySectionSet(attrib, this._sectionType);
      }
    }
  }

  // ----------------------------------
  // calculate a section attributes
  // ----------------------------------
  _calcSectionAttributes(segmentIdx) {
    let attribute = null;

    const ptCount = this._polyCenter.getPointsCount();
    if (ptCount > 1 && ptCount > segmentIdx + 1) {
      const viewDir = this._camera.getViewDirection();

      // define the height of a section
      let height = this._glScene.bbox.length();
      if (height < 0.4) height = 0.4;

      // calculate the middle point of a central line's segment
      let ptStart = this._polyCenter.getPointAt(segmentIdx);
      let ptEnd = this._polyCenter.getPointAt(segmentIdx + 1);
      const ptCenterMiddle = ptStart.clone();
      ptCenterMiddle.add(ptEnd).multiplyScalar(0.5);

      const segment = ptEnd.clone();
      segment.sub(ptStart);
      const width = segment.length();
      segment.normalize();

      // prepare the left and right planes
      const leftPlane = new Plane();
      leftPlane.setFromNormalAndCoplanarPoint(segment, ptStart);

      const rightPlane = new Plane();
      rightPlane.setFromNormalAndCoplanarPoint(segment.negate(), ptEnd);

      // calculate the middle points of toward and away line's segments
      ptStart = this._polyToward.getPointAt(segmentIdx);
      ptEnd = this._polyToward.getPointAt(segmentIdx + 1);
      const ptTowardMiddle = ptStart.clone();
      ptTowardMiddle.add(ptEnd).multiplyScalar(0.5);

      ptStart = this._polyAway.getPointAt(segmentIdx);
      ptEnd = this._polyAway.getPointAt(segmentIdx + 1);
      const ptAwayMiddle = ptStart.clone();
      ptAwayMiddle.add(ptEnd).multiplyScalar(0.5);

      // calculate the depth of the section
      segment.subVectors(ptTowardMiddle, ptAwayMiddle);
      const depth = segment.length();
      segment.normalize();

      // prepare the clipping section space center
      const ptSpaceCenter = ptTowardMiddle.clone();
      const tmpSegment = segment.clone();
      tmpSegment.multiplyScalar(-depth * 0.5);
      ptSpaceCenter.add(tmpSegment);

      // prepare the away plane
      const awayPlane = new Plane();
      awayPlane.setFromNormalAndCoplanarPoint(segment, ptAwayMiddle);

      // prepare the toward plane
      const towardPlane = new Plane();
      towardPlane.setFromNormalAndCoplanarPoint(segment.negate(), ptTowardMiddle);

      // prepare the section's up vector
      const sectionUp = viewDir.clone();
      sectionUp.negate();

      attribute = {
        leftPlane, rightPlane, towardPlane, awayPlane,
        width, height, depth, sectionUp,
        sectionView: segment,
        sectionCenter: ptCenterMiddle,
        spaceCenter: ptSpaceCenter
      };
    }

    return attribute;
  }

  // ----------------------------------
  // draw toward / away lines
  // ----------------------------------
  _drawTowardAwayLines(drawHelpers) {
    const cnt = drawHelpers ? this._lhCenter.getPointsCount() : this._polyCenter.getPointsCount();
    if (cnt === 0) return;

    let ptStart; let ptEnd;
    const camera = this._camera;
    const viewDir = camera.getViewDirection();

    if (drawHelpers) {
      ptStart = this._lhCenter.getPointAt(0);
      ptEnd = this._lhCenter.getPointAt(1);
    } else if (cnt > 1) {
      ptStart = this._polyCenter.getPointAt(cnt - 2);
      ptEnd = this._polyCenter.getPointAt(cnt - 1);
    }

    const sectionSeg = ptEnd.clone();
    sectionSeg.sub(ptStart);
    const sectionView = viewDir.cross(sectionSeg);
    sectionView.normalize();

    const tmpSegment = sectionView.clone();
    tmpSegment.multiplyScalar(this._toward);
    const arrToward = [
      ptStart.x + tmpSegment.x, ptStart.y + tmpSegment.y, ptStart.z + tmpSegment.z,
      ptEnd.x + tmpSegment.x, ptEnd.y + tmpSegment.y, ptEnd.z + tmpSegment.z
    ];

    tmpSegment.copy(sectionView).multiplyScalar(this._away);
    const arrAway = [
      ptStart.x - tmpSegment.x, ptStart.y - tmpSegment.y, ptStart.z - tmpSegment.z,
      ptEnd.x - tmpSegment.x, ptEnd.y - tmpSegment.y, ptEnd.z - tmpSegment.z
    ];

    if (drawHelpers) {
      this._lhToward.setPoints(0, arrToward);
      this._lhAway.setPoints(0, arrAway);
      this._lhCenter.computeLineDistances();
      this._lhToward.computeLineDistances();
      this._lhAway.computeLineDistances();
    } else if (cnt > 1) {
      this._polyToward.setPoints(cnt - 2, arrToward);
      this._polyAway.setPoints(cnt - 2, arrAway);
      this._polyCenter.computeLineDistances();
      this._polyToward.computeLineDistances();
      this._polyAway.computeLineDistances();
    }
  }

  // ----------------------------------
  // handle toward / away inputs
  // ----------------------------------
  _updateTowardAway() {
    if (!this._showDynInput) return;

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
    dynInput.first = this._toward;
    dynInput.second = this._away;

    this._glScene.drawDynamicInput(event);
  }

  // ----------------------------------
  // show dynamic input mode
  // ----------------------------------
  showDynamicInput(flag) {
    if (flag) {
      this._showDynInput = true;
      this._dynInputEvent = 'drawSection';
      this._updateTowardAway();
    } else {
      this._dynInputEvent = 'over';
      this._updateTowardAway();
      this._showDynInput = false;
    }
  }

  // ------------------------------------------------------
  // set the values of toward and away from dynamic input
  // ------------------------------------------------------
  _setTowardAwayFromDynamicInput(event) {
    const inputSlots = event.target.parentElement.children;
    this._toward = parseFloat(inputSlots[1].value) ? parseFloat(inputSlots[1].value) : 1;
    this._away = parseFloat(inputSlots[2].value) ? parseFloat(inputSlots[2].value) : 1;
  }

  getSingleSection() {
    if (this._sections[0] && this._sections.length === 1) {
      return this._sections[0]
    }
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

    this._getMousePosition(event);

    let success = false;
    const glScene = this._glScene;
    if (glScene.snapMode !== GlSnapMode.None &&
      glScene.markPoint && glScene.markPoint.visible) {
      const pos = glScene.markPoint.position;
      if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
        this._intersection.copy(pos);
        success = true;
      }
    }
    if (!success) {
      this._raycaster.setFromCamera(__mouseNorm, this._camera);
      this._raycaster.near = this._camera.near;
      this._raycaster.far = this._camera.far;
      if (!this._plane) {
        const wpTool = this._glScene.getWorkPlaneTool();
        this._plane = wpTool.getPlane();
      }
      success = this._raycaster.ray.intersectPlane(this._plane, this._intersection) !== null;
    }
    if (success) {
      if (this._isStarted) {
        this._lhCenter.setPoint(1, this._intersection);
        this._drawTowardAwayLines(true);
      }
      this._dynInputEvent = 'drawSection';
      this._updateTowardAway();
      glScene.renderHelperScene();
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
    this._isCoordSet = false;

    if (glScene.snapMode !== GlSnapMode.None &&
      glScene.markPoint && glScene.markPoint.visible) {
      const pos = glScene.markPoint.position;
      if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
        this._intersection.copy(glScene.markPoint.position);
        success = true;
      }
    }
    if (!success) {
      this._getMousePosition(event);

      this._raycaster.setFromCamera(__mouseNorm, this._camera);
      this._raycaster.near = this._camera.near;
      this._raycaster.far = this._camera.far;

      // prepare local working plane
      if (!this._isStarted) {
        // const wpTool = glScene.getWorkPlaneTool();
        // wpTool.pinPlane(false);
        this._setWorkingPlane();

      }  
      // const wpTool = this._glScene.getWorkPlaneTool();
      // this._plane = wpTool.getPlane();

      success = this._raycaster.ray.intersectPlane(this._plane, this._intersection) !== null;
    }
    if (success && event.which !== 2) {
      // disable gl scene rotation
      this._glScene.setSceneRotation(false);
      this._isCoordSet = true;
    }
  }

  // ----------------------------------
  // onMouseCancel event handler
  // ----------------------------------
  onMouseUp(event) {
    event.preventDefault();

    // event.stopPropagation();
    // if (this._isTouchScreen) return;

    if (!this._isStarted && this._isCoordSet && event.which === 1) {
      this._isStarted = true;

      // set the intersection point as a position
      this._polyCenter.position.copy(this._intersection);
      this._polyCenter.addPoint(this._intersection);
      this._polyCenter.showPoints(true);

      this._polyToward.position.copy(this._intersection);
      this._polyToward.addPoint(this._intersection);
      this._polyToward.showPoints(true);

      this._polyAway.position.copy(this._intersection);
      this._polyAway.addPoint(this._intersection);
      this._polyAway.showPoints(true);

      this._lhCenter.addPoints([this._intersection, this._intersection]);
      this._lhToward.addPoints([this._intersection, this._intersection]);
      this._lhAway.addPoints([this._intersection, this._intersection]);

      this._updateTowardAway();
      this.dispatchEvent({type: GlEvents.actionStart, detail: event, object: this._polyCenter});
      this._glScene.renderHelperScene();

    } else if (!this._isStarted && event.which === 3) {
      // this._dynInputEvent = 'over';
      // this._updateTowardAway();
      this.dispatchEvent({type: GlEvents.actionEnd, detail: event, object: this._polyCenter});

      if (this._active) this._reset();

      // enable gl scene rotation
      this._glScene.setSceneRotation(true);

    } else if (this._isStarted && event.which !== 2) {
      if (event.which === 3) {
        this._isStarted = false;
        // this._dynInputEvent = 'over';
        // this._updateTowardAway();

        this._lhCenter.deleteAllPoints();
        this._lhToward.deleteAllPoints();
        this._lhAway.deleteAllPoints();

        this._glScene.renderHelperScene();
        this.dispatchEvent({type: GlEvents.actionEnd, detail: event, object: this._polyCenter});

        if (this._active) this._reset();

        // enable gl scene rotation
        this._glScene.setSceneRotation(true);

      } else if (this._isCoordSet) {
        this._polyCenter.addPoint(this._intersection);
        this._polyToward.addPoint(this._intersection);
        this._polyAway.addPoint(this._intersection);
        this._drawTowardAwayLines();

        // in case of a single section mode need to stop
        // drawing and start creating a single section
        if (this._sectionType === GlSectionType.Single ||
            this._sectionType === GlSectionType.Multi) {
          this._isStarted = false;
          // this._dynInputEvent = 'over';
          // this._updateTowardAway();

          this._lhCenter.deleteAllPoints();
          this._lhToward.deleteAllPoints();
          this._lhAway.deleteAllPoints();

          this._setLineSection();

          this.dispatchEvent({type: GlEvents.actionEnd, detail: event, object: this._polyCenter});

          if (this._active) this._reset();

          // enable gl scene rotation
          this._glScene.setSceneRotation(true);

        } else {
          // otherwise carry on drawing sections
          this._lhCenter.setPoints(0, [this._intersection, this._intersection]);
          this._lhToward.setPoints(0, [this._intersection, this._intersection]);
          this._lhAway.setPoints(0, [this._intersection, this._intersection]);
          this._updateTowardAway();
          this._glScene.renderHelperScene();
        }
      }
    }
  }

  // ----------------------------------
  // onKeyUp event handler
  // ----------------------------------
  onKeyUp(event) {
    let handleDynInput = false;
    const isEscPressed = event.key === "Escape" || event.key === "Esc";
    if (event.preventDefault) {
      event.preventDefault();
      handleDynInput = !isEscPressed && event.target.parentElement.id === 'dynamicInput';
    }

    if (handleDynInput) {
      this._setTowardAwayFromDynamicInput(event);
      this._drawTowardAwayLines(true);
      this._glScene.renderHelperScene();

    } else if (this._isStarted && isEscPressed) {
      this._isStarted = false;
      // this._dynInputEvent = 'over';
      // this._updateTowardAway();
      if (this._sectionType === GlSectionType.Single ||
          this._sectionType === GlSectionType.Multi) {
        this._setLineSection();
      }

      this.dispatchEvent({type: GlEvents.actionEnd, detail: event, object: this._polyCenter});

      // enable gl scene rotation
      this._glScene.setSceneRotation(true);
    }
  }

  // ----------------------------------
  // onTouchStart event handler
  // ----------------------------------
  onTouchStart(event) {
    event.preventDefault();
    event = event.changedTouches[0];

    let success = false;
    const glScene = this._glScene;
    this._isCoordSet = false;

    if (glScene.snapMode !== GlSnapMode.None &&
      glScene.markPoint && glScene.markPoint.visible) {
      const pos = glScene.markPoint.position;
      if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
        this._intersection.copy(glScene.markPoint.position);
        success = true;
      }
    }
    if (!success) {
      this._getMousePosition(event);

      this._raycaster.setFromCamera(__mouseNorm, this._camera);
      this._raycaster.near = this._camera.near;
      this._raycaster.far = this._camera.far;

      // prepare local working plane
      const wpTool = this._glScene.getWorkPlaneTool();
      this._plane = wpTool.getPlane();
      success = this._raycaster.ray.intersectPlane(this._plane, this._intersection) !== null;
    }
    if (success) {
      // disable gl scene rotation
      this._glScene.setSceneRotation(false);
      this._isCoordSet = true;
    }
  }

  // ----------------------------------
  // onTouchMove event handler
  // ----------------------------------
  onTouchMove(event) {
    event.preventDefault();
    event = event.changedTouches[0];

    this._getMousePosition(event);

    let success = false;
    const glScene = this._glScene;
    if (glScene.snapMode !== GlSnapMode.None &&
      glScene.markPoint && glScene.markPoint.visible) {
      const pos = glScene.markPoint.position;
      if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
        this._intersection.copy(pos);
        success = true;
      }
    }
    if (!success) {
      this._raycaster.setFromCamera(__mouseNorm, this._camera);
      this._raycaster.near = this._camera.near;
      this._raycaster.far = this._camera.far;
      if (!this._plane) {
        const wpTool = this._glScene.getWorkPlaneTool();
        this._plane = wpTool.getPlane();
      }
      success = this._raycaster.ray.intersectPlane(this._plane, this._intersection) !== null;
    }
    if (success) {
      if (this._isStarted) {
        this._lhCenter.setPoint(1, this._intersection);
        this._drawTowardAwayLines(true);
      }
      this._dynInputEvent = 'drawSection';
      this._updateTowardAway();
      glScene.renderHelperScene();
    }
  }

  // ----------------------------------
  // onTouchEnd event handler
  // ----------------------------------
  onTouchEnd(event) {
    event.preventDefault();
    // event.stopPropagation();
    // this._timeElapsed = event.timeStamp - this._timeElapsed;
    event = event.changedTouches[0];
    this._timeElapsed = event.timeElapsed;

    if (!this._isStarted && this._isCoordSet && this._timeElapsed <= 1000) {
      this._isStarted = true;

      // set the intersection point as a position
      this._polyCenter.position.copy(this._intersection);
      this._polyCenter.addPoint(this._intersection);
      this._polyCenter.showPoints(true);

      this._polyToward.position.copy(this._intersection);
      this._polyToward.addPoint(this._intersection);
      this._polyToward.showPoints(true);

      this._polyAway.position.copy(this._intersection);
      this._polyAway.addPoint(this._intersection);
      this._polyAway.showPoints(true);

      this._lhCenter.addPoints([this._intersection, this._intersection]);
      this._lhToward.addPoints([this._intersection, this._intersection]);
      this._lhAway.addPoints([this._intersection, this._intersection]);

      this._updateTowardAway();
      this.dispatchEvent({type: GlEvents.actionStart, detail: event, object: this._polyCenter});
      this._glScene.renderHelperScene();

    } else if (!this._isStarted && this._timeElapsed > 1000) {
      // this._dynInputEvent = 'over';
      // this._updateTowardAway();
      this.dispatchEvent({type: GlEvents.actionEnd, detail: event, object: this._polyCenter});

      if (this._active) this._reset();

      // enable gl scene rotation
      this._glScene.setSceneRotation(true);

    } else if (this._isStarted) {
      if (this._timeElapsed > 1000) {
        this._isStarted = false;
        // this._dynInputEvent = 'over';
        // this._updateTowardAway();

        this._lhCenter.deleteAllPoints();
        this._lhToward.deleteAllPoints();
        this._lhAway.deleteAllPoints();

        this._glScene.renderHelperScene();
        this.dispatchEvent({type: GlEvents.actionEnd, detail: event, object: this._polyCenter});

        if (this._active) this._reset();

        // enable gl scene rotation
        this._glScene.setSceneRotation(true);

      } else if (this._isCoordSet) {
        this._polyCenter.addPoint(this._intersection);
        this._polyToward.addPoint(this._intersection);
        this._polyAway.addPoint(this._intersection);
        this._drawTowardAwayLines();

        // in case of a single section mode need to stop
        // drawing and start creating a single section
        if (this._sectionType === GlSectionType.Single ||
            this._sectionType === GlSectionType.Multi) {
          this._isStarted = false;
          // this._dynInputEvent = 'over';
          // this._updateTowardAway();

          this._lhCenter.deleteAllPoints();
          this._lhToward.deleteAllPoints();
          this._lhAway.deleteAllPoints();

          this._setLineSection();

          this.dispatchEvent({type: GlEvents.actionEnd, detail: event, object: this._polyCenter});

          if (this._active) this._reset();

          // enable gl scene rotation
          this._glScene.setSceneRotation(true);

        } else {
          // otherwise carry on drawing sections
          this._lhCenter.setPoints(0, [this._intersection, this._intersection]);
          this._lhToward.setPoints(0, [this._intersection, this._intersection]);
          this._lhAway.setPoints(0, [this._intersection, this._intersection]);
          this._updateTowardAway();
          this._glScene.renderHelperScene();
        }
      }
    }
  }
}