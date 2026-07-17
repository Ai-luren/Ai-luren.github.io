/* eslint-disable react/no-unknown-property */
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { useGLTF, useTexture, Environment, Lightformer } from '@react-three/drei';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';

import cardGLB from './card.glb';
import lanyard from '../../assets/badge/lanyard.jpg';

import * as THREE from 'three';
import './Lanyard.css';

extend({ MeshLineGeometry, MeshLineMaterial });

// 1x1 transparent pixel — lets useTexture be called unconditionally when a
// front/back image isn't supplied.
const BLANK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const FRONT_UV_RECT = { x: 0, y: 0, w: 0.5, h: 0.755 };
const BACK_UV_RECT = { x: 0.5, y: 0, w: 0.5, h: 0.757 };

useGLTF.preload(cardGLB);

export default function Lanyard({
  position = [0, 0, 30],
  anchor = [0, 0, 0],
  fov = 20,
  transparent = true,
  frontImage = null,
  backImage = null,
  imageFit = 'cover',
  lanyardImage = null,
  lanyardWidth = 1,
  onFirstFrame = null,
  onContextLost = null
}) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const contextHandlers = useRef(null);

  const handleCreated = useCallback(({ gl }) => {
    gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1);
    const canvas = gl.domElement;
    const previousHandlers = contextHandlers.current;
    previousHandlers?.canvas.removeEventListener('webglcontextlost', previousHandlers.handleContextLost, false);
    const handleContextLost = event => {
      event.preventDefault();
      onContextLost?.();
    };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    contextHandlers.current = { canvas, handleContextLost };
  }, [onContextLost, transparent]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => () => {
    const handlers = contextHandlers.current;
    handlers?.canvas.removeEventListener('webglcontextlost', handlers.handleContextLost, false);
    contextHandlers.current = null;
  }, []);

  return (
    <div className="lanyard-wrapper">
      <Canvas
        camera={{ position: position, fov: fov }}
        dpr={1}
        gl={{ alpha: transparent, antialias: false }}
        onCreated={handleCreated}
      >
        <ambientLight intensity={Math.PI} />
        <Band
          isMobile={isMobile}
          anchor={anchor}
          frontImage={frontImage}
          backImage={backImage}
          imageFit={imageFit}
          lanyardImage={lanyardImage}
          lanyardWidth={lanyardWidth}
        />
        <ReadyMarker onReady={onFirstFrame} />
        <Environment blur={0.75}>
          <Lightformer
            intensity={2}
            color="white"
            position={[0, -1, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[-1, -1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[1, 1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={10}
            color="white"
            position={[-10, 0, 14]}
            rotation={[0, Math.PI / 2, Math.PI / 3]}
            scale={[100, 10, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
}

function ReadyMarker({ onReady }) {
  const hasReported = useRef(false);
  useFrame(() => {
    if (hasReported.current) return;
    hasReported.current = true;
    onReady?.();
  });
  return null;
}

function Band({
  isMobile = false,
  anchor = [0, 0, 0],
  frontImage = null,
  backImage = null,
  imageFit = 'cover',
  lanyardImage = null,
  lanyardWidth = 1
}) {
  const band = useRef();
  const cardGroup = useRef();
  const cardPosition = useRef(new THREE.Vector3(0, 0, 0));
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0));
  const dragOffset = useRef(new THREE.Vector3());
  const vec = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const anchorPoint = useMemo(() => new THREE.Vector3(...anchor), [anchor]);
  const defaultCardPosition = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const { nodes, materials } = useGLTF(cardGLB);
  const texture = useTexture(lanyardImage || lanyard);
  const frontTex = useTexture(frontImage || BLANK_PIXEL);
  const backTex = useTexture(backImage || BLANK_PIXEL);
  const cardMap = useMemo(() => {
    const baseMap = materials.base.map;
    if (!frontImage && !backImage) return baseMap;

    const baseImage = baseMap.image;
    const canvas = document.createElement('canvas');
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    const context = canvas.getContext('2d');
    if (!context) return baseMap;
    context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

    const drawFitted = (image, rect) => {
      const x = rect.x * canvas.width;
      const y = rect.y * canvas.height;
      const width = rect.w * canvas.width;
      const height = rect.h * canvas.height;
      const scale = (imageFit === 'contain' ? Math.min : Math.max)(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      context.save();
      context.beginPath();
      context.rect(x, y, width, height);
      context.clip();
      // 模型自带图集在正反卡面区域是白色；当使用 contain 保留用户图片比例
      // 时会露出原始底图。先用卡面的近黑底覆盖，既不裁图也不会出现白边。
      context.fillStyle = '#090b0f';
      context.fillRect(x, y, width, height);
      context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
      context.restore();
    };

    if (frontImage && frontTex.image) drawFitted(frontTex.image, FRONT_UV_RECT);
    if (backImage && backTex.image) drawFitted(backTex.image, BACK_UV_RECT);

    const composite = new THREE.CanvasTexture(canvas);
    composite.colorSpace = THREE.SRGBColorSpace;
    composite.flipY = baseMap.flipY;
    composite.anisotropy = 16;
    composite.needsUpdate = true;
    return composite;
  }, [backImage, backTex, frontImage, frontTex, imageFit, materials.base.map]);

  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
  );
  const [dragged, drag] = useState(false);
  const [hovered, hover] = useState(false);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => void (document.body.style.cursor = 'auto');
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      // 将指针投影到工牌所在的 z=0 平面，拖拽只改变卡片位置，不触发自由落体。
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      const distanceToCardPlane = -state.camera.position.z / dir.z;
      vec.copy(state.camera.position).add(dir.multiplyScalar(distanceToCardPlane));
      const cameraDistance = Math.abs(state.camera.position.z);
      const viewHeight = 2 * cameraDistance * Math.tan(THREE.MathUtils.degToRad(state.camera.fov / 2));
      const viewWidth = viewHeight * (state.size.width / state.size.height);
      const limitX = Math.max(0.25, viewWidth / 2 - 0.9);
      const limitY = Math.max(0.25, viewHeight / 2 - 1.4);
      targetPosition.current.set(
        THREE.MathUtils.clamp(vec.x - dragOffset.current.x, -limitX, limitX),
        THREE.MathUtils.clamp(vec.y - dragOffset.current.y, -limitY, limitY),
        0
      );
    } else {
      targetPosition.current.copy(defaultCardPosition);
    }
    cardPosition.current.lerp(targetPosition.current, 1 - Math.exp(-delta * (dragged ? 18 : 8)));
    cardGroup.current?.position.copy(cardPosition.current);
    const cardAttach = vec.set(0, 1.25, 0).add(cardPosition.current);
    curve.points[0].copy(cardAttach);
    curve.points[1].lerpVectors(cardAttach, anchorPoint, 0.34);
    curve.points[2].lerpVectors(cardAttach, anchorPoint, 0.68);
    curve.points[3].copy(anchorPoint);
    band.current?.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));
  });

  curve.curveType = 'chordal';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group ref={cardGroup} position={cardPosition.current}>
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={e => {
              e.stopPropagation();
              e.target.releasePointerCapture(e.pointerId);
              drag(false);
            }}
            onPointerDown={e => {
              e.stopPropagation();
              e.target.setPointerCapture(e.pointerId);
              dragOffset.current.copy(e.point).sub(cardPosition.current);
              drag(true);
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                map={cardMap}
                map-anisotropy={16}
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.15}
                roughness={0.9}
                metalness={0.8}
              />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          useMap
          map={texture}
          repeat={[-4, 1]}
          lineWidth={lanyardWidth}
        />
      </mesh>
    </>
  );
}
