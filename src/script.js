import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.121.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/controls/OrbitControls.js';
import Stats from 'https://cdnjs.cloudflare.com/ajax/libs/stats.js/r17/Stats.min.js';

(() => {

  var renderer,
    stats,
    container,
    camera,
    scene,
    group,
    controls;

  var width = window.innerWidth;
  var height = window.innerHeight;
  var img = new Image();
  var standardDeviationThreshold = 16;
  var minSize = 3;
  var imgWidth, imgHeight, data = null;
  var grid = [];

  function init() {

    deconstruct();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.autoClear = false;

    stats = new Stats();

    container = document.getElementById('container');
    container.appendChild(renderer.domElement);
    container.appendChild(stats.dom);

    camera = new THREE.PerspectiveCamera(55, width / height, 1, 20000);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.02;
    controls.maxPolarAngle = Math.PI / 2.2;

    scene = new THREE.Scene();

    const gl = renderer.getContext();

    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1);
    directionalLight.position.set(50, 100, -100);
    directionalLight.target.position.set(0, -10, 0);
    scene.add(directionalLight);
    scene.add(directionalLight.target);

    const pointLight = new THREE.PointLight(0xFFFFFF, 1);
    pointLight.position.x = 0;
    pointLight.position.y = -100;
    pointLight.position.z = 0;
    scene.add(pointLight);

    group = new THREE.Object3D();
    scene.add(group);

    for (let sdt = 80; sdt >= standardDeviationThreshold; sdt--) {
      subdivide(sdt, 1, 0, 0, imgWidth, imgHeight);
    }

    for (let i = 0; i < grid.length; i++) {

      var geometry = createBoxWithRoundedEdges(grid[i].w, 10, grid[i].h, 0.1, 1);

      var material = new THREE.MeshStandardMaterial({
        roughness: 0.4,
        color: grid[i].c,
        emissive: grid[i].c,
        emissiveIntensity: 0.1
      });

      var cube = new THREE.Mesh(geometry, material);
      cube.position.x = grid[i].x - (imgWidth / 2);
      cube.position.y = grid[i].z * 15 | 0;
      cube.position.z = grid[i].y - (imgHeight / 2);

      group.add(cube);

    }

    loadPosition();
    var saveInterval = setInterval(savePosition, 500);

    animate();

  }

  function createBoxWithRoundedEdges(width, height, depth, radius, smoothness) {
    
    let shape = new THREE.Shape();
    let eps = 0.00001;
    let rad = radius - eps;

    shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
    shape.absarc(eps, height - rad * 2, eps, Math.PI, Math.PI / 2, true);
    shape.absarc(width - rad * 2, height - rad * 2, eps, Math.PI / 2, 0, true);
    shape.absarc(width - rad * 2, eps, eps, 0, -Math.PI / 2, true);
    
    let geometry = new THREE.ExtrudeBufferGeometry(shape, {
      depth: depth - radius * 2,
      bevelEnabled: true,
      bevelSegments: smoothness * 2,
      steps: 1,
      bevelSize: rad,
      bevelThickness: radius,
      curveSegments: smoothness
    });
    
    return geometry;

  }

  function deconstruct() {
    
    imgWidth = img.width;
    imgHeight = img.height;
    
    const cmap = document.createElement('canvas');
    cmap.width = imgWidth;
    cmap.height = imgHeight;
    
    const ctx = cmap.getContext('2d');
    ctx.drawImage(img, 0, 0);

    data = ctx.getImageData(0, 0, imgWidth, imgHeight).data;

    for (let i = 0; i < imgWidth * imgHeight * 4; i += 4) {
      data[i + 3] = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
    }

  }

  function subdivide(sdt, i, x, y, w, h) {

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const w0 = Math.ceil(w);
    const h0 = Math.ceil(h);
    const n = w0 * h0;

    let r = 0, g = 0, b = 0, l = 0;

    for (let xi = x0; xi < x0 + w0; xi++) {
      for (let yi = y0; yi < y0 + h0; yi++) {
        const p = (yi * imgWidth + xi) * 4;
        r += data[p + 0];
        g += data[p + 1];
        b += data[p + 2];
        l += data[p + 3];
      }
    }

    r = (r / n) | 0;
    g = (g / n) | 0;
    b = (b / n) | 0;
    l = (l / n) | 0;

    let sd = 0;

    for (let xi = x0; xi < x0 + w0; xi++) {
      for (let yi = y0; yi < y0 + h0; yi++) {
        const bri = data[(yi * imgWidth + xi) * 4 + 3] - l;
        sd += bri * bri;
      }
    }

    if ((w > minSize || h > minSize) && Math.sqrt(sd / n) > sdt) {

      subdivide(sdt, i * 2, x, y, w * 0.5, h * 0.5);
      subdivide(sdt, i * 2, x + w * 0.5, y, w * 0.5, h * 0.5);
      subdivide(sdt, i * 2, x, y + h * 0.5, w * 0.5, h * 0.5);
      subdivide(sdt, i * 2, x + w * 0.5, y + h * 0.5, w * 0.5, h * 0.5);

    } else {

      const rect = {
        x,
        y,
        w: w - 0.2,
        h: h - 0.2,
        z: ((r + g + b) / 3) / 255,
        c: `rgb(${r},${g},${b})`
      };

      for (let i = 0; i < grid.length; i++) {
        if (rect.x >= grid[i].x && rect.x + rect.w <= grid[i].x + grid[i].w && rect.y >= grid[i].y && rect.y + rect.h <= grid[i].y + grid[i].h) {
          grid.splice(i, 1);
          i--;
        }
      }

      grid.push(rect);

    }

  }

  function animate() {
    requestAnimationFrame(animate, renderer.domElement);
    stats.begin();
    render();
    stats.end();
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  function onWindowResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function loadPosition() {
    var savedPosition = localStorage.getItem('savedPosition');
    if (savedPosition) {
      let data = JSON.parse(savedPosition);
      camera.position.set(data.position.x, data.position.y, data.position.z);
      controls.target.set(data.target.x, data.target.y, data.target.z);
      controls.update();
    } else{
      camera.position.set(
        148.94579431797652,
        175.66575460719645,
        267.5557930208719
      );
    }
  }

  function savePosition() {
    let data = { position: camera.position, target: controls.target };
    localStorage.setItem('savedPosition', JSON.stringify(data));
  }

  function isFullscreen() {
    return document.fullscreenElement ||
      document.mozFullScreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement;
  }

  function fullscreen() {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    }else if (document.documentElement.mozRequestFullScreen) {
      document.documentElement.mozRequestFullScreen();
    }else if (document.documentElement.webkitRequestFullScreen) {
      document.documentElement.webkitRequestFullScreen();
    }
  }

  function exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }

  img.addEventListener('load', init);
  img.src = document.getElementById('source').src;

  window.addEventListener('unload', savePosition);
  window.addEventListener('resize', onWindowResize, false);

  document.addEventListener('dblclick', () => {
    if (!isFullscreen()) fullscreen();
    else exitFullscreen();
  });

  if (document.documentElement.requestFullscreen) {
    document.addEventListener('fullscreenchange', onWindowResize);
  }else if (document.documentElement.msRequestFullscreen) {
    document.addEventListener('msfullscreenchange', onWindowResize);
  }else if (document.documentElement.mozRequestFullScreen) {
    document.addEventListener('mozfullscreenchange', onWindowResize);
  }else if (document.documentElement.webkitRequestFullScreen) {
    document.addEventListener('webkitfullscreenchange', onWindowResize);
  }

})();
