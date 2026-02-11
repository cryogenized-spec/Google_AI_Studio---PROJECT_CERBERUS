import React from 'react';

interface PortraitProps {
  url: string;
  scale: number;
  aspectRatio?: '4/5' | '9/16' | '1/1';
}

const Portrait: React.FC<PortraitProps> = ({ url, scale, aspectRatio = '4/5' }) => {
  // Mobile: w-12 (48px) - small, subtle presence
  // Desktop: w-40 (160px) - larger, detailed view
  
  let cssAspectRatio = '4/5';
  if (aspectRatio === '9/16') cssAspectRatio = '9/16';
  if (aspectRatio === '1/1') cssAspectRatio = '1/1';
  
  return (
    <div 
      className="relative rounded-sm overflow-hidden border border-cerberus-800 shadow-[0_0_15px_rgba(212,175,55,0.1)] group w-14 md:w-40 transition-all duration-300"
      style={{ 
        aspectRatio: cssAspectRatio,
        transform: `scale(${scale})`,
        transformOrigin: 'top right' 
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-cerberus-void/80 to-transparent z-10" />
      <img 
        src={url} 
        alt="Ysaraith" 
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
    </div>
  );
};

export default Portrait;