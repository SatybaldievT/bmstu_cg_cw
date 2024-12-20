import { Object3D } from "three";

export class Chart extends Object3D {
  constructor(sceneControls, width, height, setAsLayer = false) {
    super();

    const layerFlag = typeof setAsLayer === 'boolean' ? setAsLayer : false;

    this.type = 'Chart';
    this.isChart = true;

    this.isGroup = layerFlag;  // this is needed to use shaders correctly to render this object
    this.isChartLayer = layerFlag;
    if (layerFlag) {
      this.type = 'ChartLayer';
    }

    this.mapChanges = new Map();

    this.sceneControls = sceneControls;
    this.width = width;
    this.height = height;

    this.showProperties = false;

    this.xAxis = null;
    this.yAxis = null;
  }

  dispose() {
    if (this.xAxis) {
      this.xAxis.dispose();
      this.remove(this.xAxis);
      this.xAxis = null;
    }
    if (this.yAxis) {
      this.yAxis.dispose();
      this.remove(this.yAxis);
      this.yAxis = null;
    }

    if (this.isChartLayer) {
      for (const child of this.children) {
        child.dispose();
        this.remove(child);
      }  
      this.children.length = 0;
    }
  }

  axisUpdate() {
    if (this.xAxis) this.xAxis.forceUpdate();
    if (this.yAxis) this.yAxis.forceUpdate();
  }
  
  getPointsTextureName(commonName) {
    switch (commonName) {
      case 'Rectangle':
        return 'rectangle_filled'
      case 'Triangle':
        return 'triangle_filled'
      case 'Asterisk':
        return 'asterisk'

      default:
        return 'circle_full';
    }
  }

  setMaterialResolution(width, height) {
  }

  addChild(child, params) {
    if (this.isChartLayer && child) {
      const childUuid = child.uuid;
      const index = this.children.findIndex((item) => item.uuid === childUuid);
      if (index === -1) {
        if (params && params.keepParent === true) {
          this._addKeepingParent(child);
        } else {
          this.add(child);
        }
      } else {
        console.log('Object already exist!');
      }

      return index === -1;
    }
  }

  _addKeepingParent(a) {
    if (1 < arguments.length) {
      for (let b = 0; b < arguments.length; b++) {
        this.add(arguments[b]);
      }
      return this;
    }
    if (a === this) {
      console.error("THREE.Object3D.add: object can't be added as a child of itself.", a);
      return this;
    }
    if (a && a.isObject3D) {
      this.children.push(a),
      a.dispatchEvent({type: "added"});
    } else {
      console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.", a);
    }
    return this;
  }

  // ----------------------------------------------
  // get specific element in a set.
  // if argument is an integer will be returned the
  // object with that index among children
  // if argument is string or a gl object
  // will be returned by uuid
  // ----------------------------------------------
  getChild(child) {
    let childObj = null;
    if (!this.isChartLayer || child === null || child === undefined) return childObj;

    if (Number.isInteger(child) && child < this.children.length) {
      childObj = this.children[child];
    } else if (typeof child === 'string') {
      const index = this.children.findIndex((item) => item.uuid === child);
      if (index !== -1) {
        childObj = this.children[index];
      }
    } else if (typeof child === 'object') {
      const index = this.children.findIndex((item) => item.uuid === child.uuid);
      if (index !== -1) {
        childObj = this.children[index];
      }
    }
    return childObj;
  }

  // -------------------------------------------------
  // remove specific element from a set.
  // if argument is an integer then the object
  // with that index among childrens will be returned
  // if argument is a string object or a gl object
  // will be removed by uuid
  // --------------------------------------------------
  removeChild(child) {
    let index = -1;
    if (!this.isChartLayer || child === null || child === undefined) return child;

    if (Number.isInteger(child) && child < this.children.length) {
      index = child;
    } else if (typeof child === 'string') {
      index = this.children.findIndex((item) => item.uuid === child);
    } else if (typeof child === 'object') {
      index = this.children.findIndex((item) => item.uuid === child.uuid);
    }

    if (index !== -1) {
      this.remove(this.children[index]);
    }

    return index !== -1;
  }

  remove(object) {
    if (!this.isChartLayer) {
      return super.remove(object);
    }

    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) {
        this.remove(arguments[i]);
      }
      return this;
    }

    const index = this.children.indexOf(object);
    if (index !== - 1) {
      this.children[index].dispose();
      this.children.splice(index, 1);
    }

    return this;
  }

  // -------------------------------------
  // remove all elements from a set.
  // -------------------------------------
  removeAll() {
    if (this.isChartLayer) {
      for (const child of this.children) {
        child.dispose();
      }
      this.children.length = 0;
    }
  }

  // -------------------------------------
  // methods related to changes
  // -------------------------------------
  childChanged(child) {
    if (this.mapChanges.has(child.uuid)) {
      if (!child.isChanged()) this.mapChanges.delete(child.uuid);
    } else {
      this.mapChanges.set(child.uuid, child);
    }
  }

  isChanged() {
    return this.mapChanges.size > 0;
  }

  changesSaved() {
    this.mapChanges.forEach((value, key) => {
      value.changesSaved();
    })
    this.mapChanges.clear();
  }

  setClippingBox(object, minPoint, maxPoint) {
    if (object && object.setClippingPlanes) {
      object.setClippingPlanes(minPoint, maxPoint);
  
      object.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
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
    }
  }
}