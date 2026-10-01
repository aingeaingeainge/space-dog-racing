/**
 * **`live-smoke`** (`v3l4`, ONLINE_PLAN §10's L4): the headless clients of `online-walk`, against the
 * **live** room instead of `wrangler dev`.
 *
 *   npm run live-smoke -- <roomsUrl> <siteUrl>
 *   npm run live-smoke -- https://sdr-rooms.<subdomain>.workers.dev https://space-dog-racing.pages.dev
 *
 * Every request carries `Origin: <siteUrl>`, as a browser on the live site would. It makes real rooms
 * (two: the game's and the one the origin check makes), prints their codes, and leaves them: a room
 * deletes itself 30 days after its last action (§2.2). Nothing here needs an account or a key.
 *
 * The live room has no `debug` hook (`DEV_DEBUG` is set only by the walks' `wrangler dev`), so the
 * end of the game is checked from what the clients hold: every view, the last one included, must be
 * byte-identical to Node's `viewFor` over a replay of the room's `ended` log.
 *
 * Behind a proxy, run it with `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21) so `fetch` and `WebSocket` use
 * `HTTPS_PROXY`.
 */
import { PROTOCOL_VERSION, viewFor } from '@sdr/engine';
import type { ClientMsg } from '../src/protocol';
import {
  canon,
  Client,
  createRoom,
  go,
  join,
  originCheck,
  oversizeCheck,
  replayAndCompare,
  results,
  row,
  setEndpoint,
  sha,
  sleep,
  startGame,
  summary,
  until,
} from './client';

async function main(): Promise<void> {
  const [roomsUrl, siteUrl] = process.argv.slice(2);
  if (!roomsUrl || !siteUrl || !/^https?:\/\//.test(roomsUrl) || !/^https?:\/\//.test(siteUrl)) {
    console.error('usage: npm run live-smoke -- <roomsUrl> <siteUrl>');
    process.exit(2);
  }
  const site = new URL(siteUrl).origin;
  setEndpoint(roomsUrl, site);
  const t0 = Date.now();
  const codes: string[] = [];
  console.log(`live smoke: rooms ${roomsUrl}, as the page ${site}`);

  // Make a room, as the site's "Create a room" does.
  const tCreate = Date.now();
  const code = await createRoom();
  codes.push(code);
  row('a room is made, and CORS names the site', true, `${code} in ${Date.now() - tCreate} ms`);

  // Another page may neither make a room nor open a socket.
  const origins = await originCheck(code, site, 'https://evil.example');
  const made = /room ([A-Z]{6})/.exec(origins.detail)?.[1];
  if (made) codes.push(made);
  row('another page may not make a room or open a socket', origins.ok, origins.detail);

  // At the door: a look-only hello sees the lobby; two humans sit down by the code.
  const looker = new Client(code, { name: 'Looking', colour: 0, early: false });
  const tLook = Date.now();
  const look = await looker.connect({});
  const lookMs = Date.now() - tLook;
  await looker.close();
  const clients = await join(code, [
    { name: 'Aroha', colour: 3, early: false },
    { name: 'Bex', colour: 0, early: true },
  ]);
  const [a, b] = clients as [Client, Client];
  row(
    'two humans join by the code',
    look.t === 'lobby' && a.host && !b.host && a.seat !== b.seat,
    `a look-only hello: ${look.t} (${lookMs} ms, socket and hello); Aroha ${a.seat}${a.host ? ' (host)' : ''}, Bex ${b.seat}`,
  );

  // A browser on an older build is told to reload.
  const stale = new Client(code, { name: 'Old', colour: 7, early: false });
  const reload = await stale.connect({
    v: PROTOCOL_VERSION - 1,
    name: 'Old',
    colour: 7,
  } as Partial<ClientMsg>);
  await stale.close();
  row(
    'a stale v gets reload',
    reload.t === 'reload' && reload.need === PROTOCOL_VERSION,
    reload.t === 'reload' ? `need ${reload.need}` : reload.t,
  );

  // A race to 1 Bone, with one AI: the draft, then one weekend, then the end.
  await startGame(a, { kind: 'target', worth: 1 }, 1);
  await until('both views', () => clients.every((x) => x.view));

  const spoof = await a.request({ t: 'act', actions: [{ t: 'EndPhase', playerId: b.seat }] });
  const adv = await a.request({ t: 'act', actions: [{ t: 'AdvancePhase' }] });
  const dbg = await a.request({ t: 'debug', op: 'hash' });
  row(
    'a spoofed playerId, a client AdvancePhase and the dev-only debug hook are refused',
    spoof.t === 'rejected' && adv.t === 'rejected' && dbg.t === 'rejected',
    `"${spoof.t === 'rejected' ? spoof.error : spoof.t}", "${adv.t === 'rejected' ? adv.error : adv.t}", "${dbg.t === 'rejected' ? dbg.error : dbg.t}"`,
  );

  const caps = await oversizeCheck(a);
  row('a frame over 16 KB and an act of 65 actions are refused', caps.ok, caps.detail);

  // Play it out.
  const tPlay = Date.now();
  go(clients);
  await until('the game to end', () => clients.every((x) => x.ended), 600_000);
  await sleep(500);
  const rep = replayAndCompare(clients);
  const last = clients.map((x) => sha(canon(x.view!)));
  const node = sha(canon(viewFor(rep.final, a.seat)));
  const drafted = rep.final.drafts[0]?.picks.length ?? 0;
  row(
    'two humans and an AI play a race to 1 Bone through the draft to the end',
    rep.final.phase === 'seasonEnd' && rep.final.gameOver?.reason === 'target',
    `${drafted} draft picks, ${rep.final.week} weekend(s), ${rep.logRows} log rows in ${((Date.now() - tPlay) / 1000).toFixed(1)} s; ${rep.final.players.find((p) => p.id === rep.final.finalStandings?.[0]?.playerId)?.name} wins`,
  );
  row(
    "the final state equals Node's replay of the room's ended log",
    last.every((h) => h === node) && rep.mismatches.length === 0,
    `both clients' last views ${last.map((h) => h.slice(0, 12)).join(', ')}…; Node's ${node.slice(0, 12)}…`,
  );
  summary(clients, 'live', rep, t0);
  for (const x of clients) await x.close();

  console.log(`  rooms made (they delete themselves 30 days on): ${codes.join(', ')}`);
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `${bad.length} row(s) FAILED` : `All ${results.length} rows pass.`);
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
