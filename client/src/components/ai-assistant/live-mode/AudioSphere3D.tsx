import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface AudioSphere3DProps {
  audioLevel: number;
  isActive: boolean;
  color: 'red' | 'blue';
}

export default function AudioSphere3D({ audioLevel, isActive, color }: AudioSphere3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const geometryRef = useRef<THREE.IcosahedronGeometry | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const originalVerticesRef = useRef<Float32Array | null>(null);
  
  // Use refs to track props without causing effect re-runs
  const isActiveRef = useRef(isActive);
  const colorRef = useRef(color);
  const audioLevelRef = useRef(audioLevel);
  
  // Smooth interpolation refs
  const currentScaleRef = useRef(1);
  const currentSpikeRef = useRef(0);
  const currentEmissiveRef = useRef(0.2);
  
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

    // Setup lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create icosahedron geometry
    const geometry = new THREE.IcosahedronGeometry(1.5, 2);
    geometryRef.current = geometry;

    // Store original vertex positions for deformation
    originalVerticesRef.current = new Float32Array(geometry.attributes.position.array);

    // Create material
    const baseColor = color === 'blue' ? 0x3b82f6 : 0xef4444;
    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: baseColor,
      emissiveIntensity: 0.2,
      wireframe: true,
      wireframeLinewidth: 2,
    });
    materialRef.current = material;

    // Create mesh
    const sphere = new THREE.Mesh(geometry, material);
    sphereRef.current = sphere;
    scene.add(sphere);

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
      const sphere = sphereRef.current;
      const geometry = geometryRef.current;
      const material = materialRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;

      // Skip frame if refs aren't ready yet (but loop continues)
      if (!sphere || !geometry || !material || !renderer || !scene || !camera) {
        return;
      }

      const currentAudioLevel = audioLevelRef.current;
      const currentIsActive = isActiveRef.current;

      // Always rotate slowly with smooth acceleration
      sphere.rotation.y += 0.008;
      sphere.rotation.x += 0.002;

      // Smooth interpolation (lerp) for scale
      const targetScale = currentIsActive ? 1 + (currentAudioLevel / 255) * 0.5 : 1;
      currentScaleRef.current += (targetScale - currentScaleRef.current) * 0.15;
      sphere.scale.set(currentScaleRef.current, currentScaleRef.current, currentScaleRef.current);

      // Smooth interpolation for spike amount
      const targetSpike = currentIsActive ? (currentAudioLevel / 255) * 0.3 : 0;
      currentSpikeRef.current += (targetSpike - currentSpikeRef.current) * 0.12;

      // Deform vertices for "spiky" effect with smooth transitions
      if (originalVerticesRef.current) {
        const positions = geometry.attributes.position.array as Float32Array;
        const originalPositions = originalVerticesRef.current;

        for (let i = 0; i < positions.length; i += 3) {
          const originalX = originalPositions[i];
          const originalY = originalPositions[i + 1];
          const originalZ = originalPositions[i + 2];

          // Calculate vertex direction (normalized)
          const length = Math.sqrt(originalX * originalX + originalY * originalY + originalZ * originalZ);
          const nx = originalX / length;
          const ny = originalY / length;
          const nz = originalZ / length;

          // Apply smooth spike deformation
          positions[i] = originalX + nx * currentSpikeRef.current;
          positions[i + 1] = originalY + ny * currentSpikeRef.current;
          positions[i + 2] = originalZ + nz * currentSpikeRef.current;
        }

        geometry.attributes.position.needsUpdate = true;
      }

      // Smooth interpolation for emissive intensity
      const targetEmissive = currentIsActive ? 0.3 + (currentAudioLevel / 255) * 0.7 : 0.2;
      currentEmissiveRef.current += (targetEmissive - currentEmissiveRef.current) * 0.1;
      material.emissiveIntensity = currentEmissiveRef.current;

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
      sphereRef.current = null;
      geometryRef.current = null;
      materialRef.current = null;
      originalVerticesRef.current = null;
    };
  }, []); // Only run once on mount

  // Update material color when color prop changes
  useEffect(() => {
    if (!materialRef.current) return;

    const baseColor = color === 'blue' ? 0x3b82f6 : 0xef4444;
    materialRef.current.color.setHex(baseColor);
    materialRef.current.emissive.setHex(baseColor);
  }, [color]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden rounded-3xl pointer-events-none">
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full"
        style={{ 
          pointerEvents: 'none',
          filter: isActive ? `drop-shadow(0 0 ${20 + audioLevel / 5}px ${color === 'blue' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(239, 68, 68, 0.6)'})` : 'none',
          transition: 'filter 0.3s ease-out'
        }}
      />
    </div>
  );
}
