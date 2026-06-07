"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";

export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = theme === "system" ? systemTheme : theme;
  const logoSrc = currentTheme === "dark" ? "/logos/Dark.svg" : "/logos/Light.svg";

  if (!mounted) {
    return (
      <div
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`shrink-0 ${className}`}
      />
    );
  }

  return (
    <Image
      src={logoSrc}
      alt="DARSI Logo"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      priority
      unoptimized={process.env.NODE_ENV === "development"}
    />
  );
}
