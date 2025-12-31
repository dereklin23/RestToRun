import express from "express";
import session from "express-session";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";
import createMergeDataFunction from "./services/stravaOuraIntegration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-key-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

app.use(express.json());

// Serve static files (excluding protected files)
const staticOptions = {
  setHeaders: (res, path) => {
    // Prevent caching of HTML files to ensure auth checks work
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
  index: false // Don't automatically serve index.html
};

app.use(express.static(join(__dirname, "..", "public"), staticOptions));

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.stravaTokens || !req.session.ouraToken) {
    return res.redirect('/login.html');
  }
  next();
}

// Format helper
function formatSeconds(seconds) {
  if (!seconds || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/* =========================
   OAUTH ROUTES
========================= */

// Strava OAuth
app.get("/auth/strava", (req, res) => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = `${process.env.CALLBACK_URL || 'http://localhost:3000'}/auth/strava/callback`;
  const scope = "read,activity:read_all";
  
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=force&scope=${scope}`;
  
  res.redirect(authUrl);
});

app.get("/auth/strava/callback", async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.redirect('/login.html?error=strava_auth_failed');
  }
  
  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
      })
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      req.session.stravaTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at
      };
      
      console.log('[SUCCESS] Strava connected successfully');
      res.redirect('/login.html?strava=connected');
    } else {
      console.log('[ERROR] Strava token exchange failed:', data);
      res.redirect('/login.html?error=strava_token_failed');
    }
  } catch (error) {
    console.error('[ERROR] Strava OAuth error:', error);
    res.redirect('/login.html?error=strava_server_error');
  }
});

// Oura OAuth
app.get("/auth/oura", (req, res) => {
  const clientId = process.env.OURA_CLIENT_ID;
  const redirectUri = `${process.env.CALLBACK_URL || 'http://localhost:3000'}/auth/oura/callback`;
  
  const authUrl = `https://cloud.ouraring.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  res.redirect(authUrl);
});

app.get("/auth/oura/callback", async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.redirect('/login.html?error=oura_auth_failed');
  }
  
  try {
    const response = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.CALLBACK_URL || 'http://localhost:3000'}/auth/oura/callback`,
        client_id: process.env.OURA_CLIENT_ID,
        client_secret: process.env.OURA_CLIENT_SECRET
      })
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      req.session.ouraToken = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token
      };
      
      console.log('[SUCCESS] Oura connected successfully');
      res.redirect('/login.html?oura=connected');
    } else {
      console.log('[ERROR] Oura token exchange failed:', data);
      res.redirect('/login.html?error=oura_token_failed');
    }
  } catch (error) {
    console.error('[ERROR] Oura OAuth error:', error);
    res.redirect('/login.html?error=oura_server_error');
  }
});

// Check auth status
app.get("/auth/status", (req, res) => {
  res.json({
    strava: !!req.session.stravaTokens,
    oura: !!req.session.ouraToken
  });
});

// Logout
app.get("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[ERROR] Session destroy error:', err);
      return res.redirect('/login.html?error=logout_failed');
    }
    console.log('[SUCCESS] User logged out successfully');
    res.redirect('/login.html?logout=success');
  });
});

/* =========================
   DATA ROUTES
========================= */

app.get("/data", requireAuth, async (req, res) => {
  console.log("[API] /data endpoint hit");

  try {
    const startDate = req.query.startDate || "2025-12-01";
    const endDate = req.query.endDate || "2025-12-31";
    
    console.log(`Fetching data for range: ${startDate} to ${endDate}`);

    // Create mergeData function with user's tokens
    const mergeData = createMergeDataFunction(
      req.session.stravaTokens,
      req.session.ouraToken.accessToken
    );
    
    const merged = await mergeData(startDate, endDate);

    // Get all available dates for debugging
    const allDates = Object.keys(merged).sort();
    console.log(`Available dates in merged data: ${allDates.slice(0, 5).join(', ')}...${allDates.slice(-5).join(', ')}`);
    console.log(`Total dates available: ${allDates.length}`);

    // Filter data by date range (using string comparison for reliability)
    const filtered = Object.entries(merged)
      .filter(([date, value]) => {
        const included = date >= startDate && date <= endDate;
        if (!included && date >= startDate) {
          console.log(`Date ${date} excluded: ${date} > ${endDate}?`);
        }
        if (included && value.runs && value.runs.length > 0) {
          console.log(`Date ${date} included with ${value.runs.length} run(s), total distance: ${value.runs.reduce((sum, r) => sum + r.distance, 0) / 1609.34} miles`);
        }
        return included;
      });
    
    console.log(`Filtered to ${filtered.length} dates`);
    
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
      
      const totalMeters = value.runs && value.runs.length
        ? value.runs.reduce((sum, r) => sum + r.distance, 0)
        : 0;
      
      const distanceMiles = +(totalMeters / 1609.34).toFixed(2);
      
      const runsWithPace = value.runs.filter(r => r.pace !== null && r.pace > 0);
      const runsWithHR = value.runs.filter(r => r.averageHeartrate !== null);
      
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
      
      let maxHeartrate = null;
      if (value.runs && value.runs.length > 0) {
        const maxHRs = value.runs
          .map(r => r.maxHeartrate)
          .filter(hr => hr !== null && hr > 0);
        if (maxHRs.length > 0) {
          maxHeartrate = Math.max(...maxHRs);
        }
      }
      
      const runsWithCadence = value.runs.filter(r => r.cadence !== null && r.cadence > 0);
      let avgCadence = null;
      if (runsWithCadence.length > 0) {
        let totalWeightedCadence = 0;
        let totalDistance = 0;
        runsWithCadence.forEach(r => {
          totalWeightedCadence += r.cadence * r.distance;
          totalDistance += r.distance;
        });
        if (totalDistance > 0) {
          avgCadence = Math.round(totalWeightedCadence / totalDistance);
        }
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
        pace: avgPace,
        averageHeartrate: avgHeartrate,
        maxHeartrate: maxHeartrate,
        cadence: avgCadence
      };
    });

    console.log(`Final mapped data: ${mapped.length} entries`);
    console.log(`Last entry date: ${mapped[mapped.length - 1].date}, distance: ${mapped[mapped.length - 1].distance}`);

    return res.json(mapped);
  } catch (err) {
    console.error("[ERROR] /data error:", err);
    return res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Dashboard route (protected)
app.get("/dashboard", requireAuth, (req, res) => {
  res.sendFile(join(__dirname, "..", "public", "trainingDashboard.html"));
});

// Redirect root to login or dashboard
app.get("/", (req, res) => {
  if (req.session.stravaTokens && req.session.ouraToken) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login.html');
  }
});

// Fallback: serve login or dashboard based on auth status
app.use((req, res) => {
  if (req.session.stravaTokens && req.session.ouraToken) {
    res.sendFile(join(__dirname, "..", "public", "trainingDashboard.html"));
  } else {
    res.sendFile(join(__dirname, "..", "public", "login.html"));
  }
});

app.listen(port, () => {
  console.log(`[INFO] Server running at http://localhost:${port}`);
  console.log(`[INFO] Make sure to set up your OAuth apps and update .env file`);
});
