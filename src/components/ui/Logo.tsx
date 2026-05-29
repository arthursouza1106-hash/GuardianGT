import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Triangle Base */}
      <path 
        d="M50 10L90 85H10L50 10Z" 
        fill="currentColor" 
        fillOpacity="0.1" 
        stroke="currentColor" 
        strokeWidth="4" 
        strokeLinejoin="round"
      />
      
      {/* Steps on the left */}
      <path 
        d="M18 70H30M23 60H35M28 50H40" 
        stroke="currentColor" 
        strokeWidth="3" 
        strokeLinecap="round"
      />

      {/* Eye Structure */}
      <path 
        d="M35 55C35 55 42 45 50 45C58 45 65 55 65 55C65 55 58 65 50 65C42 65 35 55 35 55Z" 
        stroke="currentColor" 
        strokeWidth="3" 
        strokeLinejoin="round"
      />
      
      {/* Pupil */}
      <circle cx="50" cy="55" r="4" fill="currentColor" />
      
      {/* Bottom accent line */}
      <path 
        d="M20 92H80" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        opacity="0.3" 
      />
    </svg>
  );
}
