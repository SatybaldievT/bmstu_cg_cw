const __EPS = 1.e-8;

export class EmpiricalDistribution {
  constructor(isLogNormal = false, allowZero = false) {
    this.isEmpirical = true;

    this._isLogNormal = typeof isLogNormal === 'boolean' ? isLogNormal : false;
    this._isZeroAllowed = typeof allowZero === 'boolean' ? allowZero : false;

    this._min = 0;
    this._max = 0;
    this._highest2 = 0;
    this._highest3 = 0;
    this._highest4 = 0;
    this._median = 0;
    this._mean = 0;
    this._stdDev = 1;
    this._variance = 0;
    this._geomMean = 0;
    this._totalWeight = 0;
    this._data = [];
    this._cdf = new Map();
    this._srcIndices = null;

    this._supportBins = false;
    this._binParams = {
      min: 0,
      max: 0,
      width: 0,
    }
    this._binsCount = 0;
    this._binsMaxFreq = 0;
    this._bins = new Map();
  }

  get min() {
    return this._min;
  }

  get max() {
    return this._max;
  }

  get highest2() {
    return this._highest2;
  }

  get highest3() {
    return this._highest3;
  }

  get highest4() {
    return this._highest4;
  }

  get mean() {
    return this._mean;
  }

  get stdDev() {
    return this._stdDev;
  }

  get variance() {
    return this._variance;
  }

  get median() {
    return this._median;
  }

  get geomMean() {
    return this._geomMean;
  }

  get geomStdDev() {
    return this._geomStdDev;
  }

  get totalWeight() {
    return this._totalWeight;
  }

  get binMin() {
    return this._binParams.min;
  }

  get binMax() {
    return this._binParams.max;
  }

  get binWidth() {
    return this._binParams.width;
  }

  get binsCount() {
    return this._binsCount;
  }

  get binsMaxFreq() {
    return this._binsMaxFreq;
  }

  get size() {
    return this._data.length;
  }

  get srcIndices() {
    return this._srcIndices;
  }

  isLogNormal() {
    return this._isLogNormal;
  }

  isBinsSupported() {
    return this._supportBins;
  }

  dispose() {
    this.reset();
  }

  reset() {
    if (this._data) this._data.length = 0;
    this._cdf.clear();
    this._min = 0;
    this._max = 0;
    this._highest2 = 0;
    this._highest3 = 0;
    this._highest4 = 0;
    this._median = 0;
    this._mean = 0;
    this._geomMean = 0;
    this._stdDev = 1;
    this._variance = 0;
    this._totalWeight = 0;

    this._supportBins = false;
    this._binParams.min = 0;
    this._binParams.max = 0;
    this._binParams.width = 0;
    this._binsCount = 0;
    this._binsMaxFreq = 0;
    this._bins.clear();
  }

  setValues(values, weights, binParams, indices) {
    if (!(Array.isArray(values) && values.length > 0)) return false;

    const isWeighted = Array.isArray(weights) && weights.length > 0;
    if (isWeighted && values.length !== weights.length) return false;

    if (!isWeighted) weights = new Array(values.length).fill(1);

    const isIndexed = Array.isArray(indices) && indices.length > 0;

    const isLN = this._isLogNormal;

    this.reset();

    // if bin params provided need to validate them
    let binMin = 0;
    let binMax = 0;
    let binWidth = 0;
    let numBins = 0;
    if (binParams && Number.isFinite(binParams.min) &&
      Number.isFinite(binParams.max) && Number.isFinite(binParams.width)) {
      binMin = binParams.min
      binMax = binParams.max;
      binWidth = binParams.width < 1.e-4 ? 0.01 : binParams.width;
      numBins = Math.ceil((binMax - binMin) / binWidth);
      if (numBins > 1)
        binMax = binMin + numBins * binWidth;

      if (numBins > 0) {
        if (isLN && !binParams.isLnValues) {
          this._binParams.min = Math.log(binMin);
          this._binParams.max = Math.log(binMax);
        } else if (!isLN && binParams.isLnValues) {
          this._binParams.min = Math.exp(binMin);
          this._binParams.max = Math.exp(binMax);
        } else {
          this._binParams.min = binMin;
          this._binParams.max = binMax;
        }
        this._binParams.width = (this._binParams.max - this._binParams.min) / numBins;
        this._binsCount = numBins;

        binMin = this._binParams.min;
        binMax = this._binParams.max;
        binWidth = this._binParams.width;
        this._supportBins = true;
      }
    }

    // Validate values and weights and calculate weighted values
    let weightedSum = 0;
    let totalWeight = 0;
    let newValues = [];
    let newWeights = [];

    const calcBin = this._supportBins;

    let isValid = true;
    for (let i = 0, cnt = values.length; i < cnt; i++) {
      let value = values[i];
      isValid = Number.isFinite(value);

      let weight = 1;
      if (isValid && isWeighted) {
        weight = weights[i];
        isValid = Number.isFinite(weight) && weight > 0;
      }

      if (!isValid) break;

      if (isLN && value < __EPS) {
        if (this._isZeroAllowed) value = __EPS;
        else continue;
      }

      const v = isLN ? Math.log(value) : value;

      // if bins are supported gather bin data
      if (calcBin && v >= binMin && v <= binMax) {

        let binIndex = Math.floor((v - binMin) / binWidth);
        if (binIndex === numBins) binIndex -= 1;
        if (!this._bins.has(binIndex)) {
          this._bins.set(binIndex, {min: v, max: v, sum: value, weight, indices: isIndexed ? [ indices[i] ] : [ i ]});
          if (this._binsMaxFreq < weight) this._binsMaxFreq = weight;
        } else {
          const binData = this._bins.get(binIndex);
          if (v < binData.min) binData.min = v;
          if (v > binData.max) binData.max = v;
          binData.weight += weight;
          binData.sum += value;
          binData.indices.push(isIndexed ? indices[i] : i)

          if (this._binsMaxFreq < binData.weight) this._binsMaxFreq = binData.weight;
        }
      }

      newValues.push(v);
      newWeights.push(weight);
      weightedSum += (v * weight);
      totalWeight += weight;
    }

    if (!isValid) return false;

    // Calculate weighted mean
    this._mean = weightedSum / totalWeight;

    // Calculate geometric weighted mean
    this._geomMean = isLN ? Math.exp(this._mean) : 0;

    // Calculate squared difference
    const sqDifferences = jStat.pow(jStat.subtract(newValues, this._mean), 2);

    // Calculate weighted sum of squares
    const weightedSumOfSquares = jStat.dot(sqDifferences, newWeights);

    // Calculate weighted variance (for samples)
    this._variance = weightedSumOfSquares / (totalWeight - 1);

    // Calculate weighted standard deviation
    this._stdDev = Math.sqrt(this._variance);
    this._geomStdDev = isLN ? Math.exp(this._stdDev) : 0;

    this._totalWeight = totalWeight;

    // Keep values and weights
    this._data = null;
    this._data = newValues.map((value, index) => ({ value, weight: newWeights[index] }));

    this._srcIndices = indices;

    // Sort values
    const sortedData = newValues.map((value, index) => ({ value, weight: newWeights[index] }))
      .sort((a, b) => a.value - b.value);

    // Get min, max, median
    const cnt = sortedData.length;
    if (cnt > 2) {
      this._min = sortedData[0].value;
      this._max = sortedData[cnt - 1].value;
      this._highest2 = sortedData[cnt - 2].value;
      this._highest3 = cnt > 3 ? sortedData[cnt - 3].value : 0;
      this._highest4 = cnt > 4 ? sortedData[cnt - 4].value : 0;

      // check if array is even or odd, then assign the appropriate
      this._median = !(cnt & 1) ? (sortedData[(cnt / 2) - 1].value + sortedData[(cnt / 2)].value) / 2
        : sortedData[(cnt / 2) | 0].value;
    }

    // Calculate weighted CDF
    let cumulativeWeight = 0;
    this._cdf.clear();
    for (const { value, weight } of sortedData) {
      cumulativeWeight += weight;
      this._cdf.set(value, cumulativeWeight / this._totalWeight);
    }

    return true;
  }


  // Calculate weighted cdf
  cdf(value, sortedData) {
    if (!Number.isFinite(value) || !(sortedData && sortedData.length > 2)) return 0;

    let cdf = 0;
    const last = sortedData.length - 1;
    if (value < sortedData[0].value) {
      cdf = 0; // Value below minimum
    } else if (value >= sortedData[last].value) {
      cdf = 1; // Value at or above maximum
    } else {
      // Find closest upper bound in cdf
      cdf = -1;
      let low = 0;
      let high = last;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);

        if (sortedData[mid].value === value) {
          cdf = this._cdf.get(sortedData[mid].value); // Exact match
          break;
        } else if (sortedData[mid].value < value) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (cdf === -1) {
        // Get the CDF value of the closest lower bound
        cdf = this._cdf.get(sortedData[low - 1].value);
      }
    }

    return cdf;
  }

  probability(values) {
    if (!Array.isArray(values) || values.length === 0) return [];

    const sortedData = this._data.slice().sort((a, b) => a.value - b.value);
    const probabilities = values.map(value => this.cdf(value, sortedData));

    return probabilities;
  }

  // Calculate weighted quantile
  _quantile(value, sortedData) {
    if (!(Number.isFinite(value) && value > 0 && value <= 1) ||
      !(sortedData && sortedData.length > 2)) {
      return 0;
    }

    let qntl = this.max;
    let samplesNo = 0;
    let currWeight = 0;
    const targetWeight = value * this._totalWeight;
    for (let i = 0, cnt = sortedData.length; i < cnt; i++) {
      const prevWeight = currWeight;
      currWeight += sortedData[i].weight;
      const currValue = sortedData[i].value;
      if (Math.abs(currWeight - targetWeight) < Number.EPSILON) {
        qntl = currValue; // Exact match
        samplesNo = i ;
        break;
      } else if (currWeight > targetWeight) {
        if (i === 0) {
          qntl = currValue;
          samplesNo = 0;
          break;
        } else {
          const prevValue = sortedData[i - 1].value;
          const deltaPct = (targetWeight - prevWeight) / (currWeight - prevWeight);
          qntl = prevValue + deltaPct * (currValue - prevValue);
          samplesNo = i;
          break;
        }
      }
    }
    return { qntl, samplesNo };
  }

  quantiles(numOfQuantiles) {
    if (!(Number.isFinite(numOfQuantiles) && numOfQuantiles > 0) ||
      !(this._data && this._data.length > 2)) {
      return [];
    }
    const quantiles = [];
    const counts = [];
    const min = [];
    const max = [];
    const sortedData = this._data.slice().sort((a, b) => a.value - b.value);

    let qntl = 0;
    let prevNo = 0;
    for (let i = 0; i < numOfQuantiles; ++i) {
      // Calculate quantile using (rank - 0.5) / numOfQuantiles for better accuracy
      qntl = (i + 0.5) / numOfQuantiles;
      // qntl = (i + 1) / (numOfQuantiles + 1);
      const res = this._quantile(qntl, sortedData);
      counts.push(res.samplesNo - prevNo);
      const quantilMin = sortedData[prevNo].value;
      const quantilMax = sortedData[res.samplesNo].value;
      min.push(quantilMin);
      max.push(quantilMax);
      prevNo = res.samplesNo;
      quantiles.push(res.qntl);
    }

    return { quantiles: quantiles, counts: counts, min: min, max: max};
  }

  getValuesGrouped() {
    const unqValues = Array.from(this._cdf.keys());
    return unqValues;
  }

  getValues() {
    if (!this._data || this._data.length < 2) return [];
    const _values = this._data.map(elem => elem.value);
    return _values;
  }

  getSrcData() {
    return this._data;
  }

  getBinsData() {
    if (!this._supportBins || this._binsCount === 0 || this._bins.size === 0) {
      return [];
    }

    const bins = new Array(this._binsCount).fill(null);
    for (let [key, value] of this._bins) {
      bins[key] = value;
    }

    return bins;
  }
}
