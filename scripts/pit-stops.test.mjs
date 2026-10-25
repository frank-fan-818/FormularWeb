import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverDhl, parseStandings, parseAwardStops, matchEvent, mergeStops, getPitRecords, matchOpenSession } from '../api/_lib/pit-stops.mjs';
import handler from '../api/pit-stops.mjs';

test('DHL component discovery follows season headings and validates paths', () => {
  const html = '<h2>2025</h2><section data-type="pit_stop" data-statistic="event_info" data-url="/api/f1-award-element-data/99"><h1>Grand Prix 2025</h1><input value="800"><label><span>Albert Park Grand Prix Circuit</span></label></section><section data-url="/api/f1-award-element-data/100" data-statistic="season_overview" data-type="pit_stop"></section><h2>2024</h2><section data-type="pit_stop" data-statistic="season_overview" data-url="https://evil.test/x"></section>';
  const catalog = discoverDhl(html);
  assert.equal(catalog[2025].overview, '/api/f1-award-element-data/100');
  assert.equal(catalog[2025].events[0].id, '800');
  assert.equal(catalog[2024], undefined);
});
test('official points are retained, tied teams share ranks and zero is valid', () => {
  const rows = parseStandings([{team:'A',points:20},{team:'B',points:20},{team:'C',points:0}]);
  assert.deepEqual(rows.map(r => r.rank), [1,1,3]);
  assert.equal(rows[2].points, 0);
  assert.throws(() => parseStandings([{team:'A',points:null}]));
});
test('award stops retain repeated teams, missing laps, irregular flags and raw precision', () => {
  const rows = parseAwardStops([{id:1,team:'Ferrari',tla:'LEC',firstName:'Charles',lastName:'Leclerc',duration:2.2,lap:null,points:25,irregular:true,notes:'Review'},{id:2,team:'Ferrari',tla:'HAM',firstName:'Lewis',lastName:'Hamilton',duration:2.2,lap:12,points:18}]);
  assert.equal(rows.length,2); assert.equal(rows[0].lap,null); assert.equal(rows[0].duration,'2.2'); assert.equal(rows[0].irregular,true);
  assert.deepEqual(rows.map(r=>r.rank),[1,1]);
});
test('venue matching is explicit and rejects ambiguity', () => {
  const race={Circuit:{circuitId:'albert_park',circuitName:'Albert Park Grand Prix Circuit'}};
  assert.equal(matchEvent([{id:'800',label:'Albert Park Grand Prix Circuit'}],race).id,'800');
  assert.equal(matchEvent([{id:'1',label:'Unknown'}],race),null);
  assert.equal(matchEvent([{id:'1',label:'Albert Park Grand Prix Circuit'},{id:'2',label:'Albert Park Grand Prix Circuit'}],race),null);
});
test('published positions take precedence over equal displayed times', () => {
  const rows = [{id:1,team:'A',tla:'AAA',firstName:'A',lastName:'One',duration:2.2,lap:3,points:4},{id:2,team:'B',firstName:'B',lastName:'Two',duration:2.2,lap:4,points:2}];
  const html = '<table><tr><td>8</td><td>A</td><td>One</td><td>2.2</td><td>3</td><td>4</td></tr><tr><td>9</td><td>B</td><td>Two</td><td>2.2</td><td>4</td><td>2</td></tr></table>';
  assert.deepEqual(parseAwardStops(rows,html).map(row=>row.rank),[8,9]);
  assert.throws(()=>parseAwardStops(rows, '<table></table>'));
});
test('static and lane durations remain separate, ambiguous static matches stay null', () => {
  const lane=[{driverId:'leclerc',driverNumber:16,lap:31,stop:1,laneDuration:'22.215'}];
  const open=[{driver_number:16,lap_number:31,stop_duration:2.2,lane_duration:22.215}];
  assert.equal(mergeStops(lane,open)[0].stopDuration,'2.2');
  assert.equal(mergeStops(lane,open)[0].laneDuration,'22.215');
  assert.equal(mergeStops(lane,[...open,...open])[0].stopDuration,null);
  assert.equal(mergeStops(lane,[{...open[0],stop_duration:null}])[0].stopDuration,null);
});
test('Jolpica reads all pages and rejects incomplete pagination', async () => {
  const page = offset => ({MRData:{total:'2',offset:String(offset),RaceTable:{Races:[{PitStops:[{driverId:'a',lap:String(offset+1),stop:String(offset+1),duration:'23.456'}]}]}}});
  const rows=await getPitRecords('2025','4',async url=>page(Number(new URL(url).searchParams.get('offset')||0)));
  assert.equal(rows.length,2);
  await assert.rejects(()=>getPitRecords('2025','4',async()=>({MRData:{total:'2',RaceTable:{Races:[]}}})));
});
test('OpenF1 session matching validates year, date and venue, not session key versus round', () => {
  const race = {date:'2025-05-04',Circuit:{Location:{country:'USA',locality:'Miami'}}};
  const session={year:2025,session_name:'Race',date_start:'2025-05-04T19:00:00Z',country_name:'United States',location:'Miami',session_key:999};
  assert.equal(matchOpenSession([session],race,'2025').session_key,999);
  assert.equal(matchOpenSession([session,session],race,'2025'),null);
  assert.equal(matchOpenSession([{...session,country_name:'Bahrain',location:'Sakhir'}],race,'2025'),null);
});
test('public handler rejects invalid methods and parameters without requesting upstreams', async () => {
  for (const [url,method,status] of [['/api/pit-stops?season=2025','POST',405],['/api/pit-stops?season=2025&round=https://evil.test','GET',400],['/api/pit-stops?season=2025&kind=race','GET',400],['/api/pit-stops?season=9999','HEAD',400]]) {
    let actual; let body;
    const res={setHeader(){},writeHead(value){actual=value;},end(value){body=value;}};
    await handler({url,method},res);
    assert.equal(actual,status);
    if(method==='HEAD') assert.equal(body,undefined); else assert.equal(typeof JSON.parse(body).code,'string');
  }
});
