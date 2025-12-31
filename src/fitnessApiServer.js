import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mergeData from "./services/stravaOuraIntegration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Serve frontend
app.use(express.static(join(__dirname, "..", "public"), { index: "trainingDashboard.html" }));

function formatSeconds(seconds) {
  if (!seconds || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

app.get("/data", async (req, res) => {
  console.log("[API] /data endpoint hit");

  try {
    // Get date range from query parameters, default to December 2025
    const startDate = req.query.startDate || "2025-12-01";
    const endDate = req.query.endDate || "2025-12-31";
    
    console.log(`Fetching data for range: ${startDate} to ${endDate}`);

    const merged = await mergeData(startDate, endDate);

    // Get all available dates for debugging
    const allDates = Object.keys(merged).sort();
    console.log(`Available dates in merged data: ${allDates.slice(0, 5).join(', ')}...${allDates.slice(-5).join(', ')}`);
    console.log(`Total dates available: ${allDates.length}`);

    // Filter data by date range (using string comparison for reliability)
    const filtered = Object.entries(merged)
      .filter(([date, value]) => {
        // Simple string comparison works for YYYY-MM-DD format
        const included = date >= startDate && date <= endDate;
        if (!included && date >= startDate) {
          console.log(`Date ${date} excluded: ${date} > ${endDate}?`);
        }
        // Also log dates with runs that are being included
        if (included && value.runs && value.runs.length > 0) {
          console.log(`Date ${date} included with ${value.runs.length} run(s), total distance: ${value.runs.reduce((sum, r) => sum + r.distance, 0) / 1609.34} miles`);
        }
        return included;
      });
    
    console.log(`Filtered to ${filtered.length} dates`);
    
    // Create a map of filtered data for quick lookup
    const filteredMap = new Map(filtered);
    
    // Generate all dates in the range and ensure each has an entry
    const allDatesInRange = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      allDatesInRange.push(dateStr);
    }
    
    console.log(`Generated ${allDatesInRange.length} dates in range ${startDate} to ${endDate}`);
    console.log(`Last date in range: ${allDatesInRange[allDatesInRange.length - 1]}`);
    
    const mapped = allDatesInRange.map(date => {
        const value = filteredMap.get(date) || { runs: [], sleep: null, readiness: null };
        
        // Debug Dec 30 specifically
        if (date === "2025-12-30") {
          console.log("[DEBUG] Processing Dec 30 in API response:", {
            hasValue: !!filteredMap.get(date),
            hasSleep: !!value.sleep,
            sleepTotal: value.sleep?.total,
            sleepTotalFormatted: value.sleep?.total ? formatSeconds(value.sleep.total) : null,
            sleepLight: value.sleep?.light,
            sleepREM: value.sleep?.rem,
            sleepDeep: value.sleep?.deep,
            sleepScore: value.sleep?.score,
            runsCount: value.runs?.length || 0
          });
        }
        
        const totalMeters = value.runs && value.runs.length
          ? value.runs.reduce((sum, r) => sum + r.distance, 0)
          : 0;
        
        const distanceMiles = +(totalMeters / 1609.34).toFixed(2);
        
        // Calculate pace and heart rate metrics
        const runsWithPace = value.runs.filter(r => r.pace !== null && r.pace > 0);
        const runsWithHR = value.runs.filter(r => r.averageHeartrate !== null);
        
        // Calculate weighted average pace (weighted by distance)
        let avgPace = null;
        if (runsWithPace.length > 0) {
          let totalWeightedPace = 0;
          let totalDistance = 0;
          runsWithPace.forEach(r => {
            totalWeightedPace += r.pace * r.distance;
            totalDistance += r.distance;
          });
          if (totalDistance > 0) {
            avgPace = +(totalWeightedPace / totalDistance).toFixed(2);
          }
        }
        
        // Calculate weighted average heart rate (weighted by distance)
        let avgHeartrate = null;
        if (runsWithHR.length > 0) {
          let totalWeightedHR = 0;
          let totalDistance = 0;
          runsWithHR.forEach(r => {
            totalWeightedHR += r.averageHeartrate * r.distance;
            totalDistance += r.distance;
          });
          if (totalDistance > 0) {
            avgHeartrate = Math.round(totalWeightedHR / totalDistance);
          }
        }
        
        // Get max heart rate across all runs
        let maxHeartrate = null;
        if (value.runs && value.runs.length > 0) {
          const maxHRs = value.runs
            .map(r => r.maxHeartrate)
            .filter(hr => hr !== null && hr > 0);
          if (maxHRs.length > 0) {
            maxHeartrate = Math.max(...maxHRs);
          }
        }
        
        // Calculate weighted average cadence (weighted by distance)
        const runsWithCadence = value.runs.filter(r => r.cadence !== null && r.cadence > 0);
        let avgCadence = null;
        if (runsWithCadence.length > 0) {
          let totalWeightedCadence = 0;
          let totalDistance = 0;
          runsWithCadence.forEach(r => {
            totalWeightedCadence += r.cadence * r.distance;
            totalDistance += r.distance;
            // Debug: log cadence values being used
            if (date === "2025-12-30" || runsWithCadence.length <= 2) {
              console.log(`Cadence for run on ${date}: ${r.cadence} SPM (distance: ${(r.distance / 1609.34).toFixed(2)} miles)`);
            }
          });
          if (totalDistance > 0) {
            avgCadence = Math.round(totalWeightedCadence / totalDistance);
            if (date === "2025-12-30" || runsWithCadence.length <= 2) {
              console.log(`Weighted avg cadence for ${date}: ${avgCadence} SPM`);
            }
          }
        }
        
        // Debug Dec 30 specifically
        if (date === "2025-12-30") {
          console.log(`Processing Dec 30:`, {
            hasValue: !!filteredMap.get(date),
            runsCount: value.runs ? value.runs.length : 0,
            totalMeters: totalMeters,
            distanceMiles: distanceMiles,
            avgPace: avgPace,
            avgHeartrate: avgHeartrate,
            maxHeartrate: maxHeartrate,
            avgCadence: avgCadence,
            runs: value.runs ? value.runs.map(r => ({ 
              distance: r.distance, 
              date: r.date,
              pace: r.pace,
              avgHR: r.averageHeartrate,
              maxHR: r.maxHeartrate,
              cadence: r.cadence
            })) : []
          });
        }

        return {
          date,
          distance: distanceMiles,

          sleep: value.sleep && value.sleep.total ? formatSeconds(value.sleep.total) : null,
          light: value.sleep && value.sleep.light ? formatSeconds(value.sleep.light) : null,
          rem: value.sleep && value.sleep.rem ? formatSeconds(value.sleep.rem) : null,
          deep: value.sleep && value.sleep.deep ? formatSeconds(value.sleep.deep) : null,

          sleepScore: value.sleep ? value.sleep.score : null,
          readinessScore: value.readiness ? value.readiness.score : null,
          
          pace: avgPace, // min/mile
          averageHeartrate: avgHeartrate, // bpm
          maxHeartrate: maxHeartrate, // bpm
          cadence: avgCadence // steps per minute (SPM)
        };
      });

    console.log(`Final mapped data: ${mapped.length} entries`);
    console.log(`Last entry date: ${mapped[mapped.length - 1].date}, distance: ${mapped[mapped.length - 1].distance}`);
    
    // Debug Dec 30 in final response
    const dec30Entry = mapped.find(d => d.date === "2025-12-30");
    if (dec30Entry) {
      console.log("[DATA] Dec 30 in final API response:", {
        date: dec30Entry.date,
        sleep: dec30Entry.sleep,
        light: dec30Entry.light,
        rem: dec30Entry.rem,
        deep: dec30Entry.deep,
        sleepScore: dec30Entry.sleepScore,
        distance: dec30Entry.distance
      });
    } else {
      console.log("[ERROR] Dec 30 NOT FOUND in final mapped data");
    }

    return res.json(mapped);
  } catch (err) {
    console.error("[ERROR] /data error:", err);
    return res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Fallback: serve trainingDashboard.html for all other routes (SPA support)
// This must be last, after all other routes and static files
app.use((req, res) => {
  // Serve trainingDashboard.html for all non-API routes (SPA routing support)
  res.sendFile(join(__dirname, "..", "public", "trainingDashboard.html"), (err) => {
    if (err) {
      console.error("Error sending trainingDashboard.html:", err);
      res.status(500).send("Error loading page");
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

