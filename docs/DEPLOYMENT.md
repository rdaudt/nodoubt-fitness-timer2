# HIIT Timer — Deployment Guide

---

## 1. Hosting Platform

**Provider:** Vercel  
**Plan:** Hobby (free tier) — for initial development and personal/demo use  
**URL:** https://vercel.com

---

## 2. Architecture Fit

This app is a fully client-side PWA with no backend. All data is stored in IndexedDB on the user's device. This makes it an ideal fit for Vercel's static deployment model:

- No serverless functions required
- No API routes
- No database or backend services
- Entire app is built as a static bundle and served via Vercel's global CDN

This means the app will stay well within all Hobby tier limits regardless of usage volume.

---

## 3. Hobby Plan Limits (as of 2026)

| Resource | Hobby Limit |
|---|---|
| Fast Data Transfer | 100 GB/month |
| Edge Requests | 1M/month |
| Deployments | 100/day |
| Build duration | 45 minutes max |
| Source upload size | 100 MB |
| Runtime logs retention | 1 hour |
| Custom domains | Supported |
| Automatic SSL | Included |
| CI/CD (Git integration) | Included |

For a static PWA with no server-side compute, none of these limits are realistically at risk of being hit during development or early-stage use.

---

## 4. ⚠️ Commercial Use Restriction

The Vercel Hobby plan is **restricted to non-commercial, personal use only**. If this app is:

- Deployed for clients
- Used as part of a paid consulting engagement
- Monetized in any form

…then the **Pro plan ($20/user/month) is required**. Violating the Hobby plan terms of service can result in account suspension.

**Recommended path:** Use Hobby for development, prototyping, and personal demos. Upgrade to Pro before any client-facing or commercial deployment.

---

## 5. Deployment Setup

### Prerequisites
- Vercel account (free at vercel.com)
- GitHub (or GitLab / Bitbucket) repository for the project
- Node.js installed locally

### Steps

1. **Connect repository to Vercel**
   - Import the project repo from the Vercel dashboard
   - Vercel auto-detects the framework (e.g., Vite, Next.js) and configures the build

2. **Build configuration** (set in Vercel dashboard or `vercel.json`)
   - Build command: `npm run build` (or framework equivalent)
   - Output directory: `dist` (Vite) or `.next` (Next.js)

3. **PWA configuration**
   - Ensure the service worker and `manifest.json` are included in the build output
   - Verify the app registers the service worker correctly in production (service workers require HTTPS, which Vercel provides automatically)

4. **Custom domain** (optional)
   - Add a custom domain from the Vercel project settings
   - SSL is provisioned automatically

5. **Deploy**
   - Every push to the main branch triggers an automatic production deployment
   - Pull request branches get automatic preview URLs

---

## 6. Environment Variables

This app has no backend and requires no environment variables for v1.

If environment variables are added in future (e.g., analytics keys), they are configured in:  
**Vercel Dashboard → Project → Settings → Environment Variables**

---

## 7. Upgrade Path

| Stage | Plan | Trigger |
|---|---|---|
| Development & personal demo | Hobby (free) | Default starting point |
| Client-facing or commercial use | Pro ($20/month) | Any commercial deployment |
| Team collaboration | Pro | Multiple developers on the project |

---

*Update this document when the deployment target or plan changes.*
