import {GlBase} from './gl-base';
import { utils } from '@tangens/common/utils/dataUtils';
import { GlAttributeType as A_TYPE } from './gl-constants';

export class GlLayer extends GlBase {
  constructor() {
    super();

    this.type = 'GlLayer';
    this.isGroup = true;  // this is needed to use shaders correctly to render this object
    this.isGlLayer = true;

    this.URL = '';
    this.dataSource = null;
    this.mapChanges = new Map();

    this.snappable = true;
    this.selectable = true;

    // object's datasource
    this.ds = [];
    this.dsHeader = ['index', 'child', 'isFiltered', 'x', 'y', 'z'];
    this.defaultRow = [-1, -1, false, 0, 0, 0, ];
    this.dsKeyIndex = {
      index: 0,
      x: 3,
      y: 4,
      z: 5,
      child: 1,
      isFiltered: 2,
    };

    this.lastHiddenObjects = new Map();
  }

  get getDS() {
    for (let p = 0; p < this.children.length; p++) {
      const child = this.children[p];
      if (child.dsSync === false) continue;
      child.dsSync = false;
  
      const ds = child.ds;
      const pointsCount = child.getPointsCount();
      const pntCoords = child.getPoints(0, pointsCount - 1);
      for (let i = 0; i < pointsCount; i++) {
        const rowData = ds[i];
        if (utils.isEmpty(rowData)) break;
  
        rowData[this.dsKeyIndex['x']] = pntCoords[i].x;
        rowData[this.dsKeyIndex['y']] = pntCoords[i].y;
        rowData[this.dsKeyIndex['z']] = pntCoords[i].z;
        rowData[this.dsKeyIndex['isFiltered']] = child.isGlPoints ? child.isPointVisible(i) : child.visible;
  
        for (const pAttrs of child.attributes) {
          if (pAttrs[1].type !== A_TYPE.Vertex) continue;
          const key = pAttrs[0];
          const v = child.getAttributeAt(key, i);
          rowData[this.dsKeyIndex[key]] = v;
        }
      }
  
      if (ds.length !== pointsCount) {
        // index of global ds to start updating
        let index = this.ds.length;
        if (ds.length > pointsCount) {
          // some data were deleted
          const deleteCount = ds.length - pointsCount;
          // sync datasource with children object
          const ind = ds.splice(ds.length - deleteCount, ds.length)[0][this.dsKeyIndex['index']];
          // ds.splice(ds.length - deleteCount, ds.length);
          // sync main datasource
          // const index = ds[ds.length - 1][this.dsKeyIndex['index']] + 1;
          this.ds.splice(ind, deleteCount);
          index = ind;
        } else if (ds.length < pointsCount) {
          // some data were added
          const addCount = pointsCount - ds.length;
          const i = ds.length ? ds.length - 1 : ds.length;
          // let rowData = !utils.isEmpty(ds[i]) ? ds[i] : this.ds[this.ds.length - 1];
          let rowData = !utils.isEmpty(ds[i]) ? ds[i] : this.ds[this.ds.length - 1];          

          // new children does not have dataSource
          if ((!rowData || !this.ds.length) && !i) {
            for (const pAttrs of child.attributes) {
              const key = pAttrs[0];
              this.dsHeader.push(key);
              this.dsKeyIndex[key] = this.defaultRow.length;
              this.defaultRow.push(undefined);
            }

            rowData = this.defaultRow;
          }

          const datas = Array.from({ length: addCount }, (_, i) => {
            const data = new Array(rowData.length);

            data[this.dsKeyIndex['index']] = rowData[this.dsKeyIndex['index']] + i + 1;
            data[this.dsKeyIndex['child']] = p; // rowData[this.dsKeyIndex['child']] + 1;
            data[this.dsKeyIndex['x']] = pntCoords[ds.length + i].x;
            data[this.dsKeyIndex['y']] = pntCoords[ds.length + i].y;
            data[this.dsKeyIndex['z']] = pntCoords[ds.length + i].z;
            data[this.dsKeyIndex['isFiltered']] = child.isGlPoints ? child.isPointVisible(i) : child.visible;

            for (const pAttrs of child.attributes) {
              if (pAttrs[1].type !== A_TYPE.Vertex) continue;
              const key = pAttrs[0];
              const v = child.getAttributeAt(key, ds.length + i);
              data[this.dsKeyIndex[key]] = v;
            }
  
            return data;
          });

          ds.splice(ds.length, 0, ...datas);
          this.ds.splice(rowData[this.dsKeyIndex['index']] + 1, 0, ...datas);

          index = ds[ds.length - 1][this.dsKeyIndex['index']] + 1;
        }
  
        for (let i = index, end = this.ds.length; i < end; i++) {
          this.ds[i][this.dsKeyIndex['index']] = i;
          this.ds[i][this.dsKeyIndex['isFiltered']] = false;
        }
      }
    }
  
    return this.ds;
  }

  addChild(child, params) {
    if (child) {
      const childUuid = child.uuid;
      const index = this.children.findIndex((item) => item.uuid === childUuid);
      if (index === -1) {
        if (params && params.keepParent === true) {
          this.addKeepingParent(child);
        } else {
          this.add(child);
        }
      } else {
        console.log('Object already exist!');
      }

      return index === -1;
    }
  }

  addKeepingParent(a) {
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
    if (child === null || child === undefined) return childObj;

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
    if (child === null || child === undefined) return child;

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
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) {
        this.remove(arguments[i]);
      }
      return this;
    }

    const index = this.children.indexOf(object);
    if (index !== - 1) {
      // dataSource syncr
      const objectDs = object.ds;
      if (objectDs && objectDs.length) {
        const startingIndex = objectDs[0][this.dsKeyIndex['index']];
        object.parent.ds.splice(startingIndex, objectDs.length);
        for (let i = startingIndex; i < object.parent.ds.length; i++) {
          object.parent.ds[i][this.dsKeyIndex['index']] = i;
        }
      }
      this.children[index].dispose();
      this.children.splice(index, 1);
    }
    return this;
  }

  // -------------------------------------
  // remove all elements from a set.
  // -------------------------------------
  removeAll() {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].dispose();
    }
    this.children.length = 0;
  }

  showLastHiddenObjects() {
    if (!this.lastHiddenObjects.size) return;
    this.lastHiddenObjects.forEach((value, key)=> {
      value.visible = true;
    });
    this.lastHiddenObjects.clear();
  }

  // -------------------------------------
  // check if index is valid
  // -------------------------------------
  __isValidIndex(index) {
    if (Number.isInteger(index) && index >= 0 && index < this.children.length) {
      return true;
    }
    return false;
  }

  // --------------------
  // dispose
  // --------------------
  dispose(index) {
    super.dispose();
    
    if (this.__isValidIndex(index)) {
      this.children[index].dispose();
      this.removeChild(index);
      return;
    }

    for (let i = 0; i < this.children.length; i++) {
      this.children[i].dispose();
    }
    
    this.ds.length = 0;
    this.children.length = 0;
  }
  
  // -------------------------------------
  // methods related to changes
  // -------------------------------------
  childChanged(child) {
    child.dsSync = true;
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
}