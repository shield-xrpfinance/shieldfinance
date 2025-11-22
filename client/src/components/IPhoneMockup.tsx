interface IPhoneMockupProps {
  screenshot: string;
  alt?: string;
  className?: string;
}

export function IPhoneMockup({ screenshot, alt = "Mobile app screenshot", className = "" }: IPhoneMockupProps) {
  return (
    <div className={`relative mx-auto ${className}`} style={{ width: '300px', height: '612px' }}>
      {/* iPhone Frame */}
      <div className="relative w-full h-full bg-[#1f1f1f] rounded-[3rem] p-3 shadow-2xl">
        {/* Screen Bezel */}
        <div className="relative w-full h-full bg-black rounded-[2.5rem] overflow-hidden">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-black rounded-b-3xl z-20" />
          
          {/* Screenshot */}
          <img 
            src={screenshot} 
            alt={alt}
            className="w-full h-full object-cover object-top"
            data-testid="img-iphone-screenshot"
          />
        </div>
      </div>
      
      {/* Side Buttons */}
      <div className="absolute -left-1 top-24 w-1 h-8 bg-[#1f1f1f] rounded-l-sm" />
      <div className="absolute -left-1 top-36 w-1 h-12 bg-[#1f1f1f] rounded-l-sm" />
      <div className="absolute -left-1 top-52 w-1 h-12 bg-[#1f1f1f] rounded-l-sm" />
      <div className="absolute -right-1 top-28 w-1 h-16 bg-[#1f1f1f] rounded-r-sm" />
    </div>
  );
}
