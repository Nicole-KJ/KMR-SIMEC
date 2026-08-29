export function SkeletonBlock({ width = '100%', height = 16, style, className = '' }) {
  return <div className={`skeleton-block ${className}`} style={{ width, height, ...style }} />
}
