// The problems inside one merged ticket: one per cause, not one per subject line.
// The cause comes from causes.ts (tenant locale, booking form, way in), the same logic the desk runs.
// Reports the desk read differently (desk-notes.json) stay under their cause and are footnoted.
import { causeOf, type Cause, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = Cause | 'unplaced';

export function problemOf(r: Report, t: Tenant | undefined): Problem {
  return causeOf(r, t) ?? 'unplaced';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DATE = new RegExp(`\\b(\\d{1,2}) (${MONTHS.join('|')})\\b`, 'g');

export type BodyShows = 'day/month swap' | 'one-day move' | 'other dates' | 'no date pair';

// What a report's own words show: the date people booked against the date they got.
export function bodyShows(body: string): BodyShows {
  const dates = [...body.matchAll(DATE)].map((m) => ({ day: Number(m[1]), month: MONTHS.indexOf(m[2]) + 1 }));
  if (dates.length !== 2) return 'no date pair';
  const [a, b] = dates;
  if (a.day === b.month && a.month === b.day) return 'day/month swap';
  if (a.month === b.month && Math.abs(a.day - b.day) === 1) return 'one-day move';
  return 'other dates';
}

export type ProblemGroup = {
  problem: Problem;
  reports: Report[];
  // What the bodies show, way in, subject: value → count.
  shows: Record<string, number>;
  channels: Record<string, number>;
  subjects: Record<string, number>;
  tenants: number;
  firstSeen: string;
  lastSeen: string;
};

const tally = (xs: string[]) => xs.reduce<Record<string, number>>((n, x) => ({ ...n, [x]: (n[x] ?? 0) + 1 }), {});

export function groupByProblem(reports: Report[], tenantOf: (r: Report) => Tenant | undefined): ProblemGroup[] {
  const byProblem = new Map<Problem, Report[]>();
  for (const r of reports) {
    const p = problemOf(r, tenantOf(r));
    byProblem.set(p, [...(byProblem.get(p) ?? []), r]);
  }
  return [...byProblem.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        shows: tally(rs.map((r) => bodyShows(r.body))),
        channels: tally(rs.map((r) => r.channel)),
        subjects: tally(rs.map((r) => r.subject)),
        tenants: new Set(rs.map((r) => r.tenant)).size,
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
}

// Subject lines that come in under more than one problem: why merging on subject joined them.
export function sharedSubjects(groups: ProblemGroup[]): { shared: number; all: number } {
  const seenIn = new Map<string, number>();
  for (const g of groups) for (const s of Object.keys(g.subjects)) seenIn.set(s, (seenIn.get(s) ?? 0) + 1);
  return { shared: [...seenIn.values()].filter((n) => n > 1).length, all: seenIn.size };
}
