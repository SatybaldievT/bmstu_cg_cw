/* eslint-disable no-undef */
import { GlMeshBase } from './gl-meshbase';
import { MeshAttributeType } from './gl-constants';
import {
  BufferAttribute,
  BufferGeometry,
} from 'three';

export class GlMesh extends GlMeshBase {
  constructor(params, fromJSON) {
    params = params || {};

    super(params, fromJSON);

    this.isGlMesh = true;
    this.type = 'GlMesh';

    this.__changesCount = 0;
  }

  // ----------------------------------------------------
  // __createBufferGeometry(values)
  // 'values' must be the type of Array and contain
  // values as: [x0, y0, z0, x1, y1, z1]
  // ----------------------------------------------------
  __recreateBufferGeometry(type, values) {
    if (!(values && values instanceof Array)) return;

    let itemSize = 3;
    let attribName = 'position';
    let attrib = this.geometry.attributes.position;
    if (type === MeshAttributeType.COLOR) {
      attrib = this.geometry.attributes.color;
      attribName = 'color';
    } else if (type === MeshAttributeType.NORMAL) {
      attrib = this.geometry.attributes.normal;
      attribName = 'normal';
    } else if (type === MeshAttributeType.UV) {
      attrib = this.geometry.attributes.uv;
      attribName = 'uv';
      itemSize = 2;
    }

    const newValuesCount = Math.floor(values.length / itemSize);

    // define the size of new attribute and create a new buffer
    const newSize = (this.__verticesCount + newValuesCount + 100) * itemSize;
    const newBuffer = new BufferAttribute(new Float32Array(newSize), itemSize);

    let oldGeometry;
    if (attrib) {
      oldGeometry = this.geometry;
      for (let i = 0; i < this.__verticesCount; i++) {
        newBuffer.copyAt(i, attrib, i);
      }
    }

    // add new values
    const start = ((attrib) ? this.__verticesCount : 0) * itemSize;
    const end = start + (newValuesCount * itemSize);
    for (let i = start; i < end; i += itemSize) {
      newBuffer.array[i] = values[i - start];
      newBuffer.array[i + 1] = values[i - start + 1];
      if (itemSize > 2) newBuffer.array[i + 2] = values[i - start + 2];
    }

    if (oldGeometry) {
      this.geometry = new BufferGeometry();
      this.geometry.copy(oldGeometry);
      this.geometry.deleteAttribute(attribName);
      if (this.vertices) {
        this.vertices.geometry = this.geometry;
      }
      oldGeometry.dispose();
    }

    this.geometry.setAttribute(attribName, newBuffer);
    newBuffer.needsUpdate = true;

    if (type === MeshAttributeType.POSITION) {
      this.geometry.computeBoundingBox = this.computeBoundingBox;
      this.geometry.computeBoundingSphere = this.computeBoundingSphere;

      this.__verticesCount += newValuesCount;
      if (!this.geometry.index) {
        this.geometry.setDrawRange(0, this.__verticesCount);
      }
      this.geometry.computeBoundingSphere();
    }
  }

  // ---------------------------------------
  // __addAttributes()
  // ---------------------------------------
  __addAttributes(type, array) {
    // adjust values as: [x0, y0, z0, x1, y1, z1]
    const values = this.__validateArrayValues(type, array);

    if (values && values.length) {
      let itemSize = 3;
      let attrib = this.geometry.attributes.position;
      if (type === MeshAttributeType.COLOR) {
        attrib = this.geometry.attributes.color;
      } else if (type === MeshAttributeType.NORMAL) {
        attrib = this.geometry.attributes.normal;
      } else if (type === MeshAttributeType.UV) {
        attrib = this.geometry.attributes.uv;
        itemSize = 2;
      }

      if (attrib) {
        const xyz = attrib;
        const newPointsCount = values.length / xyz.itemSize;

        if (this.__verticesCount + newPointsCount <= xyz.count) {
          const start = this.__verticesCount * xyz.itemSize;
          const end = start + newPointsCount * xyz.itemSize;

          for (let i = start; i < end; i += 3) {
            xyz.array[i] = values[i - start];
            xyz.array[i + 1] = values[i - start + 1];
            if (itemSize > 2) xyz.array[i + 2] = values[i - start + 2];
          }

          this.__verticesCount += newPointsCount;
          xyz.needsUpdate = true;
          this.geometry.computeVertexNormals();
        } else {
          this.__recreateBufferGeometry(type, values);
        }
      } else {
        this.__recreateBufferGeometry(type, values);
      }
    }
  }

  // -------------------------------------
  // deleteVertexAt()
  // -------------------------------------
  deleteVertexAt(index) {
    const indArray = this.geometry.index.array;
    const xyz = this.geometry.attributes.position.array;
    const itemSize = 3;

    if (indArray && xyz) {

      for (let i = (index * itemSize); i < (this.__verticesCount * itemSize); i++) {
        xyz[i] = xyz[i + itemSize];
      }

      const faceCnt = this.__facesCount;
      for (let i = 0, j = 0; j < faceCnt; j += 3) {
        if (indArray[j] === index || indArray[j + 1] === index || indArray[j + 2] === index) {
          this.__facesCount -= 3;
          continue;
        };

        indArray[i] = indArray[j];
        indArray[i + 1] = indArray[j + 1];
        indArray[i + 2] = indArray[j + 2];

        if (indArray[i] > index) indArray[i] -= 1;
        if (indArray[i + 1] > index) indArray[i + 1] -= 1;
        if (indArray[i + 2] > index) indArray[i + 2] -= 1;

        i += 3;
      }

      this.__verticesCount -= 1;

      if (this.__verticesCount === 0) this.resetPivotPoint();

      this.geometry.setDrawRange(0, this.__facesCount);
      this.geometry.index.needsUpdate = true;
      // TODO handle vertex in loop as well
      this.geometry.computeVertexNormals();
      this.geometry.attributes.position.needsUpdate = true;
    }
  }

  // -------------------------------------
  // insertVertex()
  // -------------------------------------
  insertVertex(index, array) {
    if (!this.__isValidIndex(index)) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    const xyz = this.geometry.attributes.position;
    const indArray = this.geometry.index.array;

    const coords = this.__validateArrayValues(MeshAttributeType.POSITION, array);
    const itemSize = xyz.itemSize;
    const newPointsCount = coords.length / itemSize;
    if (this.geometry.attributes.position) {
      if (this.__verticesCount + newPointsCount <= xyz.count) {
        for (let i = ((this.__verticesCount + newPointsCount) * itemSize) - 1; i > index * itemSize; i--) {
          xyz.array[i] = xyz.array[i - (newPointsCount * itemSize)];
        }

        // insert newCoords
        const insertStart = index * itemSize;
        const insertEnd = insertStart + newPointsCount * itemSize
        for (let i = insertStart; i < insertEnd; i += 3) {
          xyz.array[i] = coords[i - insertStart];
          xyz.array[i + 1] = coords[i - insertStart + 1];
          xyz.array[i + 2] = coords[i - insertStart + 2];
        }

        const faceCnt = this.__facesCount;
        for (let i = 0, j = 0; j < faceCnt; j += 3) {
          if (indArray[i] >= index) indArray[i] += 1;
          if (indArray[i + 1] >= index) indArray[i + 1] += 1;
          if (indArray[i + 2] >= index) indArray[i + 2] += 1;
          i += 3;
        }

        this.__verticesCount += 1;
        this.geometry.index.needsUpdate = true;
        this.geometry.attributes.position.needsUpdate = true;
      } else {
        const lastIdx = this.__verticesCount * itemSize;
        const newCoordsSize = lastIdx + coords.length;
        const newCoords = Array(newCoordsSize).fill(0.0);
        const breakPoint = index * itemSize;
        let i; let j;
        for (i = 0; i < breakPoint; i += 3) {
          newCoords[i] = xyz.array[i];
          newCoords[i + 1] = xyz.array[i + 1];
          newCoords[i + 2] = xyz.array[i + 2];
        }
        for (j = 0; j < coords.length; j += 3) {
          newCoords[j + i] = coords[j];
          newCoords[j + i + 1] = coords[j + 1];
          newCoords[j + i + 2] = coords[j + 2];
        }
        j += i;
        for (i = breakPoint; i < lastIdx; i += 3) {
          newCoords[j] = xyz.array[i];
          newCoords[j + 1] = xyz.array[i + 1];
          newCoords[j + 2] = xyz.array[i + 2];
          j += 3;
        }

        this.__verticesCount = 0;
        this.__recreateBufferGeometry(newCoords);
      }
    } else {
      this.__recreateBufferGeometry(coords);
    }

  }

  // ----------------------------------------------------
  // __validateCoordinates()
  // validate and adjust coordinates as:
  // [x0, y0, z0, x1, y1, z1]
  // This method converts coordinates from world to local
  // -----------------------------------------------------
  __validateCoordinates(coords, reverseOrder = false) {
    if (!coords) return null;

    let retCoords = null;
    let error = '';
    if (coords instanceof Array) {
      if (coords[0] instanceof Array) {
        // we'll assum that the 'coords' is an array of arrays: [[x0, y0, z0], [x1, y1, z1], ...]
        retCoords = Array(coords.length * 3).fill(0.0);

        if (reverseOrder) coords.reverse();

        for (let i = 0; i < coords.length; ++i) {
          if (coords[i][0] === undefined || coords[i][1] === undefined || coords[i][2] === undefined ||
            coords[i][0] === null || coords[i][1] === null || coords[i][2] === null) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retCoords[i * 3] = coords[i][0];
            retCoords[i * 3 + 1] = coords[i][1];
            retCoords[i * 3 + 2] = coords[i][2];
          }
        }
      } else if (typeof coords[0] === 'object') {
        // we'll assume that the 'coords' is an array of objects: [point1, point2, ...]
        retCoords = Array(coords.length * 3).fill(0.0);

        if (reverseOrder) coords.reverse();

        for (let i = 0; i < coords.length; ++i) {
          if (coords[i].x === undefined || coords[i].y === undefined ||
            coords[i].z === undefined) {
            error = 'Ошибка: некоторые координаты заданы некорректно';
          } else {
            retCoords[i * 3] = coords[i].x;
            retCoords[i * 3 + 1] = coords[i].y;
            retCoords[i * 3 + 2] = coords[i].z;
          }
        }
      } else {
        // we'll assume that the 'coords' are given as: [x0, y0, z0, x1, y1, z1]
        const ptCount = Math.floor(coords.length / 3);
        const arrLen = ptCount * 3;
        retCoords = Array(arrLen).fill(0.0);
        if (!reverseOrder) {
          for (let i = 0; i < arrLen; ++i) {
            retCoords[i] = coords[i];
          }
        } else {
          let j = 0;
          for (let i = arrLen - 3; i >= 0; i -= 3) {
            retCoords[j] = coords[i];
            retCoords[j + 1] = coords[i + 1];
            retCoords[j + 2] = coords[i + 2];
            j += 3;
          }
        }
      }
    } else {
      // we'll assume that the 'coords' is an object
      if (coords.x === undefined || coords.y === undefined || coords.z === undefined) {
        error = 'Ошибка: координаты заданы некорректно';
      } else {
        retCoords = [coords.x, coords.y, coords.z];
      }
    }

    if (retCoords && retCoords.length) {
      // set an objects position if it's needed
      if (this.__verticesCount === 0) {
        this.__m4.copy(this.matrixWorld).invert();
        this.pivotOffset.set(0, 0, 0);
        this.position.set(retCoords[0], retCoords[1], retCoords[2]);
        this.position.applyMatrix4(this.__m4);
        this.updateMatrixWorld();
      }

      this.__m4.copy(this.matrixWorld).invert();

      // convert coordinates from world to local
      for (let i = 0; i < retCoords.length; i += 3) {
        this.__v3.set(retCoords[i], retCoords[i + 1], retCoords[i + 2]);
        this.__v3.applyMatrix4(this.__m4);
        retCoords[i] = this.__v3.x;
        retCoords[i + 1] = this.__v3.y;
        retCoords[i + 2] = this.__v3.z;
      }
    }

    if (error) {
      console.log(error);
    }

    return retCoords;
  }

  addTriFaces(indices) {
    if (indices.length % 3) {
      console.log("Ошибка: задан некоректные индексы")
      return;
    }

    let indArray = this.geometry.index;

    if (indArray) {
      if (this.__facesCount + indices.length >= indArray.count) {
        // no space enought recreate BufferAttribute
        const newIndices = new Uint32Array(this.__facesCount + indices.length + 15);
        for (let i = 0; i < this.__facesCount; i++) {
          newIndices[i] = indArray.array[i];
        }

        let version = 0;
        if (this.geometry.index) version = this.geometry.index.version + 1;
        this.geometry.setIndex(new BufferAttribute(newIndices, 1));
        this.geometry.index.version = version;
        indArray = this.geometry.index;
      }

      for (let i = 0; i < indices.length && this.__facesCount < indArray.count; i++) {
        indArray.array[this.__facesCount] = indices[i];
        this.__facesCount++;
      }

      this.geometry.setDrawRange(0, this.__facesCount);
      this.geometry.computeVertexNormals();
      indArray.needsUpdate = true;
    }
  }

  deleteTriFace(index) {
    if (this.getTriFacesCount() < index) {
      console.log('Ошибка: задан некорректный индекс');
    }
    this.deleteTriFaces(index, index);
  }

  deleteTriFaces(startIndex, endIndex) {
    if (startIndex > this.getTriFacesCount() || endIndex > this.getTriFacesCount()) {
      console.log('Ошибка: задан некорректный индекс');
      return;
    }

    if (startIndex > endIndex) {
      console.log('Ошибка: начальный индекс должен быть =< конечного индекса');
      return;
    }

    const indArray = this.geometry.index;
    if (indArray) {
      const start = (endIndex + 1) * 3;
      const delCount = (endIndex - startIndex + 1) * 3;

      for (let i = start; i < indArray.count; i++) {
        indArray.array[i - delCount] = indArray.array[i];
      }

      this.__facesCount -= delCount;

      this.geometry.setDrawRange(0, this.__facesCount);
      indArray.needsUpdate = true;
    }
  }
}