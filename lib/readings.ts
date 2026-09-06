// A regrade re-judges one run's stored evidence: a second reading of the run, never a second
// run. This puts the readings of each run in the order they were made, so the newest can be
// the one a tally counts.

export type Reading = {
  task: string;
  run: string;
  regrade_of: string | null;
  regraded_at: string | null;
};

const regradeNumber = (run: string) => {
  const match = /-regrade-(\d+)$/.exec(run);

  return match ? Number(match[1]) : 0;
};

// Follows regrade_of all the way down rather than reading a number off the end of the run id:
// verify allows --regrade on a dir that is itself a regrade, and `<id>-regrade-1-regrade-1`
// parses as reading 1, colliding with the run it replaced. Depth along that chain comes
// first (a regrade of a regrade is later than what it re-read); regrades of one source tie
// there, and are ordered by regraded_at, then by their number — so that ten re-readings do
// not come out 1, 10, 2 the way the dir names sort. A record without regraded_at predates
// the field, so it is older than one that carries it.
export const orderReadings = <T extends Reading>(readings: T[]) => {
  const byId = new Map(readings.map(reading => [`${reading.task}/${reading.run}`, reading]));
  const warnings: string[] = [];
  const depth = new Map<T, number>();
  const rootOf = new Map<T, T>();

  for (const reading of readings) {
    const chain = [reading];
    let cursor = reading;
    let broken = false;

    while (cursor.regrade_of !== null) {
      const parent = byId.get(`${cursor.task}/${cursor.regrade_of}`);

      if (parent === undefined) {
        warnings.push(`artifacts/${reading.task}/${reading.run}: regrade_of names ${cursor.regrade_of}, which is not in the repo`);
        broken = true;
        break;
      }

      if (chain.includes(parent)) {
        warnings.push(`artifacts/${reading.task}/${reading.run}: regrade_of forms a cycle`);
        broken = true;
        break;
      }

      chain.push(parent);
      cursor = parent;
    }

    if (!broken) {
      depth.set(reading, chain.length - 1);
      rootOf.set(reading, cursor);
    }
  }

  const grouped = new Map<T, T[]>();

  for (const [reading, root] of rootOf) {
    grouped.set(root, [...(grouped.get(root) ?? []), reading]);
  }

  const order = (a: T, b: T) =>
    (depth.get(a) ?? 0) - (depth.get(b) ?? 0) ||
    (a.regraded_at ?? "").localeCompare(b.regraded_at ?? "") ||
    regradeNumber(a.run) - regradeNumber(b.run) ||
    a.run.localeCompare(b.run);

  return {
    /** each run's readings, oldest first; a run read once is a lineage of one */
    lineages: [...grouped.values()].map(lineage => [...lineage].sort(order)),
    warnings,
  };
};
