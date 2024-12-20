export const KdUtils = {};

/**
 * In-place quicksort for typed arrays (e.g. for Float32Array)
 * provides fast sorting
 * useful e.g. for a custom shader and/or BufferGeometry
 *
 * @author Roman Bolzern <roman.bolzern@fhnw.ch>, 2013
 * @author I4DS http://www.fhnw.ch/i4ds, 2013
 * @license MIT License <http://www.opensource.org/licenses/mit-license.php>
 *
 * Complexity: http://bigocheatsheet.com/ see Quicksort
 *
 * Example:
 * points: [x, y, z, x, y, z, x, y, z, ...]
 * eleSize: 3 //because of (x, y, z)
 * orderElement: 0 //order according to x
 */

KdUtils.quicksortIP = function(arr, eleSize, orderElement) {
  const stack = [];
  let sp = -1;
  let left = 0;
  let right = arr.length / eleSize - 1;
  let tmp = 0.0;
  let x = 0;
  let y = 0;

  const swapF = function(a, b) {
    a *= eleSize;
    b *= eleSize;

    for (y = 0; y < eleSize; y++) {
      tmp = arr[a + y];
      arr[a + y] = arr[b + y];
      arr[b + y] = tmp;
    }
  };

  let i; let j; 
  const swap = new Float32Array(eleSize);
  const temp = new Float32Array(eleSize);

  while (true) {
    if (right - left <= 25) {
      for (j = left + 1; j <= right; j++) {
        for (x = 0; x < eleSize; x++) {
          swap[x] = arr[j * eleSize + x];
        }
        i = j - 1;
        while (i >= left && arr[i * eleSize + orderElement] > swap[orderElement]) {
          for (x = 0; x < eleSize; x++) {
            arr[(i + 1) * eleSize + x] = arr[i * eleSize + x];
          }
          i--;
        }

        for (x = 0; x < eleSize; x++) {
          arr[(i + 1) * eleSize + x] = swap[x];
        }
      }

      if (sp == -1) break;

      right = stack[sp--]; // ?
      left = stack[sp--];

    } else {
      const median = (left + right) >> 1;
      i = left + 1;
      j = right;

      swapF(median, i);

      if (arr[left * eleSize + orderElement] > arr[right * eleSize + orderElement]) {
        swapF(left, right);
      }

      if (arr[i * eleSize + orderElement] > arr[right * eleSize + orderElement]) {
        swapF(i, right);
      }

      if (arr[left * eleSize + orderElement] > arr[i * eleSize + orderElement]) {
        swapF(left, i);
      }

      for (x = 0; x < eleSize; x++) {
        temp[x] = arr[i * eleSize + x];
      }

      while (true) {
        do i++; while (arr[i * eleSize + orderElement] < temp[orderElement]);
        do j--; while (arr[j * eleSize + orderElement] > temp[orderElement]);

        if (j < i) break;

        swapF(i, j);
      }

      for (x = 0; x < eleSize; x++) {
        arr[(left + 1) * eleSize + x] = arr[j * eleSize + x];
        arr[j * eleSize + x] = temp[x];
      }

      if (right - i + 1 >= j - left) {
        stack[++sp] = i;
        stack[++sp] = right;
        right = j - 1;

      } else {
        stack[++sp] = left;
        stack[++sp] = j - 1;
        left = i;
      }
    }
  }
  return arr;
};


/**
 * k-d Tree for typed arrays (e.g. for Float32Array), in-place
 * provides fast nearest neighbour search
 * useful e.g. for a custom shader and/or BufferGeometry, saves tons of memory
 * has no insert and remove, only buildup and neares neighbour search
 *
 * Based on https://github.com/ubilabs/kd-tree-javascript by Ubilabs
 *
 * @author Roman Bolzern <roman.bolzern@fhnw.ch>, 2013
 * @author I4DS http://www.fhnw.ch/i4ds, 2013
 * @license MIT License <http://www.opensource.org/licenses/mit-license.php>
 *
 * Requires typed array quicksort
 *
 * Example:
 * points: [x, y, z, x, y, z, x, y, z, ...]
 * metric: function(a, b){return Math.pow(a[0] - b[0], 2) +  Math.pow(a[1] - b[1], 2) +  Math.pow(a[2] - b[2], 2); }  //Manhatten distance
 * eleSize: 3 //because of (x, y, z)
 *
 * Further information (including mathematical properties)
 * http://en.wikipedia.org/wiki/Binary_tree
 * http://en.wikipedia.org/wiki/K-d_tree
 *
 * If you want to further minimize memory usage, remove Node.depth and replace in search algorithm with a traversal to root node
 */

KdUtils.KdTree = function(points, metric, eleSize) {
  const self = this;
  let maxDepth = 0;
  let insertCount = 0;

  const getPointSet = function(points, pos) {
    return points.subarray(pos * eleSize, pos * eleSize + eleSize);
  };

  function buildTree(points, depth, parent, pos) {
    const dim = depth % eleSize;
    let median = null;
    let node = null;
    const plength = points.length / eleSize;

    if (depth > maxDepth) maxDepth = depth;

    if (plength === 0) return null;
    if (plength === 1) {
      return new self.Node(getPointSet(points, 0), depth, parent, pos);
    }

    KdUtils.quicksortIP(points, eleSize, dim);

    median = Math.floor(plength / 2);

    node = new self.Node(getPointSet(points, median), depth, parent, median + pos);
    node.left = buildTree(points.subarray(0, median * eleSize), depth + 1, node, pos);
    node.right = buildTree(points.subarray((median + 1) * eleSize, points.length), depth + 1, node, pos + median + 1);

    return node;
  }

  this.root = buildTree(points, 0, null, 0);

  this.getMaxDepth = function() {
    return maxDepth;
  };

  this.toJSON = function (src) {
    if (!src) src = this.root;
    const dest = new this.Node(src.obj, src.depth, src.parent, src.pos);
    if (src.left) dest.left = self.toJSON(src.left);
    if (src.right) dest.right = self.toJSON(src.right);
    return dest;
  };

  this.insert = function (point) {
    function innerSearch(node, parent) {

      if (node === null) {
        return parent;
      }

      const dimension = node.depth % eleSize;
      if (point[dimension] < node.obj[dimension]) {
        return innerSearch(node.left, node);
      } else {
        return innerSearch(node.right, node);
      }
    }

    const insertPosition = innerSearch(this.root, null);
    let newNode = null;
    let dimension = null;

    if (insertPosition === null) {
      this.root = new self.Node(point, 0, null, 0);
      insertCount++;
      return;
    }

    newNode = new self.Node(point, ((insertPosition.depth + 1) % eleSize), insertPosition, insertCount);
    insertCount++;
    dimension = insertPosition.depth % eleSize;

    if (point[dimension] < insertPosition.obj[dimension]) {
      insertPosition.left = newNode;
    } else {
      insertPosition.right = newNode;
    }
  };

  this.remove = function (point) {
    let node = null;

    function nodeSearch(node) {
      if (node === null) {
        return null;
      }

      let flag = true;
      for (let i = 0; i < eleSize; i++) {
        if (node.obj[i] !== point[i]) {
          flag = false;
          break;
        }
      }
      if (flag) {
        return node;
      }

      const dimension = node.depth % eleSize;

      if (point[dimension] < node.obj[dimension]) {
        return nodeSearch(node.left, node);
      } else {
        return nodeSearch(node.right, node);
      }
    }

    function removeNode(node) {
      let nextNode = null;
      let nextObj = null;
      let pDimension = null;

      function findMin(node, dim) {
        let dimension = null;
        let own = null;
        let left = null;
        let right = null;
        let min = null;

        if (node === null) {
          return null;
        }

        dimension = node.depth % eleSize;

        if (node.dimension === dim) {
          if (node.left !== null) {
            return findMin(node.left, dim);
          }
          return node;
        }

        own = node.obj[dimension];
        left = findMin(node.left, dim);
        right = findMin(node.right, dim);
        min = node;

        if (left !== null && left.obj[dimension] < own) {
          min = left;
        }
        if (right !== null && right.obj[dimension] < min.obj[dimension]) {
          min = right;
        }
        return min;
      }

      if (node.left === null && node.right === null) {
        if (node.parent === null) {
          self.root = null;
          return;
        }

        pDimension = node.parent.depth;

        if (node.obj[pDimension] < node.parent.obj[pDimension]) {
          node.parent.left = null;
        } else {
          node.parent.right = null;
        }
        return;
      }

      // If the right subtree is not empty, swap with the minimum element on the
      // node's dimension. If it is empty, we swap the left and right subtrees and
      // do the same.
      if (node.right !== null) {
        nextNode = findMin(node.right, node.dimension);
        nextObj = nextNode.obj;
        removeNode(nextNode);
        node.obj = nextObj;
      } else {
        nextNode = findMin(node.left, node.dimension);
        nextObj = nextNode.obj;
        removeNode(nextNode);
        node.right = node.left;
        node.left = null;
        node.obj = nextObj;
      }

    }

    node = nodeSearch(self.root);

    if (node === null) {
      return;
    }

    removeNode(node);
  };

  this.nearest = function(point, maxNodes, maxDistance) {
    /* point: array of size eleSize
      maxNodes: max amount of nodes to return
      maxDistance: maximum distance to point result nodes should have
      condition (not implemented): function to test node before it's added to the result list, e.g. test for view frustum
    */

    let i = null;
    let result = null;
    let bestNodes = null;

    bestNodes = new KdUtils.KdTree.BinaryHeap(
        function(e) {
          return -e[1];
        }
    );

    function nearestSearch(node) {
      let bestChild;
      const dimension = node.depth % eleSize;
      const ownDistance = metric(point, node.obj);
      let linearDistance = 0;
      let otherChild;
      let i;
      const linearPoint = [];

      function saveNode(node, distance) {
        bestNodes.push([node, distance]);

        if (bestNodes.size() > maxNodes) {
          bestNodes.pop();
        }
      }

      for (i = 0; i < eleSize; i += 1) {
        if (i === node.depth % eleSize) {
          linearPoint[i] = point[i];
        } else {
          linearPoint[i] = node.obj[i];
        }
      }

      linearDistance = metric(linearPoint, node.obj);

      // if it's a leaf
      if (node.right === null && node.left === null) {
        if (bestNodes.size() < maxNodes || ownDistance < bestNodes.peek()[1]) {
          saveNode(node, ownDistance);
        }
        return;
      }

      if (node.right === null) {
        bestChild = node.left;
      } else if (node.left === null) {
        bestChild = node.right;
      } else {

        if (point[dimension] < node.obj[dimension]) {
          bestChild = node.left;
        } else {
          bestChild = node.right;
        }
      }

      // recursive search
      nearestSearch(bestChild);

      if (bestNodes.size() < maxNodes || ownDistance < bestNodes.peek()[1]) {
        saveNode(node, ownDistance);
      }

      // if there's still room or the current distance is nearer than the best distance
      if (bestNodes.size() < maxNodes || Math.abs(linearDistance) < bestNodes.peek()[1]) {
        if (bestChild === node.left) {
          otherChild = node.right;
        } else {
          otherChild = node.left;
        }

        if (otherChild !== null) {
          nearestSearch(otherChild);
        }
      }
    }

    if (maxDistance) {
      for (i = 0; i < maxNodes; i += 1) {
        bestNodes.push([null, maxDistance]);
      }
    }

    if (self.root) {
      nearestSearch(self.root);
    }

    result = [];

    for (i = 0; i < Math.min(maxNodes, bestNodes.content.length); i += 1) {
      if (bestNodes.content[i][0]) {
        result.push([bestNodes.content[i][0], bestNodes.content[i][1]]);
      }
    }
    return result;
  };


  this.nearestCount = function(point, maxNodes, maxDistance, accumulator = function() { return 1; }) {
    let count = 0;
    const stack = [];
  
    if (self.root) {
      stack.push(self.root);
    }
  
    while (stack.length > 0) {
      const node = stack.pop();
      const dimension = node.depth % eleSize;
      const ownDistance = metric(point, node.obj);
      let linearDistance = 0;
      const linearPoint = [];
  
      for (let i = 0; i < eleSize; i++) {
        if (i === dimension) {
          linearPoint[i] = point[i];
        } else {
          linearPoint[i] = node.obj[i];
        }
      }
  
      linearDistance = metric(linearPoint, node.obj);
  
      if (node.right === null && node.left === null) {
        if (ownDistance <= maxDistance) {
          count += accumulator(point, node.obj);
        }
        continue;
      }
  
      let bestChild, otherChild;
  
      if (node.right === null) {
        bestChild = node.left;
      } else if (node.left === null) {
        bestChild = node.right;
      } else {
        bestChild = point[dimension] < node.obj[dimension] ? node.left : node.right;
      }
  
      if (bestChild !== null) {
        stack.push(bestChild);
      }
  
      if (ownDistance <= maxDistance) {
        count += accumulator(point, node.obj);
      }
  
      if (Math.abs(linearDistance) <= maxDistance) {
        otherChild = (bestChild === node.left) ? node.right : node.left;
        if (otherChild !== null) {
          stack.push(otherChild);
        }
      }
    }
  
    return count;
  };
  
};

/**
 * If you need to free up additional memory and agree with an additional O( log n ) traversal time you can get rid of "depth" and "pos" in Node:
 * Depth can be easily done by adding 1 for every parent (care: root node has depth 0, not 1)
 * Pos is a bit tricky: Assuming the tree is balanced (which is the case when after we built it up), perform the following steps:
 *   By traversing to the root store the path e.g. in a bit pattern (01001011, 0 is left, 1 is right)
 *   From buildTree we know that "median = Math.floor( plength / 2 );", therefore for each bit...
 *     0: amountOfNodesRelevantForUs = Math.floor( (pamountOfNodesRelevantForUs - 1) / 2 );
 *     1: amountOfNodesRelevantForUs = Math.ceil( (pamountOfNodesRelevantForUs - 1) / 2 );
 *        pos += Math.floor( (pamountOfNodesRelevantForUs - 1) / 2 );
 *     when recursion done, we still need to add all left children of target node:
 *        pos += Math.floor( (pamountOfNodesRelevantForUs - 1) / 2 );
 *        and I think you need to +1 for the current position, not sure.. depends, try it out ^^
 *
 * I experienced that for 200'000 nodes you can get rid of 4 MB memory each, leading to 8 MB memory saved.
 */
KdUtils.KdTree.prototype.Node = function(obj, depth, parent, pos) {
  this.obj = obj;
  this.left = null;
  this.right = null;
  this.parent = parent;
  this.depth = depth;
  this.pos = pos;
};

/**
 * Binary heap implementation
 * @author http://eloquentjavascript.net/appendix2.htm
 */
KdUtils.KdTree.BinaryHeap = function(scoreFunction) {
  this.content = [];
  this.scoreFunction = scoreFunction;
};

KdUtils.KdTree.BinaryHeap.prototype = {

  push: function(element) {
    // Add the new element to the end of the array.
    this.content.push(element);

    // Allow it to bubble up.
    this.bubbleUp(this.content.length - 1);
  },

  pop: function() {
    // Store the first element so we can return it later.
    const result = this.content[0];

    // Get the element at the end of the array.
    const end = this.content.pop();

    // If there are any elements left, put the end element at the
    // start, and let it sink down.
    if (this.content.length > 0) {
      this.content[0] = end;
      this.sinkDown(0);
    }
    return result;
  },

  peek: function() {
    return this.content[0];
  },

  remove: function(node) {
    const len = this.content.length;

    // To remove a value, we must search through the array to find it.
    for (let i = 0; i < len; i++) {
      if (this.content[i] == node) {
        // When it is found, the process seen in 'pop' is repeated
        // to fill up the hole.
        const end = this.content.pop();

        if (i != len - 1) {
          this.content[i] = end;

          if (this.scoreFunction(end) < this.scoreFunction(node)) {
            this.bubbleUp(i);
          } else {
            this.sinkDown(i);
          }
        }
        return;
      }
    }

    throw new Error("Node not found.");
  },

  size: function() {
    return this.content.length;
  },

  bubbleUp: function(n) {
    // Fetch the element that has to be moved.
    const element = this.content[n];

    // When at 0, an element can not go up any further.
    while (n > 0) {
      // Compute the parent element's index, and fetch it.
      const parentN = Math.floor((n + 1) / 2) - 1;
      const parent = this.content[parentN];

      // Swap the elements if the parent is greater.
      if (this.scoreFunction(element) < this.scoreFunction(parent)) {
        this.content[parentN] = element;
        this.content[n] = parent;

        // Update 'n' to continue at the new position.
        n = parentN;
      } else {
        // Found a parent that is less, no need to move it further.
        break;
      }
    }
  },

  sinkDown: function(n) {
    // Look up the target element and its score.
    const length = this.content.length;
    const element = this.content[n];
    const elemScore = this.scoreFunction(element);

    while (true) {
      // Compute the indices of the child elements.
      const child2N = (n + 1) * 2;
      const child1N = child2N - 1;

      // This is used to store the new position of the element, if any.
      let swap = null;

      let child1Score;
      let child2Score;

      // If the first child exists (is inside the array)...
      if (child1N < length) {
        // Look it up and compute its score.
        const child1 = this.content[child1N];
        child1Score = this.scoreFunction(child1);

        // If the score is less than our element's, we need to swap.
        if (child1Score < elemScore) swap = child1N;
      }

      // Do the same checks for the other child.
      if (child2N < length) {
        const child2 = this.content[child2N];
        child2Score = this.scoreFunction(child2);

        if (child2Score < (swap === null ? elemScore : child1Score)) swap = child2N;
      }

      // If the element needs to be moved, swap it, and continue.
      if (swap !== null) {
        this.content[n] = this.content[swap];
        this.content[swap] = element;
        n = swap;
      } else {
        // Otherwise, we are done.
        break;
      }
    }
  },
};


/**
 * 
 * KdBush implementation
 */
class KdBush {
    constructor(params) {
        const isValid = params && params.points && params.points.length;
        if (!isValid) throw new Error('KdBush params must be set correctly!')

        const points = params.points;
        const getX = params.getX;
        const getY = params.getY;
        const getZ = params.getZ;
        const nodeSize = params.nodeSize ? params.nodeSize : 64;
        const axisCount = params.axisCount ? params.axisCount : 3;

        this.nodeSize = nodeSize;
        this.axisCount = axisCount;

        let pointsLen = points.length;
        const isFlatArray = points instanceof Float32Array || points instanceof Float64Array ||
                          (points instanceof Array && typeof points[0] !== 'object');
        if (isFlatArray) {
          this.coords = points;
          pointsLen = Math.floor(points.length / axisCount);

        } else if (!isFlatArray && typeof points[0] === 'object') {
          this.coords = new Float64Array(pointsLen * axisCount);
          for (let i = 0; i < points.length; i++) {
              if (undefined === params.idList) this.ids[i] = i;
              const point = points[i];
              this.coords[axisCount * i + 0] = getX ? getX(point) : point.x;
              this.coords[axisCount * i + 1] = getY ? getY(point) : point.y;
              this.coords[axisCount * i + 2] = getZ ? getZ(point) : point.z;
          }
        } else {
          pointsLen = 0;
          this.coords = [];
        }

        const IndexArrayType = pointsLen < 65536 ? Uint16Array : Uint32Array;
        this.ids = params.idList ? params.idList.slice(0) : new IndexArrayType(pointsLen);
        if (!params.idList) {
          for (let i = 0; i < pointsLen; i++) {
            this.ids[i] = i;
          }
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

KdUtils.KdBush = KdBush;
