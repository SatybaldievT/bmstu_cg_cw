import {
  Object3D,
  Color,
  Raycaster,
  Vector2,
  OrthographicCamera,
  BoxGeometry,
  Mesh,
  Sprite,
  Vector3,
  Quaternion,
  Euler,
  MeshBasicMaterial,
  CanvasTexture,
  SpriteMaterial,
} from 'three';

class GlAxesHelper extends Object3D {

  constructor(glScene, dom) {
    super();
    this.isGlAxesHelper = true;

    this.glScene = glScene;

    const mainSceneCamera = this.glScene.context.camera;

    this.animating = false;
    this.controls = null;

    this._animationId = -1;
    this._timeStart = -1;

    const scope = this;

    this.onPointerup = (event) => {
      event.stopImmediatePropagation();
      scope.handleClick(event);
      scope.skipScenesPointerEvents = false;
    }

    this.onPointerdown = (event) => {
      event.stopImmediatePropagation();
      scope.skipScenesPointerEvents = true;
    }

    dom.addEventListener('pointerup', this.onPointerup);

    dom.addEventListener('pointerdown', this.onPointerdown);

    const color1 = new Color('#ff3653');
    const color2 = new Color('#8adb00');
    const color3 = new Color('#2c8fff');

    const interactiveObjects = [];
    const raycaster = new Raycaster();
    const mouse = new Vector2();

    const camera = new OrthographicCamera(- 2, 2, 2, - 2, 0, 4);
    camera.position.set(0, 0, 2);

    const geometry = new BoxGeometry(0.8, 0.05, 0.05).translate(0.4, 0, 0);

    const xAxis = new Mesh(geometry, getAxisMaterial(color1));
    const yAxis = new Mesh(geometry, getAxisMaterial(color2));
    const zAxis = new Mesh(geometry, getAxisMaterial(color3));

    yAxis.rotation.z = Math.PI / 2;
    zAxis.rotation.y = - Math.PI / 2;

    this.add(xAxis);
    this.add(zAxis);
    this.add(yAxis);

    const posXAxisHelper = new Sprite(getSpriteMaterial(color1, 'X'));
    posXAxisHelper.userData.type = 'posX';
    const posYAxisHelper = new Sprite(getSpriteMaterial(color2, 'Y'));
    posYAxisHelper.userData.type = 'posY';
    const posZAxisHelper = new Sprite(getSpriteMaterial(color3, 'Z'));
    posZAxisHelper.userData.type = 'posZ';
    const negXAxisHelper = new Sprite(getSpriteMaterial(color1));
    negXAxisHelper.userData.type = 'negX';
    const negYAxisHelper = new Sprite(getSpriteMaterial(color2));
    negYAxisHelper.userData.type = 'negY';
    const negZAxisHelper = new Sprite(getSpriteMaterial(color3));
    negZAxisHelper.userData.type = 'negZ';

    posXAxisHelper.position.x = 1;
    posYAxisHelper.position.y = 1;
    posZAxisHelper.position.z = 1;
    negXAxisHelper.position.x = - 1;
    negXAxisHelper.scale.setScalar(0.8);
    negYAxisHelper.position.y = - 1;
    negYAxisHelper.scale.setScalar(0.8);
    negZAxisHelper.position.z = - 1;
    negZAxisHelper.scale.setScalar(0.8);

    this.add(posXAxisHelper);
    this.add(posYAxisHelper);
    this.add(posZAxisHelper);
    this.add(negXAxisHelper);
    this.add(negYAxisHelper);
    this.add(negZAxisHelper);

    interactiveObjects.push(posXAxisHelper);
    interactiveObjects.push(posYAxisHelper);
    interactiveObjects.push(posZAxisHelper);
    interactiveObjects.push(negXAxisHelper);
    interactiveObjects.push(negYAxisHelper);
    interactiveObjects.push(negZAxisHelper);

    const point = new Vector3();
    const dim = 128;
    const turnRate = Math.PI; // turn rate in angles per second

    this.render = function (renderer) {
      this.quaternion.copy(mainSceneCamera.quaternion).invert();
      this.updateMatrixWorld();

      point.set(0, 0, 1);
      point.applyQuaternion(mainSceneCamera.quaternion);

      if (point.x >= 0) {
        posXAxisHelper.material.opacity = 1;
        negXAxisHelper.material.opacity = 0.5;
      } else {
        posXAxisHelper.material.opacity = 0.5;
        negXAxisHelper.material.opacity = 1;
      }

      if (point.y >= 0) {
        posYAxisHelper.material.opacity = 1;
        negYAxisHelper.material.opacity = 0.5;
      } else {
        posYAxisHelper.material.opacity = 0.5;
        negYAxisHelper.material.opacity = 1;
      }

      if (point.z >= 0) {
        posZAxisHelper.material.opacity = 1;
        negZAxisHelper.material.opacity = 0.5;
      } else {
        posZAxisHelper.material.opacity = 0.5;
        negZAxisHelper.material.opacity = 1;
      }

      const x = dom.offsetWidth - dim;

      renderer.clearDepth();
      renderer.setViewport(x, 0, dim, dim);
      renderer.render(this, camera);
    };

    const targetQuaternion = new Quaternion();
    let radius = 0;

    this.handleClick = function (event) {
      // if (this.animating === true) return false;
      const rect = dom.getBoundingClientRect();
      mouse.x = -1 + (event.clientX - rect.left) / rect.width * 2;
      mouse.y = 1 - (event.clientY - rect.top) / rect.height * 2;

      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(interactiveObjects);
      if (intersects.length > 0) {
        const intersection = intersects[0];
        const object = intersection.object;

        prepareAnimationData(object, mainSceneCamera.focalPoint);

        if ( this._animationId != - 1 ) {
          cancelAnimationFrame( this._animationId );
        }

        this._animationId = requestAnimationFrame(t => {
          this.update(t);
        })

        return true;

      } else {
        return false;
      }
    };

    this.update = function (t) {
      if (this._timeStart === -1) {
        this._timeStart = t;
      }
      const delta = (t - this._timeStart) / 1000;

      const step = delta * turnRate;
      const focusPoint = mainSceneCamera.focalPoint;
      const q = mainSceneCamera.quaternion;

      // animate orientation
      q.rotateTowards(targetQuaternion, step);
      // animate position by doing a slerp and then scaling the position on the unit sphere
      mainSceneCamera.position.set(0, 0, 1).applyQuaternion(q).multiplyScalar(radius).add(focusPoint);

      if (q.equals(targetQuaternion)) {
        if (this.controls) {
          this.glScene.handleControlsRotate();
          if (this.controls.isArcballControls) {
            mainSceneCamera.up.set(0, 1, 0).applyQuaternion(q); 
          }
          this._timeStart = -1;
          this._animationId = -1;
        }
      } else {
        this._animationId = requestAnimationFrame(t => {
          this.update(t);
        })
      }

      this.glScene.renderGl();
    };

    this.dispose = function () {
      dom.removeEventListener('pointerdown', this.onPointerdown);
      dom.removeEventListener('pointerup', this.onPointerup);
    }

    function prepareAnimationData(object, focusPoint) {
      switch (object.userData.type) {
      case 'posX':
        targetQuaternion.setFromEuler(new Euler(0, Math.PI * 0.5, Math.PI * 0.5, 'YXZ'));
        break;
  
      case 'posY':
        targetQuaternion.setFromEuler(new Euler(Math.PI * 0.5, Math.PI, 0));
        break;
  
      case 'posZ':
        targetQuaternion.setFromEuler(new Euler());
        break;
  
      case 'negX':
        targetQuaternion.setFromEuler(new Euler(0, - Math.PI * 0.5, - Math.PI * 0.5, 'YXZ'));
        break;
  
      case 'negY':
        targetQuaternion.setFromEuler(new Euler(Math.PI * 0.5, 0, 0));
        break;
  
      case 'negZ':
        targetQuaternion.setFromEuler(new Euler(0, Math.PI, 0));
        break;

        default:
          console.error('ViewHelper: Invalid axis.');
      }

      radius = mainSceneCamera.position.distanceTo(focusPoint);
    }

    function getAxisMaterial(color) {
      return new MeshBasicMaterial({ color: color, toneMapped: false });
    }

    function getSpriteMaterial(color, text = null) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;

      const context = canvas.getContext('2d');
      context.beginPath();
      context.arc(32, 32, 16, 0, 2 * Math.PI);
      context.closePath();
      context.fillStyle = color.getStyle();
      context.fill();

      if (text !== null) {
        context.font = '24px Arial';
        context.textAlign = 'center';
        context.fillStyle = '#000000';
        context.fillText(text, 32, 41);
      }

      const texture = new CanvasTexture(canvas);
      return new SpriteMaterial({ map: texture, toneMapped: false });
    }
  }
}

export { GlAxesHelper };