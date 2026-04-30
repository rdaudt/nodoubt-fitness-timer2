import { createTablesIfNeeded, getAnalyticsDb } from './_analyticsDb';

type NodeReq = {
  method?: string;
};

type NodeRes = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

const asNumber = (value: unknown): number => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};

const safeDivide = (num: number, den: number): number => (den > 0 ? num / den : 0);

export default async function handler(request: NodeReq, response: NodeRes): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await createTablesIfNeeded();
    const db = getAnalyticsDb();

    const [totalsResult, browserResult, categoryResult] = await Promise.all([
      db.execute(`
        SELECT
          SUM(app_opened_count) AS app_opened_count,
          SUM(timer_created_count) AS timer_created_count,
          SUM(timer_cloned_count) AS timer_cloned_count,
          SUM(template_created_from_timer_count) AS template_created_from_timer_count,
          SUM(timer_created_from_template_count) AS timer_created_from_template_count,
          SUM(timer_run_completed_count) AS timer_run_completed_count,
          SUM(timer_run_incomplete_count) AS timer_run_incomplete_count,
          SUM(timer_run_coach_mode_count) AS timer_run_coach_mode_count,
          SUM(timers_exported_count) AS timers_exported_count,
          SUM(timers_imported_count) AS timers_imported_count,
          SUM(total_timer_duration_sec_sum) AS total_timer_duration_sec_sum,
          SUM(station_count_sum) AS station_count_sum,
          SUM(rounds_per_station_sum) AS rounds_per_station_sum,
          SUM(work_sec_sum) AS work_sec_sum,
          SUM(rest_sec_sum) AS rest_sec_sum,
          SUM(warmup_enabled_count) AS warmup_enabled_count,
          SUM(warmup_sec_sum) AS warmup_sec_sum,
          SUM(cooldown_enabled_count) AS cooldown_enabled_count,
          SUM(cooldown_sec_sum) AS cooldown_sec_sum
        FROM analytics_rollup_daily
      `),
      db.execute(`
        SELECT browser_family, COUNT(*) AS count
        FROM analytics_events
        GROUP BY browser_family
      `),
      db.execute(`
        SELECT json_extract(payload_json, '$.category') AS category, COUNT(*) AS count
        FROM analytics_events
        WHERE event_name = 'timer_run_completed'
        GROUP BY json_extract(payload_json, '$.category')
      `),
    ]);

    const row = totalsResult.rows[0] ?? {};
    const completedRuns = asNumber(row.timer_run_completed_count);

    response.status(200).json({
      counts: {
        appOpened: asNumber(row.app_opened_count),
        timersCreated: asNumber(row.timer_created_count),
        timerRunsDone: asNumber(row.timer_run_completed_count) + asNumber(row.timer_run_incomplete_count),
        templatesCreatedFromScratch: 0,
        templatesCreatedFromTimers: asNumber(row.template_created_from_timer_count),
        timersCreatedFromTemplates: asNumber(row.timer_created_from_template_count),
        timersRunInCoachMode: asNumber(row.timer_run_coach_mode_count),
        timerExportsUsed: asNumber(row.timers_exported_count),
        timerImportsUsed: asNumber(row.timers_imported_count),
        timerClones: asNumber(row.timer_cloned_count),
      },
      browserFamilyCounts: browserResult.rows.map((item) => ({
        browserFamily: String(item.browser_family),
        count: asNumber(item.count),
      })),
      averages: {
        totalTimerTimeSec: safeDivide(asNumber(row.total_timer_duration_sec_sum), completedRuns),
        stationsSetsPerRun: safeDivide(asNumber(row.station_count_sum), completedRuns),
        roundsPerStationSet: safeDivide(asNumber(row.rounds_per_station_sum), completedRuns),
        workIntervalSec: safeDivide(asNumber(row.work_sec_sum), completedRuns),
        restIntervalSec: safeDivide(asNumber(row.rest_sec_sum), completedRuns),
      },
      percentages: {
        runsWithWarmupConfigured: safeDivide(asNumber(row.warmup_enabled_count), completedRuns),
        runsWithCooldownConfigured: safeDivide(asNumber(row.cooldown_enabled_count), completedRuns),
      },
      warmupAverageSec: safeDivide(asNumber(row.warmup_sec_sum), asNumber(row.warmup_enabled_count)),
      cooldownAverageSec: safeDivide(asNumber(row.cooldown_sec_sum), asNumber(row.cooldown_enabled_count)),
      mostUsedWorkoutTypes: {
        available: false,
        reason: 'Not collected in v1 to avoid free-text PII capture.',
      },
      mostUsedWorkoutCategories: categoryResult.rows.map((item) => ({
        category: String(item.category),
        count: asNumber(item.count),
      })),
    });
  } catch {
    response.status(500).json({ error: 'Failed to fetch analytics summary.' });
  }
}
