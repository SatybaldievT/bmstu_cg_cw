import { Axis } from './axis';
import { Chart } from './chart';
import { ChartLine } from './chart-line';
import { ChartType, RegressionType, AxisScale, ThemeType } from "../../lib/core/gl-constants";
import { KdUtils } from './kd-utils';
import { mergeSegmentsToPolyline } from './segments-to-polyline';
import { GlPoints } from "../../lib/core/gl-points";
import { GlMesh } from '../../lib/core/gl-mesh';

import { Color, Vector3, Matrix4, Line3, Line, Group, QuadraticBezierCurve3 } from 'three';
import { EmpiricalDistribution } from './empirical-distribution';
import { RegressionLine } from './regression-line';
import { MeshBVH } from 'three-mesh-bvh';
import { GlLayer } from '../../lib/core/gl-layer';
import { mapLinear } from 'three/src/math/MathUtils';


const _EPS = 1e-8;

const pallets = [
    // Красный максимум, желтый минимум
    (value, min, max) => {
        const normalized = (value - min) / (max - min);
        return new Color(255, 255 - 255 * normalized, 0);
    },
    // РАДУГА: максимум красный, минимум фиолетовый
    (value, min, max) => {
        const normalized = (value - min) / (max - min);
        const retColor = new Color();
        retColor.setHSL((240 / 360) * (1 - normalized), 1, 0.5);
        retColor.multiplyScalar(255);
        return retColor;
    },
    // Оттенки зеленого
    (value, min, max) => {
        const normalized = (value - min) / (max - min);
        return new Color(0, 255 * normalized, 0);
    },
    // Оттенки синего
    (value, min, max) => {
        const normalized = (value - min) / (max - min);
        return new Color(0, 0, 255 * (1 - normalized));
    },
    // Оттенки зеленого
    (value, min, max) => {
        const normalized = (value - min) / (max - min);
        return new Color(0, 255 * (1 - normalized), 255);
    }
];
function smoothenPoly(points, angle = 1.57079632679, smoothFactor = 10, tipFactor = 0.75, isClosed) {
    if (!(points && Array.isArray(points))) return [];

    let newPoints = [...points];
    let j, k;
    let angleRad, pointIndex, smoothNumPts;
    const edgeV = new Vector3();
    const nextEdgeV = new Vector3();
    const middleP1 = new Vector3();
    const middleP2 = new Vector3();
    const offsetForUnclosed = isClosed ? 0 : 2;

    for (let i = points.length - 1 - offsetForUnclosed; i > -1; i--) {
        if (i == points.length - 2) {
            j = i + 1;
            k = 0;
        } else if (i == points.length - 1) {
            j = 0;
            k = 1;
        } else {
            j = i + 1;
            k = i + 2;
        }
        edgeV.subVectors(points[j], points[i]);
        nextEdgeV.subVectors(points[j], points[k]);
        angleRad = edgeV.angleTo(nextEdgeV);
        if (angleRad < angle) {
            middleP1.set(0, 0, 0);
            middleP1.addScaledVector(points[i], 1 - tipFactor).addScaledVector(points[j], tipFactor);
            middleP2.set(0, 0, 0);
            middleP2.addScaledVector(points[j], tipFactor).addScaledVector(points[k], 1 - tipFactor);

            const curve = new QuadraticBezierCurve3(middleP1, points[j], middleP2);
            smoothNumPts = Math.ceil(smoothFactor + (angleRad - 0) * (0 - smoothFactor) / (Math.PI - 0));
            const curvePoints = curve.getPoints(smoothNumPts);

            pointIndex = newPoints.indexOf(points[j]);
            newPoints.splice(pointIndex, 1);
            newPoints.splice(pointIndex, 0, ...curvePoints);
        }
    }
    return _filterDuplicatePoints(newPoints);
    // return newPoints;
}
function _filterDuplicatePoints(points) {
    if (!Array.isArray(points) || points.length === 0) {
        return [];
    }
    let result = [points[0]];

    for (let i = 1; i < points.length; i++) {
        if (points[i].distanceToSquared(points[i - 1]) > 1e-6) {
            result.push(points[i]);
        }
    }

    return result;
}
export class ChartScattergram extends Chart {
    constructor(sceneControls, width = 1000, height = 750) {
        super(sceneControls, width, height, true);

        // General settings
        this.type = 'Scattergram';
        this.isScattergram = true;
        this.decimals = 4;
        this.selectable = true;

        // Data and calculation parameters
        this._xData = null;
        this._yData = null;

        this.yStats = {
            mean: null,
            median: null,
            geomMean: null,
            variance: null,
            stdDev: null
        };

        this.xStats = {
            mean: null,
            median: null,
            geomMean: null,
            variance: null,
            stdDev: null,
            xVarDivYvar: null,
        };

        this.stats = {
            corrCoeff: null,
            rankCorrCoeff: null,
            covariance: null,
            precision: null
        }

        this.themeType = ThemeType.Color;

        // Lines and visualization parameters
        this._points = null;
        this._xyLine = null;
        this._upperline = null;
        this._downline = null;
        this._glTri = null;
        this._regressionLine = null;

        this.showXY = false;
        this.isShowRegression = false;
        this.isShowConfidenceBands = false;
        this.displayContours = false;
        this.xyColor = new Color('black');
        this.regLineColor = new Color(0xC9C9C9);
        this.pallet = pallets[1];
        this.color = new Color('black');
        this.colorField = '';
        this.fileName = '';

        // Scale and regression settings
        this._isLogAxisScaleX = false;
        this._isLogAxisScaleY = false;
        this._isStandard = false;
        this.confidence = 0.95;
        this._radius = 1;
        this.order = 2;
        this.regressionType = RegressionType.Linear;
        this.regressionName = 'Linear';
        this.regression = null;
        this.xAxis0 = new Axis(sceneControls);
        this.yAxis0 = new Axis(sceneControls);

        

        this._confidenceBands = null;
        this.confidenceBandsNeedsUpdate = false;

        // Initialization state settings
        this._state = {
            dataX: false,
            dataY: false,
            params: false
        }
    }

    get sampleNum() {
        if (this._xData) {
            return this._xData.size;
        };
        return 0;
    }

    //---------------------------------------------------
    // dispose
    //---------------------------------------------------
    dispose() {
        super.dispose();
        this._xData.dispose();
        this._yData.dispose();
        this._disposeVisualComponents();
        for (const child of this.children) {
            child.dispose();
        }
    }

    _disposeVisualComponents() {
        if (this._points) {
            this._points.removeClippingPlanes();
            this._points.dispose();
            this.remove(this._points);
            this._points = null;
        }
        if (this._upperline) {
            this._upperline.removeClippingPlanes();
            this._upperline.dispose();
            this.remove(this._upperline);
            this._upperline = null;
        }
        if (this._downline) {
            this._downline.removeClippingPlanes();
            this._downline.dispose();
            this.remove(this._downline);
            this._downline = null;
        }
        if (this._regressionLine) {
            this._regressionLine.removeClippingPlanes();
            this._regressionLine.dispose();
            this.remove(this._regressionLine);
            this._regressionLine = null;
        }
        if (this._xyLine) {
            this._xyLine.removeClippingPlanes();
            this._xyLine.dispose();
            this.remove(this._xyLine);
            this._xyLine = null;
        }
        if (this._glTri) {
            this._glTri.dispose();
            this.remove(this._glTri);
            this._glTri = null;
        }
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
        if (this.colorAxis) {
            this.colorAxis.dispose();
            this.remove(this.colorAxis);
            this.colorAxis = null;
        }
        if (this.polylines) {
            this.polylines.removeAll();
            this.polylines = null;
        }
    }

    _disposeRegression() {
        if (this._regressionLine) {
            this._regressionLine.removeClippingPlanes();
            this._regressionLine.dispose();
            this.remove(this._regressionLine);
            this._regressionLine = null;
        }
        if (this._upperline) {
            this._upperline.removeClippingPlanes();
            this._upperline.dispose();
            this.remove(this._upperline);
            this._upperline = null;
        }
        if (this._downline) {
            this._downline.removeClippingPlanes();
            this._downline.dispose();
            this.remove(this._downline);
            this._downline = null;
        }
    }

    setData(xData, yData, indexData) {
        if (!xData || !yData || !indexData) return false;
        if (!this._state.params) {
            console.error('Provide scattergram params first');
            return false;
        }
        if (indexData.length !== xData.values.length || indexData.length !== yData.values.length) {
            console.error('Index data length should be equal to x and y data length');
            return false;
        }
        this.indexData = indexData;

        // Set X axis data
        let isValid = false;
        if (Array.isArray(xData.values)) {
            this._xData = new EmpiricalDistribution(this._isLogAxisScaleX, this._isLogAxisScaleX);
            isValid = this._xData.setValues(xData.values, xData.weights);
            this.xField = typeof xData.field === 'string' ? xData.field : '';
        }
        this._state.dataX = isValid;

        // Set Y axis data
        isValid = false;
        if (Array.isArray(yData.values)) {
            this._yData = new EmpiricalDistribution(this._isLogAxisScaleY, this._isLogAxisScaleY);
            isValid = this._yData.setValues(yData.values, yData.weights);
            this.yField = typeof yData.field === 'string' ? yData.field : '';
        }
        this._state.dataY = isValid;


        return this._state.dataX && this._state.dataY;
    }

    setPoints(points) {
        if (!Array.isArray(points)) return false;
        if (!this._state.params) {
            console.error('Provide scattergram params first');
            return false;
        }

    }

    setParams(params) {
        this._state.params = true;

        this._isLogAxisScaleX = typeof params.xlogTransform === 'boolean' ? params.xlogTransform : false;
        this._isLogAxisScaleY = typeof params.ylogTransform === 'boolean' ? params.ylogTransform : false;

        this.showXY = typeof params.showXY === 'boolean' ? params.showXY : false;
        if (params.xyColor && params.xyColor.isColor) {
            this.xyColor = params.xyColor;
        }

        if (params.legendData) this.legendData = params.legendData;
        this.isShowRegression = typeof params.showRegression === 'boolean' ? params.showRegression : false;
        this.regressionType = Number.isFinite(params.regressionType) ? params.regressionType : RegressionType.Linear;
        this.regressionName = this._getRegressionName(this.regressionType);

        this.pallet = pallets[Number.isFinite(params.pallet) ? params.pallet : 0];

        this._palletNum = Number.isFinite(params.pallet) ? params.pallet : 0;
        this.order = Number.isFinite(params.order) ? params.order : 2;
        this.color = new Color(typeof params.color !== 'string' ? 'teal' : params.color);

        this._isStandard = typeof params.isStandard === 'boolean' ? params.isStandard : true;

        if (Number.isFinite(params.themeType)) {
            this.themeType = params.themeType;
        }

        this.confidence = Number.isFinite(params.confidence) ? params.confidence : 0.95;
        if (this.confidence > 1) this.confidence = this.confidence / 100;
        this.isShowConfidenceBands = typeof params.showConfidenceBands === 'boolean' ? params.showConfidenceBands : false;
        this.colorField = typeof params.colorField === 'string' ? params.colorField : '';
        this.percent = params.percent;
        this.displayContours = params.displayContours;
        this.range = params.range;
        this.fileName = typeof params.fileName === 'string' ? params.fileName : '';
        this.dataSource = params.dataSource;
        this.fieldList = params.fieldList;
        if (params.palletFun) {
            this.pallet = params.palletFun;
        }

        this.errClr = new Color(255, 0, 0);
        if (params.errClr) {
            this.errClr = new Color(params.errClr);
        }

        return true
    }

    copy(obj) {
        if (!obj || !obj.isScattergram) return false;
        this._state = obj._state;
        this._isLogAxisScaleX = obj._isLogAxisScaleX;
        this._isLogAxisScaleY = obj._isLogAxisScaleY;
        this.showXY = obj.showXY;
        this.xyColor = obj.xyColor.clone();
        this.legendData = obj.legendData;
        this.isShowRegression = obj.isShowRegression;
        this.regressionType = obj.regressionType;
        this.regressionName = obj.regressionName;
        this.pallet = obj.pallet;
        this._palletNum = obj._palletNum;
        this.errClr = obj.errClr.clone();
        this.order = obj.order;
        this.color = obj.color.clone();
        this._isStandard = obj._isStandard;
        this.displayContours = obj.displayContours;
        this.confidence = obj.confidence;
        this.isShowConfidenceBands = obj.isShowConfidenceBands;
        this.themeType = obj.themeType;
        this.colorField = obj.colorField;
        this.percent = obj.percent;
        this.range = obj.range;
        this.fileName = obj.fileName;
        this.dataSource = obj.dataSource;
        this.fieldList = obj.fieldList;
        return true;
    }

    update() {
        if (!(this._state.params && this._state.dataX && this._state.dataY)) return false;

        const isLnX = this._isLogAxisScaleX;
        const isLnY = this._isLogAxisScaleY;

        const Y = this.yStats;
        Y.mean = this._yData.mean;
        Y.median = this._yData.median;
        Y.geomMean = isLnY ? this._yData.geomMean : null;
        Y.variance = this._yData.variance;
        Y.stdDev = this._yData.stdDev;

        const X = this.xStats;
        X.mean = this._xData.mean;
        X.median = this._xData.median;
        X.geomMean = isLnX ? this._xData.geomMean : null;
        X.variance = this._xData.variance;
        X.stdDev = this._xData.stdDev;
        X.xVarDivYvar = X.variance / Y.variance;

        return this.__updateVisuals();
    }

    __updateVisuals() {
        // Remove and dispose all visual components
        this._disposeVisualComponents();

        let bResult = true;

        const isLnX = this._isLogAxisScaleX;
        const isLnY = this._isLogAxisScaleY;

        const yMin = isLnY ? Math.exp(this._yData.min) : this._yData.min;
        const yMax = isLnY ? Math.exp(this._yData.max) : this._yData.max;
        const xMin = isLnX ? Math.exp(this._xData.min) : this._xData.min;
        const xMax = isLnX ? Math.exp(this._xData.max) : this._xData.max;

        const minRange = Math.min(xMin, yMin);
        const maxRange = Math.max(xMax, yMax);
        const range = [minRange, maxRange + 1];

        try {
            const clipMinPoint = new Vector3(-this.width / 2, -this.height / 2)
            const clipMaxPoint = new Vector3(this.width / 2, this.height / 2)

            //--------------------------
            // Create Y axis
            //--------------------------
            this.yAxis = new Axis(this.sceneControls, {
                min: -this.height / 2,
                max: this.height / 2,
                anchorX: -this.width / 2,
                gridLength: this.width
            });
            this.add(this.yAxis);

            this.yAxis.axisScale = this._isLogAxisScaleY ? AxisScale.Logarithmic : AxisScale.Linear;
            this.yAxis.setRange(range);
            this.yAxis.setRegularLabels();
            this.yAxis.setGridLinesAtLabels();
            this.yAxis.setHyphensAtLabels();
            this.yAxis.setTitle(this.yField);

            //--------------------------
            // Create X axis
            //--------------------------
            this.xAxis = new Axis(this.sceneControls, {
                min: -this.width / 2,
                max: this.width / 2,
                side: 'bottom',
                anchorY: -this.height / 2,
                gridLength: this.height,
            });
            this.add(this.xAxis);

            this.xAxis.axisScale = this._isLogAxisScaleX ? AxisScale.Logarithmic : AxisScale.Linear
            this.xAxis.setRange(range)
            this.xAxis.setRegularLabels();
            this.xAxis.setGridLinesAtLabels();
            this.xAxis.setHyphensAtLabels();
            this.xAxis.setTitle(this.xField);
            this.xAxis0.copy(this.xAxis);
            this.yAxis0.copy(this.yAxis);

            //----------------
            // Create XY line
            //----------------
            const coords = [];
            coords.push(this.xAxis.mapToAxisValue(range[0]), this.yAxis.mapToAxisValue(range[0]), 0);
            coords.push(this.xAxis.mapToAxisValue(range[1]), this.yAxis.mapToAxisValue(range[1]), 0);

            this._xyLine = new ChartLine();
            this._xyLine.setLineWidth(2);
            this._xyLine.addPoints(coords);
            this._xyLine.setLineColor(this.xyColor);
            this.add(this._xyLine);
            this.setClippingBox(this._xyLine, clipMinPoint, clipMaxPoint)

            this._xyLine.visible = false;

            // Get values from xData and yData
            const xValues = this._xData.getValues();
            const yValues = this._yData.getValues();

            // calculate correlation coefficient (Pearson's Rho)
            this.corrCoeff = jStat.corrcoeff(xValues, yValues);
            this.rankCorrCoeff = jStat.spearmancoeff(xValues, yValues);
            this.covariance = jStat.covariance(xValues, yValues);
            this.precision = 0;

            //-------------------
            // Create points
            //-------------------
            coords.length = 0;

            for (let i = 0; i < xValues.length; i++) {
                const x = this.xAxis.mapToAxisValue(xValues[i], isLnX);
                const y = this.yAxis.mapToAxisValue(yValues[i], isLnY);
                coords.push(x, y, 0);
            }

            // Create colors
            const colors = [];
            this.neighbors = [];
            const colorData = [];
            let mincolor, maxcolor;

            this._regression = new RegressionLine(xValues, yValues);
            bResult = this._createRegressionLine();
            this.showRegression(this.isShowRegression);


            this.showConfidenceBands(this.isShowConfidenceBands);
            

            if (!(this.displayContours && this.themeType == ThemeType.Gradient)) {
                this._points = new GlPoints();
                this._points.setPointSize(8);
                this.add(this._points);
                this.setClippingBox(this._points, clipMinPoint, clipMaxPoint);
            }

            switch (this.themeType) {
                case ThemeType.Color:
                    this._points.addPoints(coords);
                    this._points.setPointsColor(this.color);
                    break;
                case ThemeType.ColorField:
                    if (Array.isArray(this.dataSource) && Array.isArray(this.fieldList)) {
                        if (!this.fieldList.includes(this.colorField)) {
                            console.error('Color field is not in the field list');
                        }
                        this.indexData.forEach((index, i) => {
                            if (this.dataSource[index][this.colorField] === undefined) {
                                if ("attributes" in this.dataSource[index] && this.colorField in this.dataSource[index].attributes) {
                                    colorData.push(this.dataSource[index].attributes[this.colorField]);
                                } else {
                                    console.error('Color field is not in the field list');
                                }
                            } else {
                                colorData.push(this.dataSource[index][this.colorField]);
                            }

                        });
                    }

                    mincolor = colorData ? jStat.min(colorData.filter(
                        (value) => Number.isFinite(value)
                    )) : 0;
                    maxcolor = colorData ? jStat.max(colorData.filter(
                        (value) => Number.isFinite(value)
                    )) : 0;

                    for (let i = 0; i < xValues.length; i++) {
                        const color = colorData[i] ? this.pallet(colorData[i], mincolor, maxcolor) : this.errClr;
                        colors.push(color);
                    }
                    this._points.addPoints(coords, colors.length ? colors : this.color);
                    break;
                case ThemeType.Gradient:
                    const metric = (a, b) => {
                        const dx = a[0] - b[0];
                        const dy = a[1] - b[1];
                        const dz = a[2] - b[2];
                        return dx * dx + dy * dy + dz * dz;
                    };

                    const kdTree = new KdUtils.KdTree(new Float64Array(), metric, 3);
                    xValues.forEach((x, i) => {
                        kdTree.insert.call(kdTree, [x, yValues[i], 0]);
                    });

                    const stdevx = this._xData.stdDev;
                    const stdevy = this._yData.stdDev;
                    this._radius = 0;

                    if (!this.range) {
                        const _zero = [0, 0, 0];
                        const _max = [stdevx * 2, stdevy * 2, 0];
                        this._radius = metric(_zero, _max) * this.percent * this.percent;
                    }
                    else {
                        this._radius = this.range;
                    }

                    let count = 0;
                    const kde = this._KDE(kdTree);
                    this.neighbors = new Array(xValues.length);
                    xValues.forEach((x, i) => {
                        const nearest = kde(x, yValues[i]);
                        this.neighbors[i] = nearest;
                        count = nearest > count ? nearest : count;
                    });

                    this.maxCount = count;
                    mincolor = 0;
                    maxcolor = count * this.sampleNum;

                    for (let i = 0; i < xValues.length; i++) {
                        const color = this.pallet(this.neighbors[i], 0, this.maxCount);
                        colors.push(color);
                    }

                    // Create scattergram's contours

                    if (this.displayContours) {
                        this.KDEContours(kde);
                        this.extractContours();
                    } else {
                        this._points.addPoints(coords, colors.length ? colors : this.color);
                        this._points.setAttributes('neighbors', 0, this.neighbors);
                    }

                    break;
                case ThemeType.Confidence:
                    if (this._upperPredict && this._lowerPredict) {
                        for (let i = 0; i < xValues.length; i++) {
                            const y = yValues[i];
                            const x = xValues[i];
                            const upY = this._upperPredict(x);
                            const downY = this._lowerPredict(x);
                            if (y > downY && y < upY) {
                                const color = this.pallet(y, downY, upY);
                                colors.push(color);
                            }
                            else {
                                colors.push(this.errClr);
                            }

                        }
                        this._points.addPoints(coords, colors.length ? colors : this.color);
                    } else {
                        console.log('No prediction data');
                    }
            }

            if (colors.length && (!this.themeType || this.themeType == ThemeType.ColorField || this.themeType == ThemeType.Gradient)) {

                //----------------
                // Create color axis
                //----------------
                const colorAxis = new Axis(this.sceneControls, {
                    min: -this.height / 2,
                    max: this.height / 2,
                    side: 'left',
                    anchorX: (this.width / 2) + 80,
                    gridLength: 20,
                    staticRange: true,
                    visibleMinMax: true
                });
                this.colorAxis = colorAxis;
                this.add(colorAxis);

                colorAxis.axisScale = AxisScale.Linear;
                colorAxis.setRange([mincolor, maxcolor]);
                colorAxis.setRegularLabels();
                colorAxis.setGridLinesAtLabels();
                colorAxis.setHyphensAtLabels();
                //-----------------------------
                // Create colored areas
                //-----------------------------
                const areas = colorAxis.labels.map((label, i) => {
                    if (i === colorAxis.labels.length - 1) return null;
                    const color = this.pallet(Number(colorAxis.labels[i].text), mincolor, maxcolor);
                    return { lstart: label, lend: colorAxis.labels[i + 1], color: color.multiplyScalar(1 / 255) };
                });
                areas.pop();
                colorAxis.setColoredAreas(areas);
                colorAxis.setTitle('Color');
            }


            //----------------------------------------------
            // Create regression line and confidence bands
            //----------------------------------------------

            this.setMaterialResolution(this.sceneControls.domElement.clientWidth, this.sceneControls.domElement.clientHeight);
            this.xAxis?.onCameraUpdate();
            this.yAxis?.onCameraUpdate();

        } catch (e) {
            console.error('Error on Scattergram updating: ', e);
            return false
        };
        return bResult;
    }

    setRegressionType(regressionType, order) {
        this.regressionType = Number.isFinite(regressionType) ? regressionType : RegressionType.Linear;
        this.order = Number.isFinite(order) ? order : 2;
        this.regressionName = this._getRegressionName(regressionType);
        const bResult = this._createRegressionLine();
        this.showRegression(this.isShowRegression);
        this.showConfidenceBands(this.isShowConfidenceBands);
        this.setMaterialResolution(this.sceneControls.domElement.clientWidth, this.sceneControls.domElement.clientHeight);
        return bResult;
    }

    setConfidence(confidence) {
        this.confidence = Number.isFinite(confidence) ? confidence : 0.95;
        if (this.confidence > 1) this.confidence = this.confidence / 100;
        const bResult = this._createRegressionLine();
        this.setMaterialResolution(this.sceneControls.domElement.clientWidth, this.sceneControls.domElement.clientHeight);
        if (!this._points) { return bResult }
        return bResult;
    }

    setPallet(palletFun, errClr) {
        this.pallet = palletFun;
        this.errClr = new Color(errClr);
        if (!this.maxCount) return false;

        let mincolor, maxcolor;
        const colors = [];
        // for (let i = 0; i < this._points.getPointsCount(); i++) {
        //     const color = this.pallet(, 0, this.maxCount);
        //     colors.push(color);
        // }

        if (this.polylines) {
            const zPolylines = this.polylines.children.map((layer) => { return layer.getPointsAsArray(0, 0)[0][2] });
            for (let i = 0; i < this.polylines.children.length; i++) {
                const color = this.pallet(zPolylines[i], 0, this.maxCount).multiplyScalar(1 / 255);
                this.polylines.children[i].setLineColor(color);
            }
            mincolor = 0;
            maxcolor = this.maxCount * this.sampleNum;
        }
        if (this._points) {
            if (this.themeType === ThemeType.Gradient) {
                this._points.getAttributes('neighbors', 0, this._points.getPointsCount() - 1).map((value, i) => {
                    const color = this.pallet(value, 0, this.maxCount);
                    colors.push(color);
                });
                this._points.setColor(0, colors);
                mincolor = 0;
                maxcolor = this.maxCount * this.sampleNum;
            }
            if (this.themeType === ThemeType.ColorField) {
                const colorData = this._points.getAttributes(this.colorField, 0, this._points.getPointsCount() - 1);
                mincolor = colorData ? jStat.min(colorData.filter(
                    (value) => Number.isFinite(value)
                )) : 0;
                maxcolor = colorData ? jStat.max(colorData.filter(
                    (value) => Number.isFinite(value)
                )) : 0;
                for (let i = 0; i < this._points.getPointsCount(); i++) {
                    const color = colorData[i] ? this.pallet(colorData[i], mincolor, maxcolor) : this.errClr;
                    colors.push(color);
                }
                this._points.setColor(0, colors);
            }
        }
        if (this.colorAxis) {
            const areas = this.colorAxis.labels.map((label, i) => {
                if (i === this.colorAxis.labels.length - 1) return null;
                const color = this.pallet(Number(this.colorAxis.labels[i].text), mincolor, maxcolor);
                return { lstart: label, lend: this.colorAxis.labels[i + 1], color: color.multiplyScalar(1 / 255) };
            });
            areas.pop();
            this.colorAxis.setColoredAreas(areas);
        }

        return true;
    }

    showRegression(flag) {
        if (this._regressionLine) {
            this.isShowRegression = flag;
            this._regressionLine.visible = this.isShowRegression;
            this._upperline.visible = (this.isShowRegression && this.isShowConfidenceBands);
            this._downline.visible = (this.isShowRegression && this.isShowConfidenceBands);
        }
    }



    showConfidenceBands(flag) {
        if (this._upperline && this._downline) {
            this.isShowConfidenceBands = flag;
            this._upperline.visible = this.isShowConfidenceBands && this.isShowRegression;
            this._downline.visible = this.isShowConfidenceBands && this.isShowRegression;
        }
        const colors = [];

    }





    _createRegressionLine() {
        this._disposeRegression();

        this.xAxis.range = this.xAxis.range0;
        this.yAxis.range = this.yAxis.range0;

        // calculate regressions
        const regression = this._regression;
        let result;
        let adjustToZero = false;
        if (this.regressionType === RegressionType.Linear) {
            result = regression.linear();
        } else if (this.regressionType === RegressionType.Power) {
            adjustToZero = true;
            result = regression.power();
        } else if (this.regressionType === RegressionType.Polynomial) {
            result = regression.polynomial(this.order);
        } else if (this.regressionType === RegressionType.Logarithmic) {
            adjustToZero = true;
            result = regression.logarithmic();
        } else if (this.regressionType === RegressionType.Exponential) {
            result = regression.exponential();
        } else {
            console.error('Unknown regression type');
        }
        if (!result) return false;

        this.regression = result;

      

        // Start to create regression line and confidence bands
        const clipMinPoint = new Vector3(-this.width / 2, -this.height / 2)
        const clipMaxPoint = new Vector3(this.width / 2, this.height / 2)

        const _ptCnt = 100;
        const _min = adjustToZero ? 0 : this._xData.min;
        const _max = this._xData.max;
        const _meanX = this._xData.mean;
        const _step = (_max - _min) / _ptCnt;

        const len = this._xData.size;
        const dof = len - 2;
        const t = this._getCriticalValue(this.confidence, dof);
        const SE = Math.sqrt(result.ssResidual / dof);

        const coords = [];
        const upper_coords = [];
        const lower_coords = [];
        let x, y;

        this._upperPredict = (x) => {
            const SE_mean_response = SE * Math.sqrt(1 / len + (x - _meanX) ** 2 / result.ssX);
            return result.predict(x) + t * SE_mean_response;
        }

        this._lowerPredict = (x) => {
            const SE_mean_response = SE * Math.sqrt(1 / len + (x - _meanX) ** 2 / result.ssX);
            return result.predict(x) - t * SE_mean_response;
        }

        for (let i = 0; i < _ptCnt; i++) {
            x = _min + i * _step;

            y = result.predict(x);
            if (!Number.isFinite(y)) continue;

            coords.push(this.xAxis.mapToAxisValue(x, true), this.yAxis.mapToAxisValue(y, true), 0);

            const SE_mean_response = SE * Math.sqrt(1 / len + (x - _meanX) ** 2 / result.ssX);

            const upY = y + t * SE_mean_response;
            upper_coords.push(this.xAxis.mapToAxisValue(x, true), this.yAxis.mapToAxisValue(upY, true), 0);
            const btmY = y - t * SE_mean_response;
            lower_coords.push(this.xAxis.mapToAxisValue(x, true), this.yAxis.mapToAxisValue(btmY, true), 0);
        }

        this._regressionLine = new ChartLine();
        this._regressionLine.setLineWidth(2);
        this._regressionLine.addPoints(coords);
        this._regressionLine.setLineColor(this.regLineColor);
        this.add(this._regressionLine);
        this.setClippingBox(this._regressionLine, clipMinPoint, clipMaxPoint);

        this._upperline = new ChartLine();
        this._upperline.setLineWidth(2);
        this._upperline.addPoints(upper_coords);
        this._upperline.setLineColor(this.regLineColor);
        this.add(this._upperline);
        this.setClippingBox(this._upperline, clipMinPoint, clipMaxPoint);

        this._downline = new ChartLine();
        this._downline.setLineWidth(2);
        this._downline.addPoints(lower_coords);
        this._downline.setLineColor(this.regLineColor);
        this.add(this._downline);
        this.setClippingBox(this._downline, clipMinPoint, clipMaxPoint);

        return true;
    }

    _KDE(kdTree) {
        const radius = Math.sqrt(this._radius);
        // const gauss2d = (x, y) => {
        //     const term3 = Math.pow(x, 2) / powSigm1;
        //     const term4 = rhosigma1sigma2*x*y;
        //     const term5 = Math.pow(y, 2) / powSigm2;
        //     const exponent = term2 * (term3 + term4 + term5);
        //     if (Math.abs(exponent) < 1e-10) {
        //         return term1; 
        //     }
        //     if (exponent < - 50) { 
        //         return 0 ;
        //     }// Например, 700 можно настроить под свои нужды
        //     return  Math.exp(exponent);
        // }

        const gauss2d = (x, y) => {
            return Math.exp(-0.5 * (x * x + y * y));
        }

        const length = this._xData.size;

        const kde2d = (x, y) => {
            // for (let i = 0; i < dataX.length; i++) {
            //     z += gauss2d((x - dataX[i]) / h, (y - dataY[i]) / h, meanx, meany, sigmx, sigmy, covxy);
            // }
            const z = kdTree.nearestCount([x, y, 0], length, radius, function (first, second) {
                const x = first[0] - second[0];
                const y = first[1] - second[1];
                return gauss2d(x / radius, y / radius) / length;
            })
            return z;
        }
        return kde2d;
    }

    KDEContours(kde2d) {
        const meanx = this._xData.mean;
        const meany = this._yData.mean;
        const sigmx = this._xData.stdDev;
        const sigmy = this._yData.stdDev;

        const rangeX = [meanx - 3 * sigmx, meanx + 3 * sigmx];
        const rangeY = [meany - 3 * sigmy, meany + 3 * sigmy]

        const step = 100;
        const coords = [];
        const colors = [];

        for (let i = 0; i < step * step; i++) {
            const k = i % step;
            const j = Math.floor(i / step);
            const x = rangeX[0] + (rangeX[1] - rangeX[0]) * k / step;
            const y = rangeY[0] + (rangeY[1] - rangeY[0]) * j / step;
            const z = kde2d(x, y);

            const color = this.pallet(z, 0, this.maxCount);
            colors.push(color.r, color.g, color.b);
            coords.push(this.xAxis.mapToAxisValue(x, true), this.yAxis.mapToAxisValue(y, true), z);
        }

        this._glTri = new GlMesh({ name: "sr.dtm" });
        this._glTri.addVertices(coords);
        const faces = [];
        for (let i = 0; i < step - 1; i++) {
            for (let j = 0; j < step - 1; j++) {
                faces.push(i * step + j, i * step + j + 1, (i + 1) * step + j);
                faces.push(i * step + j + 1, (i + 1) * step + j + 1, (i + 1) * step + j);
            }
        }

        this._glTri.setTriFaces(faces);
        return true;
    }

    extractContours() {
        const meshObj = this._glTri;
        const clipMinPoint = new Vector3(-this.width / 2, -this.height / 2)
        const clipMaxPoint = new Vector3(this.width / 2, this.height / 2)

        if (!this._glTri.isGlMesh) {
            return false;
        }
        const pi = Math.PI / 180;
        const angleInRadRange = [130 * pi, 175 * pi];
        const numberOfPointsRange = [5, 15];
        const tipFactorRange = [0.75, 0.5];
        const interval = 10;  // Шаг по оси
        const smoothPercent = 0.5;  // Процент сглаживания
        // Определение направления пересечения
        const direction = new Vector3(0, 0, 1);
        const boundingBox = meshObj.getBoundingBox();
        const min = boundingBox.min;
        const max = boundingBox.max;
        const diagonal = max.clone().sub(min);
        const len = max.z - min.z;
        const intervalCount = 10;  // Делим на 10 частей
        const segmentHeight = len / intervalCount;
        const polylines = [];

        if (!meshObj.geometry.boundsTree) {
            meshObj.geometry.boundsTree = new MeshBVH(meshObj.geometry, { maxLeafTris: 1, strategy: MeshBVH.SAH });
        }

        const bvh1 = meshObj.geometry.boundsTree;
        const invMatrix1 = meshObj.matrixWorld.clone().invert();
        const directionScaled = direction.clone().setLength(segmentHeight);

        for (let i = 0; i < intervalCount; i++) {
            // Создание временной геометрии для каждой части
            const tempGeometry = new GlMesh();
            const vertices = [
                new Vector3(min.x, min.y, min.z + 0.001 + i * segmentHeight),
                new Vector3(max.x, min.y, min.z + 0.001 + i * segmentHeight),
                new Vector3(max.x, max.y, min.z + 0.001 + i * segmentHeight),
                new Vector3(min.x, max.y, min.z + 0.001 + i * segmentHeight),
            ];
            const clPoint = vertices[0].clone().add(vertices[1].clone()).add(vertices[2].clone()).add(vertices[3].clone()).divideScalar(4);

            tempGeometry.addVertices(vertices);
            tempGeometry.setTriFaces([0, 3, 2, 2, 1, 0]);
            tempGeometry.position.add(directionScaled.clone().multiplyScalar(i));
            tempGeometry.setPivotPoint(clPoint);
            tempGeometry.scale.set(2.1, 2.1, 2.1);
            tempGeometry.updateMatrixWorld(true);

            const bvh2 = new MeshBVH(tempGeometry.geometry, { maxLeafTris: 1, strategy: MeshBVH.SAH });

            const results = [];
            bvh1.bvhcast(bvh2, new Matrix4().multiplyMatrices(invMatrix1, tempGeometry.matrixWorld), {
                intersectsTriangles(triangle1, triangle2) {
                    const edge = new Line3();
                    if (triangle1.intersectsTriangle(triangle2, edge)) {
                        edge.start.applyMatrix4(meshObj.matrixWorld);
                        edge.end.applyMatrix4(meshObj.matrixWorld);
                        results.push(edge.clone());
                    }
                }
            });

            // Сглаживание и добавление полилиний
            if (results.length) {
                const mergePolylines = mergeSegmentsToPolyline(results);
                for (const polyline of mergePolylines) {
                    if (smoothPercent) {
                        const polyPoints = polyline.getPoints(0, polyline.getPointsCount() - 1);
                        if (polyPoints.length > 3) {

                            const angleInRad = angleInRadRange[0] + (angleInRadRange[1] - angleInRadRange[0]) * smoothPercent;
                            const numberOfPoints = Math.ceil(numberOfPointsRange[0] + (numberOfPointsRange[1] - numberOfPointsRange[0]) * smoothPercent);
                            const tipFactor = tipFactorRange[0] + (tipFactorRange[1] - tipFactorRange[0]) * smoothPercent;
                            const newPoints = smoothenPoly(polyPoints, angleInRad, numberOfPoints, tipFactor, polyline.isClosed());

                            polyline.deleteAllPoints();
                            polyline.updateMatrixWorld(true);
                            polyline.addPoints(newPoints);
                            if (polyline.isClosed()) polyline.close();
                        }
                    }
                    const color1 = this.pallet(min.z + 1e-10 + i * segmentHeight, 0, this.maxCount).multiplyScalar(1 / 255);
                    const color = color1.getHex();
                    polyline.setLineColor(color);
                    polylines.push(polyline);
                }
            }
        }

        if (!this.polylines) {
            this.polylines = new GlLayer({ name: "polyline" });//GlPolylineSet({name: "polyline"}) //
            this.add(this.polylines);
            this.setClippingBox(this.polylines, clipMinPoint, clipMaxPoint);
        }

        for (const poly of polylines) {
            const poly_ = poly.toChartLine();
            this.polylines.addChild(poly_)
            this.setClippingBox(poly_, clipMinPoint, clipMaxPoint);
        }
        //return polylines;
    }

    _getCriticalValue(confidence_level, degreesOfFreedom) {
        const target = (1 - confidence_level) / 2;
        let value = 5;
        value = jStat.studentt.inv(1 - target, degreesOfFreedom);

        return value;
    }

    _getRegressionName(regressionType) {
        let name = 'Unknown';
        if (regressionType === RegressionType.Linear) {
            name = 'Linear';
        } else if (regressionType === RegressionType.Power) {
            name = 'Power';
        } else if (regressionType === RegressionType.Polynomial) {
            name = 'Polynomial';
        } else if (regressionType === RegressionType.Logarithmic) {
            name = 'Logarithmic';
        } else if (regressionType === RegressionType.Exponential) {
            name = 'Exponential';
        }
        return name;
    }

    setMaterialResolution(width, height) {
        if (this._confidenceBands) {
            for (const child of this._confidenceBands.children) {
                if (child.isChartLine) {
                    child.setMaterialResolution(width, height)
                }
            }
        }
        if (this._regressionLine) this._regressionLine.setMaterialResolution(width, height);
        if (this._downline) this._downline.setMaterialResolution(width, height);
        if (this._upperline) this._upperline.setMaterialResolution(width, height);
        if (this._xyLine) this._xyLine.setMaterialResolution(width, height);
        if (this.polylines) {
            for (const layer of this.polylines.children) {
                layer.setMaterialResolution(width, height);
            }
        }
    }

    localVisible(flag) {
        if (this._points) this._points.visible = flag;
        if (this._xyLine) this._xyLine.visible = false;
        if (this._regressionLine) this._regressionLine.visible = (this.isShowRegression && flag);
        if (this._upperline) this._upperline.visible = (this.isShowConfidenceBands && flag);
        if (this._downline) this._downline.visible = (this.isShowConfidenceBands && flag);
        if (this.polylines) this.polylines.visible = (this.displayContours && flag);
        if (this.xAxis) this.xAxis.visible = flag;
        if (this.yAxis) this.yAxis.visible = flag;
        if (this.colorAxis) this.colorAxis.visible = flag;
    }

    visibleColorAxis(flag) {
        if (this.colorAxis) this.colorAxis.visible = flag;
    }

    axisIsValid(objects) {
        const yAxes = Array.isArray(objects) ? objects.map(obj => obj.yAxis) : objects.yAxis;
        const xAxes = Array.isArray(objects) ? objects.map(obj => obj.xAxis) : objects.xAxis;

        const isHaveTheoretical = objects.some(obj => Boolean(obj.isTheoretical));
        const isTheoreticalAlone = objects.every(obj => Boolean(obj.isTheoretical));

        const isFieldEqual = objects.every(obj => obj.xField === this.xField && obj.yField === this.yField);
        const isWeightFieldEqual = objects.every(obj => obj.xWeightField === this.xWeightField && obj.yWeightField === this.yWeightField);

        return (this.yAxis.isValid(yAxes) && this.xAxis.isValid(xAxes)
            && (isHaveTheoretical ? isTheoreticalAlone : true)
            && isFieldEqual
            && isWeightFieldEqual);
    }
}

