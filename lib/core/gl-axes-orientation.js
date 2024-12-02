
// import {
//   Object3D,
//   BoxGeometry,
//   Mesh,
//   MeshStandardMaterial,
//   CylinderGeometry,
//   BufferGeometry,
//   Float32BufferAttribute,
//   Texture,
//   LinearMipMapLinearFilter,
//   LinearFilter,
//   PointsMaterial,
//   Points
// } from 'three';

// export class GlAxesOrientation extends Object3D {
//   constructor(axisLength) {
//     super();
//     this.axisLength = axisLength || 40;

//     // create X axis
//     this._createAxis('X', 0xff0000);
//     this._createAxisLabel('X', 0xff0000);

//     // create Y axis
//     this._createAxis('Y', 0x00ff00);
//     this._createAxisLabel('Y', 0x00ff00);

//     // create Z axis
//     this._createAxis('Z', 0x0000ff);
//     this._createAxisLabel('Z', 0x0000ff);

//     const cubeSize = axisLength * 0.2;
//     const cubeGeometry = new BoxGeometry(cubeSize, cubeSize, cubeSize);
//     const cubeMesh = new Mesh(cubeGeometry, new MeshStandardMaterial({color: 0xA32AFC, roughness: 0.5, metalness: 0.1}));
//     this.add(cubeMesh);
//   }

//   // ------------------
//   // create an axis
//   // ------------------
//   _createAxis(axisName, color) {
//     const lineLength = this.axisLength * 0.7;
//     const lineRadius = lineLength * 0.1;
//     const line = new CylinderGeometry(lineRadius, lineRadius, lineLength, 15);
//     line.translate(0, lineLength / 2, 0);

//     const arrowLength = this.axisLength * 0.3;
//     const arrowRadius = lineLength * 0.2;
//     const arrow = new CylinderGeometry(0, arrowRadius, arrowLength, 15);
//     arrow.translate(0, lineLength + arrowLength / 2, 0);

//     if (axisName === 'X') {
//       line.rotateZ(-Math.PI / 2);
//       arrow.rotateZ(-Math.PI / 2);
//     } else if (axisName === 'Z') {
//       line.rotateX(Math.PI / 2);
//       arrow.rotateX(Math.PI / 2);
//     }

//     const meshLine = new Mesh(line, new MeshStandardMaterial({color: color, roughness: 0.5, metalness: 0.1}));
//     this.add(meshLine);

//     const meshArrow = new Mesh(arrow, new MeshStandardMaterial({color: color, roughness: 0.5, metalness: 0.1}));
//     this.add(meshArrow);
//   }

//   // -----------------------------------------
//   // create an axis label as a point
//   // -----------------------------------------
//   _createAxisLabel(axisName, color) {
//     // get an appropriate symbol's image, which will be used as a texture later
//     const symbolImage = this._getAxisNameImage(axisName);
//     if (symbolImage === null) {
//       return;
//     }

//     // prepare the axis label vertex coordinates
//     const geometry = new BufferGeometry();
//     const vertex = [0, 0, 0];
//     if (axisName === 'X') vertex[0] = this.axisLength + 10;
//     else if (axisName === 'Y') vertex[1] = this.axisLength + 10;
//     else if (axisName === 'Z') vertex[2] = this.axisLength + 10;

//     geometry.setAttribute('position', new Float32BufferAttribute(vertex, 3));

//     const texture = new Texture(symbolImage);
//     texture.needsUpdate = true;
//     texture.minFilter = LinearMipMapLinearFilter;
//     texture.magFilter = LinearFilter;
//     texture.generateMipmaps = true;

//     const symbolSize = 12;
//     const material = new PointsMaterial({
//       size: symbolSize,
//       color: color,
//       map: texture,
//       transparent: true
//     });

//     const axisLabel = new Points(geometry, material);
//     this.add(axisLabel);
//   }

//   // -----------------------------------------
//   // get an axis name's base64 format image
//   // -----------------------------------------
//   _getAxisNameImage(axisName) {
//     const imageBase64 = new Image();
//     if (axisName === 'X') {
//       imageBase64.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAABmJLR0QA/wD/AP+gvaeTAAACLUlEQVRoge2avS4EURiGHxRIFCJELeECSNhCSYKEO1DhInADfgqU6GkouAIKehGhUEkkEoUN0VjsKnYkm5O1856fmR2bfZPp9nu++bLPzpw5s9BMM6nmDCjVOPJALoG+uYhdq/eZDfAqBlYC7oGuIKdfTlfEjOt7ZQMdAQoCdC/EBFH2hX5fwJgteF0Al4A53wmAaaAo9FpzgbcDNwL8Gej3GKIPeBL63AEdrk1ylL/OuCanrg2AY4H/DYx79AB0xRYd2Esi20kpM6pi78CQBXcAeBO4XkqZURW7BNoEXitwLvCCKGVGVWxFYK2KrCBKmVEV+wRGa3CGgQ+BE1QpM6pit0Bnlfp24FqoT0QpMxvCiZSA7Sq1O2LteqITRFEVKwIzFXWTaHfvRJUyoyr2CPQA3cCD8PlUlDKjKnYYHcpnN1KdIIqqmHqkqpQZVbFMKmVGVazuV6m4+CpWV6XMuCqWCaXMuCgWTKnWUCCgJaWaRNMQaoX4sVdbYKaeTfwvv3W5o1emIW6ISSxR6qKYqtQBGV40NsQy3ubBarqibiI60cwopiq1VaV2W6xNXLGG2HxQlSoQbjsoEcXUReGywFoRWcGfU1SlLsjwlqnNJvagBXcAeBW4wRRTlVpwYC+KbG/FVKVOPHocCXwvxdJ69daL/urNSTFVqVmPIX4zhbadaq2YqtSu7wQV2RP6WSv27/4w8NfmQz6maR6Yp3zJDZX3iBnX+yVgz2aaicsPONQj3/nORbAAAAAASUVORK5CYII=';
//       // imageBase64.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAQMAAABJtOi3AAAAAXNSR0IB2cksfwAAAAZQTFRFAAAA/wAAG/+NIgAAAAJ0Uk5TAP9bkSK1AAAAXklEQVR4nD2Ouw3AIAwFH0pByQiMwmhmNEZhBEoKhAMnJS5Osuz3kf4pPS5lMNJUmnkoglW6nm1NYVtVcK+S+5HYvjqwDvL8wMqBl/uMLFwXrDDFniAiCaeGtWdT6gV4qTcPCMKBwgAAAABJRU5ErkJggg==';
//     } else if (axisName === 'Y') {
//       imageBase64.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAABmJLR0QA/wD/AP+gvaeTAAABu0lEQVRoge2Tyy6DURhFF2mrjyCoyyOYkxCX4GlcBm71NhholTcg6gFoCOElxKVDNWgTbeM4u+c//2VwVtJR//PtvQcLAoFEuQZa//xugLznzDxQt+ReDXq0YTnYAnaid+9hR8hsDHp0STj6DoxHrt9mFHgTMtdcjleEwyeR6v9yKmSduR6fAD6EgEXn+m3mgW9LxhcwFSVkzxLQAh5xFz8H3AsZu84LOhSAJyFo2/G+IvgLMOK8oItlIcxFfFXw9cgLuqgKgYOKrwhe8dC9hxJ+xZ9DE3za14Bu9i3BLeABu/iq4HveF3QoAM9CgS3LnW3hxiueBDexIpR4B8YM71MR3MS5UOTY8PZEeFuNsXsPJeBTKLTQ904RvElMgps4tBTqFz8H3AlvDhJb0EEVf7Pz/ZbwbeyCm1DFn0UTfCPZ+r3UDKW6f4pPtaSL96OKnynBTZSJNuQw+cp/o4pvEryYfGUzq7gNSVVwE5cMNuIinZp2JtHFbwIz6dTUOEIbUk6roEoRbYh3wYd8H6RdNPHcYd8H0yIMyRphSNYIQ7JGGJI1wpCsEYZkjTAka8Qx5Nbyfz2GzEAgLn4AMvrJJ/sw/NwAAAAASUVORK5CYII=';
//     } else if (axisName === 'Z') {
//       imageBase64.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAABmJLR0QA/wD/AP+gvaeTAAABT0lEQVRoge3ZP0oDQRiG8V8CqdQmlY2ltsHWzgOIF1BQwQsIOYLgBSxsLRQvINZqTqCNhXYWFoqNCgrGwj77Qf7MzrAPTDew7wvzzA58NDQkZYBhwnVTFbAVLDIM7psmI7O2Z5Vi2jRF6kZTZMa8VW2IFhmMGWRc+om/P5J9sX/IeaqAEVbxqbrEAxYSZaykiyfVJb7QS5SxkjauxI7UXqKMIY7ESpylChhhE78y92IF7zL3Yh73YkdqN1HGSlq4UIAXfbEStfZiHT8y92IJLzL3ooNbBXhxogAvtsRK1NqLHj5k7kUXjzL3oo1LBXhxqAAvNsRetEPspIlYzbLYi7bWXszhTgFenCrAiwOxErX2Yg3fMvdiEc8y96KDawV4cawAL7bFS0xrTWSG+Or/UZiakVkjRYYTCjIuzTA0K5oidSNSJPX8kMD129AwJf4AZEdtHHEaElIAAAAASUVORK5CYII=';
//       // imageBase64.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAAXNSR0IB2cksfwAAAIFQTFRFAAAAECaXECiXESeYESeYESiZECeYECeaEiiYECeYESaaEieXECaYESeYFSqVESeYESeYFiybESeYESaZESeZECiXECWYESeZEiOVESeYESeYECaYESeXDyeXESiXECaZESeYESeYESiYEiiZESeYDyWWEieYECaWECiYESeYESeY0/QTZwAAACt0Uk5TAIBA/+Itq06Bb1iRL7IM3NMX9DyJYD6iHePDuuVCZ4zrwtWg9iJIX23zvzKtkGgAAACVSURBVHiczdLJDoJQEERR5ImAiDOII84D//+BLuhyYe6LLqntqaTTnQ6CP9LzJrSC86UDhX7UFsKvDFSIeetEnrIP5Rn7SJ6zjyfm0xkXcvP5gn2pAQV7IU/YS/mKvVqbb9iDrfmuYs80YM+eyg/ssbxmj44/LnwyP3sWuJhfb+yfn7qzP+RP9vLFL+lc0xYan3el8AagPgrpmM1RwgAAAABJRU5ErkJggg==';
//     } else {
//       return null;
//     }

//     return imageBase64;
//   }

// }