import {
  CylinderGeometry,
  Vector3,
  Mesh,
  MeshBasicMaterial,
} from 'three';

const radiusTop = 1;
const radiusBottom = 0;
const height = 3;
const pinGeometry = new CylinderGeometry(radiusTop, radiusBottom, height);
pinGeometry.rotateX(Math.PI / 2);
pinGeometry.translate(0, 0, height / 2);
const _v1 = new Vector3();

export class GlImagePin extends Mesh {
  constructor(imgDiag) {
    const pinMaterial = new MeshBasicMaterial({ color: 0xff0000 });
    super(GlImagePin.DEFAULT_GEOMETRY, pinMaterial);

    this.imgDiag = imgDiag;
    
    this.isGlImagePin = true;
    this.type = 'GlImagePin';
    this.height = height;
    this.selectable = true;
  }
  
  select() {
    this.material.color.setHex(0x00ff00);
  }
  
  deselect() {
    this.material.color.setHex(0xff0000);
  }

  updateMatrixWorld() {
    super.updateMatrixWorld();

    const imgscale = this.parent.parent.scale;
    const factor = this.imgDiag / 50 * (imgscale.x + imgscale.y) / 3;

    const te = this.matrixWorld.elements;

    const sx = _v1.set( te[ 0 ], te[ 1 ], te[ 2 ] ).length();
    const sy = _v1.set( te[ 4 ], te[ 5 ], te[ 6 ] ).length();
    const sz = _v1.set( te[ 8 ], te[ 9 ], te[ 10 ] ).length();

		const invSZ = 1 / sz * factor;
		const invSX = 1 / sx * factor;
		const invSY = 1 / sy * factor;

		te[ 0 ] *= invSX;
		te[ 1 ] *= invSX;
		te[ 2 ] *= invSX;
    
		te[ 4 ] *= invSY;
		te[ 5 ] *= invSY;
		te[ 6 ] *= invSY;
    
		te[ 8 ] *= invSZ;
		te[ 9 ] *= invSZ;
		te[ 10 ] *= invSZ;
  }
}

GlImagePin.DEFAULT_GEOMETRY = pinGeometry;