"""Quick Monte-Carlo sanity model for Space Dog Racing economy & race sim.
Not the real engine — used to pick default numbers for the GDD / spreadsheet."""
import random, statistics as st
from collections import defaultdict

# ---------- tunables ----------
WEEKS = 13
MAJOR_WEEKS = {4, 7, 10, 13}
MAJOR_MULT = 2.5
FINAL_MULT = 4.0
PURSES = {  # 1st, 2nd, 3rd for a standard weekend
    'bronze': (1000, 500, 250),
    'silver': (2500, 1250, 600),
    'gold':   (6000, 3000, 1500),
}
BANDS = {'bronze': (0, 45), 'silver': (0, 70), 'gold': (0, 100)}  # caps only: you may always race UP a class
TRAPS = 8
UPKEEP_PER_DOG = 150
FOOD_PER_DOG = 1          # units / week
FUEL = 250
TRAINER_WAGE = 400
START_CASH = 6000

def dog_value(rating, age):
    agef = {1: 1.15, 2: 1.1, 3: 1.0, 4: 0.85, 5: 0.65, 6: 0.45}.get(age, 0.4)
    return round((400 + 2.2 * rating ** 2) * agef)

class Dog:
    _id = 0
    def __init__(self, quality):
        Dog._id += 1
        self.id = Dog._id
        q = quality
        self.speed = min(99, max(20, random.gauss(q, 8)))
        self.accel = min(99, max(20, random.gauss(q, 8)))
        self.stamina = min(99, max(20, random.gauss(q, 8)))
        self.trap = min(99, max(20, random.gauss(q, 8)))
        self.age = random.choice([1, 2, 2, 3, 3, 4])
        self.fitness = 90
        self.form = 0
        self.rating = self.base_rating()
        self.wins = 0
    def base_rating(self):
        return 0.4 * self.speed + 0.2 * self.accel + 0.25 * self.stamina + 0.15 * self.trap
    def eligible(self, cls):
        lo, hi = BANDS[cls]
        return lo <= self.rating <= hi

def run_race(dogs, distance=480, seed=None):
    """Tick model: returns finishing order. Each tick 0.1s."""
    rng = random.Random(seed)
    pos = {d.id: 0.0 for d in dogs}
    vel = {d.id: 0.0 for d in dogs}
    finished = []
    t = 0
    # per-dog race-day noise: form + luck
    luck = {d.id: rng.gauss(0, 1.5) for d in dogs}
    # trap break: reaction advantage
    for d in dogs:
        pos[d.id] = (d.trap / 100) * 3 * rng.uniform(0.6, 1.4)
    while len(finished) < len(dogs) and t < 1000:
        t += 1
        for d in dogs:
            if d.id in finished: continue
            fit = 0.8 + 0.2 * d.fitness / 100
            top = (13 + 6 * d.speed / 100 + 0.05 * d.form + 0.40 * luck[d.id]) * fit
            # stamina: fade after a fraction of the race
            fade_start = 0.45 + 0.45 * d.stamina / 100
            frac = pos[d.id] / distance
            if frac > fade_start:
                top *= 1 - 0.35 * (frac - fade_start) / max(0.05, 1 - fade_start)
            acc = 4 + 6 * d.accel / 100
            vel[d.id] = min(top, vel[d.id] + acc * 0.1) + rng.gauss(0, 0.35)
            pos[d.id] += vel[d.id] * 0.1
            if pos[d.id] >= distance:
                finished.append(d.id)
    return finished

def update_rating(dog, place, field):
    # Elo-ish: expected place vs actual
    n = len(field)
    avg = st.mean(x.rating for x in field)
    exp_place = 1 + (n - 1) * (1 / (1 + 10 ** ((dog.rating - avg) / 15)))
    delta = (exp_place - place) * 1.6
    dog.rating = max(5, min(99, dog.rating + delta))
    dog.form = max(-10, min(10, dog.form + (exp_place - place)))
    dog.fitness = max(30, dog.fitness - 12)

class Player:
    def __init__(self, name, smart):
        self.name, self.smart = name, smart
        self.cash = START_CASH
        self.dogs = [Dog(random.choice([38, 42, 46])) for _ in range(3)]
        self.trainer = smart
        self.income = 0; self.costs = 0; self.bets = 0
    def assign(self):
        """Pick one dog per class among eligible; smart = maximize expected value."""
        best = None
        import itertools
        for perm in itertools.permutations(self.dogs[:3]):
            ok = all(d.eligible(c) for d, c in zip(perm, ('bronze', 'silver', 'gold')))
            if not ok: continue
            score = sum(d.rating * PURSES[c][0] for d, c in zip(perm, ('bronze', 'silver', 'gold')))
            if self.smart: score += random.random()
            else: score = random.random()
            if best is None or score > best[0]: best = (score, perm)
        if best is None:
            return None
        return dict(zip(('bronze', 'silver', 'gold'), best[1]))

def local_dog(cls):
    lo, hi = BANDS[cls]
    d = Dog((lo + hi) / 2)
    return d

def season(nplayers=6, verbose=False):
    players = [Player(f'P{i}', smart=(i % 2 == 0)) for i in range(nplayers)]
    week_income = defaultdict(list)
    for week in range(1, WEEKS + 1):
        mult = FINAL_MULT if week == 13 else MAJOR_MULT if week in MAJOR_WEEKS else 1.0
        entries = {c: [] for c in PURSES}
        assignments = {}
        for p in players:
            a = p.assign()
            if a is None:  # scratch: race best two anywhere legal
                continue
            assignments[p.name] = a
            for c, d in a.items():
                entries[c].append((p, d))
        for c in PURSES:
            field = [d for _, d in entries[c]]
            owners = {d.id: p for p, d in entries[c]}
            while len(field) < TRAPS:
                field.append(local_dog(c))
            order = run_race(field, seed=random.random())
            for place, did in enumerate(order, 1):
                d = next(x for x in field if x.id == did)
                update_rating(d, place, field)
                if did in owners and place <= 3:
                    prize = PURSES[c][place - 1] * mult
                    owners[did].cash += prize; owners[did].income += prize
                    week_income[week].append(prize)
                if place == 1: d.wins += 1
        for p in players:
            cost = UPKEEP_PER_DOG * len(p.dogs) + FUEL + (TRAINER_WAGE if p.trainer else 0) + 70 * len(p.dogs)
            p.cash -= cost; p.costs += cost
            for d in p.dogs:
                d.fitness = min(100, d.fitness + 15)
                if p.trainer: d.speed = min(99, d.speed + 0.8); d.rating += 0.4
    results = []
    for p in players:
        worth = p.cash + sum(dog_value(d.rating, d.age) for d in p.dogs) + 3000
        results.append((p.name, p.smart, round(p.cash), round(p.income), round(p.costs), round(worth)))
    return results

if __name__ == '__main__':
    random.seed(1)
    agg = defaultdict(list)
    for _ in range(200):
        for name, smart, cash, inc, cost, worth in season():
            agg[smart].append((cash, inc, cost, worth))
    for smart, rows in agg.items():
        cash = [r[0] for r in rows]; inc = [r[1] for r in rows]; cost = [r[2] for r in rows]; worth = [r[3] for r in rows]
        print(f"smart={smart}: end cash mean {st.mean(cash):.0f} (p10 {sorted(cash)[len(cash)//10]:.0f}, p90 {sorted(cash)[9*len(cash)//10]:.0f}) | "
              f"prize income mean {st.mean(inc):.0f} | costs {st.mean(cost):.0f} | worth {st.mean(worth):.0f}")
    # race sim sanity: win prob by rating gap
    print("\nWin-probability check (one dog vs 7 dogs of rating 50):")
    for r in (35, 45, 50, 55, 65, 75):
        wins = 0; N = 400
        for _ in range(N):
            d = Dog(r); d.rating = d.base_rating()
            field = [d] + [Dog(50) for _ in range(7)]
            if run_race(field, seed=random.random())[0] == d.id: wins += 1
        print(f"  quality {r}: win {wins/N:.0%}")
