# Browser QA Checklist

Run this after UI, routing, data-loading, or chart changes.

## Routes

- `/` loads season overview, next race, and standings.
- `/races` renders the race list and can navigate to a race detail page.
- `/races/:round` renders weekend schedule, mode switch, result tabs, and FastF1 sections without console errors.
- `/drivers/:driverId` renders profile and history data.
- `/constructors/:constructorId` renders profile and history data.
- `/circuits/:circuitId` renders circuit metadata and SVG imagery.

## Viewports

- Desktop: 1440 x 900.
- Tablet: 768 x 1024.
- Mobile: 375 x 812.

## Required Checks

- No new console errors or warnings from the changed flow.
- No failed network requests except known unavailable upstream data.
- Mobile RaceDetail tab dots and arrows change sessions.
- FastF1 chart cards handle loading, populated, and empty data.
- Global search can navigate to a driver, constructor, circuit, and race.

## Report Format

- Date:
- Branch:
- Build or dev URL:
- Routes checked:
- Viewports checked:
- Findings:
- Blocking:
- Screenshot paths:
