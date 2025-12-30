import fetch from "node-fetch";
import "dotenv/config";

const OURA_ACCESS_TOKEN = process.env.OURA_ACCESS_TOKEN;
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
let STRAVA_REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

/* =========================
   STRAVA
========================= */

// Refresh Strava token
async function refreshStravaToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: STRAVA_REFRESH_TOKEN
    })
  });

  const data = await res.json();
  STRAVA_REFRESH_TOKEN = data.refresh_token;
  return data.access_token;
}

// Fetch Strava runs
async function getStravaActivities() {
  const accessToken = await refreshStravaToken();

  // Fetch activities with pagination to ensure we get all recent ones
  let allActivities = [];
  let page = 1;
  const perPage = 200;
  
  while (true) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = await res.json();
    
    if (!data || data.length === 0) {
      break;
    }
    
    allActivities = allActivities.concat(data);
    
    // Stop if we got fewer than per_page (last page)
    if (data.length < perPage) {
      break;
    }
    
    // Safety limit: don't fetch more than 3 pages (600 activities)
    if (page >= 3) {
      console.log("Reached page limit (3 pages), stopping fetch");
      break;
    }
    
    page++;
  }
  
  console.log(`Fetched ${allActivities.length} total activities from Strava across ${page} page(s)`);
  
  const data = allActivities;

  const runs = (data || [])
    .filter(a => a.type === "Run")
    .map(a => {
      // Extract date from start_date_local (format: "2025-12-30T14:30:00Z" or similar)
      const dateStr = a.start_date_local.split("T")[0];
      
      // Calculate pace (min/mile) from moving_time (seconds) and distance (meters)
      // Pace = (moving_time in minutes) / (distance in miles)
      let pace = null;
      if (a.moving_time && a.distance && a.distance > 0) {
        const distanceMiles = a.distance / 1609.34; // meters to miles
        const timeMinutes = a.moving_time / 60; // seconds to minutes
        pace = timeMinutes / distanceMiles; // min/mile
      }
      
      // Strava reports cadence per foot, so multiply by 2 to get total steps per minute
      let cadence = null;
      if (a.average_cadence && a.average_cadence > 0) {
        const originalCadence = a.average_cadence;
        cadence = originalCadence * 2;
        // Debug: log cadence multiplication
        console.log(`Cadence conversion for ${dateStr}: ${originalCadence} (Strava per foot) -> ${cadence} (total SPM)`);
      }
      
      return {
        date: dateStr,
        distance: a.distance, // meters
        startDate: a.start_date_local,
        name: a.name || "Run",
        pace: pace ? +(pace.toFixed(2)) : null, // min/mile, rounded to 2 decimals
        averageHeartrate: a.average_heartrate || null, // bpm
        maxHeartrate: a.max_heartrate || null, // bpm
        cadence: cadence, // steps per minute (SPM) - already multiplied by 2
        movingTime: a.moving_time || null // seconds
      };
    });

  // Debug: log recent runs
  const topRuns = runs.slice(0, 10);
  console.log("Recent Strava runs (first 10):", topRuns.map(r => ({ 
    date: r.date, 
    distance: (r.distance / 1609.34).toFixed(2) + " miles",
    name: r.name,
    cadence: r.cadence ? r.cadence + " spm" : "N/A"
  })));
  console.log("Total runs fetched:", runs.length);
  console.log("Date range of runs:", runs.length > 0 ? {
    earliest: runs[runs.length - 1].date,
    latest: runs[0].date
  } : "No runs");
  
  // Check specifically for Dec 30 and recent dates
  const dec30Runs = runs.filter(r => r.date === "2025-12-30");
  const last2DaysRuns = runs.filter(r => {
    const runDate = new Date(r.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - runDate) / (1000 * 60 * 60 * 24));
    return daysDiff <= 2; // Last 2 days
  });
  
  console.log("December 30th runs:", dec30Runs.length, dec30Runs.map(r => ({
    date: r.date,
    distance: (r.distance / 1609.34).toFixed(2) + " miles",
    name: r.name,
    startDate: r.startDate,
    id: r.id
  })));
  console.log("Recent runs (last 2 days):", last2DaysRuns.map(r => ({
    date: r.date,
    distance: (r.distance / 1609.34).toFixed(2) + " miles",
    name: r.name
  })));

  return runs;
}

/* =========================
   OURA
========================= */

// Sleep durations + stages (REAL seconds)
async function getOuraSleepDurations(start, end) {
  const res = await fetch(
    `https://api.ouraring.com/v2/usercollection/sleep?start_date=${start}&end_date=${end}`,
    { headers: { Authorization: `Bearer ${OURA_ACCESS_TOKEN}` } }
  );

  const data = await res.json();

  return (data.data || []).map(s => ({
    date: s.day,
    total: s.total_sleep_duration ?? 0,
    rem: s.rem_sleep_duration ?? 0,
    deep: s.deep_sleep_duration ?? 0,
    light: s.light_sleep_duration ?? 0
  }));
}

// Sleep scores only
async function getOuraSleepScores(start, end) {
  const res = await fetch(
    `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${start}&end_date=${end}`,
    { headers: { Authorization: `Bearer ${OURA_ACCESS_TOKEN}` } }
  );

  const data = await res.json();

  return (data.data || []).map(s => ({
    date: s.day,
    score: s.score
  }));
}

// Readiness scores
async function getOuraReadinessScores(start, end) {
  const res = await fetch(
    `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${start}&end_date=${end}`,
    { headers: { Authorization: `Bearer ${OURA_ACCESS_TOKEN}` } }
  );

  const data = await res.json();

  return (data.data || []).map(r => ({
    date: r.day,
    score: r.score
  }));
}

// Aggregate multiple sleep sessions per day
function aggregateSleepByDay(sessions) {
  const byDate = {};

  sessions.forEach(s => {
    if (!byDate[s.date]) {
      byDate[s.date] = {
        total: 0,
        rem: 0,
        deep: 0,
        light: 0
      };
    }

    byDate[s.date].total += s.total;
    byDate[s.date].rem += s.rem;
    byDate[s.date].deep += s.deep;
    byDate[s.date].light += s.light;
  });

  return byDate;
}

/* =========================
   MERGE EVERYTHING
========================= */

export default async function mergeData(startDate = "2025-12-01", endDate = "2025-12-31") {
  const runs = await getStravaActivities();

  const sleepScores = await getOuraSleepScores(
    startDate,
    endDate
  );

  const readinessScores = await getOuraReadinessScores(
    startDate,
    endDate
  );

  const sleepSessions = await getOuraSleepDurations(
    startDate,
    endDate
  );

  const sleepByDate = aggregateSleepByDay(sleepSessions);

  const merged = {};

  // Initialize with sleep data
  sleepScores.forEach(s => {
    merged[s.date] = {
      sleep: {
        total: sleepByDate[s.date]?.total ?? null,
        rem: sleepByDate[s.date]?.rem ?? null,
        deep: sleepByDate[s.date]?.deep ?? null,
        light: sleepByDate[s.date]?.light ?? null,
        score: s.score
      },
      readiness: null,
      runs: []
    };
  });

  // Add readiness scores
  readinessScores.forEach(r => {
    if (!merged[r.date]) {
      merged[r.date] = {
        sleep: null,
        readiness: null,
        runs: []
      };
    }
    merged[r.date].readiness = {
      score: r.score
    };
  });

  // Merge runs
  runs.forEach(r => {
    if (!merged[r.date]) {
      merged[r.date] = {
        sleep: null,
        readiness: null,
        runs: []
      };
    }
    merged[r.date].runs.push(r);
    // Debug: log when adding runs
    if (r.date === "2025-12-30") {
      console.log(`Adding Dec 30 run to merged data: ${(r.distance / 1609.34).toFixed(2)} miles`);
      console.log(`Merged entry for Dec 30 now has ${merged[r.date].runs.length} run(s)`);
    }
  });

  // Debug: log dates with runs
  const datesWithRuns = Object.entries(merged)
    .filter(([date, value]) => value.runs && value.runs.length > 0)
    .map(([date]) => date)
    .sort();
  console.log("Dates with runs in merged data:", datesWithRuns.slice(-10));
  console.log("Latest date with run:", datesWithRuns.length > 0 ? datesWithRuns[datesWithRuns.length - 1] : "none");
  console.log("Requested date range:", startDate, "to", endDate);

  // Sort by date
  return Object.fromEntries(
    Object.entries(merged).sort(([a], [b]) =>
      a.localeCompare(b)
    )
  );
}

