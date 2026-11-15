import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DottedWaveBackgroundProps {
  intensity?: 'subtle' | 'minimal' | 'none';
  className?: string;
}

export const DottedWaveBackground: React.FC<DottedWaveBackgroundProps> = ({
  intensity = 'subtle',
  className,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    if (intensity === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

    // Grid spacing & visual intensity
    const spacing = intensity === 'minimal' ? 44 : 36;
    const baseRadius = intensity === 'minimal' ? 1.0 : 1.35;

    // Mouse coordinates (for desktop fine pointer)
    let mouseX = -1000;
    let mouseY = -1000;
    let targetMouseX = -1000;
    let targetMouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      targetMouseX = -1000;
      targetMouseY = -1000;
    };

    if (hasFinePointer && !prefersReducedMotion) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      if (prefersReducedMotion) {
        drawStatic();
      }
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Check if dark theme is currently active
    const isDark = () => document.documentElement.classList.contains('dark');

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      const dark = isDark();
      const alpha = dark
        ? intensity === 'minimal'
          ? 0.16
          : 0.28
        : intensity === 'minimal'
          ? 0.15
          : 0.26;
      const colorRgb = dark ? '255, 115, 20' : '220, 85, 0';

      ctx.fillStyle = `rgba(${colorRgb}, ${alpha})`;
      for (let x = spacing / 2; x < width; x += spacing) {
        for (let y = spacing / 2; y < height; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    if (prefersReducedMotion) {
      drawStatic();
      return () => {
        window.removeEventListener('resize', handleResize);
        if (hasFinePointer) {
          window.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseleave', handleMouseLeave);
        }
      };
    }

    let time = 0;

    const render = () => {
      // Pause rendering if tab is in background
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      time += 0.015;

      // Smooth mouse easing
      if (hasFinePointer) {
        mouseX += (targetMouseX - mouseX) * 0.08;
        mouseY += (targetMouseY - mouseY) * 0.08;
      }

      ctx.clearRect(0, 0, width, height);

      const dark = isDark();
      const baseAlpha = dark
        ? intensity === 'minimal'
          ? 0.16
          : 0.28
        : intensity === 'minimal'
          ? 0.15
          : 0.26;
      const colorRgb = dark ? '255, 115, 20' : '220, 85, 0';

      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);

      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const originX = i * spacing;
          const originY = j * spacing;

          // Gentle ambient wave
          const wave =
            Math.sin(originX * 0.005 + time) * 3 + Math.cos(originY * 0.005 + time * 0.7) * 2;

          let posX = originX;
          let posY = originY + wave;
          let pointAlpha = baseAlpha;
          let radius = baseRadius;

          // Subtle desktop mouse parallax
          if (hasFinePointer && mouseX > 0) {
            const dx = posX - mouseX;
            const dy = posY - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 180;

            if (dist < maxDist) {
              const factor = 1 - dist / maxDist;
              posX += (dx / dist) * factor * 6;
              posY += (dy / dist) * factor * 6;
              pointAlpha += factor * 0.22;
              radius += factor * 0.5;
            }
          }

          ctx.fillStyle = `rgba(${colorRgb}, ${pointAlpha})`;
          ctx.beginPath();
          ctx.arc(posX, posY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (hasFinePointer) {
        window.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [intensity]);

  if (intensity === 'none') {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-slot="dotted-wave-background"
      className={cn(
        'fixed inset-0 pointer-events-none -z-10 h-full w-full opacity-100 transition-opacity duration-700',
        className,
      )}
    />
  );
};
