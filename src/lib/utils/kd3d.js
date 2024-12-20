/**
 * KdBush
 *
 **/
export class KdBush {
    constructor(params) {
        const isValid = params && params.points && params.points.length;
        if (isValid) throw new Error('KdBush params must be set correctly!')

        const points = params.points;
        const getX = params.getX;
        const getY = params.getY;
        const getZ = params.getZ;
        const nodeSize = params.nodeSize ? params.nodeSize : 64;
        const ArrayType = params.ArrayType ? params.ArrayType : Float64Array;
        const axisCount = params.axisCount ? params.axisCount : 3;

        this.nodeSize = nodeSize;
        this.points = points;
        this.axisCount = axisCount;

        const IndexArrayType = points.length < 65536 ? Uint16Array : Uint32Array;

        this.ids = params.idList ? params.idList.slice(0) : new IndexArrayType(points.length);

        this.coords = new ArrayType(points.length * axisCount);

        for (let i = 0; i < points.length; i++) {
            if (undefined === params.idList) this.ids[i] = i;
            const point = points[i];
            this.coords[axisCount * i + 0] = getX ? getX(point) : point.x;
            this.coords[axisCount * i + 1] = getY ? getY(point) : point.y;
            this.coords[axisCount * i + 2] = getZ ? getZ(point) : point.z;
        }

        // kd-sort both arrays for efficient search
        this.__sortKD(this.ids, this.coords, nodeSize, 0, this.ids.length - 1, 0, axisCount);
      }


      __sortKD(ids, coords, nodeSize, left, right, axis, axisCount) {
          if (right - left <= nodeSize) {
              return;
          }

          const m = (left + right) >> 1; // middle index

          // sort ids and coords around the middle index so that the halves lie
          // either left/right or top/bottom correspondingly (taking turns)
          this.__select(ids, coords, m, left, right, axis, axisCount);

          // recursively kd-sort first half and second half on the opposite axis
          this.__sortKD(ids, coords, nodeSize, left, m - 1, (1 + axis) % axisCount, axisCount);
          this.__sortKD(ids, coords, nodeSize, m + 1, right, (1 + axis) % axisCount, axisCount);
      }

      // custom Floyd-Rivest selection algorithm: sort ids and coords so that
      // [left..k-1] items are smaller than k-th item (on either x or y axis)
      __select(ids, coords, k, left, right, axis, axisCount) {
        while (right > left) {
            if (right - left > 600) {
                const n = right - left + 1;
                const m = k - left + 1;
                const z = Math.log(n);
                const s = 0.5 * Math.exp(2 * z / 3);
                const sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);

                const newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
                const newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));

                this.__select(ids, coords, k, newLeft, newRight, axis, axisCount);
            }

            const t = coords[axisCount * k + axis];
            let i = left;
            let j = right;

            this.__swapItem(ids, coords, left, k, axisCount);

            if (coords[axisCount * right + axis] > t) {
                this.__swapItem(ids, coords, left, right, axisCount);
            }

            while (i < j) {
                this.__swapItem(ids, coords, i, j, axisCount);
                i++;
                j--;
                while (coords[axisCount * i + axis] < t) i++;
                while (coords[axisCount * j + axis] > t) j--;
            }

            if (coords[axisCount * left + axis] === t) {
                this.__swapItem(ids, coords, left, j, axisCount);
            } else {
                j++;
                this.__swapItem(ids, coords, j, right, axisCount);
            }

            if (j <= k) left = j + 1;
            if (k <= j) right = j - 1;
        }
    }

    __swapItem(ids, coords, i, j, axisCount) {
        this.__swap(ids, i, j);
        this.__swap(coords, axisCount * i + 0, axisCount * j + 0);
        this.__swap(coords, axisCount * i + 1, axisCount * j + 1);
        this.__swap(coords, axisCount * i + 2, axisCount * j + 2);
    }

    __swap(arr, i, j) {
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }

    range(minX, minY, minZ, maxX, maxY, maxZ) {
        return this.__range(this.ids, this.coords, minX, minY, minZ, maxX, maxY, maxZ, this.nodeSize, this.axisCount);
    }

    __range(ids, coords, minX, minY, minZ, maxX, maxY, maxZ, nodeSize, axisCount) {
        const stack = [0, ids.length - 1, 0];
        const result = [];

        // recursively search for items in range in the kd-sorted arrays
        while (stack.length) {
            const axis = stack.pop();
            const right = stack.pop();
            const left = stack.pop();

            // if we reached "tree node", search linearly
            if (right - left <= nodeSize) {
                for (let i = left; i <= right; i++) {
                    const x = coords[axisCount * i + 0];
                    const y = coords[axisCount * i + 1];
                    const z = coords[axisCount * i + 2];
                    if (
                        x >= minX && x <= maxX &&
                        y >= minY && y <= maxY &&
                        z >= minZ && z <= maxZ
                    ) result.push(ids[i]);
                }
                continue;
            }

            // otherwise find the middle index
            const m = (left + right) >> 1;

            // include the middle item if it's in range
            const x = coords[axisCount * m + 0];
            const y = coords[axisCount * m + 1];
            const z = coords[axisCount * m + 2];
            if (
                x >= minX && x <= maxX &&
                y >= minY && y <= maxY &&
                z >= minZ && z <= maxZ
        ) result.push(ids[m]);

            // queue search in halves that intersect the query
            let next_axis = (1 + axis) % axisCount;
            let min_conditional;
            let max_conditional;

            switch (axis) {

                case 0:
                    min_conditional = minX <= x;
                    max_conditional = maxX >= x;
                    break;

                case 1:
                    min_conditional = minY <= y;
                    max_conditional = maxY >= y;
                    break;

                case 2:
                    min_conditional = minZ <= z;
                    max_conditional = maxZ >= z;
                    break;

            }

            if (min_conditional) {
                stack.push(left);
                stack.push(m - 1);
                stack.push(next_axis);
            }

            if (max_conditional) {
                stack.push(m + 1);
                stack.push(right);
                stack.push(next_axis);
            }
        }

        return result;
    }

    within(x, y, z, r) {
        return this.__within(this.ids, this.coords, x, y, z, r, this.nodeSize, this.axisCount);
    }

    __within(ids, coords, qx, qy, qz, r, nodeSize, axisCount) {
        const stack = [0, ids.length - 1, 0];
        const result = [];
        const r2 = r * r;

        // recursively search for items within radius in the kd-sorted arrays
        while (stack.length) {
            const axis = stack.pop();
            const right = stack.pop();
            const left = stack.pop();

            // if we reached "tree node", search linearly
            if (right - left <= nodeSize) {
                for (let i = left; i <= right; i++) {
                    if (this.__sqDist(coords[axisCount * i + 0],
                                      coords[axisCount * i + 1],
                                      coords[axisCount * i + 2],
                                      qx, qy, qz) <= r2) {
                        result.push(ids[i]);
                    }
                }
                continue;
            }

            // otherwise find the middle index
            const m = (left + right) >> 1;

            // include the middle item if it's in range
            const x = coords[axisCount * m + 0];
            const y = coords[axisCount * m + 1];
            const z = coords[axisCount * m + 2];
            if (this.__sqDist(x, y, z, qx, qy, qz) <= r2) {
                result.push(ids[m]);
            }

            // queue search in halves that intersect the query
            let next_axis = (1 + axis) % axisCount;
            let min_conditional;
            let max_conditional;

            switch (axis) {
                case 0:
                    min_conditional = qx - r <= x;
                    max_conditional = qx + r >= x;
                    break;

                case 1:
                    min_conditional = qy - r <= y;
                    max_conditional = qy + r >= y;
                    break;

                case 2:
                    min_conditional = qz - r <= z;
                    max_conditional = qz + r >= z;
                    break;
            }

            if (min_conditional) {
                stack.push(left);
                stack.push(m - 1);
                stack.push(next_axis);
            }

            if (max_conditional) {
                stack.push(m + 1);
                stack.push(right);
                stack.push(next_axis);
            }
        }

        return result;
    }

    __sqDist(ax, ay, az, bx, by, bz) {
        const dx = ax - bx;
        const dy = ay - by;
        const dz = az - bz;
        return dx * dx + dy * dy + dz * dz;
    }
}