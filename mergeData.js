import fetch from "node-fetch";
import "dotenv/config";

const OURA_ACCESS_TOKEN = process.env.OURA_ACCESS_TOKEN;
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
let STRAVA_REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

// ---------- Refresh Strava token ----------
async function refreshStravaToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: STRAVA_REFRESH_TOKEN,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Error refreshing Strava token:", data);
    throw new Error("Failed to refresh token");
  }

  STRAVA_REFRESH_TOKEN = data.refresh_token; // update refresh token
  return data.access_token;
}

// ---------- Fetch Strava activities ----------
async function getStravaActivities() {
  const accessToken = await refreshStravaToken();

  const res = await fetch(
    "https://www.strava.com/api/v3/athlete/activities?per_page=200", // fetch more if needed
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await res.json();
  if (!Array.isArray(data)) {
    console.error("Unexpected Strava response:", data);
    return [];
  }

  // Filter only Runs
  return data
    .filter(a => a.type === "Run")
    .map(a => ({
      date: a.start_date_local.split("T")[0],
      name: a.name,
      distance: a.distance,
      duration: a.moving_time,
      cadence: a.average_cadence,
      heartrate: a.average_heartrate,
    }));
}

// ---------- Fetch Oura sleep (PAT) ----------
async function getOuraSleep(start, end) {
  const res = await fetch(
    `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${start}&end_date=${end}`,
    { headers: { Authorization: `Bearer ${OURA_ACCESS_TOKEN}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Error fetching Oura daily sleep:", res.status, text);
    return [];
  }

  const data = await res.json();
  return data.data.map(s => ({
    date: s.day,
    total_sleep_score: s.score,
    deep_sleep: s.contributors.deep_sleep,
    rem_sleep: s.contributors.rem_sleep,
    efficiency: s.contributors.efficiency,
    restfulness: s.contributors.restfulness,
    latency: s.contributors.latency,
    timing: s.contributors.timing,
    total_sleep: s.contributors.total_sleep,
  }));
}

export default async function mergeData() {
  const [sleepData, runsData] = await Promise.all([
    getOuraSleep(),      // your Oura function
    getStravaActivities() // your Strava function
  ]);

  const merged = {};
  sleepData.forEach(s => merged[s.date] = { sleep: s, runs: [] });
  runsData.forEach(r => {
    if (!merged[r.date]) merged[r.date] = { sleep: null, runs: [] };
    merged[r.date].runs.push(r);
  });

  // Optional: sort by date ascending
  const sortedMerged = Object.fromEntries(
    Object.entries(merged).sort((a,b) => new Date(a[0]) - new Date(b[0]))
  );

  return sortedMerged; // RETURN the merged object instead of console.log
}

// ---------- Merge by date ----------
// async function mergeData() {
//   const runsData = await getStravaActivities();

//   if (!runsData.length) {
//     console.log("No Strava runs found.");
//     return;
//   }

//   // Determine date range for Oura based on earliest and latest runs
//   const runDates = runsData.map(r => r.date);
//   const startDate = runDates.reduce((min, d) => (d < min ? d : min), runDates[0]);
//   const endDate = runDates.reduce((max, d) => (d > max ? d : max), runDates[0]);

//   const sleepData = await getOuraSleep(startDate, endDate);

//   const merged = {};

//   // Add sleep data
//   sleepData.forEach(s => {
//     merged[s.date] = { sleep: s, runs: [] };
//   });

//   // Add runs data
//   runsData.forEach(r => {
//     if (!merged[r.date]) merged[r.date] = { sleep: null, runs: [] };
//     merged[r.date].runs.push(r);
//   });

//   // Optional: sort by date
//   const sortedMerged = Object.fromEntries(
//     Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))
//   );

//   console.log("Merged Oura + Strava Data:");
//   console.dir(sortedMerged, { depth: null, colors: true });
// }

// // Run
// mergeData();
