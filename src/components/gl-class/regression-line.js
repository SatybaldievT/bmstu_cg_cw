/**
 * Ported from regression-js and adapted to our data structure
 **/

/**
* Round a number to a precision, specificed in number of decimal places
*
* @param {number} number - The number to round
* @param {number} precision - The number of decimal places to round to:
*                             > 0 means decimals, < 0 means powers of 10
*
* @return {number} - The number, rounded
*/
const round = function (number, precision) {
  const factor = 10 ** precision;
  return Math.round(number * factor) / factor;
}

const _EPS = 1e-8;
const _EPS3 = 1e-3;

export class RegressionLine {
  constructor(xValues, yValues) {
    this.xValues = null;
    this.yValues = null;
    this.setValues(xValues, yValues);
  }

  setValues(xValues, yValues) {
    this.xValues = null;
    this.yValues = null;

    const isXValid = Array.isArray(xValues) && xValues.length > 0;
    const isYValid = Array.isArray(yValues) && yValues.length > 0;
    if (!(isXValid && isYValid && xValues.length === yValues.length)) {
      console.error('Error on setting x and y values');
      return;
    }

    this.xValues = xValues;
    this.yValues = yValues;
  }

  /**
  * Determine the solution of a system of linear equations A * x = b using
  * Gaussian elimination.
  *
  * @param {Array<Array<number>>} input - A 2-d matrix of data in row-major form [ A | b ]
  * @param {number} order - How many degrees to solve for
  *
  * @return {Array<number>} - Vector of normalized solution coefficients matrix (x)
  */
  _gaussianElimination(input, order) {
    const matrix = input;
    const n = input.length - 1;
    const coefficients = [order];

    for (let i = 0; i < n; i++) {
      let maxrow = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(matrix[i][j]) > Math.abs(matrix[i][maxrow])) {
          maxrow = j;
        }
      }

      for (let k = i; k < n + 1; k++) {
        const tmp = matrix[k][i];
        matrix[k][i] = matrix[k][maxrow];
        matrix[k][maxrow] = tmp;
      }

      for (let j = i + 1; j < n; j++) {
        for (let k = n; k >= i; k--) {
          matrix[k][j] -= (matrix[k][i] * matrix[i][j]) / matrix[i][i];
        }
      }
    }

    for (let j = n - 1; j >= 0; j--) {
      let total = 0;
      for (let k = j + 1; k < n; k++) {
        total += matrix[k][j] * coefficients[k];
      }

      coefficients[j] = (matrix[n][j] - total) / matrix[j][j];
    }

    return coefficients;
  }

  //===============================================
  //  The set of all fitting methods
  //===============================================
  linear() {
    const xs = this.xValues;
    const ys = this.yValues;
    if (!xs || !ys) return null;

    const sum = [0, 0, 0, 0];
    let len = 0;
    const data = [];
    for (let n = 0; n < xs.length; n++) {
      len++;
      sum[0] += xs[n];
      sum[1] += ys[n];
      sum[2] += xs[n] * xs[n];
      sum[3] += xs[n] * ys[n];
      data.push([xs[n], ys[n]]);
    }

    const run = ((len * sum[2]) - (sum[0] * sum[0]));
    const rise = ((len * sum[3]) - (sum[0] * sum[1]));
    const gradient = run === 0 ? 0 : rise / run;
    const intercept = (sum[1] / len) - ((gradient * sum[0]) / len);

    const predict = (x) => (gradient * x + intercept);

    // calculate r-squared
    let ssResidual = 0, ssTotal = 0, ssX = 0;
    const meanY = sum[1] / len;
    const meanX = sum[0] / len;
    for (const point of data) {
      const fit = (gradient * point[0]) + intercept;
      ssResidual += (point[1] - fit) * (point[1] - fit);
      ssTotal += (point[1] - meanY) * (point[1] - meanY);
      ssX += (point[0] - meanX) * (point[0] - meanX);
    }
    const rSquared = 1 - ssResidual / ssTotal;

    const b0 = Math.abs(gradient) < _EPS3 ? gradient.toExponential(2) : gradient.toFixed(3);
    const b1 = Math.abs(intercept) < _EPS3 ? intercept.toExponential(2) : intercept.toFixed(3);

    return {
      predict,
      equation: [gradient, intercept],
      r2: rSquared,
      string: intercept === 0 ? `y = ${b0}x` : `y = ${b0}x + ${b1}`,
      sumXX: sum[2],
      ssTotal, ssResidual, ssX
    };
  }

  exponential() {
    const xs = this.xValues;
    const ys = this.yValues;
    if (!xs || !ys) return null;

    const sum = [0, 0, 0, 0, 0, 0, 0];

    let len = 0;
    const data = [];
    for (let n = 0; n < xs.length; n++) {
      if (ys[n] < _EPS) continue;
      len++;
      sum[0] += xs[n];
      sum[1] += ys[n];
      sum[2] += xs[n] * xs[n] * ys[n];
      sum[3] += ys[n] * Math.log(ys[n]);
      sum[4] += xs[n] * ys[n] * Math.log(ys[n]);
      sum[5] += xs[n] * ys[n];
      sum[6] += xs[n] * xs[n];
      data.push([xs[n], ys[n]]);
    }

    const denominator = ((sum[1] * sum[2]) - (sum[5] * sum[5]));
    const a = Math.exp(((sum[2] * sum[3]) - (sum[5] * sum[4])) / denominator);
    const b = ((sum[1] * sum[4]) - (sum[5] * sum[3])) / denominator;
    const coeffA = a;
    const coeffB = b;

    const predict = (x) => (coeffA * Math.exp(coeffB * x));

    // calculate r-squared
    let ssResidual = 0, ssTotal = 0, ssX = 0;
    const meanY = sum[1] / len;
    const meanX = sum[0] / len;
    for (const point of data) {
      const fit = coeffA * Math.exp(coeffB * point[0]);
      ssResidual += (point[1] - fit) * (point[1] - fit);
      ssTotal += (point[1] - meanY) * (point[1] - meanY);
      ssX += (point[0] - meanX) * (point[0] - meanX);
    }
    const rSquared = 1 - ssResidual / ssTotal;

    const b0 = Math.abs(coeffA) < _EPS3 ? coeffA.toExponential(2) : coeffA.toFixed(3);
    const b1 = Math.abs(coeffB) < _EPS3 ? coeffB.toExponential(2) : coeffB.toFixed(3);

    return {
      predict,
      equation: [coeffA, coeffB],
      string: `y = ${b0}e^(${b1}x)`,
      r2: rSquared,
      sumXX: sum[6],
      ssTotal, ssResidual, ssX
    };
  }

  logarithmic() {
    const xs = this.xValues;
    const ys = this.yValues;
    if (!xs || !ys) return null;

    const sum = [0, 0, 0, 0, 0, 0];

    let len = 0;
    const data = [];
    for (let n = 0, cnt = xs.length; n < cnt; n++) {
      if (xs[n] < _EPS) continue;
      len++;
      sum[0] += Math.log(xs[n]);
      sum[1] += ys[n] * Math.log(xs[n]);
      sum[2] += ys[n];
      sum[3] += (Math.log(xs[n]) ** 2);
      sum[4] += xs[n] * xs[n];
      data.push([xs[n], ys[n]]);
    }

    const a = ((len * sum[1]) - (sum[2] * sum[0])) / ((len * sum[3]) - (sum[0] * sum[0]));
    const coeffB = a;
    const coeffA = (sum[2] - (coeffB * sum[0])) / len;

    const predict = (x) => (coeffA + (coeffB * Math.log(x)));

    // calculate r-squared
    let ssResidual = 0, ssTotal = 0, ssX = 0;
    const meanY = sum[2] / len;
    const meanX = sum[0] / len;
    for (const point of data) {
      const fit = coeffA + (coeffB * Math.log(point[0]));
      ssResidual += (point[1] - fit) * (point[1] - fit);
      ssTotal += (point[1] - meanY) * (point[1] - meanY);
      ssX += (point[0] - meanX) * (point[0] - meanX);
    }
    const rSquared = 1 - ssResidual / ssTotal;

    const b0 = Math.abs(coeffA) < _EPS3 ? coeffA.toExponential(2) : coeffA.toFixed(3);
    const b1 = Math.abs(coeffB) < _EPS3 ? coeffB.toExponential(2) : coeffB.toFixed(3);

    return {
      predict,
      equation: [coeffA, coeffB],
      string: `y = ${b0} + ${b1} ln(x)`,
      r2: rSquared,
      sumXX: sum[4],
      ssTotal, ssResidual, ssX
    };
  }

  power() {
    const xs = this.xValues;
    const ys = this.yValues;
    if (!xs || !ys) return null;

    const sum = [0, 0, 0, 0, 0, 0];

    let len = 0;
    const data = [];
    for (let n = 0, cnt = xs.length; n < cnt; n++) {
      if (xs[n] < _EPS || ys[n] < _EPS) continue;
      len++;
      sum[0] += Math.log(xs[n]);
      sum[1] += Math.log(ys[n]) * Math.log(xs[n]);
      sum[2] += Math.log(ys[n]);
      sum[3] += (Math.log(xs[n]) ** 2);
      sum[4] += xs[n] * xs[n];
      sum[5] += ys[n];
      data.push([xs[n], ys[n]]);
    }

    const b = ((len * sum[1]) - (sum[0] * sum[2])) / ((len * sum[3]) - (sum[0] ** 2));
    const a = ((sum[2] - (b * sum[0])) / len);
    const coeffA = Math.exp(a);
    const coeffB = b;

    const predict = (x) => (coeffA * (x ** coeffB));

    // calculate r-squared
    let ssResidual = 0, ssTotal = 0, ssX = 0;
    const meanY = sum[5] / len;
    const meanX = sum[0] / len;
    for (const point of data) {
      const fit = coeffA * (point[0] ** coeffB);
      ssResidual += (point[1] - fit) * (point[1] - fit);
      ssTotal += (point[1] - meanY) * (point[1] - meanY);
      ssX += (point[0] - meanX) * (point[0] - meanX);
    }
    const rSquared = 1 - ssResidual / ssTotal;

    const b0 = Math.abs(coeffA) < _EPS3 ? coeffA.toExponential(2) : coeffA.toFixed(3);
    const b1 = Math.abs(coeffB) < _EPS3 ? coeffB.toExponential(2) : coeffB.toFixed(3);

    return {
      predict,
      equation: [coeffA, coeffB],
      string: `y = ${b0}x^${b1}`,
      r2: rSquared,
      sumXX: sum[4],
      ssTotal, ssResidual, ssX
    };
  }

  polynomial(order) {
    const xs = this.xValues;
    const ys = this.yValues;
    if (!xs || !ys) return null;

    const _order = Number.isFinite(order) && order > 0 && order < 6 ? order : 2;

    const lhs = [];
    const rhs = [];
    let a = 0;
    let b = 0;
    const len = xs.length;
    const k = _order + 1;

    let isDataReady = false;
    const sums = [0, 0, 0];
    const data = [];
    for (let i = 0; i < k; i++) {
      for (let l = 0; l < len; l++) {
        a += (xs[l] ** i) * ys[l];
        if (!isDataReady) {
          sums[0] += xs[l] * xs[l];
          sums[1] += ys[l];
          sums[2] += xs[l];
          data.push([xs[l], ys[l]]);
        }
      }
      isDataReady = true;

      lhs.push(a);
      a = 0;

      const c = [];
      for (let j = 0; j < k; j++) {
        for (let l = 0; l < len; l++) {
          b += xs[l] ** (i + j);
        }
        c.push(b);
        b = 0;
      }
      rhs.push(c);
    }
    rhs.push(lhs);

    const coefficients = this._gaussianElimination(rhs, k);

    const predict = (x) => (coefficients.reduce((sum, coeff, power) => sum + (coeff * (x ** power)), 0));

    // calculate r-squared
    let ssResidual = 0, ssTotal = 0, ssX = 0;
    const meanY = sums[1] / len;
    const meanX = sums[2] / len;
    for (const point of data) {
      const fit = predict(point[0]);
      ssResidual += (point[1] - fit) * (point[1] - fit);
      ssTotal += (point[1] - meanY) * (point[1] - meanY);
      ssX += (point[0] - meanX) * (point[0] - meanX);
    }
    const rSquared = 1 - ssResidual / ssTotal;

    let string = 'y = ';
    for (let i = coefficients.length - 1; i >= 0; i--) {
      const coefStr = Math.abs(coefficients[i]) < _EPS3 ? coefficients[i].toExponential(2) : coefficients[i].toFixed(3);
      if (i > 1) {
        string += `${coefStr}x^${i} + `;
      } else if (i === 1) {
        string += `${coefStr}x + `;
      } else {
        string += coefStr;
      }
    }

    return {
      string,
      predict,
      equation: [...coefficients],
      r2: rSquared,
      sumXX: sums[0],
      ssTotal, ssResidual, ssX
    };
  }
}
