// Prevent multiple initializations
let chartsInitialized = false;
let isInitializing = false;
let sleepChartInstance = null;
let distanceChartInstance = null;
let mileageChartInstance = null;
let initRetryCount = 0;
const MAX_RETRIES = 50; // Max 5 seconds of retries

// Initialize Training Load Analyzer
let trainingLoadAnalyzer = null;

// Initialize Yearly Goals Planner
let yearlyGoalsPlanner = null;

// Get chart colors based on current theme
function getChartColors() {
  const isDark = document.documentElement.classList.contains('dark-theme');
  
  if (isDark) {
    return {
      text: '#ecf0f1',
      textSecondary: '#bdc3c7',
      grid: 'rgba(255, 255, 255, 0.1)',
      border: 'rgba(255, 255, 255, 0.2)',
      tooltipBg: 'rgba(0, 0, 0, 0.9)',
      tooltipBorder: 'rgba(255, 255, 255, 0.3)'
    };
  } else {
    return {
      text: '#2c3e50',
      textSecondary: '#7f8c8d',
      grid: 'rgba(0, 0, 0, 0.05)',
      border: 'rgba(255, 255, 255, 0.2)',
      tooltipBg: 'rgba(0, 0, 0, 0.8)',
      tooltipBorder: 'rgba(255, 255, 255, 0.2)'
    };
  }
}

// Wait for DOM and Chart.js to be ready
function initCharts() {
  // Prevent multiple calls
  if (chartsInitialized) {
    console.log("Charts already initialized, skipping...");
    return;
  }

  // Prevent concurrent initialization
  if (isInitializing) {
    console.log("Initialization already in progress, skipping...");
    return;
  }

  // Check retry limit
  if (initRetryCount >= MAX_RETRIES) {
    console.error("Max retries reached, giving up on chart initialization");
    return;
  }

  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    initRetryCount++;
    console.log(`Waiting for Chart.js... (attempt ${initRetryCount})`);
    setTimeout(initCharts, 100);
    return;
  }

  // Check if canvas elements exist
  const sleepChartEl = document.getElementById("sleepChart");
  const distanceChartEl = document.getElementById("distanceChart");
  
  if (!sleepChartEl || !distanceChartEl) {
    initRetryCount++;
    console.log(`Waiting for canvas elements... (attempt ${initRetryCount})`);
    setTimeout(initCharts, 100);
    return;
  }

  // Check if charts already exist on these canvases
  if (sleepChartEl.chart || distanceChartEl.chart) {
    console.log("Charts already exist on canvas elements");
    chartsInitialized = true;
    return;
  }

  isInitializing = true;
  chartsInitialized = true;
  
  // Set default to today if dates are not set
  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');
  if (startInput && endInput && !startInput.value) {
    // Get today's date in local timezone explicitly
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    startInput.value = formatDate(today);
    endInput.value = formatDate(today);
    
    // Mark "Today" button as active
    const todayButton = document.querySelector('[data-preset="today"]');
    if (todayButton) {
      document.querySelectorAll('[data-preset]').forEach(btn => btn.classList.remove('active'));
      todayButton.classList.add('active');
    }
  }
  
  loadDataAndCreateCharts();
}

async function loadData(startDate, endDate) {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const url = `/data${params.toString() ? '?' + params.toString() : ''}`;
    console.log("Fetching data from", url);
    console.log("Requested date range:", startDate, "to", endDate);
    console.log("Today's date:", new Date().toISOString().split('T')[0]);
    const res = await fetch(url);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`HTTP error! status: ${res.status}`, errorText);
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    console.log("Data fetched successfully, type:", typeof data, "length:", Array.isArray(data) ? data.length : "N/A");
    
    if (!Array.isArray(data)) {
      console.error("Data is not an array:", data);
      return [];
    }
    
    return data;
  } catch (error) {
    console.error("[ERROR] Error loading data:", error);
    return [];
  }
}

function formatDateRangeTitle(startDate, endDate, activePreset = null) {
  if (!startDate || !endDate) return "Dashboard";
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if it's a single day (Today view)
  const isSameDay = startDate === endDate;
  if (isSameDay) {
    // Check if it's actually today (using local timezone)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const todayStr = formatDate(today);
    
    if (startDate === todayStr) {
      return "Today";
    } else {
      // Single day but not today - show the date
      const dayName = start.toLocaleString('default', { weekday: 'long' });
      const month = start.toLocaleString('default', { month: 'long' });
      const day = start.getDate();
      const year = start.getFullYear();
      return `${dayName}, ${month} ${day}, ${year}`;
    }
  }
  
  // Check for preset date ranges - compare date strings directly to avoid timezone issues
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const todayStr = formatDate(today);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const lastYear = currentYear - 1;
  
  // Parse the date strings to extract year, month, day
  const startParts = startDate.split('-');
  const endParts = endDate.split('-');
  
  if (startParts.length === 3 && endParts.length === 3) {
    const startYear = parseInt(startParts[0], 10);
    const startMonth = parseInt(startParts[1], 10);
    const startDay = parseInt(startParts[2], 10);
    const endYear = parseInt(endParts[0], 10);
    const endMonth = parseInt(endParts[1], 10);
    const endDay = parseInt(endParts[2], 10);
    
    // Check for "Last 7 Days" (endDate is today, startDate is 6 days before)
    if (endDate === todayStr) {
      const sixDaysAgo = new Date(today);
      sixDaysAgo.setDate(today.getDate() - 6);
      const sixDaysAgoStr = formatDate(sixDaysAgo);
      if (startDate === sixDaysAgoStr) {
        return "Last 7 Days";
      }
      
      // Check for "Last 30 Days" (endDate is today, startDate is 29 days before)
      const twentyNineDaysAgo = new Date(today);
      twentyNineDaysAgo.setDate(today.getDate() - 29);
      const twentyNineDaysAgoStr = formatDate(twentyNineDaysAgo);
      if (startDate === twentyNineDaysAgoStr) {
        return "Last 30 Days";
      }
      
      // Check for "This Month" (startDate is first day of current month, endDate is today)
      const firstOfMonth = new Date(currentYear, currentMonth, 1);
      const firstOfMonthStr = formatDate(firstOfMonth);
      const isThisMonth = startDate === firstOfMonthStr && endDate === todayStr;
      
      // Check for "This Year" (startDate is Jan 1 of current year, endDate is today)
      const isThisYear = startYear === currentYear && startMonth === 1 && startDay === 1 && endDate === todayStr;
      
      // In January, both "This Month" and "This Year" produce the same date range (Jan 1 to today)
      // Use the active preset to determine which one to show
      if (isThisMonth && isThisYear) {
        // Ambiguous case (January) - use preset if available
        if (activePreset === 'thisYear') {
          return "This Year";
        } else if (activePreset === 'thisMonth') {
          return "This Month";
        }
        // Fallback: prefer "This Month" as it's more specific
        return "This Month";
      }
      
      // Non-ambiguous cases
      if (isThisMonth) {
        return "This Month";
      }
      
      if (isThisYear) {
        return "This Year";
      }
    }
    
    // Check for "Last Month" (first day to last day of previous month)
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth, 0); // Last day of last month
    const lastMonthStartStr = formatDate(lastMonthStart);
    const lastMonthEndStr = formatDate(lastMonthEnd);
    if (startDate === lastMonthStartStr && endDate === lastMonthEndStr) {
      return "Last Month";
    }
    
    // Check for "Last Year" (Jan 1 to Dec 31 of previous year)
    const isLastYear = startYear === lastYear && 
                       endYear === lastYear &&
                       startMonth === 1 && startDay === 1 &&
                       endMonth === 12 && endDay === 31;
    
    if (isLastYear) {
      return "Last Year";
    }
  }
  
  const startMonth = start.toLocaleString('default', { month: 'long' });
  const startYear = start.getFullYear();
  const endMonth = end.toLocaleString('default', { month: 'long' });
  const endYear = end.getFullYear();
  
  // Same month and year
  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${startYear}`;
  }
  
  // Same year, different months
  if (startYear === endYear) {
    return `${startMonth} - ${endMonth} ${startYear}`;
  }
  
  // Different years
  return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
}

function updatePageTitle(startDate, endDate) {
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) {
    // Check which preset button is active to get the correct title
    const activePresetButton = document.querySelector('[data-preset].active');
    const preset = activePresetButton ? activePresetButton.getAttribute('data-preset') : null;
    titleEl.textContent = formatDateRangeTitle(startDate, endDate, preset);
  }
}

function parseHours(str) {
  if (!str) return 0;
  try {
    // Format is "8h 30m" or similar
    const parts = str.split(" ");
    let hours = 0;
    let minutes = 0;
    
    parts.forEach(part => {
      if (part.endsWith("h")) {
        hours = parseInt(part) || 0;
      } else if (part.endsWith("m")) {
        minutes = parseInt(part) || 0;
      }
    });
    
    return hours + minutes / 60;
  } catch (error) {
    console.error("Error parsing hours:", str, error);
    return 0;
  }
}

function updateStatistics(data, totalSleep, light, rem, deep, distance, sleepScores, readinessScores, pace, averageHeartrate, maxHeartrate, cadence, isSingleDay = false) {
  const statsContainer = document.getElementById('statsContainer');
  if (!statsContainer) return;
  
  // Calculate statistics
  const validSleep = totalSleep.filter(s => s > 0);
  const validDistance = distance.filter(d => d > 0);
  const validSleepScores = sleepScores.filter(s => s !== null && s !== undefined);
  const validReadinessScores = readinessScores.filter(r => r !== null && r !== undefined);
  const validPace = pace.filter(p => p !== null && p > 0);
  const validAvgHR = averageHeartrate.filter(hr => hr !== null && hr > 0);
  const validMaxHR = maxHeartrate.filter(hr => hr !== null && hr > 0);
  const validCadence = cadence.filter(c => c !== null && c > 0);
  
  const totalSleepHours = validSleep.reduce((sum, h) => sum + h, 0);
  const avgSleepHours = validSleep.length > 0 ? totalSleepHours / validSleep.length : 0;
  
  const totalDistance = validDistance.reduce((sum, d) => sum + d, 0);
  const avgDistance = validDistance.length > 0 ? totalDistance / validDistance.length : 0;
  const maxDistance = validDistance.length > 0 ? Math.max(...validDistance) : 0;
  
  const totalLight = light.reduce((sum, h) => sum + h, 0);
  const totalREM = rem.reduce((sum, h) => sum + h, 0);
  const totalDeep = deep.reduce((sum, h) => sum + h, 0);
  
  const avgSleepScore = validSleepScores.length > 0 
    ? (validSleepScores.reduce((sum, s) => sum + s, 0) / validSleepScores.length).toFixed(1)
    : 'N/A';
  
  const avgReadinessScore = validReadinessScores.length > 0
    ? (validReadinessScores.reduce((sum, r) => sum + r, 0) / validReadinessScores.length).toFixed(1)
    : 'N/A';
  
  // Calculate pace statistics (weighted by distance)
  let avgPace = null;
  let bestPace = null;
  if (validPace.length > 0 && validDistance.length > 0) {
    // Match pace with distance for weighted average
    let totalWeightedPace = 0;
    let totalDist = 0;
    data.forEach((d, i) => {
      if (pace[i] !== null && pace[i] > 0 && distance[i] > 0) {
        totalWeightedPace += pace[i] * distance[i];
        totalDist += distance[i];
      }
    });
    if (totalDist > 0) {
      avgPace = totalWeightedPace / totalDist;
    }
    // Best (fastest) pace is the minimum value
    bestPace = Math.min(...validPace);
  }
  
  // Calculate heart rate statistics
  let avgHR = null;
  if (validAvgHR.length > 0) {
    // Weighted by distance
    let totalWeightedHR = 0;
    let totalDist = 0;
    data.forEach((d, i) => {
      if (averageHeartrate[i] !== null && averageHeartrate[i] > 0 && distance[i] > 0) {
        totalWeightedHR += averageHeartrate[i] * distance[i];
        totalDist += distance[i];
      }
    });
    if (totalDist > 0) {
      avgHR = totalWeightedHR / totalDist;
    }
  }
  
  const maxHR = validMaxHR.length > 0 ? Math.max(...validMaxHR) : null;
  
  // Calculate cadence statistics (weighted by distance)
  let avgCadence = null;
  if (validCadence.length > 0) {
    // Weighted by distance
    let totalWeightedCadence = 0;
    let totalDist = 0;
    data.forEach((d, i) => {
      if (cadence[i] !== null && cadence[i] > 0 && distance[i] > 0) {
        totalWeightedCadence += cadence[i] * distance[i];
        totalDist += distance[i];
      }
    });
    if (totalDist > 0) {
      avgCadence = totalWeightedCadence / totalDist;
    }
  }
  
  // Calculate crowns (score >= 85)
  const sleepCrowns = validSleepScores.filter(s => s >= 85).length;
  const readinessCrowns = validReadinessScores.filter(r => r >= 85).length;
  const totalCrowns = sleepCrowns + readinessCrowns;
  
  const daysWithRuns = validDistance.length;
  const daysWithSleep = validSleep.length;
  
  // Format helper
  const formatHours = (hours) => {
    if (!hours || hours === 0) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m > 0) return `${h}h ${m}m`;
    return `${h}h`;
  };
  
  // Format pace (min/mile) to MM:SS format
  const formatPace = (paceMinutes) => {
    if (!paceMinutes || paceMinutes === 0) return 'N/A';
    const minutes = Math.floor(paceMinutes);
    const seconds = Math.round((paceMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Get score color based on value (Oura scores are 0-100)
  const getScoreColor = (score) => {
    if (score === 'N/A') return '#95a5a6';
    const num = parseFloat(score);
    if (num >= 85) return '#27ae60'; // Green for excellent
    if (num >= 70) return '#f39c12'; // Orange for good
    if (num >= 55) return '#e67e22'; // Dark orange for fair
    return '#e74c3c'; // Red for poor
  };
  
  // Create stats cards - simplified for single day, full for multiple days
  if (isSingleDay) {
    // Simplified view for single day: Sleep Total, Total Distance, Runs, Pace
    const todaySleep = totalSleepHours > 0 ? formatHours(totalSleepHours) : 'N/A';
    const todayDistance = totalDistance > 0 ? totalDistance.toFixed(1) : '0.0';
    const todayRuns = daysWithRuns;
    const todayPace = avgPace !== null ? formatPace(avgPace) : 'N/A';
    
    statsContainer.innerHTML = `
      <div class="stat-card distance">
        <div class="stat-label">Total Distance</div>
        <div class="stat-value" style="font-size: 36px;">${todayDistance}</div>
        <div class="stat-unit">miles</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Runs</div>
        <div class="stat-value" style="font-size: 36px;">${todayRuns}</div>
        <div class="stat-unit">${todayRuns === 1 ? 'run' : 'runs'}</div>
      </div>
      <div class="stat-card" style="border-left: 4px solid #3498db;">
        <div class="stat-label">Pace</div>
        <div class="stat-value" style="color: #3498db; font-size: 36px;">${todayPace}</div>
        <div class="stat-unit">min/mile</div>
      </div>
    `;
  } else {
    // Full comprehensive view for multiple days
    statsContainer.innerHTML = `
      <div class="stats-column sleep-stats">
        <div class="stats-column-title">😴 Recovery Metrics</div>
        <!-- Sleep Stats (Left Side) -->
        <div class="stat-card sleep">
          <div class="stat-label">Average Sleep</div>
          <div class="stat-value">${formatHours(avgSleepHours)}</div>
          <div class="stat-unit">per night</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid ${getScoreColor(avgSleepScore)};">
          <div class="stat-label">Avg Sleep Score</div>
          <div class="stat-value" style="color: ${getScoreColor(avgSleepScore)};">${avgSleepScore}</div>
          <div class="stat-unit">${sleepCrowns > 0 ? `👑 ${sleepCrowns}` : ''}</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid ${getScoreColor(avgReadinessScore)};">
          <div class="stat-label">Avg Readiness</div>
          <div class="stat-value" style="color: ${getScoreColor(avgReadinessScore)};">${avgReadinessScore}</div>
          <div class="stat-unit">${readinessCrowns > 0 ? `👑 ${readinessCrowns}` : ''}</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #f39c12;">
          <div class="stat-label">Total Crowns</div>
          <div class="stat-value" style="color: #f39c12; font-size: 28px;">👑 ${totalCrowns}</div>
          <div class="stat-unit">${sleepCrowns} sleep + ${readinessCrowns} readiness</div>
        </div>
      </div>
      
      <div class="stats-column running-stats">
        <div class="stats-column-title">🏃‍♂️ Performance Metrics</div>
        <!-- Running Stats (Right Side) -->
        <!-- Totals & Maximums (Top) -->
        <div class="stat-card distance">
          <div class="stat-label">Total Distance</div>
          <div class="stat-value">${totalDistance.toFixed(1)}</div>
          <div class="stat-unit">miles</div>
        </div>
        ${daysWithRuns > 1 ? `
        <div class="stat-card" style="border-left: 4px solid #27ae60;">
          <div class="stat-label">Longest Distance</div>
          <div class="stat-value" style="color: #27ae60;">${maxDistance.toFixed(1)}</div>
          <div class="stat-unit">miles</div>
        </div>` : ''}
        <div class="stat-card">
          <div class="stat-label">Runs</div>
          <div class="stat-value">${daysWithRuns}</div>
          <div class="stat-unit">total runs</div>
        </div>
        ${validPace.length > 1 ? `
        <div class="stat-card" style="border-left: 4px solid #2ecc71;">
          <div class="stat-label">Fastest Pace</div>
          <div class="stat-value" style="color: #2ecc71;">${bestPace !== null ? formatPace(bestPace) : 'N/A'}</div>
          <div class="stat-unit">min/mile</div>
        </div>` : ''}
        <div class="stat-card" style="border-left: 4px solid #c0392b;">
          <div class="stat-label">Max Heart Rate</div>
          <div class="stat-value" style="color: #c0392b;">${maxHR !== null ? maxHR : 'N/A'}</div>
          <div class="stat-unit">bpm</div>
        </div>
        
        <!-- Averages (Bottom) -->
        <div class="stat-card average">
          <div class="stat-label">Avg Distance</div>
          <div class="stat-value">${avgDistance.toFixed(1)}</div>
          <div class="stat-unit">miles per run</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #3498db;">
          <div class="stat-label">Avg Pace</div>
          <div class="stat-value" style="color: #3498db;">${avgPace !== null ? formatPace(avgPace) : 'N/A'}</div>
          <div class="stat-unit">min/mile</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #e74c3c;">
          <div class="stat-label">Avg Heart Rate</div>
          <div class="stat-value" style="color: #e74c3c;">${avgHR !== null ? Math.round(avgHR) : 'N/A'}</div>
          <div class="stat-unit">bpm</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #9b59b6;">
          <div class="stat-label">Avg Cadence</div>
          <div class="stat-value" style="color: #9b59b6;">${avgCadence !== null ? Math.round(avgCadence) : 'N/A'}</div>
          <div class="stat-unit">spm</div>
        </div>
      </div>
    `;
  }
}

function formatDateLabel(dateString, dateRangeDays, showMonth = true) {
  if (!dateString) return '';
  
  // Parse date string as local date to avoid timezone issues
  // dateString is in format "YYYY-MM-DD"
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', dateString);
    return dateString;
  }
  
  const monthName = date.toLocaleString('default', { month: 'short' });
  const dayNum = date.getDate();
  
  // For very long ranges (>90 days), show month and day
  if (dateRangeDays > 90) {
    return `${monthName} ${dayNum}`;
  }
  // For medium-long ranges (60-90 days), show month and day
  else if (dateRangeDays > 60) {
    return `${monthName} ${dayNum}`;
}
  // For medium ranges (30-60 days), show month and day
  else if (dateRangeDays > 30) {
    return `${monthName} ${dayNum}`;
  }
  // For short ranges (≤30 days), show day of week and day
  else {
    const dayOfWeek = date.toLocaleString('default', { weekday: 'short' });
    return `${dayOfWeek} ${dayNum}`;
  }
}

function calculateOptimalTickSpacing(dataLength, dateRangeDays) {
  // Calculate how many ticks to show based on data length and range
  if (dataLength <= 7) return 1; // Show all for a week
  if (dataLength <= 14) return 2; // Every other day for 2 weeks
  if (dataLength <= 30) return 3; // Every 3rd day for a month
  if (dataLength <= 60) return 5; // Every 5th day for 2 months
  if (dataLength <= 90) return 7; // Every 7th day for 3 months
  if (dataLength <= 180) return Math.ceil(dataLength / 15); // ~15 ticks for 6 months
  return Math.ceil(dataLength / 20); // ~20 ticks max for longer ranges
}

function calculateMaxTicks(dataLength, dateRangeDays) {
  // Calculate maximum number of ticks to display based on range
  if (dateRangeDays <= 30) return Math.min(15, dataLength);
  if (dateRangeDays <= 60) return Math.min(12, dataLength);
  if (dateRangeDays <= 90) return Math.min(10, dataLength);
  if (dateRangeDays <= 180) return Math.min(15, Math.ceil(dataLength / 12));
  return Math.min(20, Math.ceil(dataLength / 15)); // For 6+ months
}

async function loadDataAndCreateCharts(startDate, endDate) {
  try {
    console.log("Starting to load data...");
    
    // Show loading indicator
    const loadingMsg = document.createElement("p");
    loadingMsg.id = "loading-msg";
    loadingMsg.style.cssText = "text-align: center; color: #666; padding: 20px;";
    loadingMsg.textContent = "Loading data...";
    document.body.appendChild(loadingMsg);

    // Get dates from inputs if not provided
    if (!startDate || !endDate) {
      const startInput = document.getElementById('startDate');
      const endInput = document.getElementById('endDate');
      
      if (startInput && endInput && startInput.value && endInput.value) {
        startDate = startInput.value;
        endDate = endInput.value;
      } else {
        // Default to today if inputs are empty
        // Get today's date in local timezone explicitly
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        startDate = formatDate(today);
        endDate = formatDate(today);
        
        // Set the input values
        if (startInput) startInput.value = startDate;
        if (endInput) endInput.value = endDate;
      }
    }

    // Update page title
    updatePageTitle(startDate, endDate);

    const data = await loadData(startDate, endDate);
    
    // Remove loading indicator
    const loadingEl = document.getElementById("loading-msg");
    if (loadingEl) loadingEl.remove();
    
    if (!data || data.length === 0) {
      console.error("No data received", data);
      const errorMsg = document.createElement("p");
      errorMsg.style.cssText = "color: red; text-align: center; padding: 20px;";
      errorMsg.textContent = "No data available. Check server logs.";
      document.body.appendChild(errorMsg);
      return;
    }

    console.log("Data loaded successfully:", data.length, "entries");

    // Ensure data is sorted by date
    data.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate date range for formatting
    const firstDate = new Date(data[0]?.date || startDate);
    const lastDate = new Date(data[data.length - 1]?.date || endDate);
    const dateRangeDays = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Check if this is a single day view
    const isSingleDay = data.length === 1;
    
    // Format labels intelligently based on date range
    const labels = data.map(d => formatDateLabel(d.date, dateRangeDays));
    const rawDates = data.map(d => d.date); // Keep raw dates for tooltips
    
    // Calculate optimal tick spacing and max ticks
    const tickSpacing = calculateOptimalTickSpacing(data.length, dateRangeDays);
    const maxTicks = calculateMaxTicks(data.length, dateRangeDays);

  const totalSleep = data.map(d => parseHours(d.sleep));
  const light = data.map(d => parseHours(d.light));
  const rem = data.map(d => parseHours(d.rem));
  const deep = data.map(d => parseHours(d.deep));
    const distance = data.map(d => parseFloat(d.distance) || 0);
    const sleepScores = data.map(d => d.sleepScore !== null && d.sleepScore !== undefined ? parseFloat(d.sleepScore) : null);
    const readinessScores = data.map(d => d.readinessScore !== null && d.readinessScore !== undefined ? parseFloat(d.readinessScore) : null);
    const pace = data.map(d => d.pace !== null && d.pace !== undefined ? parseFloat(d.pace) : null);
    const averageHeartrate = data.map(d => d.averageHeartrate !== null && d.averageHeartrate !== undefined ? parseFloat(d.averageHeartrate) : null);
    const maxHeartrate = data.map(d => d.maxHeartrate !== null && d.maxHeartrate !== undefined ? parseFloat(d.maxHeartrate) : null);
    const cadence = data.map(d => d.cadence !== null && d.cadence !== undefined ? parseFloat(d.cadence) : null);
    
    // Log Dec 30 distance value after creating distance array
    const dec30FinalIndex = data.findIndex(d => d.date === "2025-12-30");
    if (dec30FinalIndex >= 0) {
      console.log("Dec 30 distance value in array:", {
        index: dec30FinalIndex,
        distanceValue: distance[dec30FinalIndex],
        label: labels[dec30FinalIndex],
        rawDistance: data[dec30FinalIndex].distance,
        allDistances: distance
      });
    } else {
      console.warn("Dec 30 NOT FOUND in data array after processing!");
    }
    
    // Calculate and display statistics
    updateStatistics(data, totalSleep, light, rem, deep, distance, sleepScores, readinessScores, pace, averageHeartrate, maxHeartrate, cadence, isSingleDay);
    
    // Update training load analysis (hide for single-day views)
    if (!isSingleDay) {
      if (!trainingLoadAnalyzer) {
        trainingLoadAnalyzer = new TrainingLoadAnalyzer();
      }
      renderTrainingLoadAnalysis(data);
    } else {
      // Hide training load container for single day view
      const trainingLoadContainer = document.getElementById('trainingLoadContainer');
      if (trainingLoadContainer) {
        trainingLoadContainer.style.display = 'none';
      }
    }
    
    // Update yearly goals planner (hide for single-day views)
    if (!isSingleDay) {
      if (!yearlyGoalsPlanner) {
        yearlyGoalsPlanner = new YearlyGoalsPlanner();
      }
      renderYearlyGoalsPlan(data);
      
      // Add event listener for edit button
      setTimeout(() => {
        const editBtn = document.getElementById('editYearlyPlanBtn');
        if (editBtn) {
          editBtn.addEventListener('click', openYearlyGoalsModal);
        }
      }, 100);
    } else {
      // Hide yearly goals container for single day view
      const yearlyGoalsContainer = document.getElementById('yearlyGoalsContainer');
      if (yearlyGoalsContainer) {
        yearlyGoalsContainer.style.display = 'none';
      }
    }
    
    // Update goals progress with loaded data (hide for single-day views)
    updateGoalsWithData(data, isSingleDay);
    
    // Debug: log data to verify it's correct
    console.log("Chart data summary:", {
      labelsCount: labels.length,
      dataPoints: data.length,
      dateRangeDays: dateRangeDays,
      maxTicks: maxTicks,
      tickSpacing: tickSpacing,
      sampleLabels: labels.slice(0, 5),
      sampleLight: light.slice(0, 5),
      sampleRem: rem.slice(0, 5),
      sampleDeep: deep.slice(0, 5),
      sampleDistance: distance.slice(0, 5),
      totalLightSum: light.reduce((a, b) => a + b, 0),
      totalRemSum: rem.reduce((a, b) => a + b, 0),
      totalDeepSum: deep.reduce((a, b) => a + b, 0),
      sleepDataSample: data.slice(0, 3).map(d => ({ date: d.date, sleep: d.sleep, light: d.light, rem: d.rem, deep: d.deep })),
      allDates: data.map(d => d.date),
      datesWithDistance: data.filter(d => d.distance > 0).map(d => ({ date: d.date, distance: d.distance })),
      lastDateInData: data.length > 0 ? data[data.length - 1].date : 'none',
      requestedEndDate: endDate
    });

  /* =========================
     SLEEP STACKED BAR CHART
  ========================= */

    try {
      // Destroy existing chart if it exists
      if (sleepChartInstance) {
        sleepChartInstance.destroy();
        sleepChartInstance = null;
      }

      const sleepChartEl = document.getElementById("sleepChart");
      if (!sleepChartEl) {
        throw new Error("Sleep chart canvas element not found");
      }
      
      // Add single-day class to container for centering
      const sleepChartContainer = sleepChartEl.closest('.chart-container');
      if (isSingleDay) {
        sleepChartContainer?.classList.add('single-day');
      } else {
        sleepChartContainer?.classList.remove('single-day');
      }

      // Validate data before creating chart
      if (!labels || labels.length === 0) {
        throw new Error("No labels available for sleep chart");
      }
      
      // Check if we have any sleep data
      const hasSleepData = light.some(v => v > 0) || rem.some(v => v > 0) || deep.some(v => v > 0);
      if (!hasSleepData) {
        console.warn("No sleep data available for the selected date range");
        console.log("Light sleep values:", light);
        console.log("REM sleep values:", rem);
        console.log("Deep sleep values:", deep);
        console.log("Raw data sample:", data.slice(0, 3).map(d => ({ 
          date: d.date, 
          sleep: d.sleep, 
          light: d.light, 
          rem: d.rem, 
          deep: d.deep 
        })));
      }

      // Always destroy and recreate chart to ensure fresh data
      if (sleepChartEl.chart) {
        console.log("Sleep chart already exists, destroying and recreating...");
        sleepChartEl.chart.destroy();
        sleepChartEl.chart = null;
      }

      // Helper function to format hours to xHrxM
      const formatHoursToHM = (decimalHours) => {
        if (!decimalHours || isNaN(decimalHours) || decimalHours === 0) return '0h';
        const totalMinutes = Math.round(decimalHours * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
      };

      // Log Chart.js version for debugging
      if (typeof Chart !== 'undefined' && Chart.version) {
        console.log('Chart.js version:', Chart.version);
      }

      // Register custom tooltip formatter plugin
      Chart.register({
        id: 'sleepTooltipFormatter',
        beforeTooltipUpdate: function(chart, args) {
          // Intercept tooltip before it's displayed
          const tooltip = chart.tooltip;
          if (tooltip && tooltip.dataPoints) {
            tooltip.dataPoints.forEach(point => {
              if (point.parsed && point.parsed.y !== null && !isNaN(point.parsed.y)) {
                const value = point.parsed.y;
                const formatted = formatHoursToHM(value);
                point.label = `${point.dataset.label}: ${formatted}`;
                console.log('[TOOLTIP] Plugin formatting:', point.dataset.label, value, '→', formatted);
              }
            });
          }
        }
      });

      // Plugin to draw crowns on sleep chart
      const sleepCrownPlugin = {
        id: 'sleepCrowns',
        afterDraw: (chart) => {
          const ctx = chart.ctx;
          const meta = chart.getDatasetMeta(0);
          
          // Draw blue crowns for sleep scores >= 85
          sleepScores.forEach((score, index) => {
            if (score !== null && score >= 85) {
              const bar = meta.data[index];
              if (bar) {
                const x = bar.x;
                const y = bar.y - 25; // Position above the bar
                
                ctx.save();
                ctx.font = 'bold 22px Arial';
                ctx.fillStyle = '#3498db'; // Blue for sleep crown
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('👑', x, y);
                ctx.restore();
              }
            }
          });
        }
      };

      sleepChartInstance = new Chart(sleepChartEl, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { 
          label: "Light Sleep", 
          data: light, 
          stack: "sleep", 
          backgroundColor: "rgba(116, 185, 255, 0.85)",
          borderColor: "rgba(116, 185, 255, 1)",
          borderWidth: isSingleDay ? 2 : 0,
          borderRadius: isSingleDay ? 12 : 6,
          borderSkipped: false,
          barPercentage: isSingleDay ? 0.6 : 0.8,
          categoryPercentage: isSingleDay ? 0.6 : 0.8
        },
        { 
          label: "REM Sleep", 
          data: rem, 
          stack: "sleep", 
          backgroundColor: "rgba(255, 107, 129, 0.85)",
          borderColor: "rgba(255, 107, 129, 1)",
          borderWidth: isSingleDay ? 2 : 0,
          borderRadius: isSingleDay ? 12 : 6,
          borderSkipped: false,
          barPercentage: isSingleDay ? 0.6 : 0.8,
          categoryPercentage: isSingleDay ? 0.6 : 0.8
        },
        { 
          label: "Deep Sleep", 
          data: deep, 
          stack: "sleep", 
          backgroundColor: "rgba(72, 219, 251, 0.85)",
          borderColor: "rgba(72, 219, 251, 1)",
          borderWidth: isSingleDay ? 2 : 0,
          borderRadius: isSingleDay ? 12 : 6,
          borderSkipped: false,
          barPercentage: isSingleDay ? 0.6 : 0.8,
          categoryPercentage: isSingleDay ? 0.6 : 0.8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: isSingleDay ? {
          left: 50,
          right: 50
        } : {
          left: 0,
          right: 20  // Add padding on right to prevent last bar from being truncated
        }
      },
      animation: {
        duration: 0
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        title: {
          display: true,
          text: "Sleep Breakdown (hours)",
          font: {
            size: 20,
            weight: '600',
            family: "'-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', sans-serif"
          },
          color: '#2c3e50',
          padding: {
            bottom: 20
          }
        },
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 13,
              weight: '500'
            },
            padding: 15,
            usePointStyle: true,
            color: '#34495e'
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          padding: 14,
          titleFont: {
            size: 14,
            weight: '600'
          },
          bodyFont: {
            size: 13
          },
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            title: function(context) {
              const index = context[0].dataIndex;
              const rawDate = rawDates[index];
              const [year, month, day] = rawDate.split('-').map(Number);
              const date = new Date(year, month - 1, day);
              return date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              });
            },
            label: function(context) {
              // Chart.js v4 - get value from parsed.y
              const value = context.parsed.y;
              
              // Force console log to verify callback is called
              console.log('[TOOLTIP] TOOLTIP CALLBACK FIRED!', {
                dataset: context.dataset.label,
                value: value,
                parsed: context.parsed,
                raw: context.raw
              });
              
              if (value === null || value === undefined || isNaN(value) || value === 0) {
                return `${context.dataset.label}: No data`;
              }
              
              // Format decimal hours to xHrxM
              const formatted = formatHoursToHM(value);
              console.log('[SUCCESS] Returning formatted:', formatted);
              
              // Return the formatted string - this should replace the default
              return `${context.dataset.label}: ${formatted}`;
            },
            labelTextColor: function() {
              return 'rgba(255, 255, 255, 1)';
            },
            labelColor: function(context) {
              return {
                borderColor: context.dataset.borderColor || context.dataset.backgroundColor,
                backgroundColor: context.dataset.backgroundColor
              };
            },
            footer: function(tooltipItems) {
              let totalHours = 0;
              tooltipItems.forEach(item => {
                const value = item.parsed?.y;
                if (value !== null && !isNaN(value)) {
                  totalHours += value;
                }
              });
              
              if (totalHours > 0) {
                const formatted = formatHoursToHM(totalHours);
                return `Total Sleep: ${formatted}`;
              }
              return '';
            }
          }
        },
        // Ensure all bars get equal width by adjusting scale after layout
        afterLayout: (chart) => {
          if (!isSingleDay) {
            const xScale = chart.scales.x;
            // Force the scale to include proper range for all categories
            const numCategories = labels.length;
            xScale.min = -0.5;
            xScale.max = numCategories - 0.5;
            // Update the scale to recalculate
            xScale.update('none');
          }
        }
      },
      scales: {
        x: { 
          stacked: true,
          grid: {
            display: !isSingleDay, // Hide grid for single day
            color: 'rgba(0, 0, 0, 0.03)',
            drawBorder: false
          },
          ticks: {
            font: {
              size: isSingleDay ? 16 : (dateRangeDays > 90 ? 10 : 11),
              weight: isSingleDay ? '600' : '500'
            },
            color: isSingleDay ? '#2c3e50' : '#7f8c8d',
            maxRotation: dateRangeDays > 90 ? 90 : 45,
            minRotation: dateRangeDays > 90 ? 45 : 0,
            maxTicksLimit: maxTicks,
            autoSkip: true,
            autoSkipPadding: dateRangeDays > 90 ? 5 : 8,
            padding: isSingleDay ? 20 : 10
          },
          border: {
            display: false
          },
          offset: true, // Enable offset to add padding on both sides for all bars
          // For single day, center the bar; for multi-day, ensure all bars are same width
          ...(isSingleDay ? { 
            min: -0.5, 
            max: 0.5 
          } : {
            // Don't set min/max - let Chart.js calculate with offset: true
            // This ensures all categories get equal space
          })
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.06)',
            drawBorder: false,
            lineWidth: 1
          },
          title: { 
            display: true, 
            text: "Hours",
            font: {
              size: 13,
              weight: '600'
            },
            color: '#34495e',
            padding: {
              bottom: 10,
              top: 5
            }
          },
          ticks: {
            font: {
              size: 11,
              weight: '500'
            },
            color: '#7f8c8d',
            padding: 10,
            callback: function(value) {
              return value.toFixed(1) + 'h';
            }
          },
          border: {
            display: false
          }
        }
      },
      layout: {
        padding: isSingleDay ? {
          left: 50,
          right: 50
        } : {
          left: 10,
          right: 30,  // Padding on right to ensure last bar has space
          top: 5,
          bottom: 5
        }
      }
    },
    plugins: [sleepCrownPlugin] // Register the crown plugin
  });
      console.log("[SUCCESS] Sleep chart created successfully", sleepChartInstance);
      
      // Store reference on canvas element
      sleepChartEl.chart = sleepChartInstance;
      
      // Aggressive monitoring to detect what's happening
      let checkCount = 0;
      const monitorInterval = setInterval(() => {
        checkCount++;
        const canvas = document.getElementById("sleepChart");
        
        if (!canvas) {
          console.error(`[ERROR] [${checkCount}s] Sleep chart canvas element removed from DOM!`);
          clearInterval(monitorInterval);
          return;
        }
        
        if (!canvas.parentElement) {
          console.error(`[ERROR] [${checkCount}s] Sleep chart canvas has no parent!`);
          clearInterval(monitorInterval);
          return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(canvas);
        
        if (rect.width === 0 || rect.height === 0) {
          console.error(`[ERROR] [${checkCount}s] Sleep chart canvas has zero dimensions!`, rect);
        }
        
        if (computedStyle.display === 'none') {
          console.error(`[ERROR] [${checkCount}s] Sleep chart canvas is hidden!`, computedStyle);
        }
        
        if (computedStyle.visibility === 'hidden') {
          console.error(`[ERROR] [${checkCount}s] Sleep chart canvas visibility is hidden!`, computedStyle);
        }
        
        if (computedStyle.opacity === '0') {
          console.error(`[ERROR] [${checkCount}s] Sleep chart canvas opacity is 0!`, computedStyle);
        }
        
        if (sleepChartInstance && sleepChartInstance.destroyed) {
          console.error(`[ERROR] [${checkCount}s] Sleep chart instance was destroyed!`);
          clearInterval(monitorInterval);
          return;
        }
        
        if (checkCount <= 5) {
          console.log(`[SUCCESS] [${checkCount}s] Sleep chart still active - width: ${rect.width}, height: ${rect.height}, display: ${computedStyle.display}`);
        }
        
        // Stop monitoring after 10 seconds
        if (checkCount >= 10) {
          clearInterval(monitorInterval);
        }
      }, 1000);
    } catch (error) {
      console.error("[ERROR] Error creating sleep chart:", error);
      const errorMsg = document.createElement("p");
      errorMsg.style.cssText = "color: red; text-align: center; padding: 10px;";
      errorMsg.textContent = `Sleep chart error: ${error.message}`;
      document.body.appendChild(errorMsg);
    }

  /* =========================
     DISTANCE LINE CHART
  ========================= */

    try {
      // Destroy existing chart if it exists
      if (distanceChartInstance) {
        distanceChartInstance.destroy();
        distanceChartInstance = null;
      }

      const distanceChartEl = document.getElementById("distanceChart");
      if (!distanceChartEl) {
        throw new Error("Distance chart canvas element not found");
      }
      
      // Add single-day class to container for centering
      const distanceChartContainer = distanceChartEl.closest('.chart-container');
      if (isSingleDay) {
        distanceChartContainer?.classList.add('single-day');
      } else {
        distanceChartContainer?.classList.remove('single-day');
      }

      // Validate data before creating chart
      if (!labels || labels.length === 0) {
        throw new Error("No labels available for distance chart");
      }
      
      // Check if we have any distance data
      const hasDistanceData = distance.some(d => d > 0);
      if (!hasDistanceData) {
        console.warn("No distance data available for the selected date range");
      }
      
      // Log distance data for debugging
      const dec30Data = data.find(d => d.date === "2025-12-30");
      const dec30Index = data.findIndex(d => d.date === "2025-12-30");
      const dec30DistanceValue = dec30Index >= 0 ? distance[dec30Index] : null;
      
      console.log("Distance chart data:", {
        labelsCount: labels.length,
        distanceArrayLength: distance.length,
        distanceValues: distance,
        distanceSum: distance.reduce((a, b) => a + b, 0),
        datesWithRuns: data.filter(d => d.distance > 0).map(d => ({ date: d.date, distance: d.distance })),
        lastDate: data.length > 0 ? data[data.length - 1].date : 'none',
        lastDistanceValue: distance.length > 0 ? distance[distance.length - 1] : 'none',
        lastLabel: labels.length > 0 ? labels[labels.length - 1] : 'none',
        requestedEndDate: endDate,
        dec30Data: dec30Data ? { date: dec30Data.date, distance: dec30Data.distance, index: dec30Index } : "NOT FOUND",
        dec30DistanceValue: dec30DistanceValue,
        dec30Label: dec30Index >= 0 ? labels[dec30Index] : "NOT FOUND",
        allDates: data.map(d => d.date),
        allLabels: labels,
        dataLength: data.length,
        labelsLength: labels.length
      });

      // Always destroy and recreate chart to ensure fresh data
      if (distanceChartEl.chart) {
        console.log("Distance chart already exists, destroying and recreating...");
        distanceChartEl.chart.destroy();
        distanceChartEl.chart = null;
      }

      // Final verification before creating chart
      const finalDec30Index = data.findIndex(d => d.date === "2025-12-30");
      console.log("Creating distance chart with:", {
        labelsCount: labels.length,
        distanceCount: distance.length,
        lastLabel: labels[labels.length - 1],
        lastDistance: distance[distance.length - 1],
        lastDate: data[data.length - 1]?.date,
        dec30Index: finalDec30Index,
        dec30Distance: finalDec30Index >= 0 ? distance[finalDec30Index] : "NOT FOUND",
        dec30Label: finalDec30Index >= 0 ? labels[finalDec30Index] : "NOT FOUND",
        allDistanceValues: distance,
        allLabels: labels
      });

      distanceChartInstance = new Chart(distanceChartEl, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Distance (miles)",
          data: distance,
          tension: 0.4,
          borderWidth: isSingleDay ? 4 : 3,
          pointRadius: isSingleDay ? 8 : 5,
          pointHoverRadius: isSingleDay ? 10 : 7,
          pointBackgroundColor: "#fff",
          pointBorderColor: "rgba(52, 152, 219, 1)",
          pointBorderWidth: isSingleDay ? 3 : 2,
          borderColor: "rgba(52, 152, 219, 1)",
          backgroundColor: "rgba(52, 152, 219, 0.1)",
          fill: true,
          spanGaps: false,
          showLine: !isSingleDay, // Hide line for single point
          yAxisID: 'y'
        },
        {
          label: "Pace (min/mile)",
          data: pace,
          tension: 0.4,
          borderWidth: isSingleDay ? 3 : 2,
          borderDash: [3, 3],
          pointRadius: isSingleDay ? 6 : 3,
          pointHoverRadius: isSingleDay ? 8 : 5,
          pointBackgroundColor: "rgba(52, 152, 219, 0.7)",
          pointBorderColor: "rgba(52, 152, 219, 0.9)",
          pointBorderWidth: isSingleDay ? 2 : 1.5,
          borderColor: "rgba(52, 152, 219, 0.7)",
          backgroundColor: "rgba(52, 152, 219, 0.05)",
          fill: false,
          spanGaps: false,
          showLine: !isSingleDay,
          yAxisID: 'y2'
        },
        {
          label: "Heart Rate (bpm)",
          data: averageHeartrate,
          tension: 0.4,
          borderWidth: isSingleDay ? 2.5 : 1.5,
          borderDash: [5, 5],
          pointRadius: isSingleDay ? 5 : 2,
          pointHoverRadius: isSingleDay ? 7 : 4,
          pointBackgroundColor: "rgba(231, 76, 60, 0.6)",
          pointBorderColor: "rgba(231, 76, 60, 0.8)",
          pointBorderWidth: isSingleDay ? 2 : 1,
          borderColor: "rgba(231, 76, 60, 0.6)",
          backgroundColor: "rgba(231, 76, 60, 0.05)",
          fill: false,
          spanGaps: false,
          showLine: !isSingleDay,
          yAxisID: 'y1'
        },
        {
          label: "Cadence (spm)",
          data: cadence,
          tension: 0.4,
          borderWidth: isSingleDay ? 2.5 : 1.5,
          borderDash: [5, 5],
          pointRadius: isSingleDay ? 5 : 2,
          pointHoverRadius: isSingleDay ? 7 : 4,
          pointBackgroundColor: "rgba(155, 89, 182, 0.6)",
          pointBorderColor: "rgba(155, 89, 182, 0.8)",
          pointBorderWidth: isSingleDay ? 2 : 1,
          borderColor: "rgba(155, 89, 182, 0.6)",
          backgroundColor: "rgba(155, 89, 182, 0.05)",
          fill: false,
          spanGaps: false,
          showLine: !isSingleDay,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: isSingleDay ? {
          left: 50,
          right: 50
        } : {
          left: 10,
          right: 40  // Add padding on right to prevent last point from being cut off
        }
      },
      animation: {
        duration: 0
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        title: {
          display: true,
          text: "Running Distance, Heart Rate & Cadence",
          font: {
            size: 20,
            weight: '600',
            family: "'-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', sans-serif"
          },
          color: '#2c3e50',
          padding: {
            bottom: 20
          }
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {
              size: 13,
              weight: '500'
            },
            padding: 15,
            usePointStyle: true,
            color: '#34495e'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          padding: 14,
          titleFont: {
            size: 14,
            weight: '600'
          },
          bodyFont: {
            size: 13
          },
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            title: function(context) {
              const index = context[0].dataIndex;
              const rawDate = rawDates[index];
              // Parse date string as local date to avoid timezone issues
              // rawDate is in format "YYYY-MM-DD"
              const [year, month, day] = rawDate.split('-').map(Number);
              const date = new Date(year, month - 1, day); // month is 0-indexed
              return date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              });
            },
            label: function(context) {
              const value = context.parsed.y;
              const datasetLabel = context.dataset.label;
              
              if (datasetLabel.includes('Distance')) {
                return `Distance: ${value.toFixed(2)} miles`;
              } else if (datasetLabel.includes('Pace')) {
                const minutes = Math.floor(value);
                const seconds = Math.round((value - minutes) * 60);
                return `Pace: ${minutes}:${seconds.toString().padStart(2, '0')} min/mile`;
              } else if (datasetLabel.includes('Heart Rate')) {
                return `Heart Rate: ${Math.round(value)} bpm`;
              } else if (datasetLabel.includes('Cadence')) {
                return `Cadence: ${Math.round(value)} spm`;
              }
              return `${datasetLabel}: ${value}`;
            }
          }
        },
        // Custom plugin to draw crown indicators (blue for sleep, green for readiness)
        afterDraw: (chart) => {
          const ctx = chart.ctx;
          const meta = chart.getDatasetMeta(0); // Use first dataset for positioning
          const yScale = chart.scales.y;
          
          // Draw crowns for each data point
          sleepScores.forEach((sleepScore, index) => {
            const readinessScore = readinessScores[index];
            const point = meta.data[index];
            
            if (point) {
              const x = point.x;
              let yOffset = 0;
              
              // Blue crown for sleep score >= 85
              if (sleepScore !== null && sleepScore >= 85) {
                const y = yScale.getPixelForValue(yScale.max) - 20 - yOffset; // Top of chart
                ctx.save();
                ctx.font = 'bold 18px Arial';
                ctx.fillStyle = '#3498db'; // Blue for sleep crown
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('👑', x, y);
                ctx.restore();
                yOffset += 25; // Space for next crown
              }
              
              // Green crown for readiness score >= 85
              if (readinessScore !== null && readinessScore >= 85) {
                const y = yScale.getPixelForValue(yScale.max) - 20 - yOffset; // Top of chart
                ctx.save();
                ctx.font = 'bold 18px Arial';
                ctx.fillStyle = '#27ae60'; // Green for readiness crown
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('👑', x, y);
                ctx.restore();
              }
            }
          });
        }
      },
      scales: {
        x: {
          grid: {
            display: !isSingleDay,
            color: 'rgba(0, 0, 0, 0.03)',
            drawBorder: false
          },
          ticks: {
            font: {
              size: isSingleDay ? 16 : (dateRangeDays > 90 ? 10 : 11),
              weight: isSingleDay ? '600' : '500'
            },
            color: isSingleDay ? '#2c3e50' : '#7f8c8d',
            maxRotation: dateRangeDays > 90 ? 90 : 45,
            minRotation: dateRangeDays > 90 ? 45 : 0,
            maxTicksLimit: maxTicks,
            autoSkip: true,
            autoSkipPadding: dateRangeDays > 90 ? 5 : 8,
            padding: isSingleDay ? 20 : 10
          },
          border: {
            display: false
          },
          offset: true, // Add padding on both sides to prevent point truncation
          // For single day, center the point
          ...(isSingleDay ? { 
            min: -0.5, 
            max: 0.5 
          } : {})
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.06)',
            drawBorder: false,
            lineWidth: 1
          },
          title: { 
            display: true, 
            text: "Distance (miles)",
            font: {
              size: 13,
              weight: '600'
            },
            color: 'rgba(52, 152, 219, 1)',
            padding: {
              bottom: 10,
              top: 5
            }
          },
          ticks: {
            font: {
              size: 11,
              weight: '500'
            },
            color: 'rgba(52, 152, 219, 1)',
            padding: 10,
            callback: function(value) {
              return value.toFixed(1);
            }
          },
          border: {
            display: false
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: false,
          grid: {
            display: false,
            drawBorder: false
          },
          title: { 
            display: true, 
            text: "HR (bpm) / Cadence (spm)",
            font: {
              size: 13,
              weight: '600'
            },
            color: '#7f8c8d',
            padding: {
              bottom: 10,
              top: 5
            }
          },
          ticks: {
            font: {
              size: 11,
              weight: '500'
            },
            color: '#7f8c8d',
            padding: 10,
            callback: function(value) {
              return Math.round(value);
            }
          },
          border: {
            display: false
          }
        },
        y2: {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: false,
          grid: {
            display: false,
            drawBorder: false
          },
          title: { 
            display: true, 
            text: "Pace (min/mile)",
            font: {
              size: 13,
              weight: '600'
            },
            color: 'rgba(52, 152, 219, 0.7)',
            padding: {
              bottom: 10,
              top: 5
        }
          },
          ticks: {
            font: {
              size: 11,
              weight: '500'
            },
            color: 'rgba(52, 152, 219, 0.7)',
            padding: 10,
            callback: function(value) {
              const minutes = Math.floor(value);
              const seconds = Math.round((value - minutes) * 60);
              return `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
          },
          border: {
            display: false
          }
        }
      },
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: 5,
          bottom: 5
        }
      }
    }
      });
      console.log("[SUCCESS] Distance chart created successfully", distanceChartInstance);
      
      // Store reference on canvas element
      distanceChartEl.chart = distanceChartInstance;
      
      // Aggressive monitoring to detect what's happening
      let checkCount2 = 0;
      const monitorInterval2 = setInterval(() => {
        checkCount2++;
        const canvas = document.getElementById("distanceChart");
        
        if (!canvas) {
          console.error(`[ERROR] [${checkCount2}s] Distance chart canvas element removed from DOM!`);
          clearInterval(monitorInterval2);
          return;
        }
        
        if (!canvas.parentElement) {
          console.error(`[ERROR] [${checkCount2}s] Distance chart canvas has no parent!`);
          clearInterval(monitorInterval2);
          return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(canvas);
        
        if (rect.width === 0 || rect.height === 0) {
          console.error(`[ERROR] [${checkCount2}s] Distance chart canvas has zero dimensions!`, rect);
        }
        
        if (computedStyle.display === 'none') {
          console.error(`[ERROR] [${checkCount2}s] Distance chart canvas is hidden!`, computedStyle);
        }
        
        if (computedStyle.visibility === 'hidden') {
          console.error(`[ERROR] [${checkCount2}s] Distance chart canvas visibility is hidden!`, computedStyle);
        }
        
        if (computedStyle.opacity === '0') {
          console.error(`[ERROR] [${checkCount2}s] Distance chart canvas opacity is 0!`, computedStyle);
        }
        
        if (distanceChartInstance && distanceChartInstance.destroyed) {
          console.error(`[ERROR] [${checkCount2}s] Distance chart instance was destroyed!`);
          clearInterval(monitorInterval2);
          return;
        }
        
        if (checkCount2 <= 5) {
          console.log(`[SUCCESS] [${checkCount2}s] Distance chart still active - width: ${rect.width}, height: ${rect.height}, display: ${computedStyle.display}`);
        }
        
        // Stop monitoring after 10 seconds
        if (checkCount2 >= 10) {
          clearInterval(monitorInterval2);
        }
      }, 1000);
      
  /* =========================
     WEEKLY MILEAGE BAR CHART
  ========================= */
  
    try {
      // Only show mileage chart for multi-day views
      if (isSingleDay || data.length <= 1) {
        console.log("[INFO] Skipping mileage chart for single-day view");
        
        // Hide the mileage chart container
        const mileageChartEl = document.getElementById("mileageChart");
        if (mileageChartEl) {
          const mileageContainer = mileageChartEl.closest('.chart-container');
          if (mileageContainer) {
            mileageContainer.style.display = 'none';
          }
        }
        
        // Destroy existing chart if it exists
        if (mileageChartInstance) {
          mileageChartInstance.destroy();
          mileageChartInstance = null;
        }
      } else {
        // Multi-day view - show the chart
        const mileageChartEl = document.getElementById("mileageChart");
        if (!mileageChartEl) {
          console.warn("Mileage chart canvas element not found - skipping");
        } else {
          // Show the mileage chart container
          const mileageContainer = mileageChartEl.closest('.chart-container');
          if (mileageContainer) {
            mileageContainer.style.display = 'block';
          }
          
          // Destroy existing chart if it exists
          if (mileageChartInstance) {
            mileageChartInstance.destroy();
            mileageChartInstance = null;
          }
        // Calculate weekly mileage data
        // Group data by week (Sunday - Saturday)
        const weeklyData = {};
        const weeks = [];
        
        data.forEach(day => {
          const date = new Date(day.date + 'T00:00:00');
          
          // Get the Sunday of the week for this date
          const dayOfWeek = date.getDay();
          const sundayDate = new Date(date);
          sundayDate.setDate(date.getDate() - dayOfWeek);
          const weekKey = sundayDate.toISOString().split('T')[0];
          
          if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = {
              startDate: weekKey,
              totalMiles: 0,
              runs: 0
            };
          }
          
          weeklyData[weekKey].totalMiles += (day.distance || 0);
          if (day.distance > 0) {
            weeklyData[weekKey].runs++;
          }
        });
        
        // Sort weeks and prepare data arrays
        const sortedWeeks = Object.keys(weeklyData).sort();
        const weekLabels = sortedWeeks.map(weekStart => {
          const date = new Date(weekStart + 'T00:00:00');
          const options = { month: 'short', day: 'numeric' };
          return date.toLocaleDateString('en-US', options);
        });
        const weeklyMiles = sortedWeeks.map(week => Math.round(weeklyData[week].totalMiles * 10) / 10);
        
        // Calculate 4-week rolling average
        const rollingAverage = [];
        for (let i = 0; i < weeklyMiles.length; i++) {
          const start = Math.max(0, i - 3);
          const slice = weeklyMiles.slice(start, i + 1);
          const avg = slice.reduce((sum, val) => sum + val, 0) / slice.length;
          rollingAverage.push(Math.round(avg * 10) / 10);
        }
        
        console.log("[INFO] Weekly mileage data:", {
          weeks: sortedWeeks.length,
          totalMiles: weeklyMiles.reduce((sum, val) => sum + val, 0),
          avgWeekly: Math.round((weeklyMiles.reduce((sum, val) => sum + val, 0) / weeklyMiles.length) * 10) / 10
        });
        
        // Create mileage bar chart with rolling average line
        mileageChartInstance = new Chart(mileageChartEl, {
          type: 'bar',
          data: {
            labels: weekLabels,
            datasets: [
              {
                label: 'Weekly Mileage',
                data: weeklyMiles,
                backgroundColor: 'rgba(231, 76, 60, 0.7)',
                borderColor: 'rgba(231, 76, 60, 1)',
                borderWidth: 2,
                borderRadius: 6,
                order: 2
              },
              {
                label: '4-Week Average',
                data: rollingAverage,
                type: 'line',
                borderColor: 'rgba(52, 152, 219, 1)',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: 'rgba(52, 152, 219, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                tension: 0.4,
                fill: false,
                order: 1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            interaction: {
              intersect: false,
              mode: 'index'
            },
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: {
                  font: {
                    size: 13,
                    weight: '600'
                  },
                  color: '#2c3e50',
                  padding: 15,
                  usePointStyle: true,
                  pointStyle: 'circle'
                }
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                titleFont: {
                  size: 14,
                  weight: 'bold'
                },
                bodyFont: {
                  size: 13
                },
                padding: 12,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1,
                displayColors: true,
                callbacks: {
                  label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    label += context.parsed.y.toFixed(1) + ' mi';
                    
                    // Add run count for weekly bars
                    if (context.datasetIndex === 0) {
                      const weekKey = sortedWeeks[context.dataIndex];
                      const runs = weeklyData[weekKey].runs;
                      label += ` (${runs} ${runs === 1 ? 'run' : 'runs'})`;
                    }
                    
                    return label;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: {
                  display: false,
                  drawBorder: false
                },
                ticks: {
                  font: {
                    size: 11,
                    weight: '500'
                  },
                  color: '#7f8c8d',
                  maxRotation: 45,
                  minRotation: 0
                },
                border: {
                  display: false
                }
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)',
                  drawBorder: false
                },
                ticks: {
                  font: {
                    size: 12,
                    weight: '500'
                  },
                  color: '#7f8c8d',
                  padding: 10,
                  callback: function(value) {
                    return value + ' mi';
                  }
                },
                title: {
                  display: true,
                  text: 'Miles',
                  font: {
                    size: 13,
                    weight: '600'
                  },
                  color: '#2c3e50',
                  padding: {
                    bottom: 10
                  }
                },
                border: {
                  display: false
                }
              }
            }
          }
        });
        
        console.log("[SUCCESS] Mileage chart created successfully");
        mileageChartEl.chart = mileageChartInstance;
      }
      }
    } catch (error) {
      console.error("[ERROR] Error creating mileage chart:", error);
    }
      
      // Mark initialization as complete
      isInitializing = false;
    } catch (error) {
      console.error("[ERROR] Error creating distance chart:", error);
      const errorMsg = document.createElement("p");
      errorMsg.style.cssText = "color: red; text-align: center; padding: 10px;";
      errorMsg.textContent = `Distance chart error: ${error.message}`;
      document.body.appendChild(errorMsg);
      isInitializing = false;
    }
  } catch (error) {
    console.error("Error creating charts:", error);
    document.body.innerHTML += "<p style='color: red;'>Error loading charts: " + error.message + "</p>";
    isInitializing = false;
  }
}

// Wait for Chart.js script to load, then initialize
function waitForChartJS() {
  if (typeof Chart !== 'undefined') {
    // Chart.js is loaded, now wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCharts);
    } else {
      // DOM is already ready
      setTimeout(initCharts, 50); // Small delay to ensure everything is ready
    }
  } else {
    // Keep checking for Chart.js
    setTimeout(waitForChartJS, 50);
  }
}

// Start initialization
waitForChartJS();

// Set up date range selector
function setupDateSelector() {
  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');
  const updateButton = document.getElementById('updateDates');
  const presetButtons = document.querySelectorAll('[data-preset]');

  if (!startInput || !endInput || !updateButton) {
    console.warn("Date selector elements not found, retrying...");
    setTimeout(setupDateSelector, 100);
    return;
  }

  function applyDateRange(startDate, endDate) {
    startInput.value = startDate;
    endInput.value = endDate;
    handleDateUpdate();
  }

  function handleDateUpdate() {
    const startDate = startInput.value;
    const endDate = endInput.value;

    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('Start date must be before end date');
      return;
    }

    // Reset chart initialization state to allow reload
    chartsInitialized = false;
    isInitializing = false;
    initRetryCount = 0;

    // Destroy existing charts
    if (sleepChartInstance) {
      sleepChartInstance.destroy();
      sleepChartInstance = null;
      const sleepChartEl = document.getElementById("sleepChart");
      if (sleepChartEl) sleepChartEl.chart = null;
    }
    if (distanceChartInstance) {
      distanceChartInstance.destroy();
      distanceChartInstance = null;
      const distanceChartEl = document.getElementById("distanceChart");
      if (distanceChartEl) distanceChartEl.chart = null;
    }

    // Reload charts with new date range
    loadDataAndCreateCharts(startDate, endDate);
  }

  // Set up preset buttons
  presetButtons.forEach(button => {
    button.addEventListener('click', () => {
      const preset = button.getAttribute('data-preset');
      // Get today's date in local timezone explicitly
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      let startDate, endDate;
      
      switch(preset) {
        case 'today':
          // Show only today - most recent day's data
          startDate = new Date(today);
          endDate = new Date(today);
          break;
        case 'last7':
          // Last 7 days including today (today - 6 days ago through today)
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 6);
          break;
        case 'last30':
          // Last 30 days including today (today - 29 days ago through today)
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 29);
          break;
        case 'thisMonth':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today);
          break;
        case 'lastMonth':
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          startDate = new Date(lastMonth);
          endDate = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of last month
          break;
        case 'thisYear':
          // January 1st of current year to today
          startDate = new Date(today.getFullYear(), 0, 1);
          endDate = new Date(today);
          break;
        case 'lastYear':
          // January 1st to December 31st of previous year
          startDate = new Date(today.getFullYear() - 1, 0, 1);
          endDate = new Date(today.getFullYear() - 1, 11, 31);
          break;
        default:
          return;
      }
      
      // Format dates as YYYY-MM-DD
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      // Remove active class from all buttons
      presetButtons.forEach(btn => btn.classList.remove('active'));
      // Add active class to clicked button
      button.classList.add('active');
      
      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);
      console.log(`Preset ${preset} selected: ${startDateStr} to ${endDateStr}`);
      console.log(`Today's date object:`, today);
      console.log(`Today's formatted date:`, formatDate(today));
      applyDateRange(startDateStr, endDateStr);
  });
});

  updateButton.addEventListener('click', () => {
    // Remove active class from all preset buttons when manually updating
    presetButtons.forEach(btn => btn.classList.remove('active'));
    handleDateUpdate();
  });

  // Also allow Enter key on date inputs
  startInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      presetButtons.forEach(btn => btn.classList.remove('active'));
      handleDateUpdate();
    }
  });
  endInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      presetButtons.forEach(btn => btn.classList.remove('active'));
      handleDateUpdate();
    }
  });

  console.log("Date selector initialized");
}

// Initialize date selector when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupDateSelector);
} else {
  setTimeout(setupDateSelector, 50);
}

/* =========================
   GOALS INTEGRATION
========================= */

let goalsManager = null;

// Initialize goals system
function initGoals() {
  if (typeof GoalsManager === 'undefined') {
    console.log('[GOALS] Waiting for GoalsManager...');
    setTimeout(initGoals, 100);
    return;
  }
  
  goalsManager = new GoalsManager();
  console.log('[GOALS] Goals system initialized');
  
  // Setup modal controls
  const setGoalsBtn = document.getElementById('setGoalsBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelGoalsBtn = document.getElementById('cancelGoalsBtn');
  const saveGoalsBtn = document.getElementById('saveGoalsBtn');
  const goalsModal = document.getElementById('goalsModal');
  
  if (setGoalsBtn) {
    setGoalsBtn.addEventListener('click', () => {
      openGoalsModal();
    });
  }
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      closeGoalsModal();
    });
  }
  
  if (cancelGoalsBtn) {
    cancelGoalsBtn.addEventListener('click', () => {
      closeGoalsModal();
    });
  }
  
  if (saveGoalsBtn) {
    saveGoalsBtn.addEventListener('click', () => {
      saveGoals();
    });
  }
  
  // Close modal on outside click
  if (goalsModal) {
    goalsModal.addEventListener('click', (e) => {
      if (e.target === goalsModal) {
        closeGoalsModal();
      }
    });
  }
  
  // Render initial goals display
  renderGoals();
}

// Open goals modal and populate with current values
function openGoalsModal() {
  const modal = document.getElementById('goalsModal');
  if (!modal || !goalsManager) return;
  
  const goals = goalsManager.goals;
  
  // Populate weekly goals
  document.getElementById('weeklyMileageEnabled').checked = goals.weekly.mileage.enabled;
  document.getElementById('weeklyMileageTarget').value = goals.weekly.mileage.target;
  document.getElementById('weeklyRunsEnabled').checked = goals.weekly.runs.enabled;
  document.getElementById('weeklyRunsTarget').value = goals.weekly.runs.target;
  document.getElementById('weeklyAvgSleepEnabled').checked = goals.weekly.avgSleep.enabled;
  document.getElementById('weeklyAvgSleepTarget').value = goals.weekly.avgSleep.target;
  document.getElementById('weeklyAvgReadinessEnabled').checked = goals.weekly.avgReadiness.enabled;
  document.getElementById('weeklyAvgReadinessTarget').value = goals.weekly.avgReadiness.target;
  
  // Populate monthly goals
  document.getElementById('monthlyMileageEnabled').checked = goals.monthly.mileage.enabled;
  document.getElementById('monthlyMileageTarget').value = goals.monthly.mileage.target;
  document.getElementById('monthlyRunsEnabled').checked = goals.monthly.runs.enabled;
  document.getElementById('monthlyRunsTarget').value = goals.monthly.runs.target;
  document.getElementById('monthlyAvgSleepEnabled').checked = goals.monthly.avgSleep.enabled;
  document.getElementById('monthlyAvgSleepTarget').value = goals.monthly.avgSleep.target;
  document.getElementById('monthlyAvgReadinessEnabled').checked = goals.monthly.avgReadiness.enabled;
  document.getElementById('monthlyAvgReadinessTarget').value = goals.monthly.avgReadiness.target;
  
  modal.classList.add('active');
}

// Close goals modal
function closeGoalsModal() {
  const modal = document.getElementById('goalsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Save goals from modal
function saveGoals() {
  if (!goalsManager) return;
  
  // Save weekly goals
  goalsManager.updateGoal('weekly', 'mileage', 
    document.getElementById('weeklyMileageEnabled').checked,
    parseFloat(document.getElementById('weeklyMileageTarget').value) || 0
  );
  goalsManager.updateGoal('weekly', 'runs',
    document.getElementById('weeklyRunsEnabled').checked,
    parseInt(document.getElementById('weeklyRunsTarget').value) || 0
  );
  goalsManager.updateGoal('weekly', 'avgSleep',
    document.getElementById('weeklyAvgSleepEnabled').checked,
    parseFloat(document.getElementById('weeklyAvgSleepTarget').value) || 0
  );
  goalsManager.updateGoal('weekly', 'avgReadiness',
    document.getElementById('weeklyAvgReadinessEnabled').checked,
    parseInt(document.getElementById('weeklyAvgReadinessTarget').value) || 0
  );
  
  // Save monthly goals
  goalsManager.updateGoal('monthly', 'mileage',
    document.getElementById('monthlyMileageEnabled').checked,
    parseFloat(document.getElementById('monthlyMileageTarget').value) || 0
  );
  goalsManager.updateGoal('monthly', 'runs',
    document.getElementById('monthlyRunsEnabled').checked,
    parseInt(document.getElementById('monthlyRunsTarget').value) || 0
  );
  goalsManager.updateGoal('monthly', 'avgSleep',
    document.getElementById('monthlyAvgSleepEnabled').checked,
    parseFloat(document.getElementById('monthlyAvgSleepTarget').value) || 0
  );
  goalsManager.updateGoal('monthly', 'avgReadiness',
    document.getElementById('monthlyAvgReadinessEnabled').checked,
    parseInt(document.getElementById('monthlyAvgReadinessTarget').value) || 0
  );
  
  // Re-calculate progress with current data if available
  if (window.currentData) {
    goalsManager.updateProgress(window.currentData);
  }
  
  // Re-render goals display
  renderGoals();
  
  // Close modal
  closeGoalsModal();
  
  console.log('[GOALS] Goals saved successfully');
}

// Render goals display
function renderGoals() {
  if (!goalsManager) return;
  
  const goalsContent = document.getElementById('goalsContent');
  if (!goalsContent) return;
  
  const activeGoals = goalsManager.getActiveGoals();
  const streaks = goalsManager.getStreaks();
  
  if (activeGoals.length === 0) {
    // Show no goals message
    goalsContent.innerHTML = `
      <div class="no-goals-message">
        <p>No goals set yet. Start tracking your progress!</p>
        <p style="font-size: 14px; color: #95a5a6;">Click "Set Goals" to create weekly or monthly targets.</p>
      </div>
    `;
    return;
  }
  
  // Render active goals
  let goalsHTML = '<div class="goals-grid">';
  
  activeGoals.forEach(goal => {
    const summary = goalsManager.getGoalSummary(goal.period, goal.metric);
    if (!summary) return;
    
    const periodClass = goal.period === 'weekly' ? 'weekly' : 'monthly';
    const completeClass = summary.isComplete ? 'complete' : '';
    const metricNames = {
      mileage: 'Mileage',
      runs: 'Runs',
      avgSleep: 'Avg Sleep',
      avgReadiness: 'Readiness'
    };
    
    const statusText = summary.isComplete 
      ? '🎉 Goal Complete!' 
      : `${summary.remaining.toFixed(1)} ${summary.unit} to go`;
    
    goalsHTML += `
      <div class="goal-card ${periodClass} ${completeClass}">
        <div class="goal-title">${goal.period} ${metricNames[goal.metric]}</div>
        <div class="goal-metric">${summary.displayText}</div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width: ${summary.progress}%"></div>
        </div>
        <div class="goal-status">${statusText}</div>
      </div>
    `;
  });
  
  goalsHTML += '</div>';
  
  // Add streaks section
  goalsHTML += `
    <div class="streaks-section">
      <div class="streaks-title">
        🔥 Current Streaks
      </div>
      <div class="streaks-grid">
        <div class="streak-item">
          <div class="streak-icon">💤</div>
          <div class="streak-info">
            <div class="streak-label">Sleep Goal (8h+)</div>
            <div class="streak-value">${streaks.consecutiveSleepGoal} days</div>
            <div class="streak-best">Best: ${streaks.bestSleepStreak}</div>
          </div>
        </div>
        <div class="streak-item">
          <div class="streak-icon">🏃</div>
          <div class="streak-info">
            <div class="streak-label">Run Streak</div>
            <div class="streak-value">${streaks.consecutiveRunDays} days</div>
            <div class="streak-best">Best: ${streaks.bestRunStreak}</div>
          </div>
        </div>
        <div class="streak-item">
          <div class="streak-icon">⚡</div>
          <div class="streak-info">
            <div class="streak-label">Readiness (85+)</div>
            <div class="streak-value">${streaks.consecutiveReadinessGoal} days</div>
            <div class="streak-best">Best: ${streaks.bestReadinessStreak}</div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  goalsContent.innerHTML = goalsHTML;
}

// Update goals progress when new data is loaded
function updateGoalsWithData(data, isSingleDay = false) {
  if (!goalsManager || !data) return;
  
  const goalsContainer = document.getElementById('goalsContainer');
  
  // Hide goals for single-day views
  if (isSingleDay || data.length <= 1) {
    console.log('[GOALS] Hiding goals for single-day view');
    if (goalsContainer) {
      goalsContainer.style.display = 'none';
    }
    return;
  }
  
  // Show goals for multi-day views
  if (goalsContainer) {
    goalsContainer.style.display = 'block';
  }
  
  // Store data globally for access in other functions
  window.currentData = data;
  
  // Update progress calculations
  goalsManager.updateProgress(data);
  
  // Update training load analysis
  if (trainingLoadAnalyzer) {
    renderTrainingLoadAnalysis(data);
  }
  
  // Re-render goals display
  renderGoals();
  
  console.log('[GOALS] Progress updated with new data');
}

// Training Load Analysis Rendering
function renderTrainingLoadAnalysis(data) {
  const container = document.getElementById('trainingLoadContent');
  const containerParent = document.getElementById('trainingLoadContainer');
  
  if (!container || !data || data.length === 0) return;

  // Make sure the container is visible
  if (containerParent) {
    containerParent.style.display = 'block';
  }

  if (!trainingLoadAnalyzer) {
    trainingLoadAnalyzer = new TrainingLoadAnalyzer();
  }

  const analysis = trainingLoadAnalyzer.getFullAnalysis(data);
  
  if (!analysis) {
    container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">Need at least 7 days of data for training load analysis.</p>';
    return;
  }

  let html = '<div class="training-load-grid">';

  // ACWR Card
  if (analysis.acwr) {
    const acwr = analysis.acwr;
    const riskClass = `risk-${acwr.riskLevel}`;
    const riskEmoji = {
      'low': '📉',
      'optimal': '✅',
      'moderate': '⚠️',
      'high': '🚨'
    }[acwr.riskLevel] || '📊';

    html += `
      <div class="training-load-card acwr ${riskClass}">
        <h3>${riskEmoji} Training Load Ratio</h3>
        <div class="metric-value">${acwr.ratio.toFixed(2)}</div>
        <div class="metric-label">Acute:Chronic Workload Ratio</div>
        <div class="detail-text">
          7-day avg: ${acwr.acuteAvg.toFixed(1)} mi/day<br>
          28-day avg: ${acwr.chronicAvg.toFixed(1)} mi/day<br>
          Risk Level: <strong>${acwr.riskLevel.toUpperCase()}</strong>
        </div>
        <div class="recommendation-text">
          ${acwr.recommendation}
        </div>
      </div>
    `;
  }

  // Today's Recovery Card
  if (analysis.todayRecovery && analysis.todayRecovery.score !== null) {
    const recovery = analysis.todayRecovery;
    const level = trainingLoadAnalyzer.getRecoveryLevel(recovery.score);
    const emoji = {
      'excellent': '💪',
      'good': '✓',
      'fair': '⚡',
      'poor': '🛑'
    }[level] || '📊';

    html += `
      <div class="training-load-card recovery">
        <h3>${emoji} Today's Recovery</h3>
        <div class="metric-value">${recovery.score}</div>
        <div class="metric-label">Recovery Score</div>
        <div class="detail-text">
          ${recovery.source === 'combined' 
            ? `Sleep: ${recovery.sleepScore} | Readiness: ${recovery.readinessScore}`
            : `Based on ${recovery.source}`
          }<br>
          Level: <strong>${level.toUpperCase()}</strong>
        </div>
      </div>
    `;
  }

  // Today's Recommendation Card
  if (analysis.todayRecommendation) {
    const rec = analysis.todayRecommendation;
    html += `
      <div class="training-load-card recommendation" style="border-left: 5px solid ${rec.color};">
        <h3>🎯 Today's Recommendation</h3>
        <div class="metric-label" style="font-size: 16px; margin: 15px 0;">
          ${rec.recommendation}
        </div>
        <div class="detail-text">
          Training Intensity: <strong>${rec.trainingIntensity.toUpperCase()}</strong>
          ${rec.distance > 0 ? `<br>Distance run: ${rec.distance.toFixed(1)} mi` : ''}
        </div>
      </div>
    `;
  }

  // 7-Day Average Recovery Card
  if (analysis.avgRecovery !== null) {
    const avgLevel = analysis.avgRecoveryLevel;
    const emoji = {
      'excellent': '💪',
      'good': '✓',
      'fair': '⚡',
      'poor': '🛑'
    }[avgLevel] || '📊';

    html += `
      <div class="training-load-card" style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);">
        <h3>${emoji} 7-Day Recovery Trend</h3>
        <div class="metric-value">${analysis.avgRecovery}</div>
        <div class="metric-label">Average Recovery Score</div>
        <div class="detail-text">
          Trend: <strong>${avgLevel.toUpperCase()}</strong>
        </div>
      </div>
    `;
  }

  html += '</div>';

  // Calendar view for last 14 days (using local timezone)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(today.getDate() - 13);
  
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const startDate = formatDate(fourteenDaysAgo);
  const endDate = formatDate(today);
  
  const calendar = trainingLoadAnalyzer.generateCalendarRecommendations(data, startDate, endDate);
  
  if (calendar && calendar.length > 0) {
    html += `
      <div class="calendar-view">
        <h3>📅 14-Day Training Calendar</h3>
        <div class="calendar-grid">
    `;
    
    calendar.forEach(day => {
      const date = new Date(day.date);
      const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const intensityClass = `intensity-${day.trainingIntensity}`;
      
      html += `
        <div class="calendar-day ${intensityClass}">
          <div class="calendar-day-date">${dateLabel}</div>
          <div class="calendar-day-recommendation">${day.recommendation}</div>
          ${day.recoveryScore ? `
            <div class="calendar-day-metrics">
              Recovery: ${day.recoveryScore}
              ${day.distance > 0 ? `<br>Run: ${day.distance.toFixed(1)} mi` : ''}
            </div>
          ` : ''}
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  console.log('[TRAINING LOAD] Analysis rendered');
}

// Yearly Goals Planner Rendering
function renderYearlyGoalsPlan(data) {
  const container = document.getElementById('yearlyGoalsContent');
  const containerParent = document.getElementById('yearlyGoalsContainer');
  
  if (!container || !data || data.length === 0) return;

  // Make sure the container is visible
  if (containerParent) {
    containerParent.style.display = 'block';
  }

  if (!yearlyGoalsPlanner) {
    yearlyGoalsPlanner = new YearlyGoalsPlanner();
  }

  // Check if a plan already exists
  let existingPlan = yearlyGoalsPlanner.loadPlan();
  
  if (existingPlan) {
    renderExistingPlan(existingPlan);
  } else {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <p style="font-size: 18px; color: #2c3e50; margin-bottom: 20px;">
          📊 Set your weekly mileage goals for ${new Date().getFullYear() + 1}
        </p>
        <p style="color: #7f8c8d; margin-bottom: 30px;">
          Enter your target weekly mileage for each week of the year.<br>
          Plan your training progression the way YOU want!
        </p>
        <button id="setWeeklyGoalsBtn" style="padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
          Set Weekly Goals
        </button>
      </div>
    `;
    
    // Add event listener for the button
    setTimeout(() => {
      const btn = document.getElementById('setWeeklyGoalsBtn');
      if (btn) {
        btn.addEventListener('click', openYearlyGoalsModal);
      }
    }, 100);
  }
  
  console.log('[YEARLY GOALS] Planner rendered');
}

function openYearlyGoalsModal() {
  const modal = document.getElementById('yearlyGoalsModal');
  if (!modal) return;

  // Generate week inputs for all quarters
  generateWeekInputs();

  // Show modal
  modal.classList.add('active');

  // Setup event listeners
  setupYearlyGoalsModalListeners();
}

function generateWeekInputs() {
  const quarters = [
    { id: 'q1-inputs', start: 1, end: 13 },
    { id: 'q2-inputs', start: 14, end: 26 },
    { id: 'q3-inputs', start: 27, end: 39 },
    { id: 'q4-inputs', start: 40, end: 52 }
  ];

  quarters.forEach(quarter => {
    const container = document.getElementById(quarter.id);
    if (!container) return;

    let html = '';
    for (let week = quarter.start; week <= quarter.end; week++) {
      html += `
        <div class="week-input-item">
          <label for="week-${week}">Week ${week}</label>
          <input type="number" id="week-${week}" min="0" step="0.5" placeholder="0" />
        </div>
      `;
    }
    container.innerHTML = html;
  });
}

function setupYearlyGoalsModalListeners() {
  // Quarter tab switching
  const quarterTabs = document.querySelectorAll('.quarter-tab');
  quarterTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const quarter = this.getAttribute('data-quarter');
      
      // Update tabs
      quarterTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Update forms
      document.querySelectorAll('.quarter-form').forEach(form => {
        form.classList.remove('active');
      });
      document.querySelector(`.quarter-${quarter}`).classList.add('active');
    });
  });

  // Close button
  const closeBtn = document.getElementById('closeYearlyModalBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeYearlyGoalsModal);
  }

  // Cancel button
  const cancelBtn = document.getElementById('cancelYearlyGoalsBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeYearlyGoalsModal);
  }

  // Save button
  const saveBtn = document.getElementById('saveYearlyGoalsBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveYearlyGoals);
  }
}

function closeYearlyGoalsModal() {
  const modal = document.getElementById('yearlyGoalsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function saveYearlyGoals() {
  const weeklyGoals = [];
  
  // Collect all 52 weeks
  for (let week = 1; week <= 52; week++) {
    const input = document.getElementById(`week-${week}`);
    const value = input ? parseFloat(input.value) || 0 : 0;
    weeklyGoals.push(value);
  }

  // Validate - at least some weeks should have goals
  const totalMileage = weeklyGoals.reduce((sum, w) => sum + w, 0);
  if (totalMileage === 0) {
    alert('Please enter mileage goals for at least some weeks!');
    return;
  }

  // Create custom plan
  const plan = yearlyGoalsPlanner.createCustomPlan(weeklyGoals);
  
  if (plan) {
    // Save the plan
    yearlyGoalsPlanner.savePlan(plan);
    
    // Close modal
    closeYearlyGoalsModal();
    
    // Render the plan
    renderExistingPlan(plan);
    
    alert('✓ Weekly goals saved successfully!');
  } else {
    alert('Error creating plan. Please try again.');
  }
}

function generateAndShowPlan() {
  if (!window.currentData || window.currentData.length === 0) {
    alert('Need at least some training data to generate a plan. Start logging your runs!');
    return;
  }

  const currentTraining = yearlyGoalsPlanner.analyzeCurrentTraining(window.currentData);
  
  if (!currentTraining) {
    alert('Unable to analyze current training. Need more data!');
    return;
  }

  // Generate plan with conservative progression
  const plan = yearlyGoalsPlanner.generateYearlyPlan(currentTraining, {
    progressionType: 'conservative',
    targetIncrease: 20, // 20% increase
    includeDeloadWeeks: true
  });

  // Save the plan
  yearlyGoalsPlanner.savePlan(plan);
  
  // Render it
  renderExistingPlan(plan);
}

function renderExistingPlan(plan) {
  const container = document.getElementById('yearlyGoalsContent');
  if (!container) return;

  const currentTraining = yearlyGoalsPlanner.analyzeCurrentTraining(window.currentData);
  const quarterly = yearlyGoalsPlanner.getQuarterlyBreakdown(plan);
  const recommendations = yearlyGoalsPlanner.generateRecommendations(currentTraining);

  let html = '';

  // Summary Section
  html += `
    <div class="yearly-summary">
      <div class="yearly-summary-item">
        <div class="yearly-summary-label">Starting Mileage</div>
        <div class="yearly-summary-value">${plan.summary.startingMileage}</div>
        <div class="yearly-summary-unit">mi/week</div>
      </div>
      <div class="yearly-summary-item">
        <div class="yearly-summary-label">Target Mileage</div>
        <div class="yearly-summary-value">${plan.summary.targetMileage}</div>
        <div class="yearly-summary-unit">mi/week</div>
      </div>
      <div class="yearly-summary-item">
        <div class="yearly-summary-label">Total Year</div>
        <div class="yearly-summary-value">${plan.summary.totalYearMileage}</div>
        <div class="yearly-summary-unit">miles</div>
      </div>
      <div class="yearly-summary-item">
        <div class="yearly-summary-label">Increase</div>
        <div class="yearly-summary-value">+${plan.summary.increasePercent}%</div>
        <div class="yearly-summary-unit">from current</div>
      </div>
    </div>
  `;

  // Quarterly Breakdown
  if (quarterly) {
    html += '<div class="quarterly-breakdown">';
    quarterly.forEach(q => {
      html += `
        <div class="quarter-card">
          <h4>${q.quarter} ${plan.year}</h4>
          <div class="metric">
            <span>Total Mileage</span>
            <span class="metric-value">${q.totalMileage} mi</span>
          </div>
          <div class="metric">
            <span>Avg Weekly</span>
            <span class="metric-value">${q.avgWeeklyMileage} mi</span>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  // Recommendations
  if (recommendations && recommendations.length > 0) {
    html += '<div class="recommendations-list"><h4>📝 Training Recommendations</h4>';
    recommendations.forEach(rec => {
      html += `<div class="recommendation-item">${rec}</div>`;
    });
    html += '</div>';
  }

  // Actions
  html += `
    <div class="plan-actions">
      <button class="btn-customize" onclick="editYearlyPlan()">✏️ Edit Goals</button>
      <button class="btn-accept" onclick="clearYearlyPlan()">🗑️ Clear Plan</button>
    </div>
  `;

  container.innerHTML = html;
}

// Edit yearly plan
window.editYearlyPlan = function() {
  const plan = yearlyGoalsPlanner.loadPlan();
  if (!plan) return;
  
  // Open modal and pre-fill with existing values
  openYearlyGoalsModal();
  
  // Pre-fill the inputs after a short delay
  setTimeout(() => {
    plan.plan.forEach((weekPlan, index) => {
      const input = document.getElementById(`week-${index + 1}`);
      if (input && weekPlan.plannedMileage > 0) {
        input.value = weekPlan.plannedMileage;
      }
    });
  }, 200);
};

// Clear yearly plan
window.clearYearlyPlan = function() {
  if (confirm('Clear your weekly goals? This cannot be undone.')) {
    yearlyGoalsPlanner.savePlan(null);
    renderYearlyGoalsPlan(window.currentData);
  }
};

// Initialize goals system when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGoals);
} else {
  setTimeout(initGoals, 100);
}
