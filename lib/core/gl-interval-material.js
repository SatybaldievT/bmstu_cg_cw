import {
  UniformsLib,
  Color,
  Vector2,
  ShaderLib,
  ShaderMaterial,
  UniformsUtils
} from 'three';

/* eslint-disable no-undef */

UniformsLib.line = {
  diffuse: {value: new Color(0xeeeeee)},
  opacity: {value: 1.0},
  linewidth: {value: 1},
  resolution: {value: new Vector2(1, 1)},
  dashScale: {value: 1},
  dashSize: {value: 1},
  gapSize: {value: 1} // todo FIX - maybe change to totalSize
};

ShaderLib['line'] = {
  uniforms: UniformsLib.line,

  vertexShader:
    `
    attribute vec3 segmentPosition;
    attribute vec2 segmentUv;

    #include <common>
    #include <color_pars_vertex>
    #include <fog_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    #include <clipping_planes_pars_vertex>

    uniform float linewidth;
    uniform vec2  resolution;

    attribute vec3 instanceStart;
    attribute vec3 instanceEnd;

    attribute vec3 instanceColorStart;
    attribute vec3 instanceColorEnd;

    varying vec2 vUv;

    #ifdef USE_DASH
      uniform   float dashScale;
      attribute float instanceDistanceStart;
      attribute float instanceDistanceEnd;
      varying   float vLineDistance;
    #endif

    //--------------------------------------------
    // trims end segment so it terminates between
    // the camera plane and the near plane
    //--------------------------------------------
    void trimSegment(const in vec4 start, inout vec4 end) {

      // conservative estimate of the near plane
      float a = projectionMatrix[2][2]; // 3nd entry in 3th column
      float b = projectionMatrix[3][2]; // 3nd entry in 4th column
      float nearEstimate = -0.5 * b / a;
      float alpha = (nearEstimate - start.z) / (end.z - start.z);

      end.xyz = mix(start.xyz, end.xyz, alpha);
    }

    void main() {

      #ifdef USE_COLOR
        vColor.xyz = (segmentPosition.y < 0.5) ? instanceColorStart : instanceColorEnd;
      #endif

      #ifdef USE_DASH
        vLineDistance = (segmentPosition.y < 0.5) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
      #endif

      float aspect = resolution.x / resolution.y;

      vUv = segmentUv;

      // camera space
      vec4 start = modelViewMatrix * vec4(instanceStart, 1.0);
      vec4 end   = modelViewMatrix * vec4(instanceEnd, 1.0);

      // special case for perspective projection, and segments that terminate either in, or behind,
      // the camera plane clearly the gpu firmware has a way of addressing this issue when
      // projecting into ndc space but we need to perform ndc-space calculations in the shader,
      // so we must address this issue directly perhaps there is a more elegant solution
      bool perspective = (projectionMatrix[2][3] == - 1.0); // 4th entry in the 3rd column
      if (perspective) {
        if (start.z < 0.0 && end.z >= 0.0)
          trimSegment(start, end);
        else if (end.z < 0.0 && start.z >= 0.0)
          trimSegment(end, start);
      }

      // clip space
      vec4 clipStart = projectionMatrix * start;
      vec4 clipEnd   = projectionMatrix * end;

      // ndc space
      vec2 ndcStart = clipStart.xy / clipStart.w;
      vec2 ndcEnd   = clipEnd.xy / clipEnd.w;

      // direction
      vec2 dir = ndcEnd - ndcStart;

      // account for clip-space aspect ratio
      dir.x *= aspect;
      dir = normalize(dir);

      // perpendicular to dir
      vec2 offset = vec2(dir.y, - dir.x);

      // undo aspect ratio adjustment
      dir.x /= aspect;
      offset.x /= aspect;

      // sign flip
      if (segmentPosition.x < 0.0)
        offset *= - 1.0;

      // endcaps
      if (segmentPosition.y < 0.0)
        offset += - dir;
      else if (segmentPosition.y > 1.0)
        offset += dir;

      // adjust for linewidth
      offset *= linewidth;

      // adjust for clip-space to screen-space conversion
      // maybe resolution should be based on viewport ...
      offset /= resolution.y;

      // select end
      vec4 clip = (segmentPosition.y < 0.5) ? clipStart : clipEnd;

      // back to clip space
      offset *= clip.w;

      clip.xy += offset;

      gl_Position = clip;

      vec4 mvPosition = (segmentPosition.y < 0.5) ? start : end; // this is an approximation

      #include <logdepthbuf_vertex>
      #include <clipping_planes_vertex>
      #include <fog_vertex>
    }
    `,

  fragmentShader:
    `
    uniform vec3 diffuse;
    uniform float opacity;

    #ifdef USE_DASH
      uniform float dashSize;
      uniform float gapSize;
    #endif

    varying float vLineDistance;

    #include <common>
    #include <color_pars_fragment>
    #include <fog_pars_fragment>
    #include <logdepthbuf_pars_fragment>
    #include <clipping_planes_pars_fragment>

    varying vec2 vUv;

    void main() {
      #include <clipping_planes_fragment>

      #ifdef USE_DASH
        if (vUv.y < - 1.0 || vUv.y > 1.0)
          discard; // discard endcaps

        if (mod(vLineDistance, dashSize + gapSize) > dashSize)
          discard; // todo - FIX
      #endif

      if (abs(vUv.y) > 1.0) {
        float a = vUv.x;
        float b = (vUv.y > 0.0) ? vUv.y - 1.0 : vUv.y + 1.0;
        float len2 = a * a + b * b;
        if (len2 > 1.0)
          discard;
      }

      vec4 diffuseColor = vec4(diffuse, opacity);

      #include <logdepthbuf_fragment>
      #include <color_fragment>

      gl_FragColor = vec4(diffuseColor.rgb, diffuseColor.a);

      #include <premultiplied_alpha_fragment>
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
    }
    `
};

export class GlIntervalMaterial extends ShaderMaterial {

  constructor(params) {
    super({
      type: 'GlIntervalMaterial',
      uniforms: UniformsUtils.clone(ShaderLib['line'].uniforms),
      vertexShader: ShaderLib['line'].vertexShader,
      fragmentShader: ShaderLib['line'].fragmentShader
    });

    this.isGlIntervalMaterial = true;
    this.dashed = false;

    Object.defineProperties(this, {

      color: {
        enumerable: true,

        get: function() {
          return this.uniforms.diffuse.value;
        },

        set: function(value) {
          this.uniforms.diffuse.value = value;
        }
      },

      linewidth: {
        enumerable: true,

        get: function() {
          return this.uniforms.linewidth.value;
        },

        set: function(value) {
          this.uniforms.linewidth.value = value;
        }
      },

      dashScale: {
        enumerable: true,

        get: function() {
          return this.uniforms.dashScale.value;
        },

        set: function(value) {
          this.uniforms.dashScale.value = value;
        }
      },

      dashSize: {
        enumerable: true,

        get: function() {
          return this.uniforms.dashSize.value;
        },

        set: function(value) {
          this.uniforms.dashSize.value = value;
        }
      },

      gapSize: {
        enumerable: true,

        get: function() {
          return this.uniforms.gapSize.value;
        },

        set: function(value) {
          this.uniforms.gapSize.value = value;
        }
      },

      resolution: {
        enumerable: true,

        get: function() {
          return this.uniforms.resolution.value;
        },

        set: function(value) {
          this.uniforms.resolution.value.copy(value);
        }
      }
    });

    this.setValues(params);
  }

  // ---------------------------
  // copy
  // ---------------------------
  copy(source) {
    super.copy.call(this, source);
    this.color.copy(source.color);
    this.linewidth = source.linewidth;
    this.resolution = source.resolution;

    // todo
    return this;
  }

  // ---------------------------
  // toJSON
  // ---------------------------
  toJSON(meta) {

    const data = {
      metadata: {
        version: 4.5,
        type: 'GlIntervalMaterial',
        generator: 'GlIntervalMaterial.toJSON'
      }
    };

    // standard GlIntervalMaterial serialization
    data.uuid = this.uuid;
    data.type = this.type;

    if (this.name !== '') {
      data.name = this.name;
    }

    if (this.color && this.color.isColor) {
      data.color = this.color.getHex();
    }

    if (this.vertexColors) {
      data.vertexColors = this.vertexColors;
    }

    data.uniforms = {};

    // eslint-disable-next-line guard-for-in
    for (const name in this.uniforms) {
      const uniform = this.uniforms[name];
      const value = uniform.value;

      if (value.isTexture) {
        data.uniforms[name] = {type: 't', value: value.toJSON(meta).uuid};
      } else if (value.isColor) {
        data.uniforms[name] = {type: 'c', value: value.getHex()};
      } else if (value.isVector2) {
        data.uniforms[name] = {type: 'v2', value: value.toArray()};
      } else if (value.isVector3) {
        data.uniforms[name] = {type: 'v3', value: value.toArray()};
      } else if (value.isVector4) {
        data.uniforms[name] = {type: 'v4', value: value.toArray()};
      } else if (value.isMatrix4) {
        data.uniforms[name] = {type: 'm4', value: value.toArray()};
      } else {
        data.uniforms[name] = {value: value};
      }
    }
    
    return data;
  }
}
