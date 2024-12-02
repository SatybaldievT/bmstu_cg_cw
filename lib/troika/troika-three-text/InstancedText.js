import {
  Color,
  DoubleSide,
  FrontSide,
  Matrix4,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  Vector2,
  Quaternion,
} from 'three'

import { mergeAttributes } from 'three/examples/jsm/utils/BufferGeometryUtils'

import { GlyphsGeometry } from './GlyphsGeometry.js'
import { getTextRenderInfo } from './TextBuilder.js'
import { GlInstancedBase } from '../../core/gl-instansedBase.js'
import {DefaultFont, GlSnapMode} from '../../core/gl-constants';
import { createTextDerivedMaterial } from '../troika-three-text/TextDerivedMaterial.js'


const defaultMaterial = /*#__PURE__*/ new MeshBasicMaterial({
  color: 0xffffff,
  side: DoubleSide,
  transparent: true
})
const defaultStrokeColor = 0x808080

const tempMat4 = /*#__PURE__*/ new Matrix4()
const tempVec3a = /*#__PURE__*/ new Vector3()
const tempVec3b = /*#__PURE__*/ new Vector3()
const tempQuat = /*#__PURE__*/ new Quaternion()
const tempArray = []
const origin = /*#__PURE__*/ new Vector3()
const defaultOrient = '+x+y'

const inverseRotation = new Matrix3();
// orientMatrix with respect to parent
const orientMatrixWRTparent = new Matrix3();

function first(o) {
  return Array.isArray(o) ? o.find((v) => (v && v.isText)) : o
}

let getFlatRaycastMesh = () => {
  const mesh = new Mesh(
    new PlaneGeometry(1, 1),
    defaultMaterial
  )
  getFlatRaycastMesh = () => mesh
  return mesh
}
let getCurvedRaycastMesh = () => {
  const mesh = new Mesh(
    new PlaneGeometry(1, 1, 32, 1),
    defaultMaterial
  )
  getCurvedRaycastMesh = () => mesh
  return mesh
}

const syncStartEvent = { type: 'syncstart' }
const syncCompleteEvent = { type: 'synccomplete' }

const SYNCABLE_PROPS = [
  'font',
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'maxWidth',
  'overflowWrap',
  'text',
  'direction',
  'textAlign',
  'textIndent',
  'whiteSpace',
  'anchorX',
  'anchorY',
  'colorRanges',
  'sdfGlyphSize'
]

const COPYABLE_PROPS = SYNCABLE_PROPS.concat(
  'material',
  'color',
  'depthOffset',
  'clipRect',
  'curveRadius',
  'orientation',
  'glyphGeometryDetail'
)

/**
 * @class InstancedText
 *
 * This class is used as an instanced merger of Troika Text objects
 * and it is not supposed to be used to create textRenderInfo on its own
 */
class InstancedText extends GlInstancedBase {
  constructor(count) {
    super();
    this.geometry = new GlyphsGeometry();
    this.count = count;

    // === Texts layout properties: === //
    this.type = 'InstancedText';
    this.isInstancedText = true;

    /**
     * @member {number|string} anchorX
     * Defines the horizontal position in the text block that should line up with the local origin.
     * Can be specified as a numeric x position in local units, a string percentage of the total
     * text block width e.g. `'25%'`, or one of the following keyword strings: 'left', 'center',
     * or 'right'.
     */
    this.anchorX = 0

    /**
     * @member {number|string} anchorX
     * Defines the vertical position in the text block that should line up with the local origin.
     * Can be specified as a numeric y position in local units (note: down is negative y), a string
     * percentage of the total text block height e.g. `'25%'`, or one of the following keyword strings:
     * 'top', 'top-baseline', 'top-cap', 'top-ex', 'middle', 'bottom-baseline', or 'bottom'.
     */
    this.anchorY = 0

    /**
     * @member {number} curveRadius
     * Defines a cylindrical radius along which the text's plane will be curved. Positive numbers put
     * the cylinder's centerline (oriented vertically) that distance in front of the text, for a concave
     * curvature, while negative numbers put it behind the text for a convex curvature. The centerline
     * will be aligned with the text's local origin; you can use `anchorX` to offset it.
     *
     * Since each glyph is by default rendered with a simple quad, each glyph remains a flat plane
     * internally. You can use `glyphGeometryDetail` to add more vertices for curvature inside glyphs.
     */
    this.curveRadius = 0

    /**
     * @member {string} direction
     * Sets the base direction for the text. The default value of "auto" will choose a direction based
     * on the text's content according to the bidi spec. A value of "ltr" or "rtl" will force the direction.
     */
    this.direction = 'auto'

    /**
     * @member {string} font
     * URL of a custom font to be used. Font files can be in .ttf, .otf, or .woff (not .woff2) formats.
     * Defaults to the Roboto font loaded from Google Fonts.
     */
    this.font = DefaultFont; //will use default from TextBuilder

    /**
     * @member {number} fontSize
     * The size at which to render the font in local units; corresponds to the em-box height
     * of the chosen `font`.
     */
    this.fontSize = 0.12

    /**
     * @member {number} letterSpacing
     * Sets a uniform adjustment to spacing between letters after kerning is applied. Positive
     * numbers increase spacing and negative numbers decrease it.
     */
    this.letterSpacing = 0

    /**
     * @member {number|string} lineHeight
     * Sets the height of each line of text, as a multiple of the `fontSize`. Defaults to 'normal'
     * which chooses a reasonable height based on the chosen font's ascender/descender metrics.
     */
    this.lineHeight = 'normal'

    /**
     * @member {number} maxWidth
     * The maximum width of the text block, above which text may start wrapping according to the
     * `whiteSpace` and `overflowWrap` properties.
     */
    this.maxWidth = Infinity

    /**
     * @member {string} overflowWrap
     * Defines how text wraps if the `whiteSpace` property is `normal`. Can be either `'normal'`
     * to break at whitespace characters, or `'break-word'` to allow breaking within words.
     * Defaults to `'normal'`.
     */
    this.overflowWrap = 'normal'

    /**
     * @member {string} textAlign
     * The horizontal alignment of each line of text within the overall text bounding box.
     */
    this.textAlign = 'left'

    /**
     * @member {number} textIndent
     * Indentation for the first character of a line; see CSS `text-indent`.
     */
    this.textIndent = 0

    /**
     * @member {string} whiteSpace
     * Defines whether text should wrap when a line reaches the `maxWidth`. Can
     * be either `'normal'` (the default), to allow wrapping according to the `overflowWrap` property,
     * or `'nowrap'` to prevent wrapping. Note that `'normal'` here honors newline characters to
     * manually break lines, making it behave more like `'pre-wrap'` does in CSS.
     */
    this.whiteSpace = 'normal'


    // === Presentation properties: === //

    /**
     * @member {Material} material
     * Defines a _base_ material to be used when rendering the text. This material will be
     * automatically replaced with a material derived from it, that adds shader code to
     * decrease the alpha for each fragment (pixel) outside the text glyphs, with antialiasing.
     * By default it will derive from a simple white MeshBasicMaterial, but you can use any
     * of the other mesh materials to gain other features like lighting, texture maps, etc.
     *
     * Also see the `color` shortcut property.
     */
    // this.material = createTextDerivedMaterial(defaultMaterial.clone());
    this.material = createTextDerivedMaterial(defaultMaterial.clone());

    /**
     * @member {string|number|THREE.THREE.Color} color
     * This is a shortcut for setting the `color` of the text's material. You can use this
     * if you don't want to specify a whole custom `material`. Also, if you do use a custom
     * `material`, this color will only be used for this particuar Text instance, even if
     * that same material instance is shared across multiple Text objects.
     */
    this.color = null

    /**
     * @member {object|null} colorRanges
     * WARNING: This API is experimental and may change.
     * This allows more fine-grained control of colors for individual or ranges of characters,
     * taking precedence over the material's `color`. Its format is an Object whose keys each
     * define a starting character index for a range, and whose values are the color for each
     * range. The color value can be a numeric hex color value, a `THREE.THREE.Color` object, or
     * any of the strings accepted by `THREE.THREE.Color`.
     */
    this.colorRanges = null

    /**
     * @member {number|string} outlineWidth
     * WARNING: This API is experimental and may change.
     * The width of an outline/halo to be drawn around each text glyph using the `outlineColor` and `outlineOpacity`.
     * Can be specified as either an absolute number in local units, or as a percentage string e.g.
     * `"12%"` which is treated as a percentage of the `fontSize`. Defaults to `0`, which means
     * no outline will be drawn unless an `outlineOffsetX/Y` or `outlineBlur` is set.
     */
    this.outlineWidth = 0

    /**
     * @member {string|number|THREE.THREE.Color} outlineColor
     * WARNING: This API is experimental and may change.
     * The color of the text outline, if `outlineWidth`/`outlineBlur`/`outlineOffsetX/Y` are set.
     * Defaults to black.
     */
    this.outlineColor = 0x000000

    /**
     * @member {number} outlineOpacity
     * WARNING: This API is experimental and may change.
     * The opacity of the outline, if `outlineWidth`/`outlineBlur`/`outlineOffsetX/Y` are set.
     * Defaults to `1`.
     */
    this.outlineOpacity = 1

    /**
     * @member {number|string} outlineBlur
     * WARNING: This API is experimental and may change.
     * A blur radius applied to the outer edge of the text's outline. If the `outlineWidth` is
     * zero, the blur will be applied at the glyph edge, like CSS's `text-shadow` blur radius.
     * Can be specified as either an absolute number in local units, or as a percentage string e.g.
     * `"12%"` which is treated as a percentage of the `fontSize`. Defaults to `0`.
     */
    this.outlineBlur = 0

    /**
     * @member {number|string} outlineOffsetX
     * WARNING: This API is experimental and may change.
     * A horizontal offset for the text outline.
     * Can be specified as either an absolute number in local units, or as a percentage string e.g. `"12%"`
     * which is treated as a percentage of the `fontSize`. Defaults to `0`.
     */
    this.outlineOffsetX = 0

    /**
     * @member {number|string} outlineOffsetY
     * WARNING: This API is experimental and may change.
     * A vertical offset for the text outline.
     * Can be specified as either an absolute number in local units, or as a percentage string e.g. `"12%"`
     * which is treated as a percentage of the `fontSize`. Defaults to `0`.
     */
    this.outlineOffsetY = 0

    /**
     * @member {number|string} strokeWidth
     * WARNING: This API is experimental and may change.
     * The width of an inner stroke drawn inside each text glyph using the `strokeColor` and `strokeOpacity`.
     * Can be specified as either an absolute number in local units, or as a percentage string e.g. `"12%"`
     * which is treated as a percentage of the `fontSize`. Defaults to `0`.
     */
    this.strokeWidth = 0

    /**
     * @member {string|number|Color} strokeColor
     * WARNING: This API is experimental and may change.
     * The color of the text stroke, if `strokeWidth` is greater than zero. Defaults to gray.
     */
    this.strokeColor = defaultStrokeColor

    /**
     * @member {number} strokeOpacity
     * WARNING: This API is experimental and may change.
     * The opacity of the stroke, if `strokeWidth` is greater than zero. Defaults to `1`.
     */
    this.strokeOpacity = 1

    /**
     * @member {number} fillOpacity
     * WARNING: This API is experimental and may change.
     * The opacity of the glyph's fill from 0 to 1. This behaves like the material's `opacity` but allows
     * giving the fill a different opacity than the `strokeOpacity`. A fillOpacity of `0` makes the
     * interior of the glyph invisible, leaving just the `strokeWidth`. Defaults to `1`.
     */
    this.fillOpacity = 1

    /**
     * @member {number} depthOffset
     * This is a shortcut for setting the material's `polygonOffset` and related properties,
     * which can be useful in preventing z-fighting when this text is laid on top of another
     * plane in the scene. Positive numbers are further from the camera, negatives closer.
     */
    this.depthOffset = 0

    /**
     * @member {Array<number>} clipRect
     * If specified, defines a `[minX, minY, maxX, maxY]` of a rectangle outside of which all
     * pixels will be discarded. This can be used for example to clip overflowing text when
     * `whiteSpace='nowrap'`.
     */
    this.clipRect = null

    /**
     * @member {string} orientation
     * Defines the axis plane on which the text should be laid out when the mesh has no extra
     * rotation transform. It is specified as a string with two axes: the horizontal axis with
     * positive pointing right, and the vertical axis with positive pointing up. By default this
     * is '+x+y', meaning the text sits on the xy plane with the text's top toward positive y
     * and facing positive z. A value of '+x-z' would place it on the xz plane with the text's
     * top toward negative z and facing positive y.
     */
    this.orientation = defaultOrient

    /**
     * @member {number} glyphGeometryDetail
     * Controls number of vertical/horizontal segments that make up each glyph's rectangular
     * plane. Defaults to 1. This can be increased to provide more geometrical detail for custom
     * vertex shader effects, for example.
     */
    this.glyphGeometryDetail = 1

    /**
     * @member {number|null} sdfGlyphSize
     * The size of each glyph's SDF (signed distance field) used for rendering. This must be a
     * power-of-two number. Defaults to 64 which is generally a good balance of size and quality
     * for most fonts. Larger sizes can improve the quality of glyph rendering by increasing
     * the sharpness of corners and preventing loss of very thin lines, at the expense of
     * increased memory footprint and longer SDF generation time.
     */
    this.sdfGlyphSize = null

    /**
     * @member {boolean} gpuAccelerateSDF
     * When `true`, the SDF generation process will be GPU-accelerated with WebGL when possible,
     * making it much faster especially for complex glyphs, and falling back to a JavaScript version
     * executed in web workers when support isn't available. It should automatically detect support,
     * but it's still somewhat experimental, so you can set it to `false` to force it to use the JS
     * version if you encounter issues with it.
     */
    this.gpuAccelerateSDF = true

    this.debugSDF = false

    /**
     * private member to keep text size unchanged
     */
    this.scaleFactor = false;
    this.__scaleFactor = 1.0;

    this.offset = new Vector3(0, 0, 0);
    this.offsetH = 0;
    this.offsetV = 0;
    this.fontWidth = 0;
    this.usePerpendicularTo = false;

    /**
     * Keep track of inidividual texts after merging
     */
    this.individualTexts = new Map();

    this.selectable = true;
    this.selectedTexts = [];
    this.selectionColor = new Color(0, 0, 1);

    this.syncables = [];
  }

  // /**
  //  * Set specific text properteis by index in instanced text.
  //  * @param {number} index - the index of the instance to set the value for
  //  * @param {Object} textProperties - text's properties
  //  * @param {string} textProperties.text - the text's string what will be displayed on the screne
  //  * @param {number} textProperties.fontSize - the text's fontSize
  //  * @param {number} textProperties.letterSpacing
  //  * @param {number} textProperties.lineHeight
  //  * @param {number} textProperties.maxWidth
  //  * @param {number} textProperties.direction
  //  * @param {number} textProperties.textAlign
  //  * @param {number} textProperties.textIndent
  //  * @param {number} textProperties.whiteSpace
  //  * @param {number} textProperties.overflowWrap
  //  * @param {number} textProperties.anchorX
  //  * @param {number} textProperties.anchorY
  //  * @param {number} textProperties.colorRanges
  //  * @param {number} textProperties.includeCaretPositions
  //  * @param {number} textProperties.sdfGlyphSize
  //  * @param {number} textProperties.gpuAccelerateSDF
  //  */
  // setText(index, textProperties) {
  //   const defaultProperties = {
  //     text: "Default Text",
  //     font: this.font,
  //     fontSize: this.fontSize || 0.1,
  //     letterSpacing: this.letterSpacing || 0,
  //     lineHeight: this.lineHeight || 'normal',
  //     maxWidth: this.maxWidth,
  //     direction: this.direction || 'auto',
  //     textAlign: this.textAlign,
  //     textIndent: this.textIndent,
  //     whiteSpace: this.whiteSpace,
  //     overflowWrap: this.overflowWrap,
  //     anchorX: this.anchorX,
  //     anchorY: this.anchorY,
  //     colorRanges: this.colorRanges,
  //     includeCaretPositions: true, //TODO parameterize
  //     sdfGlyphSize: this.sdfGlyphSize,
  //     gpuAccelerateSDF: this.gpuAccelerateSDF,
  //   }

  //   if (this.__isValidIndex(index)) {
  //     this.syncables.push({...defaultProperties , ...textProperties});
  //   }
  // }

  // /**
  //  * Updates the text rendering according to the current text-related configuration properties.
  //  * This is an async process, so you can pass in a callback function to be executed when it
  //  * finishes.
  //  * @param {function} [callback]
  //  */
  // sync(callback) {
  //   if (this._needsSync) {
  //     this._needsSync = false

  //     // If there's another sync still in progress, queue
  //     if (this._isSyncing) {
  //       (this._queuedSyncs || (this._queuedSyncs = [])).push(callback)
  //     } else {
  //       this._isSyncing = true
  //       this.dispatchEvent(syncStartEvent)

  //       const syncs = new Array(this.syncables)
  //       let atlasLength = 0;
  //       for(let i = 0; i < this.syncables.length; i++) {
  //         atlasLength += this.syncables[i].text.length;
  //         syncs[i] = getTextRenderInfo(this.syncables[i])
  //       }

  //       const scope = this;
  //       return Promise.all(syncs).then((results) => {
  //         scope._isSyncing = false

  //         const glyphAtlasIndices = new Uint16Array(atlasLength);
  //         const glyphBounds = new Float32Array(atlasLength * 4);
  //         const glyphColors = new Uint8Array(atlasLength * 3);
          
  //         debugger;
  //         let atlasIndices = 0;
  //         for (let i = 0; i < results.length; i++) {
  //           // Save result for later use in onBeforeRender
  //           const textRenderInfo = results[i];
  //           scope._textRenderInfo = textRenderInfo;

  //           if (textRenderInfo.glyphAtlasIndices) glyphAtlasIndices.set(textRenderInfo.glyphAtlasIndices, atlasIndices);
  //           if (textRenderInfo.glyphBounds) glyphBounds.set(textRenderInfo.glyphBounds, atlasIndices * 4);
  //           if (textRenderInfo.glyphColors) glyphColors.set(textRenderInfo.glyphColors, atlasIndices * 3);

  //           atlasIndices += textRenderInfo.glyphAtlasIndices.length;

  //           const xMax = textRenderInfo.glyphBounds[2];
  //           const xMin = textRenderInfo.glyphBounds[0];
  //           scope.fontWidth = (xMax - xMin) * 1.1;
  //         }
          
  //         // Update the geometry attributes
  //         scope.geometry.updateGlyphs(
  //           glyphBounds,
  //           glyphAtlasIndices,
  //           scope._textRenderInfo.blockBounds,
  //           scope._textRenderInfo.chunkedBounds,
  //           glyphColors
  //         )
          
  //         // If we had extra sync requests queued up, kick it off
  //         const queued = scope._queuedSyncs
  //         if (queued) {
  //           scope._queuedSyncs = null
  //           scope._needsSync = true
  //           scope.sync(() => {
  //             queued.forEach(fn => fn && fn())
  //           })
  //         }

  //         scope.dispatchEvent(syncCompleteEvent)
  //         if (callback) {
  //           callback()
  //         }
  //       })
  //     }
  //   }
  // }

  /**
   * Initiate a sync if needed - note it won't complete until next frame at the
   * earliest so if possible it's a good idea to call sync() manually as soon as
   * all the properties have been set.
   * @override
   */
  onBeforeRender(renderer, scene, camera, geometry, material, group) {
    // this class is not used to produce text render info
    // this.sync()

    if (this.scaleFactor) {
      const cHeight = camera.top - camera.bottom;
      this.__scaleFactor = cHeight * this.fontSize / camera.zoom;
    } else {
      this.__scaleFactor = 1.0;
    }

    // This may not always be a text material, e.g. if there's a scene.overrideMaterial present
    if (material.isTroikaTextMaterial) {
      this._prepareForRender(material, camera.matrixWorld, camera);
    }

    // We need to force the material to FrontSide to avoid the double-draw-call performance hit
    // introduced in Three.js r130: https://github.com/mrdoob/three.js/pull/21967 - The sidedness
    // is instead applied via drawRange in the GlyphsGeometry.
    material._hadOwnSide = material.hasOwnProperty('side')
    this.geometry.setSide(material._actualSide = material.side)
    material.side = FrontSide

    // The next peace of code is intended to handle
    // local clipping planes correctly
    const cp = material.clippingPlanes;
    const min = material.minPoint;
    const max = material.maxPoint;
    const planePoint = material.planePoint;
    if (cp && min && max && planePoint) {
      const leftPl = cp[0];
      const rightPl = cp[1];
      const topPl = cp[2];
      const bottomPl = cp[3];

      planePoint.copy(min).divideScalar(camera.zoom).add(camera.focalPoint);
      leftPl.constant = - planePoint.dot(leftPl.normal);
      bottomPl.constant = - planePoint.dot(bottomPl.normal);
      planePoint.copy(max).divideScalar(camera.zoom).add(camera.focalPoint);
      rightPl.constant = - planePoint.dot(rightPl.normal);
      topPl.constant = - planePoint.dot(topPl.normal);
    }
  }

  onAfterRender(renderer, scene, camera, geometry, material, group) {
    // Restore original material side
    if (material._hadOwnSide) {
      material.side = material._actualSide
    } else {
      delete material.side // back to inheriting from base material
    }
  }

  /**
   * Shortcut to dispose the geometry specific to this instance.
   * Note: we don't also dispose the derived material here because if anything else is
   * sharing the same base material it will result in a pause next frame as the program
   * is recompiled. Instead users can dispose the base material manually, like normal,
   * and we'll also dispose the derived material at that time.
   */
  dispose() {
    this.deselect();
    this.geometry.dispose();
    this.material.dispose();

    const texts = Array.from(this.individualTexts.keys());

    for (let j = 0; j < texts.length; j++) {
      texts[j].dispose();
    }

    texts.length = 0;
    this.individualTexts.length = 0;
    this.individualTexts.clear();
  }

  /**
   * @property {TroikaTextRenderInfo|null} textRenderInfo
   * @readonly
   * The current processed rendering data for this TextMesh, returned by the TextBuilder after
   * a `sync()` call. This will be `null` initially, and may be stale for a short period until
   * the asynchrous `sync()` process completes.
   */
  get textRenderInfo() {
    return this._textRenderInfo || null
  }

  // for merging texts
  set textRenderInfo(value) {
    this._textRenderInfo = value;
  }

  get glyphGeometryDetail() {
    return this.geometry.detail
  }
  set glyphGeometryDetail(detail) {
    this.geometry.detail = detail
  }

  get curveRadius() {
    return this.geometry.curveRadius
  }
  set curveRadius(r) {
    this.geometry.curveRadius = r
  }

  // Create and update material for shadows upon request:
  get customDepthMaterial() {
    return first(this.material).getDepthMaterial()
  }
  get customDistanceMaterial() {
    return first(this.material).getDistanceMaterial()
  }

  _prepareForRender(material, orientMatrix, camera) {
    const isOutline = material.isTextOutlineMaterial
    const uniforms = material.uniforms
    const textInfo = this.textRenderInfo
    if (textInfo) {
      const { sdfTexture, blockBounds } = textInfo
      uniforms.uTroikaSDFTexture.value = sdfTexture
      uniforms.uTroikaSDFTextureSize.value.set(sdfTexture.image.width, sdfTexture.image.height)
      uniforms.uTroikaSDFGlyphSize.value = textInfo.sdfGlyphSize
      uniforms.uTroikaSDFExponent.value = textInfo.sdfExponent
      uniforms.uTroikaTotalBounds.value.fromArray(blockBounds)
      uniforms.uTroikaUseGlyphColors.value = !isOutline && !!textInfo.glyphColors

      let distanceOffset = 0
      let blurRadius = 0
      let strokeWidth = 0
      let fillOpacity
      let strokeOpacity
      let strokeColor
      let offsetX = 0
      let offsetY = 0

      if (isOutline) {
        let { outlineWidth, outlineOffsetX, outlineOffsetY, outlineBlur, outlineOpacity } = this
        distanceOffset = this._parsePercent(outlineWidth) || 0
        blurRadius = Math.max(0, this._parsePercent(outlineBlur) || 0)
        fillOpacity = outlineOpacity
        offsetX = this._parsePercent(outlineOffsetX) || 0
        offsetY = this._parsePercent(outlineOffsetY) || 0
      } else {
        strokeWidth = Math.max(0, this._parsePercent(this.strokeWidth) || 0)
        if (strokeWidth) {
          strokeColor = this.strokeColor
          uniforms.uTroikaStrokeColor.value.set(strokeColor == null ? defaultStrokeColor : strokeColor)
          strokeOpacity = this.strokeOpacity
          if (strokeOpacity == null) strokeOpacity = 1
        }
        fillOpacity = this.fillOpacity
      }

      uniforms.uTroikaDistanceOffset.value = distanceOffset
      uniforms.uTroikaPositionOffset.value.set(offsetX, offsetY)
      uniforms.uTroikaOffset.value.copy(this.offset || new Vector3())
      uniforms.uTroikaSide.value = this.side || 1
      uniforms.uTroikaBlurRadius.value = blurRadius
      uniforms.uTroikaStrokeWidth.value = strokeWidth
      uniforms.uTroikaStrokeOpacity.value = strokeOpacity
      uniforms.uTroikaFillOpacity.value = fillOpacity == null ? 1 : fillOpacity
      uniforms.uTroikaCurveRadius.value = this.curveRadius || 0
      uniforms.uTroikaScaleFactor.value = this.__scaleFactor || 1
      uniforms.uTroikaOffsetH.value = this.offsetH * (this.fontWidth ? this.fontWidth : this.fontSize)
      uniforms.uTroikaOffsetV.value = this.offsetV * this.fontSize
      uniforms.uTroikaUsePerpendicularTo.value = this.usePerpendicularTo

      let clipRect = this.clipRect
      if (clipRect && Array.isArray(clipRect) && clipRect.length === 4) {
        uniforms.uTroikaClipRect.value.fromArray(clipRect)
      } else {
        // no clipping - choose a finite rect that shouldn't ever be reached by overflowing glyphs or outlines
        const pad = (this.fontSize || 0.1) * 100
        uniforms.uTroikaClipRect.value.set(
          blockBounds[0] - pad,
          blockBounds[1] - pad,
          blockBounds[2] + pad,
          blockBounds[3] + pad
        )
      }
      this.geometry.applyClipRect(uniforms.uTroikaClipRect.value)
    }
    uniforms.uTroikaSDFDebug.value = !!this.debugSDF
    material.polygonOffset = !!this.depthOffset
    material.polygonOffsetFactor = material.polygonOffsetUnits = this.depthOffset || 0

    // Shortcut for setting material color via `color` prop on the mesh; this is
    // applied only to the derived material to avoid mutating a shared base material.
    const color = isOutline ? (this.outlineColor || 0) : this.color

    if (color == null) {
      delete material.color //inherit from base
    } else {
      const colorObj = material.hasOwnProperty('color') ? material.color : (material.color = new Color())
      if (color !== colorObj._input || typeof color === 'object') {
        colorObj.set(colorObj._input = color)
      }
    }

    // base orientation
    let orient = this.orientation || defaultOrient
    if (orient === 'camera' && orientMatrix && orientMatrix.isMatrix4) {
      if (this.parent) {
        inverseRotation.setFromMatrix4(this.parent.matrixWorld);
        inverseRotation.invert();
        orientMatrixWRTparent.setFromMatrix4(orientMatrix);
        orientMatrixWRTparent.premultiply(inverseRotation);
        uniforms.uTroikaOrient.value.copy(orientMatrixWRTparent);
      } else {
        uniforms.uTroikaOrient.value.setFromMatrix4(orientMatrix);
      }
    } else if (orient !== material._orientation) {
      let rotMat = uniforms.uTroikaOrient.value
      orient = orient.replace(/[^-+xyz]/g, '')
      let match = orient !== defaultOrient && orient.match(/^([-+])([xyz])([-+])([xyz])$/)
      if (match) {
        let [, hSign, hAxis, vSign, vAxis] = match
        tempVec3a.set(0, 0, 0)[hAxis] = hSign === '-' ? 1 : -1
        tempVec3b.set(0, 0, 0)[vAxis] = vSign === '-' ? -1 : 1
        tempMat4.lookAt(origin, tempVec3a.cross(tempVec3b), tempVec3b)
        rotMat.setFromMatrix4(tempMat4)
      } else {
        rotMat.identity()
      }
      material._orientation = orient
    }
  }

  _parsePercent(value) {
    if (typeof value === 'string') {
      let match = value.match(/^(-?[\d.]+)%$/)
      let pct = match ? parseFloat(match[1]) : NaN
      value = (isNaN(pct) ? 0 : pct / 100) * this.fontSize
    }
    return value
  }

  /**
   * Translate a point in local space to an x/y in the text plane.
   */
  localPositionToTextCoords(position, target = new Vector2()) {
    target.copy(position) //simple non-curved case is 1:1
    const r = this.curveRadius
    if (r) { //flatten the curve
      target.x = Math.atan2(position.x, Math.abs(r) - Math.abs(position.z)) * Math.abs(r)
    }
    return target
  }

  /**
   * Translate a point in world space to an x/y in the text plane.
   */
  worldPositionToTextCoords(position, target = new Vector2()) {
    tempVec3a.copy(position)
    return this.localPositionToTextCoords(this.worldToLocal(tempVec3a), target)
  }

  /**
   * @override Custom raycasting to test against the whole text block's max rectangular bounds
   * TODO is there any reason to make this more granular, like within individual line or glyph rects?
   */
  raycast(raycaster, intersects) {
    // don't do raycasting if the object is not selectable
    if (
      !this.visible ||
      (this.parent && !this.parent.visible) ||
      (!this.selectable && !this.snappable)
    ) return;

    const snapMode = raycaster.params.snapMode;
    if (snapMode && snapMode !== GlSnapMode.None && !this.snappable) return;

    const camera = raycaster.camera;
    const viewDirN = camera.getViewDirection().negate();
    const texts = Array.from(this.individualTexts.keys());
    
    for (let j = 0; j < texts.length; j++) {
      const textObj = texts[j];
      const { textRenderInfo, curveRadius } = textObj
      if (textRenderInfo) {
        const bounds = textRenderInfo.blockBounds
        const index = textObj.lIndex;
        const raycastMesh = curveRadius ? getCurvedRaycastMesh() : getFlatRaycastMesh()
        const geom = raycastMesh.geometry
        raycastMesh.matrix.copy(textObj.matrix);
        const { position, uv } = geom.attributes
        for (let i = 0; i < uv.count; i++) {
          let x = bounds[0] + (uv.getX(i) * (bounds[2] - bounds[0]))
          const y = bounds[1] + (uv.getY(i) * (bounds[3] - bounds[1]))
          let z = 0
          if (curveRadius) {
            z = curveRadius - Math.cos(x / curveRadius) * curveRadius
            x = Math.sin(x / curveRadius) * curveRadius
          }
          position.setXYZ(i, x, y, z)
        }
        geom.boundingSphere = textObj.geometry.boundingSphere
        geom.boundingBox = textObj.geometry.boundingBox

        if ( this.parent === null ) {
          raycastMesh.matrixWorld.copy( raycastMesh.matrix );
        } else {
          raycastMesh.matrixWorld.multiplyMatrices( this.parent.matrixWorld, raycastMesh.matrix );
        }

        if (this.usePerpendicularTo) {
          const position = new Vector3();
          const scale = new Vector3();

          raycastMesh.matrixWorld.decompose(position, tempQuat, scale);

          const perpVArr = this.getUniformAt('uTroikaPerpendicularTo', index);
          const offset = this.getUniformAt('uTroikaOffset', index);
          const side = this.getUniformAt('uTroikaSide', index);

          const posOffset = new Vector3(offset.x, offset.y, offset.z);
          const upDir = new Vector3(perpVArr.x, perpVArr.y, perpVArr.z);
          const tempVec3a = new Vector3().crossVectors(upDir, viewDirN).normalize();
          const tempVec3b = new Vector3().crossVectors(viewDirN, tempVec3a).normalize();

          tempQuat.setFromRotationMatrix(new Matrix4().makeBasis(tempVec3a, tempVec3b, viewDirN));
          raycastMesh.matrixWorld.identity();

          tempVec3a.setLength(posOffset.length());
          tempVec3a.multiplyScalar(side);
          position.add(tempVec3a);
          
          raycastMesh.matrixWorld.compose(position, tempQuat, scale);
        }

        raycastMesh.material.side = DoubleSide;
        tempArray.length = 0
        raycastMesh.raycast(raycaster, tempArray);
        for (let i = 0; i < tempArray.length; i++) {
          tempArray[i].object = this
          tempArray[i].child = {
            index: j,
            object: textObj,
          }
          intersects.push(tempArray[i])
        }
      }
    }
  }

  select(child) {
    const textObj = child.object;
    const color = this.selectionColor;
    const i = this.individualTexts.get(textObj);
    for (let atlasIdx = 0; atlasIdx < textObj.textRenderInfo.glyphAtlasIndices.length; atlasIdx++) {
      this.setColorAt(i + atlasIdx, color);
    }
    this.instanceColor.needsUpdate = true;
    this.selectedTexts.push(textObj);
  }

  deselect() {
    const color = new Color();
    for (const textObj of this.selectedTexts) {
      const i = this.individualTexts.get(textObj);
      for (let atlasIdx = 0; atlasIdx < textObj.textRenderInfo.glyphAtlasIndices.length; atlasIdx++) {
        textObj.color ? color.set(textObj.color) : color.set(textObj.material.color);
        this.setColorAt(i + atlasIdx, color);
      }
    }
    this.instanceColor.needsUpdate = true;
    this.selectedTexts.length = 0;
    if (this.selectedMesh) this.selectedMesh.visible = false;
  }

  copy(source) {
    // Prevent copying the geometry reference so we don't end up sharing attributes between instances
    const geom = this.geometry
    super.copy(source)
    this.geometry = geom

    COPYABLE_PROPS.forEach(prop => {
      this[prop] = source[prop]
    })
    return this
  }

  clone() {
    return new this.constructor().copy(this)
  }
}


// Create setters for properties that affect text layout:
SYNCABLE_PROPS.forEach(prop => {
  const privateKey = '_private_' + prop
  Object.defineProperty(InstancedText.prototype, prop, {
    get() {
      return this[privateKey]
    },
    set(value) {
      if (value !== this[privateKey]) {
        this[privateKey] = value
        this._needsSync = true
      }
    }
  })
})

function mergeTextsIntoInstancedText(texts, disableDepthTest = false) {
  // try to simply set uniforms as in the first text
  // (another possibility is to set uniform for each instance)
  const firstText = first(texts);
  if (firstText === undefined) return null;
  if (firstText.textRenderInfo === undefined) return null;
  const hasAtts = texts.every(t => t.geometry.getAttribute('aTroikaGlyphBounds') && t.geometry.getAttribute('aTroikaGlyphIndex'));
  if (!hasAtts) return;
  const mergedBounds = mergeAttributes(texts.map(t => t.geometry.getAttribute('aTroikaGlyphBounds'))).array;
  const mergedIndices = mergeAttributes(texts.map(t => t.geometry.getAttribute('aTroikaGlyphIndex'))).array;
  const mergedColors = firstText.colorRanges && mergeAttributes(texts.map(t => t.geometry.getAttribute('aTroikaGlyphColor'))).array;
  
  const instancedText = new InstancedText();
  instancedText.count = mergedIndices.length;
  const individualTexts = instancedText.individualTexts;
  // set _baseMaterial for instanced uniforms mesh to override uniforms with attributes
  instancedText.material = firstText.material;
  // textRenderInfo has reference to sdfTexture and other common parameters
  instancedText.textRenderInfo = firstText.textRenderInfo;

  // assume that orientation and scale factor is the same for all texts
  instancedText.orientation = firstText.orientation;
  instancedText.scaleFactor = firstText.scaleFactor;
  instancedText.usePerpendicularTo = firstText.usePerpendicularTo;
  
  // for better visibility
  if (disableDepthTest) {
    instancedText.material.depthTest = false;
    instancedText.renderOrder = Infinity;
  }

  instancedText.selectable = firstText.selectable;

  instancedText.geometry.updateGlyphs(
    mergedBounds,
    mergedIndices,
    firstText.geometry._blockBounds,
    firstText.geometry._chunkedBounds,
    mergedColors
  );
  let matrixIdx = 0;
  const color = new Color();
  for (let i = 0; i < texts.length; i++) {
    texts[i].updateMatrixWorld();
    individualTexts.set(texts[i], matrixIdx);
    // texts[i].updateMatrix();
    texts[i].lIndex = matrixIdx;
    for (let atlasIdx = 0; atlasIdx < texts[i].textRenderInfo.glyphAtlasIndices.length; atlasIdx++) {
      instancedText.setMatrixAt(matrixIdx, texts[i].matrix);
      texts[i].color ? color.set(texts[i].color) : color.set(texts[i].material.color);
      instancedText.setColorAt(matrixIdx, color);
      if (texts[i].perpendicularTo) {
        instancedText.setUniformAt('uTroikaPerpendicularTo', matrixIdx, texts[i].perpendicularTo);
      }
      if (texts[i].offsetH) {
        const value = texts[i].offsetH * (texts[i].fontWidth ? texts[i].fontWidth : texts[i].fontSize);
        instancedText.setUniformAt('uTroikaOffsetH', matrixIdx, value);
      }
      if (texts[i].offset) {
        instancedText.setUniformAt('uTroikaOffset', matrixIdx, texts[i].offset);
      }
      if (texts[i].side) {
        instancedText.setUniformAt('uTroikaSide', matrixIdx, texts[i].side);
      }
      if (texts[i].offsetV) {
        const value = texts[i].offsetV * texts[i].fontSize;
        instancedText.setUniformAt('uTroikaOffsetV', matrixIdx, value);
      }
      if (texts[i].fillOpacity === 0) {
        instancedText.setUniformAt('uTroikaFillOpacity', matrixIdx, texts[i].fillOpacity);
      }
      
      matrixIdx++;
    }
  }
  
  return instancedText;
}

export {
  InstancedText,
  mergeTextsIntoInstancedText
}
