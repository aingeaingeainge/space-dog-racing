import {
  dogValue,
  formatBones,
  netWorthBreakdown,
  TRAIT_BY_ID,
  type Dog,
  type GameState,
  type Player,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, Bar, Delta, KV } from '../components/ui';
import { CLASS_LABEL, declaredClass, ownedDogs } from '../lib/selectors';

function status(d: Dog): { text: string; tone?: 'bad' | 'hot' } {
  if (d.injuryWeeks > 0) return { text: `injured ${d.injuryWeeks}w`, tone: 'bad' };
  if (d.banWeeks > 0) return { text: `banned ${d.banWeeks}w`, tone: 'bad' };
  if (d.fitness < 60) return { text: 'jaded', tone: 'hot' };
  return { text: 'fit' };
}

/** GDD §15.4. Read-only in this build: buying, selling and training arrive with the Market. */
export function Stable({ s, me }: { s: GameState; me: Player }) {
  const dogs = ownedDogs(s, me);
  const worth = netWorthBreakdown(s, me);
  const trained = me.training ? s.dogs[me.training.dogId] : undefined;

  return (
    <>
      <Panel title={me.name} sub="your stable">
        <div className="grid3">
          <KV
            items={[
              ['Cash', formatBones(me.cash)],
              ['Kennels', `${dogs.length} / ${me.kennelSlots} dogs`],
              ['Cargo', `${me.cargo} / ${me.ship.cargoCap} crates of kibble`],
            ]}
          />
          <KV
            items={[
              ['Ship', `engine ${me.ship.speed}${me.ship.coldStore ? ', cold store' : ''}`],
              [
                'Staff',
                Object.values(me.staff).length
                  ? Object.values(me.staff)
                      .map((o) => `${o.name} (${o.role})`)
                      .join(', ')
                  : 'none',
              ],
              [
                'Training',
                trained && me.training ? `${trained.name}: ${me.training.stat}` : 'none',
              ],
            ]}
          />
          <KV
            items={[
              [
                'Debt',
                me.loans.length
                  ? me.loans.map((l) => `${l.lender} ${formatBones(l.principal)}`).join(', ')
                  : 'none',
              ],
              ['Dogs value', formatBones(worth.dogs)],
              ['Net worth', <b key="nw">{formatBones(worth.total)}</b>],
            ]}
          />
        </div>
      </Panel>

      <Panel title="Dogs" sub="ratings and stats are public — everyone can see them" tight>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dog</th>
                <th className="num">Age</th>
                <th className="num">Rating</th>
                <th>Speed</th>
                <th>Accel</th>
                <th>Stamina</th>
                <th>Trap</th>
                <th>Fitness</th>
                <th className="num">Form</th>
                <th className="num">Runs</th>
                <th className="num">Value</th>
                <th>Status</th>
                <th>Traits</th>
              </tr>
            </thead>
            <tbody>
              {dogs.map((d) => {
                const st = status(d);
                const cls = declaredClass(s, me.id, d.id);
                return (
                  <tr key={d.id}>
                    <td>
                      <b>{d.name}</b>
                      {cls ? (
                        <Badge tone="good" title="declared this weekend">
                          {CLASS_LABEL[cls]}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="num">{d.age}</td>
                    <td className="num">
                      <b>{d.rating}</b>
                    </td>
                    <td>
                      <Bar value={d.speed} />
                    </td>
                    <td>
                      <Bar value={d.accel} />
                    </td>
                    <td>
                      <Bar value={d.stamina} />
                    </td>
                    <td>
                      <Bar value={d.trap} />
                    </td>
                    <td>
                      <Bar value={d.fitness} />
                    </td>
                    <td className="num">
                      <Delta n={d.form} />
                    </td>
                    <td className="num">
                      {d.wins}/{d.runs}
                    </td>
                    <td className="num">{formatBones(dogValue(d))}</td>
                    <td>
                      {st.tone ? <Badge tone={st.tone}>{st.text}</Badge> : <span>{st.text}</span>}
                    </td>
                    <td style={{ whiteSpace: 'normal' }}>
                      {d.traits.map((t) => (
                        <Badge key={t} title={TRAIT_BY_ID[t]?.blurb}>
                          {TRAIT_BY_ID[t]?.name ?? t}
                        </Badge>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
