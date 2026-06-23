"use client";

import { useEffect, useState } from "react";

export function CursorGlow() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute w-[600px] h-[600px] rounded-full bg-primary/7 blur-[220px] transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate(${position.x - 300}px, ${position.y - 300}px)`,
        }}
      />
    </div>
  );
}
