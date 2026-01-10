import express from "express";
import session from "express-session";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";
import createMergeDataFunction from "./services/stravaOuraIntegration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Global Redis client for data caching (separate from session store)
let redisDataClient = null;

// Setup Redis if URL is provided
async function setupRedis() {
  if (!process.env.REDIS_URL) {
    console.log('[SESSION] [INFO] No REDIS_URL found, using memory session store (development mode)');
    return { store: null, dataClient: null };
  }

  try {
    console.log('[REDIS] [INFO] Attempting to connect to Redis...');
    const { createClient } = await import('redis');
    const RedisStore = (await import('connect-redis')).default;
    
    // Create Redis client for session store
    const redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: process.env.REDIS_URL.startsWith('rediss://'),
        rejectUnauthorized: false
      }
    });
    
    // Create separate Redis client for data caching
    redisDataClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: process.env.REDIS_URL.startsWith('rediss://'),
        rejectUnauthorized: false
      }
    });
    
    redisClient.on('error', (err) => {
      console.log('[REDIS] [ERROR] Redis Session Client Error:', err.message);
    });
    
    redisDataClient.on('error', (err) => {
      console.log('[REDIS] [ERROR] Redis Data Client Error:', err.message);
    });
    
    redisClient.on('connect', () => {
      console.log('[REDIS] [INFO] Successfully connected to Redis (session store)');
    });
    
    redisDataClient.on('connect', () => {
      console.log('[REDIS] [INFO] Successfully connected to Redis (data cache)');
    });
    
    await redisClient.connect();
    await redisDataClient.connect();
    
    const store = new RedisStore({ client: redisClient });
    console.log('[SESSION] [INFO] Using Redis session store');
    console.log('[CACHE] [INFO] Redis data cache client ready');
    
    return { store, dataClient: redisDataClient };
  } catch (error) {
    console.log('[SESSION] [WARNING] Redis setup failed, using memory store:', error.message);
    return { store: null, dataClient: null };
  }
}

// Initialize app with async setup
async function startServer() {
  // Setup session store and data cache client
  const { store: sessionStore, dataClient } = await setupRedis();
  redisDataClient = dataClient; // Make it globally available
  
  // Trust proxy for Railway (needed for secure cookies)
  app.set('trust proxy', 1);
  
  // Configure session middleware
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'change-this-secret-key-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax' // Allow cookies on redirects
    }
  }));

  console.log('[SESSION] [INFO] Session middleware configured');

  app.use(express.json());

  // Log all incoming requests for debugging
  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.path} from ${req.ip}`);
    console.log(`[SESSION] Session ID: ${req.sessionID || 'none'}`);
    console.log(`[SESSION] Has Strava: ${!!req.session?.stravaTokens}, Has Oura: ${!!req.session?.ouraToken}`);
    next();
  });

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
     CACHE HELPER FUNCTIONS
  ========================= */

  // Cache expiration time: 24 hours (in seconds)
  const CACHE_EXPIRY = 24 * 60 * 60;

  // Get cache key prefix for a session
  function getCacheKeyPrefix(sessionId) {
    return `cache:${sessionId}`;
  }

  // Get cached data for a session
  async function getCachedData(sessionId, dataType) {
    if (!redisDataClient) {
      console.log('[CACHE] [INFO] Redis not available, skipping cache');
      return null;
    }

    try {
      const key = `${getCacheKeyPrefix(sessionId)}:${dataType}`;
      const data = await redisDataClient.get(key);
      if (data) {
        console.log(`[CACHE] [HIT] Found cached ${dataType} for session ${sessionId.substring(0, 8)}...`);
        return JSON.parse(data);
      }
      console.log(`[CACHE] [MISS] No cached ${dataType} for session ${sessionId.substring(0, 8)}...`);
      return null;
    } catch (error) {
      console.error(`[CACHE] [ERROR] Failed to get cached ${dataType}:`, error.message);
      return null;
    }
  }

  // Set cached data for a session
  async function setCachedData(sessionId, dataType, data) {
    if (!redisDataClient) {
      console.log('[CACHE] [INFO] Redis not available, skipping cache set');
      return false;
    }

    try {
      const key = `${getCacheKeyPrefix(sessionId)}:${dataType}`;
      await redisDataClient.setEx(key, CACHE_EXPIRY, JSON.stringify(data));
      console.log(`[CACHE] [SET] Cached ${dataType} for session ${sessionId.substring(0, 8)}... (expires in ${CACHE_EXPIRY}s)`);
      return true;
    } catch (error) {
      console.error(`[CACHE] [ERROR] Failed to set cached ${dataType}:`, error.message);
      return false;
    }
  }

  // Get cache timestamp
  async function getCacheTimestamp(sessionId) {
    if (!redisDataClient) return null;
    try {
      const timestamp = await redisDataClient.get(`${getCacheKeyPrefix(sessionId)}:timestamp`);
      return timestamp ? parseInt(timestamp) : null;
    } catch (error) {
      console.error('[CACHE] [ERROR] Failed to get cache timestamp:', error.message);
      return null;
    }
  }

  // Set cache timestamp
  async function setCacheTimestamp(sessionId) {
    if (!redisDataClient) return false;
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      await redisDataClient.setEx(`${getCacheKeyPrefix(sessionId)}:timestamp`, CACHE_EXPIRY, timestamp.toString());
      return true;
    } catch (error) {
      console.error('[CACHE] [ERROR] Failed to set cache timestamp:', error.message);
      return false;
    }
  }

  // Check if cache is fresh (less than 24 hours old)
  async function isCacheFresh(sessionId) {
    const timestamp = await getCacheTimestamp(sessionId);
    if (!timestamp) return false;
    
    const age = Math.floor(Date.now() / 1000) - timestamp;
    const isFresh = age < CACHE_EXPIRY;
    console.log(`[CACHE] [INFO] Cache age: ${age}s, fresh: ${isFresh}`);
    return isFresh;
  }

  // Clear all cache for a session
  async function clearCache(sessionId) {
    if (!redisDataClient) return false;
    try {
      const prefix = getCacheKeyPrefix(sessionId);
      // Get all keys matching the prefix
      const keys = await redisDataClient.keys(`${prefix}:*`);
      if (keys.length > 0) {
        await redisDataClient.del(keys);
        console.log(`[CACHE] [CLEAR] Cleared ${keys.length} cache entries for session ${sessionId.substring(0, 8)}...`);
      }
      return true;
    } catch (error) {
      console.error('[CACHE] [ERROR] Failed to clear cache:', error.message);
      return false;
    }
  }

  /* =========================
     DATA SYNC FUNCTION
  ========================= */

  // Sync all user data to cache (called after authentication)
  async function syncUserDataToCache(sessionId, stravaTokens, ouraToken) {
    if (!redisDataClient) {
      console.log('[SYNC] [INFO] Redis not available, skipping data sync');
      return false;
    }

    console.log(`[SYNC] [INFO] Starting data sync for session ${sessionId.substring(0, 8)}...`);

    try {
      // Fetch historical data - use a wide date range (last 2 years should cover most users)
      const endDate = new Date();
      // Expand end date by 1 day for sleep data (like mergeData does)
      endDate.setDate(endDate.getDate() + 1);
      const cacheEndDate = endDate.toISOString().split('T')[0];
      
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      const historicalStartDate = startDate.toISOString().split('T')[0];

      console.log(`[SYNC] [INFO] Fetching data from ${historicalStartDate} to ${cacheEndDate}`);

      // Use mergeData to fetch and process all data (it handles all the complexity)
      const mergeData = createMergeDataFunction(stravaTokens, ouraToken.accessToken);
      const mergedData = await mergeData(historicalStartDate, cacheEndDate);

      // Extract processed data from merged structure for caching
      // This preserves the merge logic and ensures consistency
      const stravaActivities = [];
      const ouraSleep = [];
      const ouraReadiness = [];

      Object.entries(mergedData).forEach(([date, value]) => {
        // Cache all Strava runs (don't filter by date range - cache everything)
        // Note: Runs already have a date field from getStravaActivities
        if (value.runs && value.runs.length > 0) {
          stravaActivities.push(...value.runs);
        }
        
        // Cache sleep data
        if (value.sleep && (value.sleep.total || value.sleep.score !== null)) {
          ouraSleep.push({
            date,
            total: value.sleep.total ?? 0,
            rem: value.sleep.rem ?? 0,
            deep: value.sleep.deep ?? 0,
            light: value.sleep.light ?? 0,
            score: value.sleep.score ?? null
          });
        }
        
        // Cache readiness data
        if (value.readiness && value.readiness.score !== null) {
          ouraReadiness.push({
            date,
            score: value.readiness.score
          });
        }
      });

      // Cache the data
      await Promise.all([
        setCachedData(sessionId, 'strava:activities', stravaActivities),
        setCachedData(sessionId, 'oura:sleep', ouraSleep),
        setCachedData(sessionId, 'oura:readiness', ouraReadiness),
        setCacheTimestamp(sessionId)
      ]);

      console.log(`[SYNC] [SUCCESS] Cached ${stravaActivities.length} Strava activities, ${ouraSleep.length} sleep sessions, ${ouraReadiness.length} readiness scores`);
      return true;
    } catch (error) {
      console.error('[SYNC] [ERROR] Failed to sync data to cache:', error.message);
      console.error('[SYNC] [ERROR] Stack:', error.stack);
      return false;
    }
  }

  /* =========================
     HEALTH CHECK
  ========================= */
  
  app.get("/health", (req, res) => {
    console.log('[HEALTH] Health check requested');
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /* =========================
     OAUTH ROUTES
  ========================= */

  // Strava OAuth
  app.get("/auth/strava", (req, res) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = process.env.STRAVA_REDIRECT_URI || `http://localhost:3000/auth/strava/callback`;
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
        
        // Explicitly save session before redirect
        req.session.save(async (err) => {
          if (err) {
            console.error('[ERROR] Session save error:', err);
            return res.redirect('/login.html?error=session_save_failed');
          }
          console.log('[SUCCESS] Strava connected successfully');
          
          // If Oura is also connected, trigger data sync in background
          if (req.session.ouraToken) {
            console.log('[SYNC] [INFO] Both Strava and Oura connected, triggering data sync...');
            // Don't await - let it run in background
            syncUserDataToCache(req.sessionID, req.session.stravaTokens, req.session.ouraToken)
              .catch(err => console.error('[SYNC] [ERROR] Background sync failed:', err.message));
          }
          
          res.redirect('/login.html?strava=connected');
        });
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
    const redirectUri = process.env.OURA_REDIRECT_URI || `http://localhost:3000/auth/oura/callback`;
    
    const authUrl = `https://cloud.ouraring.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    res.redirect(authUrl);
  });

  app.get("/auth/oura/callback", async (req, res) => {
    const code = req.query.code;
    
    if (!code) {
      return res.redirect('/login.html?error=oura_auth_failed');
    }
    
    try {
      const redirectUri = process.env.OURA_REDIRECT_URI || `http://localhost:3000/auth/oura/callback`;
      
      const response = await fetch('https://api.ouraring.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
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
        
        // Explicitly save session before redirect
        req.session.save(async (err) => {
          if (err) {
            console.error('[ERROR] Session save error:', err);
            return res.redirect('/login.html?error=session_save_failed');
          }
          console.log('[SUCCESS] Oura connected successfully');
          
          // If Strava is also connected, trigger data sync in background
          if (req.session.stravaTokens) {
            console.log('[SYNC] [INFO] Both Strava and Oura connected, triggering data sync...');
            // Don't await - let it run in background
            syncUserDataToCache(req.sessionID, req.session.stravaTokens, req.session.ouraToken)
              .catch(err => console.error('[SYNC] [ERROR] Background sync failed:', err.message));
          }
          
          res.redirect('/login.html?oura=connected');
        });
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
  app.get("/auth/logout", async (req, res) => {
    const sessionId = req.sessionID;
    
    // Clear cache for this session
    if (sessionId) {
      await clearCache(sessionId);
    }
    
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

      // Check cache first
      const cacheFresh = await isCacheFresh(req.sessionID);
      let merged = null;

      if (cacheFresh && redisDataClient) {
        console.log('[CACHE] [INFO] Cache is fresh, attempting to use cached data...');
        
        // Try to get cached data
        const [cachedActivities, cachedSleep, cachedReadiness] = await Promise.all([
          getCachedData(req.sessionID, 'strava:activities'),
          getCachedData(req.sessionID, 'oura:sleep'),
          getCachedData(req.sessionID, 'oura:readiness')
        ]);

        if (cachedActivities !== null && cachedSleep !== null && cachedReadiness !== null) {
          console.log('[CACHE] [HIT] Using cached data for all sources');
          
          // Reconstruct merged data structure from cache (matching mergeData output)
          merged = {};
          
          // First, add all dates in the requested range to ensure we have entries for all dates
          const allDatesInRange = [];
          const start = new Date(startDate);
          const end = new Date(endDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            allDatesInRange.push(dateStr);
            merged[dateStr] = { runs: [], sleep: null, readiness: null };
          }
          
          // Add sleep data (filter by date range)
          cachedSleep.forEach(s => {
            if (s.date >= startDate && s.date <= endDate) {
              if (!merged[s.date]) {
                merged[s.date] = { runs: [], sleep: null, readiness: null };
              }
              merged[s.date].sleep = {
                total: s.total > 0 ? s.total : null,
                rem: s.rem > 0 ? s.rem : null,
                deep: s.deep > 0 ? s.deep : null,
                light: s.light > 0 ? s.light : null,
                score: s.score ?? null
              };
            }
          });
          
          // Add readiness data (filter by date range)
          cachedReadiness.forEach(r => {
            if (r.date >= startDate && r.date <= endDate) {
              if (!merged[r.date]) {
                merged[r.date] = { runs: [], sleep: null, readiness: null };
              }
              merged[r.date].readiness = {
                score: r.score ?? null
              };
            }
          });
          
          // Add Strava activities (filter by date range)
          cachedActivities.forEach(activity => {
            const activityDate = activity.date;
            if (activityDate >= startDate && activityDate <= endDate) {
              if (!merged[activityDate]) {
                merged[activityDate] = { runs: [], sleep: null, readiness: null };
              }
              merged[activityDate].runs.push(activity);
            }
          });
          
          console.log(`[CACHE] [INFO] Reconstructed merged data for ${Object.keys(merged).length} dates from cache`);
        } else {
          console.log('[CACHE] [MISS] Cache incomplete, will fetch from APIs');
        }
      } else {
        console.log('[CACHE] [MISS] Cache not fresh or Redis unavailable, fetching from APIs');
      }

      // If cache miss, fetch from APIs
      if (!merged) {
        console.log('[API] [INFO] Fetching data from Strava and Oura APIs...');
        const mergeData = createMergeDataFunction(
          req.session.stravaTokens,
          req.session.ouraToken.accessToken
        );
        
        // Fetch with a wider date range to populate cache
        const cacheEndDate = new Date().toISOString().split('T')[0];
        const cacheStartDate = new Date();
        cacheStartDate.setFullYear(cacheStartDate.getFullYear() - 2);
        const historicalStartDate = cacheStartDate.toISOString().split('T')[0];
        
        const allMerged = await mergeData(historicalStartDate, cacheEndDate);
        
        // Filter to requested date range for response
        merged = {};
        Object.entries(allMerged).forEach(([date, value]) => {
          if (date >= startDate && date <= endDate) {
            merged[date] = value;
          }
        });

        // Cache the full dataset in background (don't await)
        syncUserDataToCache(req.sessionID, req.session.stravaTokens, req.session.ouraToken)
          .catch(err => console.error('[CACHE] [ERROR] Background cache update failed:', err.message));
      }

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

  // Cache refresh endpoint (manual invalidation)
  app.post("/cache/refresh", requireAuth, async (req, res) => {
    console.log("[API] /cache/refresh endpoint hit");
    
    try {
      // Clear existing cache
      await clearCache(req.sessionID);
      console.log('[CACHE] [REFRESH] Cleared existing cache');
      
      // Trigger new data sync in background
      syncUserDataToCache(req.sessionID, req.session.stravaTokens, req.session.ouraToken)
        .catch(err => console.error('[CACHE] [ERROR] Background refresh failed:', err.message));
      
      res.json({ 
        success: true, 
        message: 'Cache refresh initiated. Data will be updated shortly.' 
      });
    } catch (error) {
      console.error("[ERROR] /cache/refresh error:", error);
      res.status(500).json({ error: "Failed to refresh cache" });
    }
  });

  // Dashboard route (protected)
  app.get("/dashboard", requireAuth, (req, res) => {
    res.sendFile(join(__dirname, "..", "public", "trainingDashboard.html"));
  });

  // Redirect root to login or dashboard
  app.get("/", (req, res) => {
    console.log('[HTTP] GET / - Session exists:', !!req.session);
    if (req.session && req.session.stravaTokens && req.session.ouraToken) {
      res.redirect('/dashboard');
    } else {
      res.redirect('/login.html');
    }
  });

  // Fallback: serve login or dashboard based on auth status
  app.use((req, res) => {
    if (req.session && req.session.stravaTokens && req.session.ouraToken) {
      res.sendFile(join(__dirname, "..", "public", "trainingDashboard.html"));
    } else {
      res.sendFile(join(__dirname, "..", "public", "login.html"));
    }
  });

  // Start server
  const server = app.listen(port, '0.0.0.0', () => {
    const addr = server.address();
    console.log(`[INFO] Server running on port ${port}`);
    console.log(`[INFO] Listening on ${addr.address}:${addr.port}`);
    console.log(`[INFO] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[INFO] Ready to accept connections`);
  });

  server.on('error', (err) => {
    console.error('[ERROR] Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`[ERROR] Port ${port} is already in use`);
      process.exit(1);
    }
  });

  server.on('connection', (socket) => {
    console.log('[INFO] New connection established');
  });
}

// Start the server
startServer().catch(err => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
