import { useEffect, useState } from 'react';
import { getCircuitImageUrl } from '@/utils/circuitImageResolver';

interface CircuitImageProps {
  alt: string;
  circuitId: string;
  className?: string;
}

const TEXT = {
  unavailable: '\u8d5b\u9053\u56fe\u6682\u4e0d\u53ef\u7528',
};

const CircuitImage = ({ alt, circuitId, className }: CircuitImageProps) => {
  const imageUrl = getCircuitImageUrl(circuitId, 'black-outline');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  if (!imageUrl || imageFailed) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 240,
          color: '#8c8c8c',
        }}
      >
        {TEXT.unavailable}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        fetchPriority="high"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    </div>
  );
};

export default CircuitImage;
