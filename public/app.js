// Prevent multiple initializations
let chartsInitialized = false;
let isInitializing = false;
let sleepChartInstance = null;
let distanceChartInstance = null;
let initRetryCount = 0;
const MAX_RETRIES = 50; // Max 5 seconds of retries

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
  
  // Set default to last 7 days if dates are not set
  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');
  if (startInput && endInput && !startInput.value) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6); // 7 days ago (including today)
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    startInput.value = formatDate(startDate);
    endInput.value = formatDate(today);
    
    // Mark "Last 7 Days" button as active
    const last7Button = document.querySelector('[data-preset="last7"]');
    if (last7Button) {
      document.querySelectorAll('[data-preset]').forEach(btn => btn.classList.remove('active'));
      last7Button.classList.add('active');
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
    console.error("❌ Error loading data:", error);
    return [];
  }
}

function formatDateRangeTitle(startDate, endDate) {
  if (!startDate || !endDate) return "Training & Sleep";
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startMonth = start.toLocaleString('default', { month: 'long' });
  const startYear = start.getFullYear();
  const endMonth = end.toLocaleString('default', { month: 'long' });
  const endYear = end.getFullYear();
  
  // Same month and year
  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${startYear} — Training & Sleep`;
  }
  
  // Same year, different months
  if (startYear === endYear) {
    return `${startMonth} - ${endMonth} ${startYear} — Training & Sleep`;
  }
  
  // Different years
  return `${startMonth} ${startYear} - ${endMonth} ${endYear} — Training & Sleep`;
}

function updatePageTitle(startDate, endDate) {
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) {
    titleEl.textContent = formatDateRangeTitle(startDate, endDate);
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

function updateStatistics(data, totalSleep, light, rem, deep, distance, sleepScores, readinessScores, pace, averageHeartrate, maxHeartrate, cadence) {
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
  
  // Create stats cards
  statsContainer.innerHTML = `
    <div class="stat-card sleep">
      <div class="stat-label">Average Sleep</div>
      <div class="stat-value">${formatHours(avgSleepHours)}</div>
      <div class="stat-unit">per night</div>
    </div>
    <div class="stat-card" style="border-left: 4px solid ${getScoreColor(avgSleepScore)};">
      <div class="stat-label">Avg Sleep Score</div>
      <div class="stat-value" style="color: ${getScoreColor(avgSleepScore)};">${avgSleepScore}</div>
      <div class="stat-unit">${validSleepScores.length} days ${sleepCrowns > 0 ? `👑 ${sleepCrowns}` : ''}</div>
    </div>
    <div class="stat-card" style="border-left: 4px solid ${getScoreColor(avgReadinessScore)};">
      <div class="stat-label">Avg Readiness</div>
      <div class="stat-value" style="color: ${getScoreColor(avgReadinessScore)};">${avgReadinessScore}</div>
      <div class="stat-unit">${validReadinessScores.length} days ${readinessCrowns > 0 ? `👑 ${readinessCrowns}` : ''}</div>
    </div>
    <div class="stat-card" style="border-left: 4px solid #f39c12;">
      <div class="stat-label">Total Crowns</div>
      <div class="stat-value" style="color: #f39c12; font-size: 28px;">👑 ${totalCrowns}</div>
      <div class="stat-unit">${sleepCrowns} sleep + ${readinessCrowns} readiness</div>
    </div>
    <div class="stat-card total">
      <div class="stat-label">Total Sleep</div>
      <div class="stat-value">${formatHours(totalSleepHours)}</div>
      <div class="stat-unit">${daysWithSleep} nights</div>
    </div>
    <div class="stat-card distance">
      <div class="stat-label">Total Distance</div>
      <div class="stat-value">${totalDistance.toFixed(1)}</div>
      <div class="stat-unit">miles</div>
    </div>
    <div class="stat-card average">
      <div class="stat-label">Avg Distance</div>
      <div class="stat-value">${avgDistance.toFixed(1)}</div>
      <div class="stat-unit">miles per run</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Runs</div>
      <div class="stat-value">${daysWithRuns}</div>
      <div class="stat-unit">total runs</div>
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
    <div class="stat-card" style="border-left: 4px solid #c0392b;">
      <div class="stat-label">Max Heart Rate</div>
      <div class="stat-value" style="color: #c0392b;">${maxHR !== null ? maxHR : 'N/A'}</div>
      <div class="stat-unit">bpm</div>
    </div>
    <div class="stat-card" style="border-left: 4px solid #9b59b6;">
      <div class="stat-label">Avg Cadence</div>
      <div class="stat-value" style="color: #9b59b6;">${avgCadence !== null ? Math.round(avgCadence) : 'N/A'}</div>
      <div class="stat-unit">spm</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Sleep Breakdown</div>
      <div class="stat-value" style="font-size: 24px; margin-bottom: 8px;">
        ${daysWithSleep > 0 ? `${formatHours(totalLight / daysWithSleep)} / ${formatHours(totalREM / daysWithSleep)} / ${formatHours(totalDeep / daysWithSleep)}` : '0h / 0h / 0h'}
      </div>
      <div class="stat-unit">Light / REM / Deep (avg)</div>
    </div>
  `;
}

function formatDateLabel(dateString, dateRangeDays, showMonth = true) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', dateString);
    return dateString;
  }
  
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  
  // For very long ranges (>90 days), show month and day
  if (dateRangeDays > 90) {
    return `${month} ${day}`;
  }
  // For medium-long ranges (60-90 days), show month and day
  else if (dateRangeDays > 60) {
    return `${month} ${day}`;
  }
  // For medium ranges (30-60 days), show month and day
  else if (dateRangeDays > 30) {
    return `${month} ${day}`;
  }
  // For short ranges (≤30 days), show day of week and day
  else {
    const dayOfWeek = date.toLocaleString('default', { weekday: 'short' });
    return `${dayOfWeek} ${day}`;
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
        // Default to last 7 days if inputs are empty
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(today);
        start.setDate(today.getDate() - 6); // 7 days ago (including today)
        
        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        startDate = formatDate(start);
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
    updateStatistics(data, totalSleep, light, rem, deep, distance, sleepScores, readinessScores, pace, averageHeartrate, maxHeartrate, cadence);
    
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
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false
        },
        { 
          label: "REM Sleep", 
          data: rem, 
          stack: "sleep", 
          backgroundColor: "rgba(255, 107, 129, 0.85)",
          borderColor: "rgba(255, 107, 129, 1)",
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false
        },
        { 
          label: "Deep Sleep", 
          data: deep, 
          stack: "sleep", 
          backgroundColor: "rgba(72, 219, 251, 0.85)",
          borderColor: "rgba(72, 219, 251, 1)",
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
              const date = new Date(rawDate);
              return date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              });
            },
            label: function(context) {
              const value = context.parsed.y;
              const hours = Math.floor(value);
              const minutes = Math.round((value - hours) * 60);
              if (minutes > 0) {
                return `${context.dataset.label}: ${hours}h ${minutes}m`;
              }
              return `${context.dataset.label}: ${hours}h`;
            }
          }
        }
      },
      scales: {
        x: { 
          stacked: true,
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.03)',
            drawBorder: false
          },
          ticks: {
            font: {
              size: dateRangeDays > 90 ? 10 : 11,
              weight: '500'
            },
            color: '#7f8c8d',
            maxRotation: dateRangeDays > 90 ? 90 : 45,
            minRotation: dateRangeDays > 90 ? 45 : 0,
            maxTicksLimit: maxTicks,
            autoSkip: true,
            autoSkipPadding: dateRangeDays > 90 ? 5 : 8,
            padding: 10
          },
          border: {
            display: false
          },
          offset: false
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
        padding: {
          left: 10,
          right: 10,
          top: 5,
          bottom: 5
        }
      }
    }
      });
      console.log("✅ Sleep chart created successfully", sleepChartInstance);
      
      // Store reference on canvas element
      sleepChartEl.chart = sleepChartInstance;
      
      // Aggressive monitoring to detect what's happening
      let checkCount = 0;
      const monitorInterval = setInterval(() => {
        checkCount++;
        const canvas = document.getElementById("sleepChart");
        
        if (!canvas) {
          console.error(`❌ [${checkCount}s] Sleep chart canvas element removed from DOM!`);
          clearInterval(monitorInterval);
          return;
        }
        
        if (!canvas.parentElement) {
          console.error(`❌ [${checkCount}s] Sleep chart canvas has no parent!`);
          clearInterval(monitorInterval);
          return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(canvas);
        
        if (rect.width === 0 || rect.height === 0) {
          console.error(`❌ [${checkCount}s] Sleep chart canvas has zero dimensions!`, rect);
        }
        
        if (computedStyle.display === 'none') {
          console.error(`❌ [${checkCount}s] Sleep chart canvas is hidden!`, computedStyle);
        }
        
        if (computedStyle.visibility === 'hidden') {
          console.error(`❌ [${checkCount}s] Sleep chart canvas visibility is hidden!`, computedStyle);
        }
        
        if (computedStyle.opacity === '0') {
          console.error(`❌ [${checkCount}s] Sleep chart canvas opacity is 0!`, computedStyle);
        }
        
        if (sleepChartInstance && sleepChartInstance.destroyed) {
          console.error(`❌ [${checkCount}s] Sleep chart instance was destroyed!`);
          clearInterval(monitorInterval);
          return;
        }
        
        if (checkCount <= 5) {
          console.log(`✅ [${checkCount}s] Sleep chart still active - width: ${rect.width}, height: ${rect.height}, display: ${computedStyle.display}`);
        }
        
        // Stop monitoring after 10 seconds
        if (checkCount >= 10) {
          clearInterval(monitorInterval);
        }
      }, 1000);
    } catch (error) {
      console.error("❌ Error creating sleep chart:", error);
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
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: "#fff",
          pointBorderColor: "rgba(52, 152, 219, 1)",
          pointBorderWidth: 2,
          borderColor: "rgba(52, 152, 219, 1)",
          backgroundColor: "rgba(52, 152, 219, 0.1)",
          fill: true,
          spanGaps: false,
          showLine: true,
          yAxisID: 'y'
        },
        {
          label: "Pace (min/mile)",
          data: pace,
          tension: 0.4,
          borderWidth: 2,
          borderDash: [3, 3],
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "rgba(52, 152, 219, 0.7)",
          pointBorderColor: "rgba(52, 152, 219, 0.9)",
          pointBorderWidth: 1.5,
          borderColor: "rgba(52, 152, 219, 0.7)",
          backgroundColor: "rgba(52, 152, 219, 0.05)",
          fill: false,
          spanGaps: false,
          showLine: true,
          yAxisID: 'y2'
        },
        {
          label: "Heart Rate (bpm)",
          data: averageHeartrate,
          tension: 0.4,
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: "rgba(231, 76, 60, 0.6)",
          pointBorderColor: "rgba(231, 76, 60, 0.8)",
          pointBorderWidth: 1,
          borderColor: "rgba(231, 76, 60, 0.6)",
          backgroundColor: "rgba(231, 76, 60, 0.05)",
          fill: false,
          spanGaps: false,
          showLine: true,
          yAxisID: 'y1'
        },
        {
          label: "Cadence (spm)",
          data: cadence,
          tension: 0.4,
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: "rgba(155, 89, 182, 0.6)",
          pointBorderColor: "rgba(155, 89, 182, 0.8)",
          pointBorderWidth: 1,
          borderColor: "rgba(155, 89, 182, 0.6)",
          backgroundColor: "rgba(155, 89, 182, 0.05)",
          fill: false,
          spanGaps: false,
          showLine: true,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
              const date = new Date(rawDate);
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
        }
      },
      scales: {
        x: {
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.03)',
            drawBorder: false
          },
          ticks: {
            font: {
              size: dateRangeDays > 90 ? 10 : 11,
              weight: '500'
            },
            color: '#7f8c8d',
            maxRotation: dateRangeDays > 90 ? 90 : 45,
            minRotation: dateRangeDays > 90 ? 45 : 0,
            maxTicksLimit: maxTicks,
            autoSkip: true,
            autoSkipPadding: dateRangeDays > 90 ? 5 : 8,
            padding: 10
          },
          border: {
            display: false
          },
          offset: false
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
      console.log("✅ Distance chart created successfully", distanceChartInstance);
      
      // Store reference on canvas element
      distanceChartEl.chart = distanceChartInstance;
      
      // Aggressive monitoring to detect what's happening
      let checkCount2 = 0;
      const monitorInterval2 = setInterval(() => {
        checkCount2++;
        const canvas = document.getElementById("distanceChart");
        
        if (!canvas) {
          console.error(`❌ [${checkCount2}s] Distance chart canvas element removed from DOM!`);
          clearInterval(monitorInterval2);
          return;
        }
        
        if (!canvas.parentElement) {
          console.error(`❌ [${checkCount2}s] Distance chart canvas has no parent!`);
          clearInterval(monitorInterval2);
          return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(canvas);
        
        if (rect.width === 0 || rect.height === 0) {
          console.error(`❌ [${checkCount2}s] Distance chart canvas has zero dimensions!`, rect);
        }
        
        if (computedStyle.display === 'none') {
          console.error(`❌ [${checkCount2}s] Distance chart canvas is hidden!`, computedStyle);
        }
        
        if (computedStyle.visibility === 'hidden') {
          console.error(`❌ [${checkCount2}s] Distance chart canvas visibility is hidden!`, computedStyle);
        }
        
        if (computedStyle.opacity === '0') {
          console.error(`❌ [${checkCount2}s] Distance chart canvas opacity is 0!`, computedStyle);
        }
        
        if (distanceChartInstance && distanceChartInstance.destroyed) {
          console.error(`❌ [${checkCount2}s] Distance chart instance was destroyed!`);
          clearInterval(monitorInterval2);
          return;
        }
        
        if (checkCount2 <= 5) {
          console.log(`✅ [${checkCount2}s] Distance chart still active - width: ${rect.width}, height: ${rect.height}, display: ${computedStyle.display}`);
        }
        
        // Stop monitoring after 10 seconds
        if (checkCount2 >= 10) {
          clearInterval(monitorInterval2);
        }
      }, 1000);
      
      // Mark initialization as complete
      isInitializing = false;
    } catch (error) {
      console.error("❌ Error creating distance chart:", error);
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let startDate, endDate;
      
      switch(preset) {
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
        case 'december':
          // December 2025: Dec 1 to Dec 30 (or today if we're still in December)
          startDate = new Date(2025, 11, 1); // Month is 0-indexed, so 11 = December
          // If today is in December 2025, use today; otherwise use Dec 30
          if (today.getFullYear() === 2025 && today.getMonth() === 11) {
            endDate = new Date(today);
          } else {
            endDate = new Date(2025, 11, 30);
          }
          break;
        case 'lastMonth':
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          startDate = new Date(lastMonth);
          endDate = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of last month
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
