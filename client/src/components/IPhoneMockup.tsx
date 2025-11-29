interface IPhoneMockupProps {
  screenshot?: string;
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
            
            {/* Screenshot or placeholder */}
            {screenshot ? (
              <img 
                src={screenshot} 
                alt={alt}
                className="w-full h-full object-cover object-top"
                data-testid="img-iphone-screenshot"
              />
            ) : (
              <div 
                className="w-full h-full bg-gradient-to-br from-primary/20 via-background to-primary/10 flex items-center justify-center"
                data-testid="img-iphone-screenshot"
              >
                <div className="text-center p-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-foreground/80">Shield Finance</p>
                  <p className="text-xs text-muted-foreground mt-1">Mobile Portfolio</p>
                </div>
              </div>
            )}
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
