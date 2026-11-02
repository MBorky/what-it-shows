<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import split from '#lib/data/split-4471.json';
  import update from '#lib/data/engineering-4471.json';
  import { uniqueById, type Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  import { bodyShows, groupByProblem, sharedSubjects } from '#lib/kb/problems';

  let { ticket }: { ticket: number } = $props();

  const rows = reports as Report[];
  const unique = $derived(uniqueById(rows));
  const merged = $derived(unique.filter((r) => r.mergedInto === ticket));
  const groups = $derived(groupByProblem(merged, tenantOf, notes.oneDayMove));
  const subjects = $derived(sharedSubjects(groups));
  // One-day moves inside a cause's count (the desk files them there): cause → count.
  const inside = (g: (typeof groups)[number]) =>
    g.problem === 'one-day' ? 0 : g.reports.filter((r) => notes.oneDayMove.includes(r.id)).length;
  const oneDayCount = $derived(groups.find((g) => g.problem === 'one-day')?.reports.length ?? 0);
  // Where each problem stands after the engineering update; a problem the update does not name is still open.
  const states: Record<string, { status: string; reason: string }> = update.causes;
  const state = (p: string) => states[p] ?? { status: 'open', reason: 'not in the engineering update' };
  const openCount = $derived(groups.filter((g) => !states[g.problem]).length);
  const tickets: Record<string, number> = split.tickets;
  const issue = (p: string) => (tickets[p] ? `https://github.com/${split.repo}/issues/${tickets[p]}` : null);
  const fmt = (n: Record<string, number>) =>
    Object.entries(n)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ×${v}`)
      .join(' · ');
  // What a problem looks like: every report when there are few, else three that show its usual shape.
  const examples = (g: (typeof groups)[number]) => {
    const rs = [...g.reports].sort((a, b) => a.id.localeCompare(b.id));
    if (rs.length <= 5) return rs;
    const top = Object.entries(g.shows).sort((a, b) => b[1] - a[1])[0][0];
    return rs.filter((r) => bodyShows(r.body) === top).slice(0, 3);
  };
</script>

<p class="sum">
  <strong>{merged.length}</strong> reports merged into #{ticket} ·
  <strong>{groups.length}</strong>
  {groups.length === 1 ? 'problem' : 'problems'} ·
  <strong>{groups.filter((g) => issue(g.problem)).length}</strong> filed ·
  <strong>{openCount}</strong> still open
</p>
<p class="note">#{update.ticket} closed {update.closed}. States from the {update.source}.</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>the bodies show</th><th>way in</th><th>tenants</th><th>seen</th><th>ticket</th><th>state</th></tr>
  </thead>
  <tbody>
    {#each groups as g (g.problem)}
      {@const url = issue(g.problem)}
      <tr>
        <td><code>{g.problem}</code></td>
        <td><b>{g.reports.length}</b>{#if inside(g)}<span class="small"> incl. {inside(g)} one-day</span>{/if}{#if g.problem === 'one-day'}<span class="small"> also under their cause</span>{/if}</td>
        <td class="small">{fmt(g.shows)}</td>
        <td class="small">{fmt(g.channels)}</td>
        <td>{g.tenants}</td>
        <td class="small">{g.firstSeen} → {g.lastSeen}</td>
        <td>{#if url}<a href={url}>{split.repo}#{tickets[g.problem]}</a>{:else}<span class="todo">not filed</span>{/if}</td>
        <td class:open={!states[g.problem]}><b>{state(g.problem).status}</b><span class="small"> · {state(g.problem).reason}</span></td>
      </tr>
    {/each}
  </tbody>
  <tfoot>
    <tr><td>all</td><td><b>{merged.length}</b></td><td colspan="6" class="small">every report under one cause, none left over; the {oneDayCount} one-day moves are counted under their cause too, as the desk counts</td></tr>
  </tfoot>
</table>

<p class="note">
  The export holds {rows.length} rows; {rows.length - unique.length} are the same report twice, from overlapping export
  pages, and count once. {subjects.shared} of the {subjects.all} subject lines come in under more than one problem.
</p>

{#each groups as g (g.problem)}
  <h3><code>{g.problem}</code> · what the reports say</h3>
  <ul class="examples">
    {#each examples(g) as r (r.id)}
      <li><code>{r.id}</code> {r.tenant} · {r.channel}: “{r.body}”</li>
    {/each}
  </ul>
{/each}

<style>
  .sum { font-size: 1.1rem; }
  .small { color: var(--muted); font-size: 0.85em; }
  .note { color: var(--muted); font-size: 0.85em; }
  .todo { color: var(--warn); font-weight: 600; }
  .open b { color: var(--warn); }
  tfoot td { border-bottom: none; }
  h3 { font-size: 1rem; margin: 1.25rem 0 0.25rem; }
  .examples { margin: 0; padding-left: 1.2rem; font-size: 0.9rem; }
</style>
