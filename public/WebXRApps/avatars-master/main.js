import './webxr-polyfill.module.js';
import './HelioWebXRPolyfill.js';
import avatarModels from 'https://avatar-models.exokit.org/avatar-models.js'
import ModelLoader from 'https://model-loader.exokit.org/model-loader.js';
import Avatar from './avatars.js';
import {XRChannelConnection} from 'https://multiplayer.exokit.org/multiplayer.js';

console.log("hello")

const peerPoseUpdateRate = 50;
const walkSpeed = 0.0015;
const floorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector4 = new THREE.Vector3();
const localVector5 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localQuaternion2 = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localEuler = new THREE.Euler();
const localRay = new THREE.Ray();

const z180Quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

{
  const avatarModelsEl = document.getElementById('avatar-models');

  const noneAAvatar = document.createElement('a');
  noneAAvatar.classList.add('a-avatar');
  noneAAvatar.innerText = 'none';
  avatarModelsEl.appendChild(noneAAvatar);

  for (let i = 0; i < avatarModels.length; i++) {
    const avatarmodel = avatarModels[i];

    const aAvatar = document.createElement('a');
    aAvatar.classList.add('a-avatar');
    aAvatar.setAttribute('href', `https://avatar-models.exokit.org/${avatarmodel.url}`);
    aAvatar.innerText = avatarmodel.label;

    avatarModelsEl.appendChild(aAvatar);
  }
}

const scene = new THREE.Scene();

const container = new THREE.Object3D();
scene.add(container);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 1.5;
camera.position.z = 2;
// camera.rotation.y = Math.PI;

const ambientLight = new THREE.AmbientLight(0x808080);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1);
directionalLight.position.set(0.5, 1, 0.5);
scene.add(directionalLight);

/* const directionalLight2 = new THREE.DirectionalLight(0xFFFFFF, 1);
directionalLight2.position.set(0, -0.25, -0.25);
scene.add(directionalLight2); */

const gridHelper = new THREE.GridHelper(10, 10);
container.add(gridHelper);

const _makeTextMesh = (s = '', color = 0x000000, size = 1) => {
  // create a geometry of packed bitmap glyphs,
  // word wrapped to 300px and right-aligned
  var geometry = createTextGeometry({
    width: Infinity,
    font: fontJson,
  });

  // change text and other options as desired
  // the options sepcified in constructor will
  // be used as defaults
  geometry.update(s);

  // the resulting layout has metrics and bounds
  // console.log(geometry.layout.height)
  // console.log(geometry.layout.descender)

  var material = new THREE.RawShaderMaterial(createSDFShader({
    map: fontTexture,
    transparent: true,
    color,
    // color: palette[Math.floor(Math.random() * palette.length)]
    // negate: false,
    side: THREE.DoubleSide,
  }));

  const scaleFactor = 0.002 * size;

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(0, -geometry.layout.lineHeight * 0.001, 0);
  mesh.scale.set(scaleFactor, -scaleFactor, -scaleFactor);
  mesh.getText = () => s;
  mesh.setText = newS => {
    if (newS !== s) {
      s = newS;
      geometry.update(s);
    }
  };
  return mesh;
};

const teleportGeometry = new THREE.TorusBufferGeometry(0.5, 0.15, 3, 5)
  .applyMatrix(new THREE.Matrix4().makeRotationX(-(Math.PI / 2)))
  .applyMatrix(new THREE.Matrix4().makeRotationY((1 / 20) * (Math.PI * 2)));
const teleportMaterial = new THREE.MeshBasicMaterial({
  color: 0x44c2ff,
});
const _makeTeleportMesh = () => {
  const geometry = teleportGeometry;
  const material = teleportMaterial;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  return mesh;
};
const teleportMeshes = [
  _makeTeleportMesh(),
  _makeTeleportMesh(),
];
container.add(teleportMeshes[0]);
container.add(teleportMeshes[1]);

const _patchModel = object => {
  object.scene.traverse(o => {
    if (o.isMesh) {
      o.frustumCulled = false;

      if (o.material.opacity === 0) {
        o.material.opacity = 1;
      }
    }
  });
};
const _loadModelUrl = async (url, filename) => {
  const model = await ModelLoader.loadModelUrl(url, filename);
  _patchModel(model);
  return model;
};

const _bindUploadFileButton = inputFileEl => {
  inputFileEl.addEventListener('change', async e => {
    const {files} = e.target;
    if (files.length === 1) {
      const [file] = files;
      const dataUrl = URL.createObjectURL(file);
      const model = await _loadModelUrl(dataUrl, file.name);
      _setLocalModel(model);
      // modelUrl = dataUrl;
    }

    const {parentNode} = inputFileEl;
    parentNode.removeChild(inputFileEl);
    const newInputFileEl = document.createElement('input');
    newInputFileEl.type = 'file';
    newInputFileEl.id = 'upload-file-button';
    newInputFileEl.style.display = 'none';
    parentNode.appendChild(newInputFileEl);
    _bindUploadFileButton(newInputFileEl);
  });
};
_bindUploadFileButton(document.getElementById('upload-file-button'));
window.document.addEventListener('dragover', e => {
  e.preventDefault();
});
window.document.addEventListener('drop', async e => {
  e.preventDefault();

  if (e.dataTransfer.items.length !== 1) {
    return;
  }

  for (var i = 0; i < e.dataTransfer.items.length; i++) {
    if (e.dataTransfer.items[i].kind === 'file') {
      const file = e.dataTransfer.items[i].getAsFile();
      // console.log('got file', e.dataTransfer.items[i], file);
      const dataUrl = URL.createObjectURL(file);
      const model = await _loadModelUrl(dataUrl, file.name);
      _setLocalModel(model);
      // modelUrl = dataUrl;
    }
  }
});

const renderer = new THREE.WebGLRenderer({
  // canvas: document.getElementById('canvas'),
  // alpha: true,
  antialias: true,
});
// console.log('set size', window.innerWidth, window.innerHeight);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.sortObjects = false;
document.getElementById('iframe-wrapper').appendChild(renderer.domElement);

const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
orbitControls.screenSpacePanning = true;
orbitControls.enableMiddleZoom = false;
orbitControls.update();

const aAvatars = Array.from(document.querySelectorAll('.a-avatar'));
for (let i = 0; i < aAvatars.length; i++) {
  const aAvatar = aAvatars[i];
  aAvatar.addEventListener('click', async e => {
    e.preventDefault();

    const {href} = aAvatar;
    if (href) {
      _setLocalModel(await _loadModelUrl(href));
    } else {
      _setLocalModel(null);
    }
    modelUrl = href;
    _sendAllPeerConnections(JSON.stringify({
      method: 'model',
      url: modelUrl,
    }));
  });
}

let fontJson, fontTexture;
const fontPromise = Promise.all([
  fetch('DejaVu-sdf.json').then(res => res.json()),
  new Promise((accept, reject) => {
    new THREE.TextureLoader().load('DejaVu-sdf.png', accept);
  }),
]).then(results => {
  fontJson = results[0];
  fontTexture = results[1];
});
const buttonSize = new THREE.Vector3(1, 0.1*0.9, 0.1);
const buttonGeometry = new THREE.BoxBufferGeometry(buttonSize.x, buttonSize.y, buttonSize.z);
const colors = {
  normal: 0x5c6bc0,
  highlight: 0x303f9f,
};
const mirrorMesh = (() => {
  const mirrorWidth = 3;
  const mirrorHeight = 2;
  const geometry = new THREE.PlaneBufferGeometry(mirrorWidth, mirrorHeight)
    .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1, 0));
  const mesh = new THREE.Reflector(geometry, {
    clipBias: 0.003,
    textureWidth: 1024 * window.devicePixelRatio,
    textureHeight: 2048 * window.devicePixelRatio,
    color: 0x889999,
    addColor: 0x300000,
    recursion: 1,
    transparent: true,
  });
  mesh.position.set(0, 0, -1);

  const borderMesh = new THREE.Mesh(
    new THREE.BoxBufferGeometry(mirrorWidth + 0.1, mirrorHeight + 0.1, 0.1)
      .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1, -0.1/2 - 0.01)),
    new THREE.MeshPhongMaterial({
      color: 0x5c6bc0,
    })
  );
  mesh.add(borderMesh);

  const buttonMeshes = aAvatars.map((aAvatar, i) => {
    const geometry = buttonGeometry;
    const material = new THREE.MeshPhongMaterial({
      color: colors.normal,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(-2, 2 - 0.1/2 - i*0.1, 0);
    mesh.frustumCulled = false;

    fontPromise.then(() => {
      const textMesh = _makeTextMesh(aAvatar.innerText, 0xFFFFFF);
      textMesh.position.x = -0.45;
      textMesh.position.y = -0.02;
      textMesh.position.z = 0.06;
      mesh.add(textMesh);
    });

    mesh.box = new THREE.Box3();

    return mesh;
  });
  for (let i = 0; i < buttonMeshes.length; i++) {
    mesh.add(buttonMeshes[i]);
  }
  mesh.buttonMeshes = buttonMeshes;
  mesh.update = () => {
    for (let i = 0; i < buttonMeshes.length; i++) {
      const buttonMesh = buttonMeshes[i];
      buttonMesh.box.setFromCenterAndSize(buttonMesh.getWorldPosition(new THREE.Vector3()), buttonSize.clone().multiply(buttonMesh.getWorldScale(new THREE.Vector3())));
    }
  };
  mesh.getButtonIntersectionIndex = position => {
    for (let i = 0; i < buttonMeshes.length; i++) {
      if (buttonMeshes[i].box.containsPoint(position)) {
        return i;
      }
    }
    return -1;
  };

  mesh.onBeforeRender2 = () => {
    if (rig) {
      rig.undecapitate();
    }
  };
  mesh.onAfterRender2 = () => {
    if (rig && session) {
      rig.decapitate();
    }
  };

  return mesh;
})();
container.add(mirrorMesh);

const userHeight = 1.7;
const _getHeightFactor = rigHeight => rigHeight / userHeight;

let rig = null;
let modelUrl = '';
let heightFactor = 0;
const _setLocalModel = newModel => {
  if (rig) {
    container.remove(rig.model);
    rig.destroy();
    rig = null;
  }

  rig = new Avatar(newModel, {
    fingers: true,
    hair: true,
    visemes: true,
    // decapitate: true,
    microphoneMediaStream,
    debug: !newModel,
  });
  container.add(rig.model);
  window.model = newModel;

  heightFactor = _getHeightFactor(rig.height);

  container.scale.set(1, 1, 1).divideScalar(heightFactor);
};

const lastPresseds = [false, false];
const lastBs = [false, false];
const lastPads = [false, false];
const lastPositions = [new THREE.Vector3(), new THREE.Vector3()];
const startGripPositions = [new THREE.Vector3(), new THREE.Vector3()];
const startSceneMatrix = new THREE.Matrix4();
let startModelScale = 1;
const dateOffset = Math.floor(Math.random() * 60 * 1000);
const realDateNow = (now => () => dateOffset + now())(Date.now);
let lastTimestamp = Date.now();
function animate(timestamp, frame, referenceSpace) {
  const now = Date.now();
  const timeDiff = now - lastTimestamp;

  if (rig) {
    if (renderer.vr.enabled) {
      const vrCameras = renderer.vr.getCamera(camera).cameras;
      const vrCamera = vrCameras[0];
      const vrCamera2 = vrCameras[1];
      vrCamera.matrixWorld.decompose(vrCamera.position, vrCamera.quaternion, vrCamera.scale);
      vrCamera2.matrixWorld.decompose(vrCamera2.position, vrCamera2.quaternion, vrCamera2.scale);
      vrCamera.position.add(vrCamera2.position).divideScalar(2);
      const {inputSources} = session;
      const gamepads = navigator.getGamepads();

      rig.inputs.hmd.position.copy(vrCamera.position).sub(container.position).multiplyScalar(heightFactor);
      rig.inputs.hmd.quaternion.copy(vrCamera.quaternion);

      const _getGamepad = i => {
        const handedness = i === 0 ? 'left' : 'right';
        const inputSource = inputSources.find(inputSource => inputSource.handedness === handedness);
        let pose, gamepad;
        if (inputSource && (pose = frame.getPose(inputSource.gripSpace, referenceSpace)) && (gamepad = inputSource.gamepad || gamepads[i])) {
          const {transform} = pose;
          const {position, orientation, matrix} = transform;
          if (position) { // new WebXR api
            const rawP = localVector.copy(position);
            const p = localVector2.copy(rawP).sub(container.position).multiplyScalar(heightFactor);
            const q = localQuaternion.copy(orientation);
            const pressed = gamepad.buttons[0].pressed;
            const lastPressed = lastPresseds[i];
            const pointer = gamepad.buttons[0].value;
            const grip = gamepad.buttons[1].value;
            const pad = gamepad.axes[1] <= -0.5 || gamepad.axes[3] <= -0.5;
            const padX = gamepad.axes[0] !== 0 ? gamepad.axes[0] : gamepad.axes[2];
            const padY = gamepad.axes[1] !== 0 ? gamepad.axes[1] : gamepad.axes[3];
            const stick = !!gamepad.buttons[3] && gamepad.buttons[3].pressed;
            const a = !!gamepad.buttons[4] && gamepad.buttons[4].pressed;
            const b = !!gamepad.buttons[5] && gamepad.buttons[5].pressed;
            const lastB = lastBs[i];
            return {
              rawPosition: rawP,
              position: p,
              quaternion: q,
              pressed,
              lastPressed,
              pointer,
              grip,
              pad,
              padX,
              padY,
              stick,
              a,
              b,
              lastB,
            };
          } else if (matrix) { // old WebXR api
            const rawP = localVector;
            const p = localVector2;
            const q = localQuaternion;
            const s = localVector3;
            localMatrix
              .fromArray(transform.matrix)
              .decompose(rawP, q, s);
            p.copy(rawP).sub(container.position).multiplyScalar(heightFactor);
            const pressed = gamepad.buttons[0].pressed;
            const lastPressed = lastPresseds[i];
            const pointer = gamepad.buttons[0].value;
            const grip = gamepad.buttons[1].value;
            const pad = gamepad.axes[1] <= -0.5 || gamepad.axes[3] <= -0.5;
            const padX = gamepad.axes[0] !== 0 ? gamepad.axes[0] : gamepad.axes[2];
            const padY = gamepad.axes[1] !== 0 ? gamepad.axes[1] : gamepad.axes[3];
            const stick = !!gamepad.buttons[3] && gamepad.buttons[3].pressed;
            const a = !!gamepad.buttons[4] && gamepad.buttons[4].pressed;
            const b = !!gamepad.buttons[5] && gamepad.buttons[5].pressed;
            const lastB = lastBs[i];
            return {
              rawPosition: rawP,
              position: p,
              quaternion: q,
              pressed,
              lastPressed,
              pointer,
              grip,
              pad,
              padX,
              padY,
              stick,
              a,
              b,
              lastB,
            };
          } else {
            return null;
          }
        } else {
          return null;
        }
      };
      const _updateTeleportMesh = (i, pad, lastPad, position, quaternion, padX, padY, stick) => {
        const teleportMesh = teleportMeshes[i];
        teleportMesh.visible = false;

        if (pad) {
          localVector.copy(vrCamera.position).applyMatrix4(localMatrix.getInverse(container.matrix));
          localEuler.setFromQuaternion(quaternion, 'YXZ');

          for (let i = 0; i < 20; i++, localVector.add(localVector2), localEuler.x = Math.max(localEuler.x - Math.PI*0.07, -Math.PI/2)) {
            localRay.set(localVector, localVector2.set(0, 0, -1).applyQuaternion(localQuaternion.setFromEuler(localEuler)));
            const intersection = localRay.intersectPlane(floorPlane, localVector3);
            if (intersection && intersection.distanceTo(localRay.origin) <= 1) {
              teleportMesh.position.copy(intersection);
              localEuler.setFromQuaternion(localQuaternion, 'YXZ');
              localEuler.x = 0;
              localEuler.z = 0;
              teleportMesh.quaternion.setFromEuler(localEuler);
              teleportMesh.visible = true;
              break;
            }
          }
        } else if (lastPad) {
          localVector.copy(teleportMesh.position).applyMatrix4(container.matrix).sub(vrCamera.position);
          localVector.y = 0;
          container.position.sub(localVector);
        }

        if (padX !== 0 || padY !== 0) {
          localVector.set(padX, 0, padY);
          const moveLength = localVector.length();
          if (moveLength > 1) {
            localVector.divideScalar(moveLength);
          }
          const hmdEuler = localEuler.setFromQuaternion(rig.inputs.hmd.quaternion, 'YXZ');
          localEuler.x = 0;
          localEuler.z = 0;
          container.position.sub(localVector.multiplyScalar(walkSpeed * timeDiff * (stick ? 3 : 1) * rig.height).applyEuler(hmdEuler));
        }
      };

      const wasLastBd = lastBs[0] && lastBs[1];

      const lg = _getGamepad(1);
      let li = -1;
      if (lg) {
        const {rawPosition, position, quaternion, pressed, lastPressed, pointer, grip, pad, b} = lg;
        rig.inputs.leftGamepad.quaternion.copy(quaternion);
        rig.inputs.leftGamepad.position.copy(position);
        rig.inputs.leftGamepad.pointer = pointer;
        rig.inputs.leftGamepad.grip = grip;

        li = mirrorMesh.getButtonIntersectionIndex(position);
        if (pressed && !lastPressed) {
          if (li !== -1) {
            aAvatars[li].click();
          }
        }

        _updateTeleportMesh(0, pad, lastPads[0], position, quaternion, 0, 0, false);

        lastPresseds[0] = pressed;
        lastPads[0] = pad;
        lastBs[0] = b;
        lastPositions[0].copy(rawPosition);
      }
      const rg = _getGamepad(0);
      let ri = -1;
      if (rg) {
        const {rawPosition, position, quaternion, pressed, lastPressed, pointer, grip, pad, padX, padY, stick, b} = rg;
        rig.inputs.rightGamepad.quaternion.copy(quaternion);
        rig.inputs.rightGamepad.position.copy(position);
        rig.inputs.rightGamepad.pointer = pointer;
        rig.inputs.rightGamepad.grip = grip;

        ri = mirrorMesh.getButtonIntersectionIndex(position);
        if (pressed && !lastPressed) {
          if (ri !== -1) {
            aAvatars[ri].click();
          }
        }

        _updateTeleportMesh(1, false, false, position, quaternion, padX, padY, stick);

        lastPresseds[1] = pressed;
        lastPads[1] = pad;
        lastBs[1] = b;
        lastPositions[1].copy(rawPosition);
      }

      const _startScale = () => {
        for (let i = 0; i < startGripPositions.length; i++) {
          startGripPositions[i].copy(lastPositions[i]);
        }
        startSceneMatrix.copy(container.matrix);
        startModelScale = rig ? rig.inputs.hmd.scaleFactor : 1;
      };
      const _processScale = () => {
        const startDistance = startGripPositions[0].distanceTo(startGripPositions[1]);
        const currentDistance = lastPositions[0].distanceTo(lastPositions[1]);
        const scaleFactor = currentDistance / startDistance;

        let startGripPosition = localVector3.copy(startGripPositions[0]).add(startGripPositions[1]).divideScalar(2)
        let currentGripPosition = localVector4.copy(lastPositions[0]).add(lastPositions[1]).divideScalar(2)
        startGripPosition.applyMatrix4(localMatrix.getInverse(startSceneMatrix));
        currentGripPosition.applyMatrix4(localMatrix/*.getInverse(startSceneMatrix)*/);

        const positionDiff = localVector5.copy(currentGripPosition).sub(startGripPosition);

        container.matrix.copy(startSceneMatrix)
          .multiply(localMatrix.makeTranslation(currentGripPosition.x, currentGripPosition.y, currentGripPosition.z))
          .multiply(localMatrix.makeScale(scaleFactor, scaleFactor, scaleFactor))
          .multiply(localMatrix.makeTranslation(-currentGripPosition.x, -currentGripPosition.y, -currentGripPosition.z))
          .multiply(localMatrix.makeTranslation(positionDiff.x, positionDiff.y, positionDiff.z))
          .decompose(container.position, container.quaternion, container.scale);

        if (rig) {
          rig.inputs.hmd.scaleFactor = startModelScale / scaleFactor;
        }

        // _startScale();
      };
      const isLastBd = lastBs[0] && lastBs[1];
      if (!wasLastBd && isLastBd) {
        _startScale();
      } else if (isLastBd) {
        _processScale();
      }

      for (let i = 0; i < mirrorMesh.buttonMeshes.length; i++) {
        mirrorMesh.buttonMeshes[i].material.color.setHex((i === li || i === ri) ? colors.highlight : colors.normal);
      }

      rig.update();
    } else if (controlsBound) {
      // defer
    } else {
      const positionOffset = Math.sin((realDateNow()%10000)/10000*Math.PI*2)*2;
      const positionOffset2 = -Math.sin((realDateNow()%5000)/5000*Math.PI*2)*1;
      const standFactor = rig.height - 0.1*rig.height + Math.sin((realDateNow()%2000)/2000*Math.PI*2)*0.2*rig.height;
      const rotationAngle = (realDateNow()%5000)/5000*Math.PI*2;

      // rig.inputs.hmd.position.set(positionOffset, 0.6 + standFactor, 0);
      rig.inputs.hmd.position.set(positionOffset, standFactor, positionOffset2);
      rig.inputs.hmd.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationAngle)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin((realDateNow()%2000)/2000*Math.PI*2)*Math.PI*0.2))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin((realDateNow()%2000)/2000*Math.PI*2)*Math.PI*0.25));

      rig.inputs.rightGamepad.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationAngle)
        // .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin((realDateNow()%5000)/5000*Math.PI*2)*Math.PI*0.6));
      rig.inputs.rightGamepad.position.set(positionOffset, rig.height*0.7 + Math.sin((realDateNow()%2000)/2000*Math.PI*2)*0.1, positionOffset2).add(
        new THREE.Vector3(-rig.shoulderWidth/2, 0, -0.2).applyQuaternion(rig.inputs.rightGamepad.quaternion)
      )/*.add(
        new THREE.Vector3(-0.1, 0, -1).normalize().multiplyScalar(rig.rightArmLength*0.4).applyQuaternion(rig.inputs.rightGamepad.quaternion)
      ); */
      rig.inputs.leftGamepad.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationAngle);
      rig.inputs.leftGamepad.position.set(positionOffset, rig.height*0.7, positionOffset2).add(
        new THREE.Vector3(rig.shoulderWidth/2, 0, -0.2).applyQuaternion(rig.inputs.leftGamepad.quaternion)
      )/*.add(
        new THREE.Vector3(0.1, 0, -1).normalize().multiplyScalar(rig.leftArmLength*0.4).applyQuaternion(rig.inputs.leftGamepad.quaternion)
      );*/

      rig.inputs.leftGamepad.pointer = (Math.sin((Date.now()%10000)/10000*Math.PI*2) + 1) / 2;
      rig.inputs.leftGamepad.grip = (Math.sin((Date.now()%10000)/10000*Math.PI*2) + 1) / 2;

      rig.inputs.rightGamepad.pointer = (Math.sin((Date.now()%10000)/10000*Math.PI*2) + 1) / 2;
      rig.inputs.rightGamepad.grip = (Math.sin((Date.now()%10000)/10000*Math.PI*2) + 1) / 2;

      rig.update();
    }
  }

  renderer.render(scene, camera);

  for (let i = 0; i < peerConnections.length; i++) {
    const peerConnection = peerConnections[i];
    if (peerConnection.rig) {
      peerConnection.rig.update();
    }
  }

  if (controlsBound) {
    localEuler.setFromQuaternion(rig.inputs.hmd.quaternion, 'YXZ');
    localEuler.x = Math.min(Math.max(localEuler.x - mouse.movementY * 0.01, -Math.PI/2), Math.PI/2);
    localEuler.y -= mouse.movementX * 0.01
    localEuler.z = 0;
    rig.inputs.hmd.quaternion.setFromEuler(localEuler);
    mouse.movementX = 0;
    mouse.movementY = 0;

    localEuler.setFromQuaternion(rig.inputs.hmd.quaternion, 'YXZ');
    localEuler.x = 0;
    localEuler.z = 0;
    const floorRotation = localQuaternion.setFromEuler(localEuler);

    localVector.set(0, 0, 0);
    if (keys.left) {
      localVector.x += -1;
    }
    if (keys.right) {
      localVector.x += 1;
    }
    if (keys.up) {
      localVector.z += -1;
    }
    if (keys.down) {
      localVector.z += 1;
    }
    rig.inputs.hmd.position.add(localVector.normalize().multiplyScalar(walkSpeed * timeDiff * (keys.shift ? 3 : 1) * rig.height).applyQuaternion(floorRotation));
    if (keys.space) {
      const lerpFactor = 0.3;
      rig.inputs.hmd.position.y = rig.inputs.hmd.position.y * (1-lerpFactor) + rig.height*1.1 * lerpFactor;
    } else if (keys.z) {
      const lerpFactor = 0.05;
      rig.inputs.hmd.position.y = rig.inputs.hmd.position.y * (1-lerpFactor) + rig.height*0.2 * lerpFactor;
    } else if (keys.c) {
      const lerpFactor = 0.2;
      rig.inputs.hmd.position.y = rig.inputs.hmd.position.y * (1-lerpFactor) + rig.height*0.7 * lerpFactor;
    } else {
      const lerpFactor = 0.3;
      rig.inputs.hmd.position.y = rig.inputs.hmd.position.y * (1-lerpFactor) + rig.height*0.9 * lerpFactor;
    }

    rig.inputs.leftGamepad.position.copy(rig.inputs.hmd.position)
      .add(localVector.set(0.15, -0.15, -0.2).multiplyScalar(rig.height).applyQuaternion(rig.inputs.hmd.quaternion));
    rig.inputs.leftGamepad.quaternion.copy(rig.inputs.hmd.quaternion)
      .multiply(localQuaternion2.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI*0.5));
    rig.inputs.rightGamepad.position.copy(rig.inputs.hmd.position)
      .add(localVector.set(-0.15, -0.15, -0.2).multiplyScalar(rig.height).applyQuaternion(rig.inputs.hmd.quaternion));
    rig.inputs.rightGamepad.quaternion.copy(rig.inputs.hmd.quaternion)
      .multiply(localQuaternion2.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI*0.5))

    if (controlsBound === 'firstperson') {
      rig.decapitate();
    } else if (controlsBound === 'thirdperson') {
      rig.undecapitate();
    }

    rig.update();

    if (controlsBound === 'firstperson') {
      rig.outputs.eyes.matrixWorld.decompose(camera.position, camera.quaternion, localVector);
      camera.position.divideScalar(heightFactor).add(container.position);
      camera.quaternion.multiply(z180Quaternion);
    } else if (controlsBound === 'thirdperson') {
      rig.outputs.eyes.matrixWorld.decompose(camera.position, camera.quaternion, localVector);
      camera.position.divideScalar(heightFactor).add(container.position);
      camera.quaternion.multiply(z180Quaternion);
      camera.position.add(localVector.set(0, 0.5, 2).applyQuaternion(camera.quaternion));
    }
  }

  lastTimestamp = now;
}
renderer.setAnimationLoop(animate);

const mouse = {
  movementX: 0,
  movementY: 0,
};
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  z: false,
  c: false,
  space: false,
  shift: false,
};
let controlsBound = null;
let unbindControls = null;
window.document.addEventListener('pointerlockchange', () => {
  if (!window.document.pointerLockElement && unbindControls) {
    unbindControls();
    unbindControls = null;
  }
});

const _bindControls = type => {
  const _keydown = e => {
    switch (e.which) {
      case 65: {
        keys.left = true;
        break;
      }
      case 68: {
        keys.right = true;
        break;
      }
      case 87: {
        keys.up = true;
        break;
      }
      case 83: {
        keys.down = true;
        break;
      }
      case 90: {
        keys.z = true;
        break;
      }
      case 67: {
        keys.c = true;
        break;
      }
      case 32: {
        keys.space = true;
        break;
      }
      case 16: {
        keys.shift = true;
        break;
      }
    }
  };
  window.addEventListener('keydown', _keydown);
  const _keyup = e => {
    switch (e.which) {
      case 65: {
        keys.left = false;
        break;
      }
      case 68: {
        keys.right = false;
        break;
      }
      case 87: {
        keys.up = false;
        break;
      }
      case 83: {
        keys.down = false;
        break;
      }
      case 90: {
        keys.z = false;
        break;
      }
      case 67: {
        keys.c = false;
        break;
      }
      case 32: {
        keys.space = false;
        break;
      }
      case 16: {
        keys.shift = false;
        break;
      }
    }
  };
  window.addEventListener('keyup', _keyup);
  const _mousemove = e => {
    mouse.movementX += e.movementX;
    mouse.movementY += e.movementY;
  };
  window.addEventListener('mousemove', _mousemove);
  orbitControls.enabled = false;
  controlsBound = type;

  unbindControls = () => {
    window.addEventListener('keydown', _keydown);
    window.addEventListener('keyup', _keyup);
    window.removeEventListener('mousemove', _mousemove);
    orbitControls.target.copy(camera.position).add(new THREE.Vector3(0, 0, -3).applyQuaternion(camera.quaternion));
    orbitControls.enabled = true;
    controlsBound = null;
  };
};
const firstpersonButton = document.getElementById('firstperson-button');
firstpersonButton.addEventListener('click', async () => {
  if (rig) {
    await renderer.domElement.requestPointerLock();
    _bindControls('firstperson');
  }
});
const thirdpersonButton = document.getElementById('thirdperson-button');
thirdpersonButton.addEventListener('click', async () => {
  if (rig) {
    await renderer.domElement.requestPointerLock();
    _bindControls('thirdperson');
  }
});

let session = null;
const enterXrButton = document.getElementById('enter-xr-button');
const noXrButton = document.getElementById('no-xr-button');
enterXrButton.addEventListener('click', async () => {
  session = await navigator.xr.requestSession('immersive-vr', {
    requiredFeatures: ['local-floor'],
  });
  let referenceSpace;
  let referenceSpaceType = '';
  const _loadReferenceSpace = async () => {
    const lastReferenceSpaceType = referenceSpaceType;
    try {
      referenceSpace = await session.requestReferenceSpace('local-floor');
      referenceSpaceType = 'local-floor';
    } catch (err) {
      referenceSpace = await session.requestReferenceSpace('local');
      referenceSpaceType = 'local';
    }

    if (referenceSpaceType !== lastReferenceSpaceType) {
      console.log(`referenceSpace changed to ${referenceSpaceType}`);
    }
  };
  await _loadReferenceSpace();
  const loadReferenceSpaceInterval = setInterval(_loadReferenceSpace, 1000);

  renderer.vr.setSession(session);

  session.requestAnimationFrame((timestamp, frame) => {
    const pose = frame.getViewerPose(referenceSpace);
    const viewport = session.renderState.baseLayer.getViewport(pose.views[0]);
    // const width = viewport.width;
    const height = viewport.height;
    const fullWidth = (() => {
      let result = 0;
      for (let i = 0; i < pose.views.length; i++) {
        result += session.renderState.baseLayer.getViewport(pose.views[i]).width;
      }
      return result;
    })();
    renderer.setSize(fullWidth, height);
    renderer.setPixelRatio(1);

    renderer.setAnimationLoop(null);

    renderer.vr.enabled = true;
    renderer.vr.setSession(session);
    renderer.vr.setAnimationLoop(animate);

    console.log('loaded root in XR');
  });
});

let microphoneMediaStream = null;
const enableMicButton = document.getElementById('enable-mic-button');
const disableMicButton = document.getElementById('disable-mic-button');
enableMicButton.addEventListener('click', async () => {
  try {
    microphoneMediaStream  = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    rig.setMicrophoneMediaStream(microphoneMediaStream);
    if (channelConnection) {
      channelConnection.setMicrophoneMediaStream(microphoneMediaStream);
    }

    disableMicButton.style.display = null;
    enableMicButton.style.display = 'none';
  } catch (err) {
    console.warn(err);
  }
});
disableMicButton.addEventListener('click', async () => {
  rig.setMicrophoneMediaStream(null);
  if (channelConnection) {
    channelConnection.setMicrophoneMediaStream(null);
  }
  microphoneMediaStream.getAudioTracks().forEach(track => {
    track.stop();
  });

  microphoneMediaStream = null;
  enableMicButton.style.display = null;
  disableMicButton.style.display = 'none';

  /* try {
    await navigator.permissions.revoke({
      name: 'microphone',
    });
  } catch(err) {
    console.warn(err);
  } */
});

let channelConnection = null;
const peerConnections = [];
const _sendAllPeerConnections = s => {
  for (let i = 0; i < peerConnections.length; i++) {
    peerConnections[i].send(s);
  }
};
const channelInput = document.getElementById('channel-input');
const connectButton = document.getElementById('connect-button');
connectButton.addEventListener('click', () => {
  const channelInputValue = channelInput.value;
  const match = channelInputValue.match(/^(.+?)\/(.+?)$/);
  if (match) {
    const userName = match[1];
    const channelName = match[2];

    console.log(`connecting to ${userName}/${channelName}`);

    channelConnection = new XRChannelConnection(`wss://presence.exokit.org/?u=${encodeURIComponent(userName)}&c=${encodeURIComponent(channelName)}`, {
      microphoneMediaStream,
    });
    channelConnection.addEventListener('open', () => {
      console.log('xr channel open');
    });
    channelConnection.addEventListener('error', err => {
      console.warn('xr channel error', err);
    });
    channelConnection.addEventListener('peerconnection', e => {
      const peerConnection = e.detail;

      peerConnection.rig = null;
      peerConnection.mediaStream = null;
      let updateInterval = 0;
      peerConnection.addEventListener('open', () => {
        console.log('add peer connection', peerConnection);

        peerConnections.push(peerConnection);

        peerConnection.send(JSON.stringify({
          method: 'model',
          url: modelUrl,
        }));

        updateInterval = setInterval(() => {
          if (rig) {
            const hmd = {
              position: localVector.copy(rig.inputs.hmd.position).divideScalar(heightFactor).toArray(),
              quaternion: rig.inputs.hmd.quaternion.toArray(),
              scaleFactor: rig.inputs.hmd.scaleFactor,
            };
            const gamepads = [
              {
                position: localVector.copy(rig.inputs.leftGamepad.position).divideScalar(heightFactor).toArray(),
                quaternion: rig.inputs.leftGamepad.quaternion.toArray(),
                pointer: rig.inputs.leftGamepad.pointer,
                grip: rig.inputs.leftGamepad.grip,
                visible: true,
              },
              {
                position: localVector.copy(rig.inputs.rightGamepad.position).divideScalar(heightFactor).toArray(),
                quaternion: rig.inputs.rightGamepad.quaternion.toArray(),
                pointer: rig.inputs.rightGamepad.pointer,
                grip: rig.inputs.rightGamepad.grip,
                visible: true,
              },
            ];
            peerConnection.update(hmd, gamepads);
          }
        }, peerPoseUpdateRate);
      });
      peerConnection.addEventListener('close', () => {
        console.log('remove peer connection', peerConnection);

        const index = peerConnections.indexOf(peerConnection);
        if (index !== -1) {
          peerConnections.splice(index, 1);
        }

        clearInterval(updateInterval);

        if (peerConnection.rig) {
          container.remove(peerConnection.rig.model);
          peerConnection.rig.destroy();
        }
      });
      peerConnection.addEventListener('pose', e => {
        const {rig} = peerConnection;
        if (rig) {
          const {detail: data} = e;
          const {hmd, gamepads} = data;

          rig.starts.hmd.position.copy(peerConnection.rig.inputs.hmd.position);
          rig.starts.hmd.rotation.copy(peerConnection.rig.inputs.hmd.quaternion);
          rig.starts.hmd.scaleFactor = peerConnection.rig.inputs.hmd.scaleFactor;
          rig.starts.gamepads[0].position.copy(peerConnection.rig.inputs.leftGamepad.position);
          rig.starts.gamepads[0].rotation.copy(peerConnection.rig.inputs.leftGamepad.quaternion);
          rig.starts.gamepads[0].pointer = peerConnection.rig.inputs.leftGamepad.pointer;
          rig.starts.gamepads[0].grip = peerConnection.rig.inputs.leftGamepad.grip;
          rig.starts.gamepads[1].position.copy(peerConnection.rig.inputs.rightGamepad.position);
          rig.starts.gamepads[1].rotation.copy(peerConnection.rig.inputs.rightGamepad.quaternion);
          rig.starts.gamepads[1].pointer = peerConnection.rig.inputs.rightGamepad.pointer;
          rig.starts.gamepads[1].grip = peerConnection.rig.inputs.rightGamepad.grip;

          rig.targets.hmd.position.fromArray(hmd.position);
          rig.targets.hmd.rotation.fromArray(hmd.quaternion);
          rig.targets.hmd.scaleFactor = hmd.scaleFactor;
          rig.targets.gamepads[0].position.fromArray(gamepads[0].position);
          rig.targets.gamepads[0].rotation.fromArray(gamepads[0].quaternion);
          rig.targets.gamepads[0].pointer = gamepads[0].pointer;
          rig.targets.gamepads[0].grip = gamepads[0].grip;
          rig.targets.gamepads[1].position.fromArray(gamepads[1].position);
          rig.targets.gamepads[1].rotation.fromArray(gamepads[1].quaternion);
          rig.targets.gamepads[1].pointer = gamepads[1].pointer;
          rig.targets.gamepads[1].grip = gamepads[1].grip;
          rig.targets.timestamp = Date.now();
        }
      });
      peerConnection.addEventListener('mediastream', e => {
        console.log('got media stream', e.detail, e.detail.getAudioTracks());
        peerConnection.mediaStream = e.detail;
        if (peerConnection.rig) {
          peerConnection.rig.setMicrophoneMediaStream(peerConnection.mediaStream, {
            muted: false,
          });
        }
      });
      peerConnection.addEventListener('message', async e => {
        console.log('got message', e);
        const data = JSON.parse(e.data);
        const {method} = data;
        if (method === 'model') {
          const {url} = data;
          console.log('got peer model', {url});

          if (peerConnection.rig) {
            container.remove(peerConnection.rig.model);
            peerConnection.rig.destroy();
          }

          const model = url ? await _loadModelUrl(url) : null;
          peerConnection.rig = new Avatar(model, {
            fingers: true,
            hair: true,
            visemes: true,
            microphoneMediaStream: peerConnection.mediaStream,
            muted: false,
            debug: !model,
          });
          container.add(peerConnection.rig.model);

          peerConnection.rig.starts = {
            hmd: {
              position: peerConnection.rig.inputs.hmd.position.clone(),
              rotation: peerConnection.rig.inputs.hmd.quaternion.clone(),
              scaleFactor: peerConnection.rig.inputs.hmd.scaleFactor,
            },
            gamepads: [
              {
                position: peerConnection.rig.inputs.leftGamepad.position.clone(),
                rotation:  peerConnection.rig.inputs.leftGamepad.quaternion.clone(),
                pointer: peerConnection.rig.inputs.leftGamepad.pointer,
                grip: peerConnection.rig.inputs.leftGamepad.grip,
              },
              {
                position: peerConnection.rig.inputs.rightGamepad.position.clone(),
                rotation: peerConnection.rig.inputs.rightGamepad.quaternion.clone(),
                pointer: peerConnection.rig.inputs.rightGamepad.pointer,
                grip: peerConnection.rig.inputs.rightGamepad.grip,
              },
            ],
          };
          peerConnection.rig.targets = {
            hmd: {
              position: new THREE.Vector3(),
              rotation: new THREE.Quaternion(),
              scaleFactor: 1,
            },
            gamepads: [
              {
                position: new THREE.Vector3(),
                rotation: new THREE.Quaternion(),
                pointer: 0,
                grip: 0,
              },
              {
                position: new THREE.Vector3(),
                rotation: new THREE.Quaternion(),
                pointer: 0,
                grip: 0,
              },
            ],
            timestamp: Date.now(),
          };
          const heightFactor = _getHeightFactor(peerConnection.rig.height);
          peerConnection.rig.update = (_update => function update() {
            const now = Date.now();
            const {timestamp} = peerConnection.rig.targets;
            const lerpFactor = Math.min(Math.max((now - timestamp) / (peerPoseUpdateRate*2), 0), 1);

            peerConnection.rig.inputs.hmd.quaternion.copy(peerConnection.rig.starts.hmd.rotation).slerp(peerConnection.rig.targets.hmd.rotation, lerpFactor);
            peerConnection.rig.inputs.hmd.position.copy(peerConnection.rig.starts.hmd.position).lerp(
              localVector.copy(peerConnection.rig.targets.hmd.position).multiplyScalar(heightFactor),
              lerpFactor
            );
            peerConnection.rig.inputs.hmd.scaleFactor = peerConnection.rig.starts.hmd.scaleFactor * (1-lerpFactor) + peerConnection.rig.targets.hmd.scaleFactor * lerpFactor;

            peerConnection.rig.inputs.leftGamepad.position.copy(peerConnection.rig.starts.gamepads[0].position).lerp(
              localVector.copy(peerConnection.rig.targets.gamepads[0].position).multiplyScalar(heightFactor),
              lerpFactor
            );
            peerConnection.rig.inputs.leftGamepad.quaternion.copy(peerConnection.rig.starts.gamepads[0].rotation).slerp(peerConnection.rig.targets.gamepads[0].rotation, lerpFactor);
            peerConnection.rig.inputs.leftGamepad.pointer = peerConnection.rig.starts.gamepads[0].pointer * (1-lerpFactor) + peerConnection.rig.targets.gamepads[0].pointer * lerpFactor;
            peerConnection.rig.inputs.leftGamepad.grip = peerConnection.rig.starts.gamepads[0].grip * (1-lerpFactor) + peerConnection.rig.targets.gamepads[0].grip * lerpFactor;

            peerConnection.rig.inputs.rightGamepad.position.copy(peerConnection.rig.starts.gamepads[1].position).lerp(
              localVector.copy(peerConnection.rig.targets.gamepads[1].position).multiplyScalar(heightFactor),
              lerpFactor
            );
            peerConnection.rig.inputs.rightGamepad.quaternion.copy(peerConnection.rig.starts.gamepads[1].rotation).slerp(peerConnection.rig.targets.gamepads[1].rotation, lerpFactor);
            peerConnection.rig.inputs.rightGamepad.pointer = peerConnection.rig.starts.gamepads[1].pointer * (1-lerpFactor) + peerConnection.rig.targets.gamepads[1].pointer * lerpFactor;
            peerConnection.rig.inputs.rightGamepad.grip = peerConnection.rig.starts.gamepads[1].grip * (1-lerpFactor) + peerConnection.rig.targets.gamepads[1].grip * lerpFactor;

            _update.apply(this, arguments);
          })(peerConnection.rig.update);
        } else {
          console.warn('invalid method', {method});
        }
      });
    });

    connectButton.style.display = 'none';
  } else {
    console.warn(`invalid user/channel: ${channelInputValue}`);
  }
});

(async () => {
  let result;
  if (navigator.xr) {
    try {
      await navigator.xr.supportsSession('immersive-vr');
      result = true;
    } catch (err) {
      console.warn(err);
      result = false;
    }
  } else {
    result = false;
  }
  if (result) {
    console.log('xr available');
    enterXrButton.style.display = null;
  } else {
    console.log('no xr');
    noXrButton.style.display = null;
  }

  /* const microphonePermission = await navigator.permissions.query({
    name: 'microphone',
  });
  if (microphonePermission.state === 'granted') {
    microphoneMediaStream  = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    disableMicButton.style.display = null;
  } else {
    enableMicButton.style.display = null;
  } */
  enableMicButton.style.display = null;

  const {href} = aAvatars[1];
  const model = await _loadModelUrl(href);
  _setLocalModel(model);
  modelUrl = href;
  _sendAllPeerConnections(JSON.stringify({
    method: 'model',
    url: modelUrl,
  }));
})();

let loginToken = null;
const loginUrl = 'https://login.exokit.org/';
async function doLogin(email, code) {
  const res = await fetch(`${loginUrl}?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`, {
    method: 'POST',
  });
  if (res.status >= 200 && res.status < 300) {
    const newLoginToken = await res.json();

    await storage.set('loginToken', newLoginToken);

    loginToken = newLoginToken;

    // loginNameStatic.innerText = loginToken.name;
    // loginEmailStatic.innerText = loginToken.email;

    document.body.classList.add('logged-in');
    loginForm.classList.remove('phase-1');
    loginForm.classList.remove('phase-2');
    loginForm.classList.add('phase-3');

    return true;
  } else {
    return false;
  }
}
const storage = {
  async get(k) {
    const s = localStorage.getItem(k);
    if (typeof s === 'string') {
      return JSON.parse(s);
    } else {
      return undefined;
    }
  },
  async set(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  },
  async remove(k) {
    localStorage.removeItem(k);
  },
};

// const loginButton = document.getElementById('login-button');
// const loginButton2 = document.getElementById('login-button-2');
// const loginPopdown = document.getElementById('login-popdown');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginNameStatic = document.getElementById('login-name-static');
const loginEmailStatic = document.getElementById('login-email-static');
const statusNotConnected = document.getElementById('status-not-connected');
const statusConnected = document.getElementById('status-connected');
const loginVerificationCode = document.getElementById('login-verification-code');
const loginNotice = document.getElementById('login-notice');
const loginError = document.getElementById('login-error');
const logoutButton = document.getElementById('logout-button');
loginForm.onsubmit = async e => {
  e.preventDefault();

  if (loginForm.classList.contains('phase-1') && loginEmail.value) {
    loginNotice.innerHTML = '';
    loginError.innerHTML = '';
    loginForm.classList.remove('phase-1');

    const res = await fetch(`${loginUrl}?email=${encodeURIComponent(loginEmail.value)}`, {
      method: 'POST',
    })
    if (res.status >= 200 && res.status < 300) {
      loginNotice.innerText = `Code sent to ${loginEmail.value}!`;
      loginForm.classList.add('phase-2');

      return res.blob();
    } else if (res.status === 403) {
      loginError.innerText = `${loginEmail.value} is not in the beta yet :(`;

      loginForm.classList.add('phase-1');
    } else {
      throw new Error(`invalid status code: ${res.status}`);
    }
  } else if (loginForm.classList.contains('phase-2') && loginEmail.value && loginVerificationCode.value) {
    loginNotice.innerHTML = '';
    loginError.innerHTML = '';
    loginForm.classList.remove('phase-2');

    await doLogin(loginEmail.value, loginVerificationCode.value);
  } else if (loginForm.classList.contains('phase-3')) {
    await storage.remove('loginToken');

    window.location.reload();

    /* loginToken = null;
    xrEngine.postMessage({
      method: 'login',
      loginToken,
    });

    loginNotice.innerHTML = '';
    loginError.innerHTML = '';
    document.body.classList.remove('logged-in');
    loginForm.classList.remove('phase-3');
    loginForm.classList.add('phase-1'); */
  }
};

const exportModelButton = document.getElementById('export-model-button');
exportModelButton.addEventListener('click', async () => {
  const ab = await model.export();
  const b = new Blob([ab], {type: 'model/gltf-binary'});
  const u = URL.createObjectURL(b);

  const a = document.createElement('a');
  a.download = 'model.glb';
  a.href = u;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(u);
});

const scaleDownButton = document.getElementById('scale-down-button');
scaleDownButton.addEventListener('click', () => {
  const scaleFactor = 1.25;

  const orbitControlsTarget = localVector.copy(orbitControls.target);
  container.matrix
    .multiply(localMatrix.makeTranslation(orbitControlsTarget.x, orbitControlsTarget.y, orbitControlsTarget.z))
    .multiply(localMatrix.makeScale(scaleFactor, scaleFactor, scaleFactor))
    .multiply(localMatrix.makeTranslation(-orbitControlsTarget.x, -orbitControlsTarget.y, -orbitControlsTarget.z))
    .decompose(container.position, container.quaternion, container.scale);

  if (rig) {
    rig.inputs.hmd.scaleFactor /= scaleFactor;
  }
});
const scaleUpButton = document.getElementById('scale-up-button');
scaleUpButton.addEventListener('click', () => {
  const scaleFactor = 1/1.25;

  const orbitControlsTarget = localVector.copy(orbitControls.target);
  container.matrix
    .multiply(localMatrix.makeTranslation(orbitControlsTarget.x, orbitControlsTarget.y, orbitControlsTarget.z))
    .multiply(localMatrix.makeScale(scaleFactor, scaleFactor, scaleFactor))
    .multiply(localMatrix.makeTranslation(-orbitControlsTarget.x, -orbitControlsTarget.y, -orbitControlsTarget.z))
    .decompose(container.position, container.quaternion, container.scale);

  if (rig) {
    rig.inputs.hmd.scaleFactor /= scaleFactor;
  }
});

(async () => {
  const localLoginToken = await storage.get('loginToken');
  if (localLoginToken) {
    const res = await fetch(`${loginUrl}?email=${encodeURIComponent(localLoginToken.email)}&token=${encodeURIComponent(localLoginToken.token)}`, {
      method: 'POST',
    })
    if (res.status >= 200 && res.status < 300) {
      loginToken = await res.json();

      await storage.set('loginToken', loginToken);

      // loginNameStatic.innerText = loginToken.name;
      // loginEmailStatic.innerText = loginToken.email;

      document.body.classList.add('logged-in');
      loginForm.classList.remove('phase-1');
      loginForm.classList.remove('phase-2');
      loginForm.classList.add('phase-3');
    } else {
      await storage.remove('loginToken');

      console.warn(`invalid status code: ${res.status}`);
    }
  }
})();

window.addEventListener('resize', e => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});