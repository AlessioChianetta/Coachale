import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ParticleField3DProps {
  audioLevel: number;
  isActive: boolean;
  color: 'red' | 'blue';
}

export default function ParticleField3D({ audioLevel, isActive, color }: ParticleField3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const originalPositionsRef = useRef<Float32Array | null>(null);
  const particleSizesRef = useRef<Float32Array | null>(null);
  
  // Use refs to track props without causing effect re-runs
  const isActiveRef = useRef(isActive);
  const colorRef = useRef(color);
  const audioLevelRef = useRef(audioLevel);
  
  // Smooth interpolation refs
  const currentScaleRef = useRef(1);
  const currentOpacityRef = useRef(0.6);
  
  // Update refs when props change
  useEffect(() => {
    isActiveRef.current = isActive;
    colorRef.current = color;
    audioLevelRef.current = audioLevel;
  }, [isActive, color, audioLevel]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create particles - più particelle per effetto più denso
    const particleCount = 800;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const baseColor = color === 'blue' 
      ? new THREE.Color(0x3b82f6) 
      : new THREE.Color(0xef4444);

    // Position particles randomly in a 10x10x10 cube
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Random position in cube from -5 to 5 on each axis
      positions[i3] = (Math.random() - 0.5) * 10;
      positions[i3 + 1] = (Math.random() - 0.5) * 10;
      positions[i3 + 2] = (Math.random() - 0.5) * 10;

      // Set color with more variation and brightness
      const colorVariation = 0.7 + Math.random() * 0.3;
      const brightness = 1.2; // Aumento luminosità
      colors[i3] = baseColor.r * colorVariation * brightness;
      colors[i3 + 1] = baseColor.g * colorVariation * brightness;
      colors[i3 + 2] = baseColor.b * colorVariation * brightness;
      
      // Dimensioni variabili come stelle - molto piccole e casuali
      const starSize = 0.01 + Math.random() * 0.025; // Range: 0.01-0.035 (molto piccole)
      sizes[i] = starSize;
    }

    // Store original positions for wave animation
    originalPositionsRef.current = new Float32Array(positions);
    particleSizesRef.current = sizes;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometryRef.current = geometry;

    // Create material - stelle di sfondo
    const material = new THREE.PointsMaterial({
      size: 0.02, // Dimensioni stelle base
      vertexColors: true,
      transparent: true,
      opacity: 0.6, // Più trasparenti
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    });
    materialRef.current = material;

    // Create points mesh
    const particles = new THREE.Points(geometry, material);
    particlesRef.current = particles;
    scene.add(particles);

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      // Always schedule next frame FIRST to keep loop running
      animationFrameRef.current = requestAnimationFrame(animate);

      // Read latest refs each frame (don't rely on closure)
      const particles = particlesRef.current;
      const geometry = geometryRef.current;
      const material = materialRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;

      // Skip frame if refs aren't ready yet (but loop continues)
      if (!particles || !geometry || !material || !renderer || !scene || !camera) {
        return;
      }

      const currentAudioLevel = audioLevelRef.current;
      const currentIsActive = isActiveRef.current;

      // Rotazione molto lenta delle stelle di sfondo (effetto cielo)
      particles.rotation.y += 0.0002;
      
      // Leggero effetto twinkle (tremolìo) sull'opacità
      timeRef.current += 0.005;
      const twinkle = Math.sin(timeRef.current) * 0.1;
      material.opacity = 0.5 + twinkle;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (geometryRef.current) {
        geometryRef.current.dispose();
      }

      if (materialRef.current) {
        materialRef.current.dispose();
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      particlesRef.current = null;
      geometryRef.current = null;
      materialRef.current = null;
    };
  }, []); // Only run once on mount

  // Update particle colors when color prop changes
  useEffect(() => {
    if (!geometryRef.current) return;

    const baseColor = color === 'blue'
      ? new THREE.Color(0x3b82f6)
      : new THREE.Color(0xef4444);

    const colors = geometryRef.current.attributes.color.array as Float32Array;
    const particleCount = colors.length / 3;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const colorVariation = 0.8 + Math.random() * 0.2;
      colors[i3] = baseColor.r * colorVariation;
      colors[i3 + 1] = baseColor.g * colorVariation;
      colors[i3 + 2] = baseColor.b * colorVariation;
    }

    geometryRef.current.attributes.color.needsUpdate = true;
  }, [color]);

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ pointerEvents: 'none' }}
    />
  );
}
