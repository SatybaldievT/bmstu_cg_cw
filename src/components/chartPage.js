import * as THREE from 'three';
import React, { useRef, useEffect } from 'react';
import { ChartScattergram } from './gl-class/chart-scattergram';
import { Axis } from './gl-class/axis';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  Curve,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  LineSegments,
  LineBasicMaterial,
  Mesh,
  MeshPhongMaterial,
  OctahedronGeometry,
  OrthographicCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WireframeGeometry,
  WebGLRenderer,
  createCanvasElement
} from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { ThemeType } from '../lib/core/gl-constants';
function readFile() {
  return new Promise((resolve, reject) => {
    const inputFile = document.createElement('input');
    inputFile.type = 'file';

    inputFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.addEventListener('load', (e) => {
        resolve(e.target.result);
      });

      reader.addEventListener('error', (e) => {
        reject(e);
      });

      reader.readAsText(file);
    });

    inputFile.click();
  });
}


function Three() {
  const canvasRef = useRef(null);
  const effectRef = useRef(false);
  useEffect(() => {

    if (effectRef.current) {
      return;
    }
    effectRef.current = true;
    const twoPi = Math.PI * 2;

    class CustomSinCurve extends Curve {

      constructor(scale = 1) {

        super();

        this.scale = scale;

      }

      getPoint(t, optionalTarget = new Vector3()) {

        const tx = t * 3 - 1.5;
        const ty = Math.sin(2 * Math.PI * t);
        const tz = 0;

        return optionalTarget.set(tx, ty, tz).multiplyScalar(this.scale);

      }

    }

    function updateGroupGeometry(mesh, geometry) {

      mesh.children[0].geometry.dispose();
      mesh.children[1].geometry.dispose();

      mesh.children[0].geometry = new WireframeGeometry(geometry);
      mesh.children[1].geometry = geometry;

      // these do not update nicely together if shared

    }

    // heart shape

    const x = 0, y = 0;

    const heartShape = new Shape();

    heartShape.moveTo(x + 5, y + 5);
    heartShape.bezierCurveTo(x + 5, y + 5, x + 4, y, x, y);
    heartShape.bezierCurveTo(x - 6, y, x - 6, y + 7, x - 6, y + 7);
    heartShape.bezierCurveTo(x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19);
    heartShape.bezierCurveTo(x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7);
    heartShape.bezierCurveTo(x + 16, y + 7, x + 16, y, x + 10, y);
    heartShape.bezierCurveTo(x + 7, y, x + 5, y + 5, x + 5, y + 5);

    const guis = {

      BoxGeometry: function (mesh) {

        const data = {
          xField: "",
          xWeightField: "",
          yField: "",
          yWeightField: "",
          xAxisLog: false,
          yAxisLog: false,
          densety: false,
          ThemeType: 2,
          color: "#AA00FF", 
          pallet: 0,
          colorField: "",
          fieldList: null,
          isShowRegression: false,
          regressionType: 0,
          order:2,
          showConfidenceBands: false,
          confidence: 0.98,
          percent:0.1,
          displayContours: false,
        };
        let fields = [""];
        let folder = null;
        const dataSource = [];

        const obj = {
          file: null,
          loadFile: function () {
            readFile().then((content) => {
              const csvData = content.split('\n');
              const headers = csvData.shift().split(',');
              fields = [""];
              fields.push(...headers);
              data.fieldList = headers;


              csvData.forEach((row) => {
                const rowData = row.split(',');
                const obj = {};

                headers.forEach((header, index) => {
                  const value = rowData[index];
                  if (!isNaN(value)) {
                    obj[header] = Number(value);
                  } else {
                    obj[header] = value;
                  }
                });
                dataSource.push(obj);
              });
              const controllers = folder.controllers.filter((controller) => {
                return controller.property === 'xField' || controller.property === 'xWeightField' || controller.property === 'yField' || controller.property === 'yWeightField';
              });
              controllers.push(colorField);
              controllers.forEach((controller) => {
                controller.options(fields);
              });

              console.log(dataSource);
            }).catch((error) => {
              console.error(error);
            });
          },
          run: function () {

            const xField = data.xField;
            const xWeightField = data.xWeightField;
            const yField = data.yField;
            const yWeightField = data.yWeightField;
            const indexData = [];
            const xData = {
              values: [],
            };

            const yData = {
              values: [],
            };
            if (xWeightField !== "" ){
              xData.weights = [];
            }
            if (yWeightField !== "" ){
              xData.weights = [];
            } 
            dataSource.forEach((row,index) => {
              if (typeof row[xField] === 'number' &&
                 typeof row[yField] === 'number' &&
                 (xWeightField == "" || typeof row[xWeightField] === 'number') &&
                 (yWeightField == "" || typeof row[yWeightField] === 'number') 
                ) {
                xData.values.push(row[xField]);
                yData.values.push(row[yField]);
                indexData.push(index);
                if (xWeightField !== "" ){
                  xData.weights.push(row[xWeightField]);
                }
                if (yWeightField !== "" ){
                  yData.weights.push(row[yWeightField]);
                }
              }
            });
            const params = {
              dataSource,
              xlogTransform: data.xAxisLog,
              ylogTransform: data.yAxisLog,
              themeType: data.ThemeType,
              color: data.color, 
              colorField: data.colorField,
              pallet: data.pallet,
              fieldList: data.fieldList,
              showRegression: data.isShowRegression,
              regressionType: data.regressionType,
              order:data.order,
              showConfidenceBands: data.showConfidenceBands,
              confidence: data.confidence,
              percent: data.percent,
              displayContours: data.displayContours,
            }
            chartScattergram.setParams(params);
            chartScattergram.setData(xData,yData,indexData);
            chartScattergram.update();
          }
        };
        gui.add(obj, 'loadFile');
        folder = gui.addFolder('Fields');
        
        folder.add(data, 'xField', fields);
        folder.add(data, 'xWeightField', fields);
        folder.add(data, 'yField', fields);
        folder.add(data, 'yWeightField', fields);
        folder.add(data, 'xAxisLog');
        folder.add(data, 'yAxisLog');
        gui.add(data, 'ThemeType',{
          ColorField: 0,
          Color: 2,
          Densety: 3,
          Confidence: 4,
        })
          .onChange(()=>{
            switch (data.ThemeType){
              case 0 : 
              setVisible(0);
              break;
              case 2 : 
              setVisible(1);
              break;
              case 3 : 
              setVisible(2);
              break;
              case 4 : 
              setVisible(3);
              break;
            }
        })
        function setVisible(i){
          const folds = [colorFieldFold,colorFold,densetyFold,confidenceFold];
          folds.forEach((fold) => fold.show(false));
          folds[i].show(true);
        }
        const colorFieldFold = gui.addFolder('ColorField');
        const colorField = colorFieldFold.add(data,"colorField",fields);
        colorFieldFold.add(data,"pallet",[0,1,2,3,4])
        //const attribute = gui.addFolder('Attribute');
        const colorFold = gui.addFolder('Color');
        colorFold.addColor(data,"color");
        const densetyFold = gui.addFolder('Gradient');
        densetyFold.add(data,"pallet",[0,1,2,3,4]);
        densetyFold.add(data,"percent",0,1);
        densetyFold.add(data,"displayContours")
        const confidenceFold = gui.addFolder('Confidence');
        confidenceFold.add(data,"pallet",[0,1,2,3,4]);
        gui.add(obj, 'run')
        const regressionFold = gui.addFolder('Regression');
        regressionFold.add(data,'isShowRegression');
        regressionFold.add(data,'regressionType',{Linear: 0,
          Exponential: 1,
          Logarithmic: 2,
          Polynomial: 3,
          Power: 4}).onChange(()=> {
            if (data.regressionType == 3){
              order.show(true);
            }else{
              order.show(false);
            }
          });
          const order= regressionFold.add(data,'order');
          regressionFold.add(data,'showConfidenceBands');
          regressionFold.add(data,'confidence',0,1);
          
      },

    };

    function chooseFromHash(mesh) {

      const selectedGeometry = window.location.hash.substring(1) || 'BoxGeometry';

      if (guis[selectedGeometry] !== undefined) {

        guis[selectedGeometry](mesh);

      }

    }

    //

    const selectedGeometry = window.location.hash.substring(1);

    if (guis[selectedGeometry] !== undefined) {

      document.getElementById('newWindow').href += '#' + selectedGeometry;

    }

    const gui = new GUI();

    const scene = new Scene();
    scene.background = new Color(0x444444);

    const camera = new THREE.OrthographicCamera(
      window.innerWidth / -2,  // левый край камеры
      window.innerWidth / 2,   // правый край камеры
      window.innerHeight / 2,  // верхний край камеры
      window.innerHeight / -2, // нижний край камеры
    );
    camera.position.z = 100;
    Object.defineProperty(camera, 'focalPoint', {
      get: function () {
        const direction = new THREE.Vector3();
        this.getWorldDirection(direction);
        return this.position.clone().addScaledVector(direction, 100);
      }
    });



    const renderer = new WebGLRenderer({ antialias: true, canvas: canvasRef.current });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const sceneControls = new OrbitControls(camera, renderer.domElement);
    Object.defineProperty(sceneControls, 'camera', {
      get: function () {
        return this.object;
      },
      set: function (value) {
        this.object = value;
      }
    });
    sceneControls.saveState();
    sceneControls.keys = {
      LEFT: 'ArrowLeft', //left arrow
      UP: 'ArrowUp', // up arrow
      RIGHT: 'ArrowRight', // right arrow
      BOTTOM: 'ArrowDown' // down arrow
    }
    sceneControls.enableZoom = true;
    sceneControls.rotateSpeed = 0;
    sceneControls.isOrbitControls = true;
    const xData = {
      values: [0, 10, 12]
    }
    const yData = {
      values: [0, 10, 12]
    }
    const indexData = [0, 1, 2];
    const chartScattergram = new ChartScattergram(sceneControls, window.innerWidth - 200, window.innerHeight - 200);
    const params = {}
    chartScattergram.setParams(params);
    chartScattergram.setData(xData, yData, indexData);
    chartScattergram.update();
    chartScattergram.visible = true;
    scene.add(chartScattergram);


    const lights = [];
    lights[0] = new DirectionalLight(0xffffff, 3);
    lights[1] = new DirectionalLight(0xffffff, 3);
    lights[2] = new DirectionalLight(0xffffff, 3);

    lights[0].position.set(0, 200, 0);
    lights[1].position.set(100, 200, 100);
    lights[2].position.set(- 100, - 200, - 100);

    scene.add(lights[0]);
    scene.add(lights[1]);
    scene.add(lights[2]);

    const group = new Group();

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([], 3));

    const lineMaterial = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const meshMaterial = new MeshPhongMaterial({ color: 0x156289, emissive: 0x072534, side: DoubleSide, flatShading: true });

    group.add(new LineSegments(geometry, lineMaterial));
    group.add(new Mesh(geometry, meshMaterial));

    chooseFromHash(group);

    //scene.add(group);

    function render() {

      requestAnimationFrame(render);
      renderer.render(scene, camera);

    }


    window.addEventListener('resize', function () {

      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);

    }, false);

    render();
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default Three;
