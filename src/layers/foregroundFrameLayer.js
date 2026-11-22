import * as THREE from 'three';

export function createForegroundFrameLayer(assets, tenementWin) {
  const group = new THREE.Group();
  group.name = 'ForegroundFrame';

  // Close looming dark weathered brick party wall (real Poly Haven dark_brick_wall PBR!)
  const leftWallMat = new THREE.MeshStandardMaterial({
    map: assets.brickDark.map.clone(),
    normalMap: assets.brickDark.normalMap.clone(),
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: assets.brickDark.roughnessMap.clone(),
    roughness: 0.94,
    metalness: 0.04,
    color: new THREE.Color(0x6e625e)
  });
  leftWallMat.map.repeat.set(3.5, 9.5);
  leftWallMat.normalMap.repeat.set(3.5, 9.5);
  leftWallMat.roughnessMap.repeat.set(3.5, 9.5);
  leftWallMat.map.needsUpdate = true;

  const rightBrickMat = new THREE.MeshStandardMaterial({
    map: assets.brickRed.map.clone(),
    normalMap: assets.brickRed.normalMap.clone(),
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: assets.brickRed.roughnessMap.clone(),
    roughness: 0.92,
    metalness: 0.04,
    color: new THREE.Color(0xa67866)
  });
  rightBrickMat.map.repeat.set(3, 4);
  rightBrickMat.normalMap.repeat.set(3, 4);
  rightBrickMat.roughnessMap.repeat.set(3, 4);
  rightBrickMat.map.needsUpdate = true;

  const corniceMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.78, metalness: 0.18 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4c423d, roughness: 0.88 });

  // 1. Massive looming left dark brick rooftop edge (frames leftmost ~10% top-to-bottom like reference photo!)
  const leftLoom = new THREE.Mesh(new THREE.BoxGeometry(7.2, 42, 7.6), leftWallMat);
  leftLoom.position.set(-13.8, 21, -7.2);
  group.add(leftLoom);

  // 2. Lower-left close foreground brick tenement corner with warm glowing recessed windows
  const leftCorner = new THREE.Mesh(new THREE.BoxGeometry(6.6, 13.6, 7.8), rightBrickMat);
  leftCorner.position.set(-11.4, 6.8, -12.6);
  group.add(leftCorner);

  const leftCornice = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.85, 8.2), corniceMat);
  leftCornice.position.set(-11.1, 13.9, -12.6);
  group.add(leftCornice);

  // 3. Lower-right close dark tenement brick corner + heavy overhanging dark cornice
  const rightCorner = new THREE.Mesh(new THREE.BoxGeometry(6.8, 14.0, 8.0), rightBrickMat);
  rightCorner.position.set(11.4, 7.0, -11.4);
  group.add(rightCorner);

  const rightCornice = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.05, 8.4), corniceMat);
  rightCornice.position.set(10.8, 14.4, -11.4);
  group.add(rightCornice);

  // 4. Tall far-right framing apartment edge peeking in at right border
  const rightTower = new THREE.Mesh(new THREE.BoxGeometry(7.8, 32, 9.4), leftWallMat);
  rightTower.position.set(19.2, 16, -11.2);
  group.add(rightTower);

  // 5. Recessed 3D interior-mapped windows on the close left & right foreground corners
  const fgWindows = [];
  for (const fy of [5.4, 8.6, 11.6]) {
    for (const wz of [-10.0, -12.4, -14.8]) {
      fgWindows.push({ x: -8.02, y: fy, z: wz, rotY: Math.PI / 2, seed: (fy * 0.13 + Math.abs(wz) * 0.27) % 1 });
    }
    for (const wz of [-8.8, -11.2, -13.6]) {
      fgWindows.push({ x: 7.92, y: fy, z: wz, rotY: -Math.PI / 2, seed: (fy * 0.21 + Math.abs(wz) * 0.19) % 1 });
    }
  }

  const paneGeom = new THREE.PlaneGeometry(1.02, 1.85);
  const seeds = new Float32Array(fgWindows.length);
  const winIm = new THREE.InstancedMesh(paneGeom, tenementWin.mat, fgWindows.length);
  const lintelIm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.22, 1.32), stoneMat, fgWindows.length);
  const dummy = new THREE.Object3D();

  fgWindows.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z);
    dummy.rotation.set(0, w.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    winIm.setMatrixAt(i, dummy.matrix);
    seeds[i] = w.seed;

    dummy.position.set(w.x, w.y + 1.04, w.z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    lintelIm.setMatrixAt(i, dummy.matrix);
  });
  winIm.instanceMatrix.needsUpdate = true;
  lintelIm.instanceMatrix.needsUpdate = true;
  paneGeom.setAttribute('aWinSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  group.add(winIm, lintelIm);

  return { group };
}
