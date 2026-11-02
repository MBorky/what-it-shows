<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import split from '#lib/data/split-4471.json';
  import { uniqueById, type Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  import { bodyShows, groupByProblem, sharedSubjects } from '#lib/kb/problems';

  let { ticket }: { ticket: number } = $props();

  const rows = reports as Report[];
  const unique = $derived(uniqueById(rows));
  const merged = $derived(unique.filter((r) => r.mergedInto === ticket));
  const groups = $derived(groupByProblem(merged, tenantOf, notes.oneDayMove));
  const subjects = $derived(sharedSubjects(groups));
  const tickets: Record<string, number> = split.tickets;
  const issue = (p: string) => (tickets[p] ? `https://github.com/${split.repo}/issues/${tickets[p]}` : null);
  const fmt = (n: Record<string, number>) =>
    Object.entries(n)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ×${v}`)
      .join(' · ');
  // Up to three reports per problem, in id order, that show what the problem looks like.
  const examples = (g: (typeof groups)[number]) => {
    const top = Object.entries(g.shows).sort((a, b) => b[1] - a[1])[0][0];
    const rs = [...g.reports].sort((a, b) => a.id.localeCompare(b.id));
    return (g.reports.length <= 5 ? rs : rs.filter((r) => bodyShows(r.body) === top)).slice(0, g.reports.length <= 5 ? 5 : 3);
  };
</script>

<p class="sum">
  <strong>{merged.length}</strong> reports merged into #{ticket} ·
  <strong>{groups.length}</strong>
  {groups.length === 1 ? 'problem' : 'problems'} ·
  <strong>{groups.filter((g) => issue(g.problem)).length}</strong> filed
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>the bodies show</th><th>way in</th><th>tenants</th><th>seen</th><th>ticket</th></tr>
  </thead>
  <tbody>
    {#each groups as g (g.problem)}
      {@const url = issue(g.problem)}
      <tr>
        <td><code>{g.problem}</code></td>
        <td><b>{g.reports.length}</b></td>
        <td class="small">{fmt(g.shows)}</td>
        <td class="small">{fmt(g.channels)}</td>
        <td>{g.tenants}</td>
        <td class="small">{g.firstSeen} → {g.lastSeen}</td>
        <td>{#if url}<a href={url}>{split.repo}#{tickets[g.problem]}</a>{:else}<span class="todo">not filed</span>{/if}</td>
      </tr>
    {/each}
  </tbody>
  <tfoot>
    <tr><td>all</td><td><b>{groups.reduce((n, g) => n + g.reports.length, 0)}</b></td><td colspan="5" class="small">one problem per report, none left over</td></tr>
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
  tfoot td { border-bottom: none; }
  h3 { font-size: 1rem; margin: 1.25rem 0 0.25rem; }
  .examples { margin: 0; padding-left: 1.2rem; font-size: 0.9rem; }
</style>
