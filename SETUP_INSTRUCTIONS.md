# Quick Setup Instructions for RestToRun OAuth

## ✅ Step 1: Session Secret (DONE!)
Your session secret has been generated: `I8WoU89QtZiBhH2l+sDqo1R1mCQZAodRB1lyFMxWFzQ=`

## 🏃 Step 2: Set Up Strava OAuth

### Open Strava API Settings:
**URL:** https://www.strava.com/settings/api

### Create or Update Your Application:

1. **If you don't have an app yet:**
   - Click "Create New Application"
   
2. **Fill in the form:**
   - **Application Name:** RestToRun
   - **Category:** Training
   - **Club:** Leave blank
   - **Website:** http://localhost:3000
   - **Application Description:** Personal fitness dashboard combining Strava and Oura data
   - **Authorization Callback Domain:** `localhost` (just the word "localhost", no http://)

3. **After creating/updating:**
   - Copy your **Client ID** (a number)
   - Copy your **Client Secret** (a long string)
   - Save these - you'll need them in Step 4!

### Important Notes:
- The callback domain should be just `localhost` (not a full URL)
- For production, you'll add your actual domain here later

---

## 💤 Step 3: Set Up Oura OAuth

### Open Oura OAuth Applications:
**URL:** https://cloud.ouraring.com/oauth/applications

### Create Your Application:

1. **Click "Create New Application"**

2. **Fill in the form:**
   - **Name:** RestToRun
   - **Redirect URI:** `http://localhost:3000/auth/oura/callback`
   - **Description:** Personal fitness dashboard (optional)

3. **After creating:**
   - Copy your **Client ID**
   - Copy your **Client Secret**
   - Save these - you'll need them in Step 4!

### Important Notes:
- The redirect URI must be EXACTLY: `http://localhost:3000/auth/oura/callback`
- Include the full URL with http:// and the path
- For production, you'll add your production URL later

---

## 📝 Step 4: Update Your .env File

1. **Copy the template:**
   ```bash
   cp .env.template .env
   ```

2. **Edit .env and replace these values:**
   ```bash
   # Strava (from Step 2)
   STRAVA_CLIENT_ID=12345  # Your actual Client ID
   STRAVA_CLIENT_SECRET=abc123def456  # Your actual Client Secret
   
   # Oura (from Step 3)
   OURA_CLIENT_ID=YOUR_OURA_CLIENT_ID
   OURA_CLIENT_SECRET=YOUR_OURA_CLIENT_SECRET
   ```

3. **Keep the SESSION_SECRET as is** - it's already generated!

---

## 🚀 Step 5: Start the Server

```bash
npm start
```

You should see:
```
[INFO] Server running at http://localhost:3000
[INFO] Make sure to set up your OAuth apps and update .env file
```

---

## 🎯 Step 6: Test the Login

1. **Open your browser:** http://localhost:3000
2. **You'll see the login page** with two Connect buttons
3. **Click "Connect Strava":**
   - You'll be redirected to Strava
   - Click "Authorize"
   - You'll be redirected back
   - Status should show "Connected" ✅
4. **Click "Connect Oura":**
   - You'll be redirected to Oura
   - Click "Authorize"
   - You'll be redirected back
   - Status should show "Connected" ✅
5. **Click "Go to Dashboard"** - You're in! 🎉

---

## 🐛 Troubleshooting

### Strava Authorization Fails
- Check that Authorization Callback Domain is exactly: `localhost`
- Verify your Client ID and Secret are correct in .env
- Make sure there are no extra spaces in your .env file

### Oura Authorization Fails
- Check that Redirect URI is exactly: `http://localhost:3000/auth/oura/callback`
- Verify your Client ID and Secret are correct in .env
- Make sure the URI includes http:// and the full path

### "Both accounts must be connected" message persists
- Check browser console for errors (F12)
- Verify both services show "Connected" status
- Try clearing cookies and reconnecting

### Server won't start
- Make sure port 3000 is not already in use
- Check that all dependencies are installed: `npm install`
- Verify .env file exists and has all required values

---

## 📚 Need More Help?

See the full documentation in `OAUTH_SETUP.md` for:
- Detailed explanations
- Production deployment guide
- API reference
- Advanced troubleshooting

---

## ✨ Quick Reference

**Strava API Settings:** https://www.strava.com/settings/api
**Oura OAuth Apps:** https://cloud.ouraring.com/oauth/applications
**Your App URL:** http://localhost:3000

**Session Secret (already set):** `I8WoU89QtZiBhH2l+sDqo1R1mCQZAodRB1lyFMxWFzQ=`

