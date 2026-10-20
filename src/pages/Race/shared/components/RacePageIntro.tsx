import type { ReactNode } from 'react';

interface RacePageIntroProps {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}
export function RacePageIntro({
  eyebrow,
  title,
  aside,
}: RacePageIntroProps) {
  return (
    <header className="race-page-intro">
      <div className="race-page-intro-copy">
        <span className="race-page-intro-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {aside ? <div className="race-page-intro-aside">{aside}</div> : null}
    </header>
  );
}
