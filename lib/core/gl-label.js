import {Text} from '../troika/troika-three-text/Text';
import {DefaultFont} from './gl-constants';

export class GlLabel extends Text {
  constructor(params, fromJSON) {
    super();

    this.isGlLabel = true;
    this.type = 'GlLabel';

    // selection
    this.selectable = false;
    this.isSelected = false;

    this.font = DefaultFont;

    const sizeFactor = 67;
    if (!fromJSON) {
      if (!params) params = {};
      if (params.color !== null && params.color !== undefined) this.color = params.color;
      if (params.name) this.name = params.name;
      if (params.orientation) this.orientation = params.orientation;
      if (params.coords && params.coords.length !== 0) this.coords = params.coords[0];
      if (params.scaleFactor) this.scaleFactor = true;

      // the next lines are intented to be used just for backward compatibility
      if (params.labels && params.labels.length !== 0) this.text = params.labels[0];
      if (!(isNaN(params.size)) && params.size / sizeFactor) this.fontSize = params.size / sizeFactor;

      if (typeof params.font === 'string' && params.font.length > 5) this.font = params.font;
      if (params.text) this.text = params.text;
      if (params.selectable) this.selectable = params.selectable;
      if (params.fontSize) this.fontSize = params.fontSize;
      if (params.offset) this.offset = params.offset;
      if (params.side) this.side = params.side;
      if (!isNaN(params.offsetH)) this.offsetH = params.offsetH;
      if (!isNaN(params.offsetV)) this.offsetV = params.offsetV;
      if (params.anchorX) this.anchorX = params.anchorX;
      if (params.anchorY) this.anchorY = params.anchorY;
      if (params.perpendicularTo && params.perpendicularTo.isVector3) this.perpendicularTo = params.perpendicularTo.clone();
      if (!params.visible) this.visible = params.visible;
    } else {
      this._initFromJson(fromJSON);
    }
  }

  /**
   * Initialise an instance from a json file
   * @param {object} fromJSON - json object
   */
  _initFromJson(fromJSON) {
    const sizeFactor = 67;
    //uuid
    if (fromJSON.uuid) this.uuid = fromJSON.uuid;
    if (fromJSON.p) this.position.set(fromJSON.p.x, fromJSON.p.y, fromJSON.p.z);
    if (fromJSON.c) this.color = fromJSON.c;
    if (fromJSON.txt) this.text = fromJSON.txt;
    if (fromJSON.cd) this.coords = fromJSON.cd[0];
    if (fromJSON.lb) this.text = fromJSON.lb[0];
    // if (fromJSON.size && fromJSON.size / sizeFactor) this.fontSize = fromJSON.size / sizeFactor;

    if (fromJSON.v) this.visible = fromJSON.v;
    if (!fromJSON.sl) this.selectable = fromJSON.sl;

    if (typeof fromJSON.f === 'string' && fromJSON.f.length > 5) this.font = fromJSON.f;
    if (fromJSON.o) this.orientation = fromJSON.o;
    if (fromJSON.fS) this.fontSize = fromJSON.fS;
    if (fromJSON.oH) this.offsetH = fromJSON.oH;
    if (fromJSON.oV) this.offsetV = fromJSON.oV;
    if (fromJSON.aX) this.anchorX = fromJSON.aX;
    if (fromJSON.aY) this.anchorY = fromJSON.aY;

    if (fromJSON.m !== undefined) {
      this.matrix.fromArray(fromJSON.m);
      if (fromJSON.mAU !== undefined) this.matrixAutoUpdate = fromJSON.mAU;
      if (this.matrixAutoUpdate) this.matrix.decompose(this.position, this.quaternion, this.scale);
    } else {
      if (fromJSON.position !== undefined ) this.position.fromArray(fromJSON.position);
      if (fromJSON.rotation !== undefined ) this.rotation.fromArray(fromJSON.rotation);
      if (fromJSON.quaternion !== undefined ) this.quaternion.fromArray(fromJSON.quaternion);
      if (fromJSON.scale !== undefined ) this.scale.fromArray(fromJSON.scale );
    }

    if (fromJSON.rO) this.renderOrder = fromJSON.rO;
  }

  /**
   * Set the URL of a custom font file to be used. Supported font formats are:
   * .ttf,  .otf,  .woff (.woff2 is not supported)
   * Default: The Roboto font loaded from Google Fonts CDN
   * @param {String} fontURL - url of the font
   */
  setFont(fontURL) {
    if (typeof fontURL === 'string' && fontURL.length > 5) {
      this.font = fontURL;
      this.sync();
    }
  }

  setFontSize(size) {
    if (Number.isNaN(size)) return;

    this.fontSize = size;
    this.sync();
  }

  /**
   * Set a new label
   * @param {String} newLabel - new label to setz text of the GlLabel
   */
  setLabel(newLabel) {
    if (typeof newLabel === 'string') {
      this.text = newLabel;
      this.sync();
    }
  }

  /**
   * Set a new color
   * @param {number} color - hexadecimal color
   * @return {void}
   */
  setColor(color) {
    if (color !== null || color !== undefined) this.color = color;

    if (this.material) {
      this.material.color.setHex(this.color);
    }
  }

  /**
   * select / deselect
   * @return {void}
   */
  select() {
    if (!this.selectable || this.isSelected) return null;

    // this.setColor(clrSelected);
    const clrSelected = 0x0000FF;

    if (this.material) {
      this.material.color.setHex(clrSelected);
    }

    this.isSelected = true;
    return null;
  }

  deselect(child) {
    if (child && child.index !== undefined) return;

    // this.setColor(this.color);
    // this.isSelected = false;

    if (this.material) {
      this.material.color.setHex(this.color);
    }

    this.isSelected = false;
  }

  /**
   * this function will be called by raycaster
   * @param {Object} raycaster - THREE.js Raycaster object
   * @param {Object} intersects - array of intersects
   */
  raycast(raycaster, intersects) {
    // don't do raycasting if the object is not selectable
    if (!this.visible || !this.selectable) return;

    super.raycast(raycaster, intersects);
  }

  /**
   * toJSON
   * @param {Object|null|undefined} meta - meta object
   * @return {Object} - returns JSON object of the GlLable object
   */
  toJSON(meta, keepUuid = false) {
    const output = {};

    // meta is a string when called from JSON.stringify
    const isRootObject = (meta === undefined || typeof meta === 'string');
    if (isRootObject) {
      output.metadata = {
        version: 5.0,
        type: 'GlLabel',
        generator: 'GlLabel.toJSON'
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
    object.p = this.position;
    if (this.matrixAutoUpdate === false) object.mAU = false;

    object.cd = this.coords;
    object.lb = this.labels;
    object.fS = this.fontSize;
    object.c = this.color;
    object.f = this.font;
    if (!this.selectable) object.sl = this.selectable;
    if (this.offsetH) object.oH = this.offsetH;
    if (this.offsetV) object.oV = this.offsetV;
    if (this.anchorX) object.aX = this.anchorX;
    if (this.anchorY) object.aY = this.anchorY;

    output.object = object;

    return output;
  }
}