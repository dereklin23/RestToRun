# RestToRun

A comprehensive fitness dashboard that overlays and visualizes training data from Strava with sleep and readiness data from Oura Ring. Get insights into how your training correlates with your recovery metrics.

![RestToRun Dashboard](https://img.shields.io/badge/Status-Active-success)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

### 📊 Interactive Visualizations
- **Sleep Breakdown Chart**: Stacked bar chart showing Light, REM, and Deep sleep stages
- **Training Metrics Chart**: Multi-axis line chart displaying:
  - Running distance (miles)
  - Pace (min/mile)
  - Heart rate (average & max)
  - Cadence (steps per minute)

### 🏆 Performance Tracking
- **Crown Indicators** 👑: Highlights when sleep or readiness scores exceed 85
- **Comprehensive Stats Cards**: 
  - Average and total sleep metrics
  - Sleep and readiness scores
  - Total and average running distance
  - Pace, heart rate, and cadence statistics

### 📅 Flexible Date Ranges
- Today view
- Last 7 days
- Last 30 days
- This month / Last month
- This year / Last year
- Custom date range selection

### 🎨 Modern UI
- Responsive design
- Beautiful gradient backgrounds
- Smooth animations
- Card-based layout
- Adaptive single-day vs multi-day views

## 🛠 Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript + Chart.js
- **APIs**: Strava API v3, Oura Ring API v2
- **Data Processing**: Custom integration service for Strava and Oura data

## 📁 Project Structure

```
RestToRun/
├── public/
│   ├── dashboardClient.js          # Client-side chart visualization
│   ├── trainingDashboard.html      # Main dashboard UI
│   └── index.html                  # Entry point
├── src/
│   ├── apiServer.js                # Express API server
│   └── services/
│       └── fitnessDataService.js   # Strava & Oura API integration
├── .env                             # Environment variables (not in repo)
├── package.json
└── README.md
```

## 🚀 Quick Start

### Option 1: Deploy to Railway (Recommended) 🚂

**Deploy your own instance in 5 minutes!**

See the complete guide: **[RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)**

1. Fork/Clone this repository
2. Sign up for [Railway](https://railway.app) (free $5/month credit)
3. Deploy from GitHub
4. Add Redis database
5. Configure environment variables
6. Get your free subdomain: `your-app.up.railway.app`

**Optional:** Connect your own domain (`resttorun.com`)

---

### Option 2: Local Development

#### Prerequisites
- Node.js v18 or higher
- Strava account with API access
- Oura Ring account with API access

#### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dereklin23/RestToRun.git
   cd RestToRun
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up OAuth Applications**
   
   Follow the detailed guide: **[OAUTH_SETUP.md](./OAUTH_SETUP.md)**
   
   Quick summary:
   - Create a Strava API application
   - Create an Oura API application
   - Set redirect URIs to `http://localhost:3000/auth/{provider}/callback`

4. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Session Secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   SESSION_SECRET=your-secure-session-secret
   
   # Strava OAuth
   STRAVA_CLIENT_ID=your_strava_client_id
   STRAVA_CLIENT_SECRET=your_strava_client_secret
   STRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback
   
   # Oura OAuth
   OURA_CLIENT_ID=your_oura_client_id
   OURA_CLIENT_SECRET=your_oura_client_secret
   OURA_REDIRECT_URI=http://localhost:3000/auth/oura/callback
   ```

## 🎯 Usage

### Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### Access the Dashboard

Open your browser and navigate to `http://localhost:3000`

The dashboard will:
1. Load today's data by default
2. Display sleep and training metrics
3. Show interactive charts with crown indicators 👑 for excellent scores

### Select Date Ranges

Use the preset buttons or custom date picker to view different time periods:
- **Today**: Current day's data (simplified view)
- **Last 7/30 Days**: Recent training and sleep trends
- **This/Last Month**: Monthly overview
- **This/Last Year**: Full year view for long-term analysis
- **Custom Range**: Pick any start and end date

## 📡 API Endpoints

### `GET /data`

Retrieves merged fitness and sleep data for a date range.

**Query Parameters:**
- `startDate` (optional): Start date in `YYYY-MM-DD` format (default: `2025-12-01`)
- `endDate` (optional): End date in `YYYY-MM-DD` format (default: `2025-12-31`)

**Response:**
```json
[
  {
    "date": "2025-12-30",
    "distance": 5.2,
    "sleep": "8h 15m",
    "light": "4h 30m",
    "rem": "2h 15m",
    "deep": "1h 30m",
    "sleepScore": 87,
    "readinessScore": 85,
    "pace": 8.5,
    "averageHeartrate": 145,
    "maxHeartrate": 165,
    "cadence": 170
  }
]
```

## 🔄 Data Integration

### Strava Data
- **Activities**: Fetches running activities with pagination (up to 600 recent runs)
- **Metrics Collected**:
  - Distance (converted to miles)
  - Moving time
  - Pace (min/mile)
  - Average heart rate
  - Max heart rate
  - Cadence (SPM - steps per minute, converted from Strava's per-foot measurement)

### Oura Ring Data
- **Sleep Sessions**: Total, Light, REM, and Deep sleep durations
- **Sleep Scores**: Daily sleep quality scores (0-100)
- **Readiness Scores**: Daily readiness scores (0-100)
- **Automatic Sync**: Expands date range by 1 day to catch sleep sessions labeled on the next day

### Data Merging
The integration service:
1. Fetches data from both APIs concurrently
2. Aggregates multiple activities/sessions per day
3. Calculates weighted averages for pace, heart rate, and cadence
4. Handles missing data gracefully
5. Returns a unified dataset sorted by date

## 🎨 Console Logging

The application uses text-based log indicators for clarity:

| Indicator | Meaning |
|-----------|---------|
| `[ERROR]` | Error messages |
| `[SUCCESS]` | Success confirmations |
| `[WARNING]` | Warning messages |
| `[API]` | API endpoint activity |
| `[DEBUG]` | Debug information |
| `[DATA]` | Data processing logs |
| `[INFO]` | General information |
| `[DATE]` | Date-related logs |
| `[TOOLTIP]` | Tooltip formatting logs |

## 📈 Recent Updates

### December 30, 2025
- **Refactored file structure** for improved clarity:
  - Renamed files to be more descriptive
  - Better organization of client/server code
- **Replaced emojis** in console logs with text indicators (except crown 👑)
- **Added comprehensive documentation**
- **Improved code maintainability**

### December 29, 2025
- **Initial commit** with working Strava and Oura API integration
- **Frontend implementation** with Chart.js visualizations
- **Routed sleep data** and running mileage for user

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Strava API](https://developers.strava.com/) for activity data
- [Oura Ring API](https://cloud.ouraring.com/docs/) for sleep and readiness metrics
- [Chart.js](https://www.chartjs.org/) for beautiful visualizations

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

**Made with ❤️ by athletes, for athletes**
