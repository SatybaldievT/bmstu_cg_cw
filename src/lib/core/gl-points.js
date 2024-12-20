/* eslint-disable no-undef */
import {GlPointsBase} from './gl-points-base';
import {
  Vector3,
  BufferAttribute,
} from 'three';

export class GlPoints extends GlPointsBase {
  constructor(params, fromJSON) {
    params = params || {};

    super(params, fromJSON);

    this.isGlPoints = true;
    this.type = 'GlPoints';
  }

}
