interface IPhoneMockupProps {
  screenshot: string;
  alt?: string;
  className?: string;
}

export function IPhoneMockup({ screenshot, alt = "Mobile app screenshot", className = "" }: IPhoneMockupProps) {
  return (
    <div className={`relative mx-auto w-full max-w-[300px] ${className}`} style={{ perspective: '1200px' }}>
      {/* iPhone Frame with aspect ratio and 3D transform */}
      <div 
        className="relative w-full transition-transform duration-300" 
        style={{ 
          aspectRatio: '300/612',
          transform: 'rotateY(-12deg) rotateX(2deg)',
          transformStyle: 'preserve-3d'
        }}
      >
        <div className="relative w-full h-full bg-[#1f1f1f] rounded-[3rem] p-3 shadow-2xl">
          {/* Screen Bezel */}
          <div className="relative w-full h-full bg-black rounded-[2.5rem] overflow-hidden">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-[4.5%] bg-black rounded-b-3xl z-20" />
            
            {/* Screenshot */}
            <img 
              src={screenshot} 
              alt={alt}
              className="w-full h-full object-cover object-top"
              data-testid="img-iphone-screenshot"
            />
          </div>
        </div>
        
        {/* Side Buttons - positioned with percentages */}
        <div className="absolute left-0 top-[15%] w-[3%] h-[5%] bg-[#1f1f1f] rounded-l-sm -translate-x-1/2" />
        <div className="absolute left-0 top-[23%] w-[3%] h-[7.5%] bg-[#1f1f1f] rounded-l-sm -translate-x-1/2" />
        <div className="absolute left-0 top-[33%] w-[3%] h-[7.5%] bg-[#1f1f1f] rounded-l-sm -translate-x-1/2" />
        <div className="absolute right-0 top-[18%] w-[3%] h-[10%] bg-[#1f1f1f] rounded-r-sm translate-x-1/2" />
      </div>
    </div>
  );
}
