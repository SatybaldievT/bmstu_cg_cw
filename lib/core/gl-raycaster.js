import { Raycaster } from "three";

const __EPS = 1.e-3;
export class GlRaycaster extends Raycaster {

  intersectObject(object, recursive = true, intersects = []) {
    this.checkIntersection(object, this, intersects, recursive);
    intersects.sort(sortAsc);
    return intersects;
  }

  intersectObjects(objects, recursive = true, intersects = []) {
    for (let i = 0, l = objects.length; i < l; i++) {
      this.checkIntersection(objects[i], this, intersects, recursive);
    }
    const len = intersects.length;
    if (len > 1) {
      intersects.sort(sortAsc);
      const first = intersects[0].object;
      if (first.isGlMeshBase || first.isGlBlocks) {
        const second = intersects[1].object;
        const third = len > 2 ? intersects[2].object : null;
        if (!second.isGlMeshBase && !second.isGlBlocks && 
             (Math.abs(intersects[0].distance - intersects[1].distance) < __EPS) ||
             second.id === first.parent.id) {
          const tmp = intersects[0];
          intersects[0] = intersects[1];
          intersects[1] = tmp;
        }
        else if (third && !third.isGlMeshBase && !third.isGlBlocks &&
                 Math.abs(intersects[0].distance - intersects[2].distance) < __EPS) {
          const tmp = intersects[0];
          intersects[0] = intersects[2];
          intersects[2] = tmp;
        }
      }
      else if (first.isPoints) {
        const second = intersects[1].object;
        if (second.isGlBase && first.parent && first.parent.id === second.id) {
          const tmp = intersects[0];
          intersects[0] = intersects[1];
          intersects[1] = tmp;
        }
      }
    } else if (len === 1) {
      const obj = intersects[0].object;
      const objParent = obj.parent;
      if (obj.isGlMesh && objParent && objParent.isGlPolyline && intersects[0].uv) {
        intersects[0].object = objParent;
      }
    }

    return intersects;
  }

  checkIntersection(object, raycaster, intersects, recursive) {
    if (object.visible === false) return;

    if (object.layers.test(raycaster.layers)) {
      object.raycast(raycaster, intersects);
    }
  
    if (recursive === true) {
      const children = object.children;
      for (let i = 0, l = children.length; i < l; i++) {
        this.checkIntersection(children[i], raycaster, intersects, true);
      }
    }
  }
}

function sortAsc(a, b) {
  return a.distance - b.distance;
}