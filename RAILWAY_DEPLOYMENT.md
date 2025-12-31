# Railway Deployment Guide

## Quick Start: Deploy RestToRun to Railway

### Prerequisites
- GitHub account
- Railway account (sign up at https://railway.app - free $5/month credit)
- Strava API application (already set up)
- Oura API application (already set up)

---

## Step 1: Prepare Your Repository

Your code is already on GitHub at: `https://github.com/dereklin23/RestToRun.git`

✅ Repository is ready for deployment!

---

## Step 2: Deploy to Railway

### 2.1 Create a New Project

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select the **`RestToRun`** repository
6. Railway will automatically detect it's a Node.js app and start deploying

### 2.2 Add Redis Database

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"Redis"**
3. Railway will automatically create a Redis instance and add `REDIS_URL` to your environment variables

---

## Step 3: Configure Environment Variables

1. In your Railway project, click on your service (the one with your app)
2. Go to the **"Variables"** tab
3. Add these environment variables:

```
NODE_ENV=production
SESSION_SECRET=your-super-secret-session-key-change-this-to-something-random

# Strava OAuth
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_REDIRECT_URI=https://YOUR-RAILWAY-DOMAIN.railway.app/auth/strava/callback

# Oura OAuth
OURA_CLIENT_ID=your_oura_client_id
OURA_CLIENT_SECRET=your_oura_client_secret
OURA_REDIRECT_URI=https://YOUR-RAILWAY-DOMAIN.railway.app/auth/oura/callback
```

**Note:** Railway will provide your domain after the first deployment. Look for it in the **"Settings"** → **"Domains"** section.

### Generate a Session Secret

Run this command to generate a secure session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4: Get Your Railway Domain

1. Go to your Railway project
2. Click on your service
3. Go to **"Settings"** → **"Domains"**
4. Click **"Generate Domain"**
5. You'll get a free subdomain like: `resttorun-production.up.railway.app`

Copy this domain - you'll need it for the next step!

---

## Step 5: Update OAuth Redirect URIs

### Strava API Settings

1. Go to https://www.strava.com/settings/api
2. Find your application
3. Update **"Authorization Callback Domain"** to your Railway domain:
   ```
   your-app-name.up.railway.app
   ```
4. Save changes

### Oura API Settings

1. Go to https://cloud.ouraring.com/oauth/applications
2. Select your application
3. Update the **"Redirect URI"** to:
   ```
   https://your-app-name.up.railway.app/auth/oura/callback
   ```
4. Save changes

---

## Step 6: Update Environment Variables with Real Domain

1. Go back to Railway → Your project → Variables
2. Update these variables with your actual Railway domain:
   ```
   STRAVA_REDIRECT_URI=https://your-app-name.up.railway.app/auth/strava/callback
   OURA_REDIRECT_URI=https://your-app-name.up.railway.app/auth/oura/callback
   ```
3. Railway will automatically redeploy your app

---

## Step 7: Test Your Deployment

1. Visit your Railway domain: `https://your-app-name.up.railway.app`
2. You should see the login page
3. Click **"Connect with Strava"** and **"Connect with Oura"**
4. Complete the OAuth flow for both services
5. You should see your dashboard with your data!

---

## Step 8 (Optional): Connect Custom Domain

Want to use `resttorun.com` instead of the Railway subdomain?

### Purchase Domain
1. Buy `resttorun.com` from a domain registrar:
   - Namecheap (~$10/year)
   - Google Domains (~$12/year)
   - Cloudflare (~$10/year)

### Connect to Railway
1. In Railway, go to **Settings** → **Domains**
2. Click **"Custom Domain"**
3. Enter `resttorun.com`
4. Railway will give you DNS records to add
5. Go to your domain registrar and add the DNS records:
   ```
   Type: CNAME
   Name: @ (or leave blank)
   Value: [provided by Railway]
   ```
6. Wait 5-60 minutes for DNS to propagate

### Update OAuth Redirect URIs Again
1. Update Strava and Oura redirect URIs to use `resttorun.com`
2. Update Railway environment variables to use `resttorun.com`

---

## Troubleshooting

### App Won't Start
- Check logs in Railway dashboard
- Ensure all environment variables are set correctly
- Make sure Redis is connected

### OAuth Errors
- Verify redirect URIs match exactly in Strava/Oura settings
- Check that domains don't have trailing slashes
- Ensure HTTPS is used in production

### Session Issues
- Make sure Redis is connected (check logs for `[REDIS] [INFO] Connected to Redis`)
- Verify `SESSION_SECRET` is set

### Data Not Loading
- Check that OAuth tokens are being stored correctly
- Verify Strava and Oura API credentials
- Check browser console for errors

---

## Monitoring & Maintenance

### View Logs
- In Railway dashboard → Your service → **"Logs"** tab
- Filter by severity to find errors

### Usage & Costs
- Railway free tier: $5 credit/month
- Monitor usage in **"Usage"** tab
- Typical small app: ~$3-4/month (within free tier)

### Restart Service
- If something goes wrong: Railway dashboard → Service → **"Settings"** → **"Restart"**

---

## Your URLs

After deployment, you'll have:

- **Development:** http://localhost:3000
- **Production (Railway):** https://your-app-name.up.railway.app
- **Production (Custom):** https://resttorun.com (after domain setup)

---

## Security Checklist

✅ Use strong `SESSION_SECRET` (32+ random characters)  
✅ Set `NODE_ENV=production` in Railway  
✅ Use HTTPS (Railway provides this automatically)  
✅ Keep `.env` in `.gitignore` (already done)  
✅ Use Redis for sessions in production (configured)  
✅ Secure cookies enabled in production (configured)

---

## Need Help?

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Strava API Docs:** https://developers.strava.com
- **Oura API Docs:** https://cloud.ouraring.com/docs

---

Enjoy your deployed RestToRun app! 🚀

