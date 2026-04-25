import { type SVGProps } from "react"
import { useThemeStore } from "../stores/themeStore"

interface GISPulseLogoProps extends SVGProps<SVGSVGElement> {
  /** Show orbiting electrons and pulse animation */
  animated?: boolean
  /** Size shorthand — sets both width and height */
  size?: number | string
}

const ELECTRON_COLORS = {
  light: { blue: "#0D47A1", red: "#B71C1C", orange: "#F57F17", green: "#4CAF50" },
  dark:  { blue: "#42A5F5", red: "#EF5350", orange: "#FFB300", green: "#66BB6A" },
} as const

/**
 * GISPulse network-topology logo.
 * Animated version shows orbiting electrons + pulsing center.
 * Static version is a clean icon suitable for navbars.
 * Adapts electron colors and filter to light/dark theme.
 */
export function GISPulseLogo({ animated = false, size, ...props }: GISPulseLogoProps) {
  const sizeProps = size ? { width: size, height: size } : {}
  const isDark = useThemeStore((s) => s.resolvedTheme) === "dark"
  const c = isDark ? ELECTRON_COLORS.dark : ELECTRON_COLORS.light

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      {...sizeProps}
      {...props}
    >
      <defs>
        {isDark ? (
          <filter id="gp-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        ) : (
          <filter id="gp-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" />
            <feOffset dx="0.5" dy="0.5" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Pulse waves from center */}
      {animated && (
        <>
          <circle cx="60" cy="60" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0">
            <animate attributeName="r" values="8;20;8" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="60" r="8" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0">
            <animate attributeName="r" values="8;25;8" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="60" r="8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0">
            <animate attributeName="r" values="8;30;8" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Connection lines — center to corners */}
      <path d="M60,60 L30,30" stroke="currentColor" strokeWidth="0.6" opacity="0.35" fill="none" />
      <path d="M60,60 L90,30" stroke="currentColor" strokeWidth="0.6" opacity="0.35" fill="none" />
      <path d="M60,60 L30,90" stroke="currentColor" strokeWidth="0.6" opacity="0.35" fill="none" />
      <path d="M60,60 L90,90" stroke="currentColor" strokeWidth="0.6" opacity="0.35" fill="none" />

      {/* Dashed edge connections */}
      <path d="M30,30 L90,30" stroke="currentColor" strokeWidth="1" opacity="0.2" fill="none" strokeDasharray="2,2" />
      <path d="M30,90 L90,90" stroke="currentColor" strokeWidth="1" opacity="0.2" fill="none" strokeDasharray="2,2" />
      <path d="M30,30 L30,90" stroke="currentColor" strokeWidth="1" opacity="0.2" fill="none" strokeDasharray="2,2" />
      <path d="M90,30 L90,90" stroke="currentColor" strokeWidth="1" opacity="0.2" fill="none" strokeDasharray="2,2" />

      {/* Center node */}
      <circle cx="60" cy="60" r="4" fill="currentColor" filter="url(#gp-shadow)">
        {animated && (
          <animate attributeName="r" values="4;4.5;4" dur="3s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Corner nodes */}
      <circle cx="30" cy="30" r="2.5" fill="currentColor" opacity="0.7" filter="url(#gp-shadow)" />
      <circle cx="90" cy="30" r="2.5" fill="currentColor" opacity="0.7" filter="url(#gp-shadow)" />
      <circle cx="30" cy="90" r="2.5" fill="currentColor" opacity="0.7" filter="url(#gp-shadow)" />
      <circle cx="90" cy="90" r="2.5" fill="currentColor" opacity="0.7" filter="url(#gp-shadow)" />

      {/* Orbiting electrons */}
      {animated ? (
        <>
          {/* Blue electron — horizontal orbit */}
          <circle r="3" fill={c.blue} filter="url(#gp-shadow)">
            <animateMotion path="M60,60 m-35,0 a35,35 0 1,0 70,0 a35,35 0 1,0 -70,0z" dur="15s" repeatCount="indefinite" />
          </circle>
          {/* Red electron — vertical orbit */}
          <circle r="3" fill={c.red} filter="url(#gp-shadow)">
            <animateMotion path="M60,60 m0,-35 a35,35 0 1,0 0,70 a35,35 0 1,0 0,-70z" dur="13s" repeatCount="indefinite" />
          </circle>
          {/* Orange electron — diagonal orbit */}
          <circle r="3" fill={c.orange} filter="url(#gp-shadow)">
            <animateMotion path="M60,60 m-25,-25 a35.36,35.36 0 1,0 50,50 a35.36,35.36 0 1,0 -50,-50z" dur="17s" repeatCount="indefinite" />
          </circle>
          {/* Green electron — reverse diagonal orbit */}
          <circle r="3" fill={c.green} filter="url(#gp-shadow)">
            <animateMotion path="M60,60 m25,-25 a35.36,35.36 0 1,1 -50,50 a35.36,35.36 0 1,1 50,-50z" dur="19s" repeatCount="indefinite" />
          </circle>

          {/* Mini electrons traveling on connection paths */}
          <circle r="1" fill={c.blue} opacity="0">
            <animateMotion path="M30,30 L90,30" dur="8s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
            <animate attributeName="opacity" values="0;0.8;0" dur="8s" repeatCount="indefinite" />
          </circle>
          <circle r="1" fill={c.red} opacity="0">
            <animateMotion path="M30,30 L30,90" dur="8s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
            <animate attributeName="opacity" values="0;0.8;0" dur="8s" repeatCount="indefinite" />
          </circle>
          <circle r="1" fill={c.orange} opacity="0">
            <animateMotion path="M30,30 L90,90" dur="9s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
            <animate attributeName="opacity" values="0;0.8;0" dur="9s" repeatCount="indefinite" />
          </circle>
          <circle r="1" fill={c.green} opacity="0">
            <animateMotion path="M30,90 L90,90" dur="7.5s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
            <animate attributeName="opacity" values="0;0.8;0" dur="7.5s" repeatCount="indefinite" />
          </circle>
        </>
      ) : (
        <>
          {/* Static electrons at fixed positions */}
          <circle cx="25" cy="60" r="3" fill={c.blue} filter="url(#gp-shadow)" />
          <circle cx="75" cy="40" r="3" fill={c.red} filter="url(#gp-shadow)" />
          <circle cx="45" cy="85" r="3" fill={c.orange} filter="url(#gp-shadow)" />
          <circle cx="85" cy="75" r="3" fill={c.green} filter="url(#gp-shadow)" />
        </>
      )}
    </svg>
  )
}
