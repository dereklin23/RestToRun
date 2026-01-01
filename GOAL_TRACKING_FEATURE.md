# Goal Tracking Feature

## Overview
RestToRun now includes a comprehensive goal tracking system that helps athletes set, monitor, and achieve their training and recovery targets. The system tracks both weekly and monthly goals with visual progress indicators and streak tracking.

## Features

### 1. **Goal Setting**
Users can set goals for:
- **Mileage**: Weekly or monthly running distance targets (miles)
- **Runs**: Number of runs per week or month
- **Average Sleep**: Target average sleep duration (hours)
- **Average Readiness**: Target average Oura readiness score

Each goal can be individually enabled or disabled, giving users full flexibility.

### 2. **Visual Progress Tracking**
- **Progress Bars**: Animated progress bars show completion percentage
- **Gradient Cards**: Beautiful gradient backgrounds differentiate weekly vs monthly goals
- **Completion Indicators**: Goals automatically change to green gradient when completed
- **Current vs Target**: Clear display of current progress and remaining amount

### 3. **Streak Tracking**
The system automatically tracks:
- **Sleep Streak**: Consecutive days with 8+ hours of sleep
- **Run Streak**: Consecutive days with at least one run
- **Readiness Streak**: Consecutive days with readiness score ≥ 85
- **Personal Bests**: Tracks and displays all-time best streaks

### 4. **Smart Calculations**
Goals update automatically based on:
- **Weekly Goals**: Last 7 days of data
- **Monthly Goals**: Current calendar month data
- **Real-time Updates**: Progress recalculates whenever date range changes

### 5. **Data Persistence**
- Goals are saved to browser localStorage
- Survives page refreshes and browser sessions
- Per-device customization (users can have different goals on different devices)

## User Interface

### Goals Dashboard Section
Located prominently below the date selector and above the stats:
- Clean, modern card-based layout
- Color-coded by period (weekly = pink/red gradient, monthly = blue gradient)
- Completion = green gradient with celebration emoji
- Responsive grid layout adapts to screen size

### Goal Setting Modal
Easy-to-use modal interface with:
- Checkbox to enable/disable each goal
- Number inputs for target values
- Organized by period (Weekly vs Monthly)
- Clear labels and units
- Save/Cancel buttons

### Streaks Section
Dedicated area showing:
- Current active streaks with icons
- All-time personal bests
- Clean grid layout with visual hierarchy

## Technical Implementation

### Architecture
- **`goalsManager.js`**: Core goal management class
  - Goal storage and retrieval
  - Progress calculations
  - Streak tracking algorithms
  - LocalStorage integration

- **`dashboardClient.js`**: Dashboard integration
  - Modal controls
  - Goal rendering
  - Data synchronization
  - User interactions

- **`trainingDashboard.html`**: UI structure
  - Goals container
  - Modal HTML
  - CSS styling

### Data Flow
1. User sets goals via modal → Saved to localStorage
2. Dashboard loads data from API
3. `updateGoalsWithData()` calculates progress
4. Goals section re-renders with updated progress
5. Process repeats when date range changes

### Key Functions

#### GoalsManager Class
```javascript
// Core methods
loadGoals()              // Load from localStorage
saveGoals()              // Save to localStorage
updateGoal()             // Update specific goal
updateProgress()         // Calculate progress from data
updateStreaks()          // Calculate current streaks
getActiveGoals()         // Get enabled goals
getGoalSummary()         // Get formatted goal info
```

#### Dashboard Integration
```javascript
// Integration functions
initGoals()              // Initialize goals system
openGoalsModal()         // Show goal setting modal
saveGoals()              // Save user's goal selections
renderGoals()            // Render goals UI
updateGoalsWithData()    // Update progress from data
```

## Usage Instructions

### For Users

1. **Setting Goals**:
   - Click "Set Goals" button in the Goals & Progress section
   - Check the box next to goals you want to track
   - Enter target values in the input fields
   - Click "Save Goals"

2. **Viewing Progress**:
   - Active goals display automatically on the dashboard
   - Progress bars show completion percentage
   - Status text shows remaining amount to reach goal
   - Completed goals show celebration message

3. **Tracking Streaks**:
   - Current streaks update automatically
   - Best streaks are preserved and displayed
   - Streaks reset if criteria not met on consecutive days

### For Developers

1. **Customizing Goals**:
   - Edit `goalsManager.js` to add new goal types
   - Update modal HTML to include new goal inputs
   - Modify progress calculation logic as needed

2. **Styling**:
   - Goal card styles in `trainingDashboard.html` `<style>` section
   - Gradient backgrounds easily customizable
   - Responsive breakpoints defined for mobile

3. **Storage**:
   - Goals stored in `localStorage` under key `resttorun_goals`
   - Data structure includes weekly, monthly, and streaks
   - Easy to migrate to backend storage if needed

## Future Enhancements

Potential additions for future versions:
- [ ] Goal templates (e.g., "5K Training Plan", "Base Building")
- [ ] Achievement badges for milestone completions
- [ ] Email/push notifications for goal progress
- [ ] Social sharing of achievements
- [ ] Historical goal tracking and analytics
- [ ] Smart goal recommendations based on past performance
- [ ] Rest day vs training day separate goals
- [ ] Pace improvement goals
- [ ] Heart rate zone goals
- [ ] Backend synchronization across devices

## Benefits for Strava API Review

This feature demonstrates:
1. **Sophisticated Data Usage**: Complex calculations and aggregations from Strava API data
2. **User Engagement**: Sticky feature that encourages daily app usage
3. **Value Addition**: Provides insights and tracking not available in Strava alone
4. **Oura Integration**: Showcases unique recovery + performance combination
5. **User-Centric Design**: Focus on athlete needs and motivation

## Example Goals

### Beginner Runner
- Weekly Mileage: 10 miles
- Weekly Runs: 3 runs
- Average Sleep: 7.5 hours
- Average Readiness: 75

### Intermediate Runner
- Weekly Mileage: 25 miles
- Weekly Runs: 4-5 runs
- Average Sleep: 8 hours
- Average Readiness: 80

### Advanced Runner
- Monthly Mileage: 120 miles
- Monthly Runs: 20 runs
- Average Sleep: 8+ hours
- Average Readiness: 85+

## Technical Notes

### Performance
- Lightweight localStorage operations (< 1KB data)
- Efficient progress calculations (O(n) where n = number of days)
- No API calls for goal functionality
- Instant UI updates

### Browser Compatibility
- Uses modern JavaScript (ES6+ classes)
- LocalStorage API (supported by all modern browsers)
- CSS Grid and Flexbox layouts
- Graceful degradation for older browsers

### Accessibility
- Semantic HTML structure
- Keyboard navigation support for modal
- Clear labels and ARIA attributes
- High contrast color choices
- Large touch targets for mobile

## Success Metrics

Track these to measure feature adoption:
- % of users who set at least one goal
- Average number of goals set per user
- Goal completion rates
- User retention after setting goals
- Time spent on dashboard with vs without goals

---

**Version**: 1.0.0  
**Release Date**: December 31, 2025  
**Author**: RestToRun Team

