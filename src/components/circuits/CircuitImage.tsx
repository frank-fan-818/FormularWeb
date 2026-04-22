import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { resolveCircuitImageUrl } from '@/utils/circuitImageResolver';

interface CircuitImageProps {
  alt: string;
  circuitId: string;
  className?: string;
}

const TEXT = {
  loading: '\u6b63\u5728\u52a0\u8f7d\u8d5b\u9053\u56fe...',
  unavailable: '\u8d5b\u9053\u56fe\u6682\u4e0d\u53ef\u7528',
};

const CircuitImage = ({ alt, circuitId, className }: CircuitImageProps) => {
  const [imageUrl, setImageUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setResolving(true);
    setImageUrl('');
    setImageLoaded(false);
    setImageFailed(false);

    const loadImage = async () => {
      const nextImageUrl = await resolveCircuitImageUrl(circuitId, 'black-outline');

      if (cancelled) {
        return;
      }

      setImageUrl(nextImageUrl);
      setResolving(false);
    };

    void loadImage();

    return () => {
      cancelled = true;
    };
  }, [circuitId]);

  if (resolving) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          minHeight: 240,
        }}
      >
        <Spin size="large" />
        <span>{TEXT.loading}</span>
      </div>
    );
  }

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
      {!imageLoaded ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            minHeight: 240,
          }}
        >
          <Spin size="large" />
          <span>{TEXT.loading}</span>
        </div>
      ) : null}
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        loading="lazy"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageFailed(true)}
        style={{ display: imageLoaded ? 'block' : 'none' }}
      />
    </div>
  );
};

export default CircuitImage;
