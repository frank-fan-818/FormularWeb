import type { ReactNode } from 'react';

interface RacePageIntroProps {
  index: string;
  eyebrow: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}
export function RacePageIntro({
  index,
  eyebrow,
  title,
  description,
  aside,
}: RacePageIntroProps) {
  return (
    <header className="race-page-intro">
      <span className="race-page-intro-index" aria-hidden="true">{index}</span>
      <div className="race-page-intro-copy">
        <span className="race-page-intro-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {aside ? <div className="race-page-intro-aside">{aside}</div> : null}
    </header>
  );
}
