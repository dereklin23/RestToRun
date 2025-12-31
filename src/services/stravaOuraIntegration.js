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
      // Extract date from start_date_local
      // Parse as Date object and extract local date components to avoid timezone issues
      let dateStr;
      if (a.start_date_local) {
        // Parse the datetime string - if it has timezone info, Date will handle it
        // Then extract local date components (not UTC) to get the correct local date
        const dateObj = new Date(a.start_date_local);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else {
        // Fallback to start_date (UTC) if start_date_local is not available
        const fallbackDate = a.start_date ? new Date(a.start_date) : new Date();
        const year = fallbackDate.getFullYear();
        const month = String(fallbackDate.getMonth() + 1).padStart(2, '0');
        const day = String(fallbackDate.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }
      
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
// This endpoint also includes sleep scores, so we'll extract both
async function getOuraSleepDurations(start, end) {
  try {
    const url = `https://api.ouraring.com/v2/usercollection/sleep?start_date=${start}&end_date=${end}`;
    console.log(`Fetching Oura sleep data from: ${url}`);
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${OURA_ACCESS_TOKEN}` }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Oura API error (${res.status}):`, errorText);
      throw new Error(`Oura API error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    
    console.log(`Oura sleep API response: ${data.data?.length || 0} sleep sessions returned`);
    console.log(`Date range requested: ${start} to ${end}`);
    
    // Check if there's any data at all and log the full response structure
    if (data.data && data.data.length > 0) {
      console.log(`[SUCCESS] Sleep API returned ${data.data.length} session(s)`);
    } else {
      console.log(`[WARNING] Sleep API returned NO data`);
      if (data.message) {
        console.log(`API message: ${data.message}`);
      }
      if (data.error) {
        console.log(`API error: ${JSON.stringify(data.error)}`);
      }
      console.log(`Full API response: ${JSON.stringify(data, null, 2)}`);
    }
    
    if (data.data && data.data.length > 0) {
      const dates = data.data.map(s => s.day).sort();
      console.log(`Available sleep dates: ${dates.join(', ')} (all dates)`);
      console.log(`Latest sleep date in API: ${dates[dates.length - 1]}`);
      console.log(`Total sleep sessions: ${data.data.length}`);
      
      // Check if Dec 30 exists
      const dec30Sleep = data.data.find(s => s.day === "2025-12-30");
      
      // Also check Dec 29 to compare
      const dec29Sleep = data.data.find(s => s.day === "2025-12-29");
      if (dec29Sleep) {
        console.log("[SUCCESS] Dec 29 sleep session found:", {
          day: dec29Sleep.day,
          total_duration: dec29Sleep.total_sleep_duration,
          has_durations: !!(dec29Sleep.total_sleep_duration && dec29Sleep.total_sleep_duration > 0)
        });
      }
      if (dec30Sleep) {
        console.log("[SUCCESS] Dec 30 sleep data from /sleep endpoint:", {
          day: dec30Sleep.day,
          score: dec30Sleep.score,
          total_sleep_duration: dec30Sleep.total_sleep_duration,
          light_sleep_duration: dec30Sleep.light_sleep_duration,
          rem_sleep_duration: dec30Sleep.rem_sleep_duration,
          deep_sleep_duration: dec30Sleep.deep_sleep_duration,
          total_hours: dec30Sleep.total_sleep_duration ? Math.floor(dec30Sleep.total_sleep_duration / 3600) : 0,
          has_score: dec30Sleep.score !== null && dec30Sleep.score !== undefined,
          // Log the full object to see all available fields
          fullObject: JSON.stringify(dec30Sleep, null, 2)
        });
      } else {
        console.log("[ERROR] Dec 30 NOT found in /sleep endpoint response");
        console.log(`Available dates: ${dates.join(', ')}`);
        console.log(`Date range requested: ${start} to ${end}`);
        console.log(`Latest date in response: ${dates[dates.length - 1]}`);
        
        // Check if Dec 31 exists (maybe sleep from Dec 30 night is labeled as Dec 31)
        const dec31Sleep = data.data.find(s => s.day === "2025-12-31");
        if (dec31Sleep) {
          console.log("[DEBUG] Found Dec 31 sleep - this might be Dec 30 night's sleep:", {
            day: dec31Sleep.day,
            total_duration: dec31Sleep.total_sleep_duration,
            has_durations: !!(dec31Sleep.total_sleep_duration && dec31Sleep.total_sleep_duration > 0)
          });
        }
        
        // Calculate how many days behind
        if (dates.length > 0) {
          const latestDate = new Date(dates[dates.length - 1]);
          const today = new Date();
          const daysDiff = Math.floor((today - latestDate) / (1000 * 60 * 60 * 24));
          console.log(`Days since latest date in API: ${daysDiff}`);
          console.log(`Today's date: ${today.toISOString().split('T')[0]}`);
          console.log(`Latest API date: ${dates[dates.length - 1]}`);
        }
        
        // Log a sample entry to see the structure
        if (data.data && data.data.length > 0) {
          const latest = data.data.find(s => s.day === dates[dates.length - 1]);
          if (latest) {
            console.log(`Sample entry (latest date ${latest.day}):`, {
              day: latest.day,
              total_sleep_duration: latest.total_sleep_duration,
              light_sleep_duration: latest.light_sleep_duration,
              rem_sleep_duration: latest.rem_sleep_duration,
              deep_sleep_duration: latest.deep_sleep_duration,
              score: latest.score,
              // Check for any other date-related fields
              start_date: latest.start_date,
              end_date: latest.end_date,
              bedtime_start: latest.bedtime_start,
              bedtime_end: latest.bedtime_end
            });
          }
        }
        
        console.log("[WARNING] TROUBLESHOOTING:");
        console.log("  1. Check if your Personal Access Token has 'sleep' scope");
        console.log("  2. Try manually syncing in Oura app: Settings > Back up all data");
        console.log("  3. Wait a few more hours - API can take 12-24 hours to sync");
        console.log("  4. Check Oura Cloud dashboard to see if data is there");
      }
    } else {
      console.log("[WARNING] No sleep data returned from Oura API");
      if (data.message) {
        console.log("API message:", data.message);
      }
    }

    const mapped = (data.data || []).map(s => {
      const result = {
        date: s.day,
        total: s.total_sleep_duration ?? 0,
        rem: s.rem_sleep_duration ?? 0,
        deep: s.deep_sleep_duration ?? 0,
        light: s.light_sleep_duration ?? 0,
        score: s.score ?? null // Also extract score from sleep endpoint
      };
      
      // Debug: log if we have a score but no durations (unusual case)
      if (s.day === "2025-12-30") {
        console.log("[DEBUG] Mapping Dec 30 sleep session:", {
          hasTotal: result.total > 0,
          total: result.total,
          totalSeconds: result.total,
          totalHours: result.total > 0 ? Math.floor(result.total / 3600) : 0,
          hasLight: result.light > 0,
          hasREM: result.rem > 0,
          hasDeep: result.deep > 0,
          hasScore: result.score !== null,
          rawTotal: s.total_sleep_duration,
          rawLight: s.light_sleep_duration,
          rawREM: s.rem_sleep_duration,
          rawDeep: s.deep_sleep_duration,
          allFields: Object.keys(s)
        });
      }
      
      return result;
    });
    
    return mapped;
  } catch (error) {
    console.error("Error fetching Oura sleep data:", error.message);
    throw error;
  }
}

// Sleep scores only (fallback to daily_sleep endpoint)
async function getOuraSleepScores(start, end) {
  try {
    const url = `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${start}&end_date=${end}`;
    console.log(`Fetching Oura sleep scores from: ${url}`);
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${OURA_ACCESS_TOKEN}` }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Oura API error (${res.status}):`, errorText);
      // Don't throw - this is a fallback endpoint, continue without scores
      return [];
    }

    const data = await res.json();
    
    console.log(`Oura daily_sleep API response: ${data.data?.length || 0} scores returned`);
    
    if (data.data && data.data.length > 0) {
      const dates = data.data.map(s => s.day).sort();
      console.log(`Available score dates: ${dates.slice(-5).join(', ')} (showing last 5)`);
      
      const dec30Score = data.data.find(s => s.day === "2025-12-30");
      if (dec30Score) {
        console.log("[SUCCESS] Dec 30 sleep score from /daily_sleep endpoint:", {
          day: dec30Score.day,
          score: dec30Score.score
        });
      } else {
        console.log("[ERROR] Dec 30 NOT found in daily_sleep endpoint");
        console.log("Available dates:", dates);
      }
    } else {
      console.log("[WARNING] No sleep scores returned from Oura daily_sleep API");
    }

    return (data.data || []).map(s => ({
      date: s.day,
      score: s.score
    }));
  } catch (error) {
    console.error("Error fetching Oura sleep scores:", error.message);
    // Don't throw - this is a fallback endpoint
    return [];
  }
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
// Also preserve scores from sleep endpoint if available
function aggregateSleepByDay(sessions) {
  const byDate = {};

  sessions.forEach(s => {
    if (!byDate[s.date]) {
      byDate[s.date] = {
        total: 0,
        rem: 0,
        deep: 0,
        light: 0,
        score: null
      };
    }

    byDate[s.date].total += s.total;
    byDate[s.date].rem += s.rem;
    byDate[s.date].deep += s.deep;
    byDate[s.date].light += s.light;
    // Use score from sleep endpoint if available (more up-to-date)
    if (s.score !== null && s.score !== undefined) {
      byDate[s.date].score = s.score;
    }
  });

  return byDate;
}

/* =========================
   MERGE EVERYTHING
========================= */

export default async function mergeData(startDate = "2025-12-01", endDate = "2025-12-31") {
  console.log(`\n[INFO] Starting mergeData for range: ${startDate} to ${endDate}`);
  
  // Expand end date by 1 day to catch any sleep that might be labeled as the next day
  // (e.g., Dec 30 night sleep might be labeled as Dec 31)
  const expandedEndDate = new Date(endDate);
  expandedEndDate.setDate(expandedEndDate.getDate() + 1);
  const expandedEndDateStr = expandedEndDate.toISOString().split('T')[0];
  console.log(`[DATE] Expanded end date to ${expandedEndDateStr} to catch next-day labeled sleep`);
  
  const runs = await getStravaActivities();

  const sleepScores = await getOuraSleepScores(
    startDate,
    expandedEndDateStr
  );

  const readinessScores = await getOuraReadinessScores(
    startDate,
    expandedEndDateStr
  );

  const sleepSessions = await getOuraSleepDurations(
    startDate,
    expandedEndDateStr
  );

  const sleepByDate = aggregateSleepByDay(sleepSessions);

  // Debug: log sleep data
  console.log("Sleep sessions fetched:", sleepSessions.length);
  console.log("Sleep by date keys:", Object.keys(sleepByDate).sort());
  
  // Check if Dec 30 is in sleep sessions before aggregation
  const dec30Sessions = sleepSessions.filter(s => s.date === "2025-12-30");
  if (dec30Sessions.length > 0) {
    console.log(`[SUCCESS] Found ${dec30Sessions.length} sleep session(s) for Dec 30 before aggregation:`, dec30Sessions);
  } else {
    console.log("[ERROR] No sleep sessions found for Dec 30 in raw data");
  }
  
  if (sleepByDate["2025-12-30"]) {
    const dec30Sleep = sleepByDate["2025-12-30"];
    console.log("[SUCCESS] Dec 30 sleep durations after aggregation:", {
      total: dec30Sleep.total,
      totalFormatted: dec30Sleep.total ? `${Math.floor(dec30Sleep.total / 3600)}h ${Math.round((dec30Sleep.total % 3600) / 60)}m` : null,
      light: dec30Sleep.light,
      lightFormatted: dec30Sleep.light ? `${Math.floor(dec30Sleep.light / 3600)}h ${Math.round((dec30Sleep.light % 3600) / 60)}m` : null,
      rem: dec30Sleep.rem,
      remFormatted: dec30Sleep.rem ? `${Math.floor(dec30Sleep.rem / 3600)}h ${Math.round((dec30Sleep.rem % 3600) / 60)}m` : null,
      deep: dec30Sleep.deep,
      deepFormatted: dec30Sleep.deep ? `${Math.floor(dec30Sleep.deep / 3600)}h ${Math.round((dec30Sleep.deep % 3600) / 60)}m` : null,
      score: dec30Sleep.score
    });
  } else {
    console.log("[ERROR] Dec 30 NOT in sleepByDate after aggregation");
  }
  console.log("Sleep scores fetched:", sleepScores.length);
  console.log("Sleep score dates:", sleepScores.map(s => s.date).sort());

  const merged = {};

  // Initialize with sleep data from sleep scores
  sleepScores.forEach(s => {
    merged[s.date] = {
      sleep: {
        total: sleepByDate[s.date]?.total ?? null,
        rem: sleepByDate[s.date]?.rem ?? null,
        deep: sleepByDate[s.date]?.deep ?? null,
        light: sleepByDate[s.date]?.light ?? null,
        score: s.score // Use score from daily_sleep endpoint
      },
      readiness: null,
      runs: []
    };
  });

  // Also add/update sleep data for dates that have sleep durations
  // This handles cases where:
  // 1. Sleep data is synced but scores aren't available yet
  // 2. Sleep durations come in after scores (update existing entries)
  // Use score from sleep endpoint if available (it's often more up-to-date)
  Object.keys(sleepByDate).forEach(date => {
    const sleepData = sleepByDate[date];
    if (sleepData && sleepData.total > 0) {
      if (!merged[date]) {
        // Create new entry if it doesn't exist
        merged[date] = {
          sleep: {
            total: sleepData.total,
            rem: sleepData.rem ?? null,
            deep: sleepData.deep ?? null,
            light: sleepData.light ?? null,
            score: sleepData.score ?? null // Use score from sleep endpoint if available
          },
          readiness: null,
          runs: []
        };
        if (sleepData.score) {
          console.log(`Added sleep data for ${date} with score ${sleepData.score} from sleep endpoint`);
        } else {
          console.log(`Added sleep data for ${date} (no score available yet)`);
        }
      } else if (merged[date].sleep) {
        // Update existing entry with durations if they're missing or null
        // This is critical: if we have a score but null durations, update them when available
        const hasNullDurations = merged[date].sleep.total === null || 
                                 merged[date].sleep.total === 0 ||
                                 !merged[date].sleep.total;
        
        if (hasNullDurations && sleepData.total > 0) {
          merged[date].sleep.total = sleepData.total;
          merged[date].sleep.rem = sleepData.rem ?? merged[date].sleep.rem ?? null;
          merged[date].sleep.deep = sleepData.deep ?? merged[date].sleep.deep ?? null;
          merged[date].sleep.light = sleepData.light ?? merged[date].sleep.light ?? null;
          console.log(`[SUCCESS] Updated sleep durations for ${date}: ${Math.floor(sleepData.total / 3600)}h ${Math.round((sleepData.total % 3600) / 60)}m`);
        }
        
        // Update score from sleep endpoint if available
        if (sleepData.score !== null && sleepData.score !== undefined) {
          merged[date].sleep.score = sleepData.score;
          console.log(`Updated sleep score for ${date} to ${sleepData.score} from sleep endpoint`);
        }
      }
    }
  });
  
  // Debug: Log final merged state for Dec 30
  if (merged["2025-12-30"]) {
    const dec30 = merged["2025-12-30"];
    console.log("[DEBUG] Final merged Dec 30 data:", {
      hasSleep: !!dec30.sleep,
      total: dec30.sleep?.total,
      totalFormatted: dec30.sleep?.total ? `${Math.floor(dec30.sleep.total / 3600)}h ${Math.round((dec30.sleep.total % 3600) / 60)}m` : null,
      light: dec30.sleep?.light,
      rem: dec30.sleep?.rem,
      deep: dec30.sleep?.deep,
      score: dec30.sleep?.score
    });
  }

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

