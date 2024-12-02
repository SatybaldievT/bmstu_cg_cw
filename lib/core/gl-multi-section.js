import {GlLayer} from './gl-layer';
import {GlPlaneHelper} from './gl-plane-helper';
import {GlUtils} from '../utils/gl-utils';
import {Primitive_Type} from './gl-constants';
import {
  Vector3,
  Plane,
  Box3,
} from 'three';

export class GlMultiSection extends GlLayer {
  constructor(params, fromJSON) {
    super();
    this.name = '';
    this.type = 'GlMultiSection';
    this.isGlMultiSection = true;

    this.bbox = new Vector3(1, 1, 1);
    this.selectable = false;
    this.visible = true;

    this.sectionLabels = [];
    this.sectionLabelsVisible = false;
    this.sectionLabelsColor = 0x0000ff;
    this.sectionLabelsFont = '';

    this.sectionCentersVisible = false;
    this.sectionCentersColor = 0xff00ff;
    this.sectionPlaneColor = 0xACBFFF;

    if (fromJSON) {
      if(!fromJSON.uuid) {
        this.__initFromJson(fromJSON);
      } else {
        this.__initFromJson_v4_5(fromJSON);
      };
    } else if (params) {
      if (params.name) this.name = params.name;
      if (params.uuid) this.uuid = params.uuid;

      if (params.sectionLabelsColor) this.sectionLabelsColor = params.sectionLabelsColor;
      if (params.sectionLabelsFont) this.sectionLabelsFont = params.sectionLabelsFont;
      if (params.sectionCentersColor) this.sectionCentersColor = params.sectionCentersColor;
      if (params.sectionPlaneColor) this.sectionPlaneColor = params.sectionPlaneColor;

      if (params.dataSource) this.dataSource = params.dataSource;
    }
  }

  // ------------------------------------------------
  // initialize an object from JSON
  // ------------------------------------------------
  __initFromJson_v4_5(fromJSON) {
    // uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;
    // name
    if (fromJSON.name) this.name = fromJSON.name;

    if (fromJSON.dataSource) this.dataSource = fromJSON.dataSource;

    // set's visibility
    if (!fromJSON.visible) this.visible = false;

    if (fromJSON.matrix !== undefined) {
      this.matrix.fromArray(fromJSON.matrix);
      if (fromJSON.matrixAutoUpdate !== undefined) this.matrixAutoUpdate = fromJSON.matrixAutoUpdate;
      if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);
    } else {
      if (fromJSON.position !== undefined ) this.position.fromArray(fromJSON.position);
      if (fromJSON.rotation !== undefined ) this.rotation.fromArray(fromJSON.rotation);
      if (fromJSON.quaternion !== undefined ) this.quaternion.fromArray(fromJSON.quaternion);
      if (fromJSON.scale !== undefined ) this.scale.fromArray(fromJSON.scale );
    }

    if (fromJSON.renderOrder) this.renderOrder = fromJSON.renderOrder;

    if (fromJSON.sectionLabelsColor) this.sectionLabelsColor = fromJSON.sectionLabelsColor;
    if (fromJSON.sectionLabelsFont) this.sectionLabelsFont = fromJSON.sectionLabelsFont;
    if (fromJSON.sectionLabelsVisible) {
      this.showSectionLabels(true);
    }

    if (fromJSON.sectionPlaneColor) this.sectionPlaneColor = fromJSON.sectionPlaneColor;
    if (fromJSON.sectionCentersColor) this.sectionCentersColor = fromJSON.sectionCentersColor;
    if (fromJSON.sectionCentersVisible) {
      this.showSectionCenters(true);
    }
  }

  // ------------------------------------------------
  // initialize an object from JSON_v1
  // ------------------------------------------------
  __initFromJson(fromJSON) {

    // name
    if (fromJSON.n) this.name = fromJSON.n;

    if (fromJSON.dS) this.dataSource = fromJSON.dS;

    // set's visibility
    if (!fromJSON.v) this.visible = false;
    this.matrix.fromArray(fromJSON.m);
    if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
    if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;

    if (fromJSON.sLC) this.sectionLabelsColor = fromJSON.sLC;
    if (fromJSON.sLF) this.sectionLabelsFont = fromJSON.sLF;
    if (fromJSON.sLV) this.showSectionLabels(true);

    if (fromJSON.sPC) this.sectionPlaneColor = fromJSON.sPC;
    if (fromJSON.sCC) this.sectionCentersColor = fromJSON.sCC;
    if (fromJSON.sCV) this.showSectionCenters(true);
  }

  // -------------------------------------
  // adds a section to this set
  // -------------------------------------
  addChild(glObb, params) {
    if (!(glObb && glObb.isGlObb)) return;

    params = params || {};
    const sctnUuid = glObb.uuid;
    const found = this.children.findIndex((item) => item.uuid === sctnUuid);
    if (found === -1) {
      glObb.selectable = false;
      glObb.snappable = false;

      const sectionPlane = this.__prepareSectionsPlane(glObb);
      if (sectionPlane !== null) {
        glObb.material.copy(sectionPlane.material);
        glObb.material.opacity = 0.8;
        glObb.sectionPlane = sectionPlane;

        this.add(glObb);
        this.add(sectionPlane);
      } else {
        this.add(glObb);
      }
    } else {
      console.log('Object already exist!');
    }
  }

  __prepareSectionsPlane(glObb) {
    if (!(glObb && glObb.isGlObb && glObb.getPointsCount() === 8)) return null;

      // get the obb of globb
      const obb = glObb.getOBB(true);

      const sctnCenter = obb.center.clone();
      const firstPt = new Vector3();
      const sctnViewDir = new Vector3();
      const sctnUpDir = new Vector3();

      // loop through vertices points and calculate
      // globb's view direction and up direction vectors
      const points = glObb.getPoints(0, glObb.getPointsCount() - 1);
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (i === 0) firstPt.copy(point);
        if (i === 3) sctnUpDir.subVectors(point, firstPt).normalize();
        if (i === 4) sctnViewDir.subVectors(point, firstPt).normalize();
      }

      // if a section' towards and away values are missing
      // need to define them in terms of globb's size
      if (typeof glObb.towards !== 'number') {
        if (typeof glObb.userData.towards === 'number') {
          glObb.towards = glObb.userData.towards;
        } else {
          glObb.towards = obb.halfSize.y;
        }
      }
      if (typeof glObb.away !== 'number') {
        if (typeof glObb.userData.away === 'number') {
          glObb.away = glObb.userData.away;
        } else {
          glObb.away = obb.halfSize.y;
        }
      }

      // calculate the section's center
      const tmpV = sctnViewDir.clone().multiplyScalar(obb.halfSize.y);
      sctnCenter.add(tmpV);
      tmpV.normalize().multiplyScalar(glObb.away).negate();
      sctnCenter.add(tmpV);

      // create a plane and plane helper
      const plane = new Plane();
      plane.setFromNormalAndCoplanarPoint(sctnViewDir, sctnCenter);
      plane.upDir = sctnUpDir.clone();
      const planeHelper = new GlPlaneHelper(plane, 1, this.sectionPlaneColor);

      // position the plane helper
      planeHelper.setSize(obb.halfSize.x * 2, obb.halfSize.z * 2);
      planeHelper.rotate(sctnViewDir, sctnUpDir);
      planeHelper.position.copy(sctnCenter);

      return planeHelper;
  }

  // -------------------------------------
  // update a section in this set
  // -------------------------------------
  updateChild(childId, params) {
    if (childId === null || childId === undefined ||
        params === null || params === undefined) return;

    let childObj = null;
    if (Number.isInteger(childId) && childId < this.children.length) {
      childObj = this.children[childId];
    } else if (typeof childId === 'string') {
      const index = this.children.findIndex((item) => item.uuid === childId);
      if (index !== -1) {
        childObj = this.children[index];
      }
    }

    if (!(childObj && childObj.isGlObb && params.obb)) return;

    childObj.set(params.obb);
    const sctPlane = this.__prepareSectionsPlane(childObj);
    if (!sctPlane) return;

    // position the plane helper
    if (childObj.sectionPlane) {
      childObj.sectionPlane.plane.copy(sctPlane.plane);
      childObj.sectionPlane.plane.upDir.copy(sctPlane.plane.upDir);
      childObj.sectionPlane.setSize(sctPlane.width, sctPlane.height);
      childObj.sectionPlane.position.copy(sctPlane.position);
      childObj.sectionPlane.quaternion.copy(sctPlane.quaternion);
    } else {
      childObj.material.copy(sctPlane.material);
      childObj.material.opacity = 0.8;
      childObj.sectionPlane = sctPlane;
      this.add(sctPlane);
    }
  }

  // -------------------------------------
  // setSectionLabelsFont()
  // -------------------------------------
  setSectionLabelsFont(font) {
    if (typeof font !== 'string') return;

    this.sectionLabelsFont = font;
  }

  // -------------------------------------
  // setSectionLabelsColor()
  // -------------------------------------
  setSectionLabelsColor(color) {
    if (color === undefined || color === null) {
      this.sectionLabelsColor = color;
    

    
    }
  }

  // -----------------------
  // showSectionLabels
  // -----------------------
  showSectionLabels(flag) {
    if (flag === true || flag === false) {

      this.sectionLabelsVisible = flag;
    }
  }

  // -------------------------------------
  // setSectionCentersColor()
  // -------------------------------------
  setSectionCentersColor(color) {
    if (color === undefined || color === null) {
      this.sectionCentersColor = color;
    }
  }

  // -----------------------
  // showSectionLabels
  // -----------------------
  showSectionCenters(flag) {
    if (flag === true || flag === false) {

      this.sectionCentersVisible = flag;
    }
  }

  // -------------------------------------
  // show/hide(with children) set
  // -------------------------------------
  showSet(flag) {
    if (flag === true || flag === false) {
      this.visible = flag;
    }
  }

  // -------------------------------------
  // get bounding box
  // -------------------------------------
  getBoundingBox() {
    const sectionSetBB = new Box3();

    for (const object of this.children) {
      if (object.getBoundingBox) {
        const objectBB = object.getBoundingBox();
        if (objectBB) {
          const min = objectBB.min.clone();
          const max = objectBB.max.clone();
          sectionSetBB.expandByPoint(min);
          sectionSetBB.expandByPoint(max);
        }
      }
    }
    if (!sectionSetBB.isEmpty()) {
      sectionSetBB.getSize(this.bbox);
      if (this.bbox.length() < 1) this.bbox.set(1, 1, 1);
    }
    return sectionSetBB.isEmpty() ? null : sectionSetBB;
  }

  // -----------------------
  // raycast
  // -----------------------
  raycast(raycaster, intersects) {
    if (!this.visible) return;
    this.children.forEach((obj) => {
      if (typeof obj.raycast === 'function') {
        obj.raycast(raycaster, intersects);
      }
    });
  }

  // -----------------------
  // dispose all objects in a set
  // -----------------------
  dispose() {
    this.children.forEach((obj) => {
      obj.dispose();
    });
    this.children.length = 0;
  }

  // ------------------------
  // toJSON
  // ------------------------
  toJSON(meta, keepUuid = false) {
    const output = {};

    // meta is a string when called from JSON.stringify
    const isRootObject = (meta === undefined || typeof meta === 'string');
    if (isRootObject) {
      output.metadata = {
        version: 5.0,
        type: 'GlMultiSection',
        generator: 'GlMultiSection.toJSON'
      };
    }

    const object = {};
    if(keepUuid) object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== '') object.n = this.name;
    if (this.renderOrder !== 0) object.rO = this.renderOrder;
    object.v = this.visible;
    object.l = this.layers.mask;
    object.m = this.matrix.toArray();
    if (this.matrixAutoUpdate === false) object.mAU = false;

    object.p = this.position;

    object.sLC = this.sectionLabelsColor;
    object.sLF = this.sectionLabelsFont;
    if (this.sectionLabelsVisible) object.sLV = this.sectionLabelsVisible;

    object.sPC = this.sectionPlaneColor;
    object.sCC = this.sectionCentersColor;
    if (this.sectionCentersVisible) object.sCV = this.sectionCentersVisible;

    if (this.children.length) {
      object.ch = [];
      for (let i = 0; i < this.children.length; i++) {
        const glObb = this.children[i];
        if (glObb.isGlObb && glObb.getPointsCount() > 0) {
          glObb.uDT = glObb.towards; // glObb.userData.towards
          glObb.uDA = glObb.away; // glObb.userData.away
          const jsonObj = glObb.toJSON(meta);
          object.ch.push(jsonObj.object);
        }
      }
    }

    output.object = object;

    return output;
  }

  get properties() {
    return {
      type: Primitive_Type.String, // type
      oT: Primitive_Type.Uint8, // objectType
      n: Primitive_Type.String, // name
      rO: Primitive_Type.Uint8, // renderOrder
      v: Primitive_Type.Uint8, // visible
      l: Primitive_Type.Int32, // layers.mask
      m: Primitive_Type.Float64Array, // matrix
      mAU: Primitive_Type.Uint8, // matrixAutoUpdate
      pCt: Primitive_Type.Int32, // pointsCount
      lC: Primitive_Type.Uint32, // lineColor
      lLC: Primitive_Type.Uint32, // lineLabelsColor
      lLE: Primitive_Type.Uint8, // lineLabelsExist
      pOC: Primitive_Type.Uint32, // pointObjectsColor
      pO: Primitive_Type.Uint8, // pointObjects
      pLC: Primitive_Type.Uint32, // pointLabelsColor
      pLE: Primitive_Type.Uint8, // pointLabelsExist
      pvO: Primitive_Type.Float32Array, // pivotOffset
      uA: Primitive_Type.Object, // attributes
      pU: Primitive_Type.Float32, // pwUnit
      hN: Primitive_Type.String, // hatchName
      hIS: Primitive_Type.String, // hatchImage.src
      hPO: Primitive_Type.Int32, // hatchPolygonOffset
      hPD: Primitive_Type.Float32, // hatchPatternData
      geom: Primitive_Type.Object, // geometry
      rowO: Primitive_Type.Uint32Array, // row order
      ch: Primitive_Type.Int32, // children
      p: Primitive_Type.Float64, //position
      sLF: Primitive_Type.Uint32, // sectionLabelsFont
      sLC: Primitive_Type.Uint32, // sectionLabelsColor
      sLV: Primitive_Type.Uint32, // sectionLabelsVisible
      sPC: Primitive_Type.Uint32, // sectionPlaneColor
      sCC: Primitive_Type.Uint32, // sectionCentersColor
      sCV: Primitive_Type.Uint32 // sectionCentersVisible
    }
  }

  // ------------------------
  // toArrayBuffer
  // ------------------------

  toArrayBuffer(myDv) {
    const writeToDv = GlUtils.createWriter(myDv, this.properties);

    writeToDv('type', this.type);
    if (this.name !== '') writeToDv('n', this.name);
    if (this.renderOrder !== 0) writeToDv('rO', this.renderOrder);
    writeToDv('v', this.visible);
    writeToDv('l', this.layers.mask);
    writeToDv('m', this.matrix.toArray());
    if (this.matrixAutoUpdate === false) writeToDv('mAU', false);
    writeToDv('p', this.position);

    writeToDv('sLC', this.sectionLabelsColor);
    writeToDv('sLF', this.sectionLabelsFont);
    if (this.sectionLabelsVisible) writeToDv('sLV', this.sectionLabelsVisible);

    writeToDv('sPC', this.sectionPlaneColor);
    writeToDv('sCC', this.sectionCentersColor);
    if (this.sectionCentersVisible) writeToDv('sCV', this.sectionCentersVisible);

    if (this.children.length) {
      writeToDv('ch', this.children.length);
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].isGlObb) {
          this.children[i].toArrayBuffer(myDv);
        }
      }
      writeToDv('chEnd');
    }

    // if (this.children.length) {
    //   object.ch = [];
    //   for (let i = 0; i < this.children.length; i++) {
    //     const glObb = this.children[i];
    //     if (glObb.isGlObb && glObb.getPointsCount() > 0) {
    //       glObb.uDT = glObb.towards; // glObb.userData.towards
    //       glObb.uDA = glObb.away; // glObb.userData.away
    //       const jsonObj = glObb.toJSON(meta);
    //       object.ch.push(jsonObj.object);
    //     }
    //   }
    // }

    writeToDv('endObj');
  }
}