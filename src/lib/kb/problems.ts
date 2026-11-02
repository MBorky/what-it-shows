// The problems inside one merged ticket: one per fix, not one per subject line, counted the way the
// desk counts. causes.ts tells `parser` from `hint` by tenant and way in, and every report is counted
// under its cause. A report the desk read as a one-day move (desk-notes.json) is neither cause: a
// month-first parser swaps day and month, it never moves a date by one day. Those reports are a
// problem of their own, and, as the desk does (readAs in causes.ts), they stay counted where they are filed.
import { causeOf, type Cause, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = Cause | 'one-day' | 'unplaced';

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

function group(problem: Problem, rs: Report[]): ProblemGroup {
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
}

// Causes first, largest first; then the one-day moves, which are also inside their cause's count.
export function groupByProblem(
  reports: Report[],
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): ProblemGroup[] {
  const byCause = new Map<Problem, Report[]>();
  for (const r of reports) {
    const c = causeOf(r, tenantOf(r)) ?? 'unplaced';
    byCause.set(c, [...(byCause.get(c) ?? []), r]);
  }
  const groups = [...byCause.entries()].map(([p, rs]) => group(p, rs)).sort((a, b) => b.reports.length - a.reports.length);
  const oneDay = reports.filter((r) => oneDayMove.includes(r.id));
  return oneDay.length ? [...groups, group('one-day', oneDay)] : groups;
}

// Subject lines that come in under more than one problem: why merging on subject joined them.
export function sharedSubjects(groups: ProblemGroup[]): { shared: number; all: number } {
  const seenIn = new Map<string, number>();
  for (const g of groups) for (const s of Object.keys(g.subjects)) seenIn.set(s, (seenIn.get(s) ?? 0) + 1);
  return { shared: [...seenIn.values()].filter((n) => n > 1).length, all: seenIn.size };
}
