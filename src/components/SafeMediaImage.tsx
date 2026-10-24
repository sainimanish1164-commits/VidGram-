import React, { useState } from 'react';
import { Camera } from 'lucide-react';

interface SafeMediaImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const SafeMediaImage: React.FC<SafeMediaImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    const initials = (fallbackLabel || alt || 'VG')
      .replace(/^@/, '')
      .slice(0, 2)
      .toUpperCase();
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-rose-950 text-slate-200 select-none ${className}`}
      >
        {initials ? (
          <span className="font-display font-bold tracking-tight text-sm">{initials}</span>
        ) : (
          <Camera className="w-5 h-5 text-rose-400" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={className}
    />
  );
};
