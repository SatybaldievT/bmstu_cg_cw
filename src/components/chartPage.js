// components/Three.js
import * as THREE from 'three';
import React, { useRef, useEffect } from 'react';
import { Chart } from './gl-class/chart';

function Three() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808080); // серый цвет

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);

    const chart = new Chart(null, 100, 100);
    scene.add(chart);

    function animate() {
      requestAnimationFrame(animate);
      chart.axisUpdate();
      renderer.render(scene, camera);
    }

    animate();

    return () => {

      chart.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default Three;
