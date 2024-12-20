/* eslint-disable no-undef */
import {
  MathUtils as ThreeMathUtils,
  Matrix3,
  Vector3,
} from 'three';

export const MathUtils = {

  // constants
  EPS_0: 2.2205e-16,
  EPS: 1.0e-6,
  PI_2: 1.57079632679489661923,     // - pi/2
  PI_4: 0.785398163397448309616,    // - pi/4
  _1_PI: 0.318309886183790671538,   // - 1/pi
  _2_PI: 0.636619772367581343076,   // - 2/pi

  isZero(x) {
    return (Math.abs(x) < this.EPS_0);
  },

  isInteger(x) {
    return (Math.floor(x) === x);
  },

  isEqual(first, second, epsilon) {
    if (epsilon) return Math.abs(first - second) < epsilon;
    else return Math.abs(first - second) < this.EPS;
  },

  isEmpty(value) {
    if (value === undefined || value === null) return true;
    return false;
  },

  // // is 'first' greater or equal 'second'
  // isGE(first, second) {
  //   return Math.abs();
  // }

  // ----------------------------------------------------------------------------------------------
  // This code is based on EigenvalueDecomposition.cpp from
  // https://github.com/nickgillian/grt/blob/master/GRT/Util/EigenvalueDecomposition.cpp
  // and was adapted for the symmetric square matrix defined as A [0, 1, ... n]
  // ----------------------------------------------------------------------------------------------
  eigen_decompose(A) {
    const n = Math.sqrt(A.length);
    if (n > 1) {
      const eigenvectors = new Float64Array(A);
      const realEigenvalues = new Float64Array(n).fill(0);
      const complexEigenvalues = new Float64Array(n).fill(0);

      // Tridiagonalize.
      MathUtils.eigen_tred2(eigenvectors, realEigenvalues, complexEigenvalues);

      // Diagonalize.
      MathUtils.eigen_tql2(eigenvectors, realEigenvalues, complexEigenvalues);

      return {
        eigenvectors,
        eigenvalues: realEigenvalues
      };
    }
  },

  // -----------------
  // Tridiagonalize.
  // -----------------
  eigen_tred2(eigenvectors, realEigenvalues, complexEigenvalues) {
    const n = Math.sqrt(eigenvectors.length);

    let pos = (n - 1) * n;
    for (let j = 0; j < n; j++) {
      realEigenvalues[j] = eigenvectors[pos + j];
    }

    // Householder reduction to tridiagonal form.
    for (let i = n - 1; i > 0; i--) {

      // Scale to avoid under/overflow.
      let scale = 0.0;
      let h = 0.0;
      for (let k = 0; k < i; k++) {
        scale = scale + Math.abs(realEigenvalues[k]);
      }

      if (MathUtils.isZero(scale)) {
        complexEigenvalues[i] = realEigenvalues[i - 1];
        for (let j = 0; j < i; j++) {
          realEigenvalues[j] = eigenvectors[(i - 1) * n + j];
          eigenvectors[i * n + j] = 0.0;
          eigenvectors[j * n + i] = 0.0;
        }
      } else {

        // Generate Householder vector.
        for (let k = 0; k < i; k++) {
          realEigenvalues[k] /= scale;
          h += realEigenvalues[k] * realEigenvalues[k];
        }
        let f = realEigenvalues[i - 1];
        let g = Math.sqrt(h);
        if (f > 0) {
          g = -g;
        }
        complexEigenvalues[i] = scale * g;
        h = h - f * g;
        realEigenvalues[i - 1] = f - g;
        for (let j = 0; j < i; j++) {
          complexEigenvalues[j] = 0.0;
        }

        // Apply similarity transformation to remaining columns.
        for (let j = 0; j < i; j++) {
          f = realEigenvalues[j];
          eigenvectors[j * n + i] = f;
          g = complexEigenvalues[j] + eigenvectors[j * n + j] * f;
          for (let k = j + 1; k <= i - 1; k++) {
            pos = k * n + j;
            g += eigenvectors[pos] * realEigenvalues[k];
            complexEigenvalues[k] += eigenvectors[pos] * f;
          }
          complexEigenvalues[j] = g;
        }
        f = 0.0;
        for (let j = 0; j < i; j++) {
          complexEigenvalues[j] /= h;
          f += complexEigenvalues[j] * realEigenvalues[j];
        }
        let hh = f / (h + h);
        for (let j = 0; j < i; j++) {
          complexEigenvalues[j] -= hh * realEigenvalues[j];
        }
        for (let j = 0; j < i; j++) {
          f = realEigenvalues[j];
          g = complexEigenvalues[j];
          for (let k = j; k <= i - 1; k++) {
            eigenvectors[k * n + j] -= (f * complexEigenvalues[k] + g * realEigenvalues[k]);
          }
          realEigenvalues[j] = eigenvectors[(i - 1) * n + j];
          eigenvectors[i * n + j] = 0.0;
        }
      }
      realEigenvalues[i] = h;
    }

    // Accumulate transformations.
    for (let i = 0; i < n - 1; i++) {
      eigenvectors[(n - 1) * n + i] = eigenvectors[i * n + i];
      eigenvectors[i * n + i] = 1.0;
      let h = realEigenvalues[i + 1];
      if (h != 0.0) {
        for (let k = 0; k <= i; k++) {
          realEigenvalues[k] = eigenvectors[k * n + i + 1] / h;
        }
        for (let j = 0; j <= i; j++) {
          let g = 0.0;
          for (let k = 0; k <= i; k++) {
            g += eigenvectors[k * n + i + 1] * eigenvectors[k * n + j];
          }
          for (let k = 0; k <= i; k++) {
            eigenvectors[k * n + j] -= g * realEigenvalues[k];
          }
        }
      }
      for (let k = 0; k <= i; k++) {
        eigenvectors[k * n + i + 1] = 0.0;
      }
    }
    for (let j = 0; j < n; j++) {
      realEigenvalues[j] = eigenvectors[(n - 1) * n + j];
      eigenvectors[(n - 1) * n + j] = 0.0;
    }
    eigenvectors[(n - 1) * n + n - 1] = 1.0;
    complexEigenvalues[0] = 0.0;
  },

  // -----------------
  // Diagonalize.
  // -----------------
  eigen_tql2(eigenvectors, realEigenvalues, complexEigenvalues) {
    const n = Math.sqrt(eigenvectors.length);

    for (let i = 1; i < n; i++) {
      complexEigenvalues[i - 1] = complexEigenvalues[i];
    }
    complexEigenvalues[n - 1] = 0.0;

    let f = 0.0;
    let tst1 = 0.0;
    let eps = Math.pow(2.0, -52.0);
    for (let l = 0; l < n; l++) {

      // Find small subdiagonal element
      tst1 = Math.max(tst1, Math.abs(realEigenvalues[l]) + Math.abs(complexEigenvalues[l]));
      let m = l;
      while (m < n) {
        if (Math.abs(complexEigenvalues[m]) <= eps * tst1) {
          break;
        }
        m++;
      }

      // If m == l, d[l] is an eigenvalue, otherwise, iterate.
      if (m > l) {
        let iter = 0;
        do {
          iter = iter + 1;  // (Could check iteration count here.)

          // Compute implicit shift
          let g = realEigenvalues[l];
          let p = (realEigenvalues[l + 1] - g) / (2.0 * complexEigenvalues[l]);
          let r = Math.hypot(p, 1.0);
          if (p < 0) {
            r = -r;
          }
          realEigenvalues[l] = complexEigenvalues[l] / (p + r);
          realEigenvalues[l + 1] = complexEigenvalues[l] * (p + r);
          let dl1 = realEigenvalues[l + 1];
          let h = g - realEigenvalues[l];
          for (let i = l + 2; i < n; i++) {
            realEigenvalues[i] -= h;
          }
          f = f + h;

          // Implicit QL transformation.
          p = realEigenvalues[m];
          let c = 1.0;
          let c2 = c;
          let c3 = c;
          let el1 = complexEigenvalues[l + 1];
          let s = 0.0;
          let s2 = 0.0;
          for (let i = m - 1; i >= l; i--) {
            c3 = c2;
            c2 = c;
            s2 = s;
            g = c * complexEigenvalues[i];
            h = c * p;
            r = Math.hypot(p, complexEigenvalues[i]);
            complexEigenvalues[i + 1] = s * r;
            s = complexEigenvalues[i] / r;
            c = p / r;
            p = c * realEigenvalues[i] - s * g;
            realEigenvalues[i + 1] = h + s * (c * g + s * realEigenvalues[i]);

            // Accumulate transformation.
            for (let k = 0; k < n; k++) {
              h = eigenvectors[k * n + i + 1];
              eigenvectors[k * n + i + 1] = s * eigenvectors[k * n + i] + c * h;
              eigenvectors[k * n + i] = c * eigenvectors[k * n + i] - s * h;
            }
          }
          p = -s * s2 * c3 * el1 * complexEigenvalues[l] / dl1;
          complexEigenvalues[l] = s * p;
          realEigenvalues[l] = c * p;

          // Check for convergence.
        } while (Math.abs(complexEigenvalues[l]) > eps * tst1);
      }
      realEigenvalues[l] = realEigenvalues[l] + f;
      complexEigenvalues[l] = 0.0;
    }

    // Sort eigenvalues and corresponding vectors.
    for (let i = 0; i < n - 1; i++) {
      let k = i;
      let p = realEigenvalues[i];
      for (let j = i + 1; j < n; j++) {
        if (realEigenvalues[j] < p) {
          k = j;
          p = realEigenvalues[j];
        }
      }
      if (k != i) {
        realEigenvalues[k] = realEigenvalues[i];
        realEigenvalues[i] = p;
        for (let j = 0; j < n; j++) {
          p = eigenvectors[j * n + i];
          eigenvectors[j * n + i] = eigenvectors[j * n + k];
          eigenvectors[j * n + k] = p;
        }
      }
    }
  },

  // --------------------------
  // radian to (degree min sec)
  // --------------------------
  radToDms(angle, returnAsText) {
    const sign = (angle < 0.0) ? -1.0 : 1.0;
    angle = ThreeMathUtils.radToDeg(angle * sign);

    let fractPart = ThreeMathUtils.euclideanModulo(angle, 1);
    let deg = Math.floor(angle);

    if (fractPart > 0.999999) {
      fractPart -= 1.0;
      deg += 1.0;
    }

    fractPart *= 60.0;

    let sec = ThreeMathUtils.euclideanModulo(fractPart, 1);
    let min = Math.floor(fractPart);
    if (sec > 0.999999) {
      sec -= 1.0;
      min += 1.0;
    }
    angle = ((deg + min / 100.0 + sec * .006) * sign);
    angle = MathUtils.fmod(angle, 360.0);

    if (returnAsText) {
      fractPart = ThreeMathUtils.euclideanModulo(angle, 1);
      deg = Math.floor(angle);

      fractPart *= 100;
      sec = ThreeMathUtils.euclideanModulo(fractPart, 1);

      min = Math.floor(fractPart);
      sec = Math.floor(sec * 10000);

      const text = deg.toString() + '^ ' + min.toString() + '\' ' + sec + '"';
      return text;
    }
    return angle;
  },

  // ----------------------------------------------
  // fmod
  // returns the floating-point remainder of
  // numerator/denominator (rounded towards zero)
  // ----------------------------------------------
  fmod(a, b) {
    return Number((a - (Math.floor(a / b) * b)).toPrecision(8));
  },

  decimalAdjust(type, value, exp) {
    // If the exp is undefined or zero...
    if (typeof exp === 'undefined' || +exp === 0) {
      return Math[type](value);
    }
    value = +value;
    exp = +exp;
    // If the value is not a number or the exp is not an integer...
    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
      return NaN;
    }
    // Shift
    value = value.toString().split('e');
    value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
    // Shift back
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
  },

  round10(value, exp) {
    return this.decimalAdjust('round', value, exp);
  },

  floor10(value, exp) {
    return decimalAdjust('floor', value, exp);
  },

  ceil10(value, exp) {
    return decimalAdjust('ceil', value, exp);
  },

  // Returns the new point at a specified angle and distance from a  given point
  // in a 2D
  /**
   * @param point - point coordinates with x and y values: {x: 0, y: 1}
   * @param angleInDegrees - given angle where second point is located
   * @param distance - distance where second point is located
  */

  polar2D(point, angleInDegrees, distance) {
    const opposite = Math.sin(180 - angleInDegrees) * distance;
    const adjacent = Math.cos(180 - angleInDegrees) * distance;
    let validatedPoint;
    if (point instanceof Array) {
      validatedPoint = {
        x: point[0] || 0,
        y: point[1] || 0,
      };
    } else if (point instanceof Object) {
      validatedPoint = {
        x: point.x || 0,
        y: point.y || 0,
      };
    } else {
      validatedPoint = {
        x: 0,
        y: 0,
      };
    }

    return {
      x: validatedPoint.x + adjacent,
      y: validatedPoint.y + opposite,
    };
  },


  // as an argument takes 2 points(objects with x and y properties)
  // angle relative to x axis beginning with 0 degrees
  // first point taken as coordinate start point
  // if points are incorrect return null
  // else returns angle in degrees
  angleWith2Points(point1, point2) {
    if (this.isEmpty(point1.x) || this.isEmpty(point1.y) || this.isEmpty(point2.x) || this.isEmpty(point2.y)) {
      return null;
    }

    const newPoint = {
      x: (point2.x - point1.x),
      y: (point2.y - point1.y),
    };

    let angle = Math.atan2(newPoint.y, newPoint.x) * 180 / Math.PI;

    if (angle < 0) angle += 360;
  },

  // based on Kabsch–Umeyama algorithm 
  // https://zpl.fi/aligning-point-patterns-with-kabsch-umeyama-algorithm/
  // in 3D
  paramsToAlignPointPatterns(pointsA, pointsB, uniformScaling = false) {
    const rotationMatrix = new Matrix3().identity();
    const scale = new Vector3(1, 1, 1);
    const translation = new Vector3();
    if (!Array.isArray(pointsA) || !Array.isArray(pointsB)) {
      return {rotationMatrix, scale, translation};
    }

    let n = pointsA.length;

    // calculate the centroids of two sets of points
    const centroidA = new Vector3();
    const centroidB = new Vector3();
    for (let i = 0; i < n; i++) {
      centroidA.add(pointsA[i]);
      centroidB.add(pointsB[i]);
    }
    centroidA.divideScalar(n);
    centroidB.divideScalar(n);

    // calculate the covariance matrix elements
    const tmpV1 = new Vector3();
    const tmpV2 = new Vector3();
    const row = new Vector3();
    const row1 = new Vector3();
    const row2 = new Vector3();
    const row3 = new Vector3();
    for (let i = 0; i < n; i++) {
      tmpV1.copy(pointsA[i]).sub(centroidA);
      tmpV2.copy(pointsB[i]).sub(centroidB);
      row.copy(tmpV2).multiplyScalar(tmpV1.x);
      row1.add(row);
      row.copy(tmpV2).multiplyScalar(tmpV1.y);
      row2.add(row);
      row.copy(tmpV2).multiplyScalar(tmpV1.z);
      row3.add(row);
    }
    row1.divideScalar(n);
    row2.divideScalar(n);
    row3.divideScalar(n);

    if (Math.abs(row1.x) < this.EPS) row1.x = 0;
    if (Math.abs(row1.y) < this.EPS) row1.y = 0;
    if (Math.abs(row1.z) < this.EPS) row1.z = 0;
    if (Math.abs(row2.x) < this.EPS) row2.x = 0;
    if (Math.abs(row2.y) < this.EPS) row2.y = 0;
    if (Math.abs(row2.z) < this.EPS) row2.z = 0;
    if (Math.abs(row3.x) < this.EPS) row3.x = 0;
    if (Math.abs(row3.y) < this.EPS) row3.y = 0;
    if (Math.abs(row3.z) < this.EPS) row3.z = 0;

    const matrixToSVD = [[row1.x, row1.y, row1.z],
                         [row2.x, row2.y, row2.z],
                         [row3.x, row3.y, row3.z]];

    // compute the covariance matrix's Singular Value Decomposition
    const { u, q, v } = this.SVD(matrixToSVD, true, true, Number.EPSILON, Number.MIN_VALUE / Number.EPSILON);
  
    const matrixU = new Matrix3().set(u[0][0], u[0][1], u[0][2], u[1][0], u[1][1], u[1][2], u[2][0], u[2][1], u[2][2]);
    const matrixV = new Matrix3().set(v[0][0], v[0][1], v[0][2], v[1][0], v[1][1], v[1][2], v[2][0], v[2][1], v[2][2]);
    matrixV.transpose();

    const detU = matrixU.determinant();
    const detV = matrixV.determinant();
    let d = detU * detV;
    if (d > 0) d = 1; else d = -1;

    const matrixS = new Matrix3().identity();
    matrixS.elements[8] = d;

    // compute the rotation matrix and its invert
    rotationMatrix.copy(matrixU).multiply(matrixS);
    rotationMatrix.multiply(matrixV);

    const invertRM = rotationMatrix.clone();
    invertRM.invert();

    // calculate the centroid of the transformed points
    const centroidAT = new Vector3();
    for (let i = 0; i < n; i++) {
      tmpV1.copy(pointsA[i]).applyMatrix3(invertRM);
      centroidAT.add(tmpV1);
    }
    centroidAT.divideScalar(n);

    // calculate the variance of the transformed pointsA
    const sigmaA2 = new Vector3();
    for (let i = 0; i < n; i++) {
      tmpV1.copy(pointsA[i]).applyMatrix3(invertRM);
      tmpV1.sub(centroidAT);
      tmpV2.copy(tmpV1).multiply(tmpV1);
      sigmaA2.add(tmpV2);
    }
    sigmaA2.divideScalar(n);

    // compute the scale vector
    const matrixQ = new Matrix3().set(q[0], 0, 0, 0, q[1], 0, 0, 0, q[2]);
    matrixQ.multiply(matrixS);
    const me = matrixQ.elements;
    scale.set(me[0], me[4], me[8]);

    scale.x = Math.abs(scale.x) > 1e-3 ? sigmaA2.x / scale.x : 1;
    scale.y = Math.abs(scale.y) > 1e-3 ? sigmaA2.y / scale.y : 1;
    scale.z = Math.abs(scale.z) > 1e-3 ? sigmaA2.z / scale.z : 1;

    if (uniformScaling) {
      const nS = scale.clone();
      nS.z = 0;
      nS.normalize();
      if (nS.x > nS.y) {
        scale.set(scale.y, scale.y, scale.y);
      } else {
        scale.set(scale.x, scale.x, scale.x);
      }
    }

    // compute the translation vector
    centroidB.multiply(scale).applyMatrix3(rotationMatrix);
    translation.copy(centroidA).sub(centroidB);

    return {rotationMatrix, scale, translation};
  },


  // taken from svd-js npm package
  SVD(a, withu, withv, eps, tol) {
    // Define default parameters
    withu = withu !== undefined ? withu : true
    withv = withv !== undefined ? withv : true
    eps = eps || Math.pow(2, -52)
    tol = 1e-64 / eps
  
    // throw error if a is not defined
    if (!a) {
      throw new TypeError('Matrix a is not defined')
    }
  
    // Householder's reduction to bidiagonal form
  
    const n = a[0].length
    const m = a.length
  
    if (m < n) {
      throw new TypeError('Invalid matrix: m < n')
    }
  
    let i, j, k, l, l1, c, f, g, h, s, x, y, z
  
    g = 0
    x = 0
    const e = []
  
    const u = []
    const v = []
  
    const mOrN = (withu === 'f') ? m : n
  
    // Initialize u
    for (i = 0; i < m; i++) {
      u[i] = new Array(mOrN).fill(0)
    }
  
    // Initialize v
    for (i = 0; i < n; i++) {
      v[i] = new Array(n).fill(0)
    }
  
    // Initialize q
    const q = new Array(n).fill(0)
  
    // Copy array a in u
    for (i = 0; i < m; i++) {
      for (j = 0; j < n; j++) {
        u[i][j] = a[i][j]
      }
    }
  
    for (i = 0; i < n; i++) {
      e[i] = g
      s = 0
      l = i + 1
      for (j = i; j < m; j++) {
        s += Math.pow(u[j][i], 2)
      }
      if (s < tol) {
        g = 0
      } else {
        f = u[i][i]
        g = f < 0 ? Math.sqrt(s) : -Math.sqrt(s)
        h = f * g - s
        u[i][i] = f - g
        for (j = l; j < n; j++) {
          s = 0
          for (k = i; k < m; k++) {
            s += u[k][i] * u[k][j]
          }
          f = s / h
          for (k = i; k < m; k++) {
            u[k][j] = u[k][j] + f * u[k][i]
          }
        }
      }
      q[i] = g
      s = 0
      for (j = l; j < n; j++) {
        s += Math.pow(u[i][j], 2)
      }
      if (s < tol) {
        g = 0
      } else {
        f = u[i][i + 1]
        g = f < 0 ? Math.sqrt(s) : -Math.sqrt(s)
        h = f * g - s
        u[i][i + 1] = f - g
        for (j = l; j < n; j++) {
          e[j] = u[i][j] / h
        }
        for (j = l; j < m; j++) {
          s = 0
          for (k = l; k < n; k++) {
            s += u[j][k] * u[i][k]
          }
          for (k = l; k < n; k++) {
            u[j][k] = u[j][k] + s * e[k]
          }
        }
      }
      y = Math.abs(q[i]) + Math.abs(e[i])
      if (y > x) {
        x = y
      }
    }
  
    // Accumulation of right-hand transformations
    if (withv) {
      for (i = n - 1; i >= 0; i--) {
        if (g !== 0) {
          h = u[i][i + 1] * g
          for (j = l; j < n; j++) {
            v[j][i] = u[i][j] / h
          }
          for (j = l; j < n; j++) {
            s = 0
            for (k = l; k < n; k++) {
              s += u[i][k] * v[k][j]
            }
            for (k = l; k < n; k++) {
              v[k][j] = v[k][j] + s * v[k][i]
            }
          }
        }
        for (j = l; j < n; j++) {
          v[i][j] = 0
          v[j][i] = 0
        }
        v[i][i] = 1
        g = e[i]
        l = i
      }
    }
  
    // Accumulation of left-hand transformations
    if (withu) {
      if (withu === 'f') {
        for (i = n; i < m; i++) {
          for (j = n; j < m; j++) {
            u[i][j] = 0
          }
          u[i][i] = 1
        }
      }
      for (i = n - 1; i >= 0; i--) {
        l = i + 1
        g = q[i]
        for (j = l; j < mOrN; j++) {
          u[i][j] = 0
        }
        if (g !== 0) {
          h = u[i][i] * g
          for (j = l; j < mOrN; j++) {
            s = 0
            for (k = l; k < m; k++) {
              s += u[k][i] * u[k][j]
            }
            f = s / h
            for (k = i; k < m; k++) {
              u[k][j] = u[k][j] + f * u[k][i]
            }
          }
          for (j = i; j < m; j++) {
            u[j][i] = u[j][i] / g
          }
        } else {
          for (j = i; j < m; j++) {
            u[j][i] = 0
          }
        }
        u[i][i] = u[i][i] + 1
      }
    }
  
    // Diagonalization of the bidiagonal form
    eps = eps * x
    let testConvergence
    for (k = n - 1; k >= 0; k--) {
      for (let iteration = 0; iteration < 50; iteration++) {
        // test-f-splitting
        testConvergence = false
        for (l = k; l >= 0; l--) {
          if (Math.abs(e[l]) <= eps) {
            testConvergence = true
            break
          }
          if (Math.abs(q[l - 1]) <= eps) {
            break
          }
        }
  
        if (!testConvergence) { // cancellation of e[l] if l>0
          c = 0
          s = 1
          l1 = l - 1
          for (i = l; i < k + 1; i++) {
            f = s * e[i]
            e[i] = c * e[i]
            if (Math.abs(f) <= eps) {
              break // goto test-f-convergence
            }
            g = q[i]
            q[i] = Math.sqrt(f * f + g * g)
            h = q[i]
            c = g / h
            s = -f / h
            if (withu) {
              for (j = 0; j < m; j++) {
                y = u[j][l1]
                z = u[j][i]
                u[j][l1] = y * c + (z * s)
                u[j][i] = -y * s + (z * c)
              }
            }
          }
        }
  
        // test f convergence
        z = q[k]
        if (l === k) { // convergence
          if (z < 0) {
            // q[k] is made non-negative
            q[k] = -z
            if (withv) {
              for (j = 0; j < n; j++) {
                v[j][k] = -v[j][k]
              }
            }
          }
          break // break out of iteration loop and move on to next k value
        }
  
        // Shift from bottom 2x2 minor
        x = q[l]
        y = q[k - 1]
        g = e[k - 1]
        h = e[k]
        f = ((y - z) * (y + z) + (g - h) * (g + h)) / (2 * h * y)
        g = Math.sqrt(f * f + 1)
        f = ((x - z) * (x + z) + h * (y / (f < 0 ? (f - g) : (f + g)) - h)) / x
  
        // Next QR transformation
        c = 1
        s = 1
        for (i = l + 1; i < k + 1; i++) {
          g = e[i]
          y = q[i]
          h = s * g
          g = c * g
          z = Math.sqrt(f * f + h * h)
          e[i - 1] = z
          c = f / z
          s = h / z
          f = x * c + g * s
          g = -x * s + g * c
          h = y * s
          y = y * c
          if (withv) {
            for (j = 0; j < n; j++) {
              x = v[j][i - 1]
              z = v[j][i]
              v[j][i - 1] = x * c + z * s
              v[j][i] = -x * s + z * c
            }
          }
          z = Math.sqrt(f * f + h * h)
          q[i - 1] = z
          c = f / z
          s = h / z
          f = c * g + s * y
          x = -s * g + c * y
          if (withu) {
            for (j = 0; j < m; j++) {
              y = u[j][i - 1]
              z = u[j][i]
              u[j][i - 1] = y * c + z * s
              u[j][i] = -y * s + z * c
            }
          }
        }
        e[l] = 0
        e[k] = f
        q[k] = x
      }
    }
  
    // Number below eps should be zero
    for (i = 0; i < n; i++) {
      if (q[i] < eps) q[i] = 0
    }
  
    return { u, q, v }
  },
};