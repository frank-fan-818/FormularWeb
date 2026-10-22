import type { ReactNode } from 'react';

interface RacePageIntroProps {
  title: string;
  aside?: ReactNode;
}
export function RacePageIntro({
  title,
  aside,
}: RacePageIntroProps) {
  return (
    <header className="race-page-intro">
      <div className="race-page-intro-copy">
        <h2 title={title}>{title}</h2>
      </div>
      {aside ? <div className="race-page-intro-aside">{aside}</div> : null}
    </header>
  );
}
