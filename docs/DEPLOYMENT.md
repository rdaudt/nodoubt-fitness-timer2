# HIIT Timer - Deployment Guide

---

## 1. Hosting Platform

**Provider:** Vercel  
**Plan:** Hobby (free tier) - for initial development and personal/demo use  
**URL:** https://vercel.com

---

## 2. Architecture Fit

This app is primarily a client-side PWA with IndexedDB persistence, plus one serverless API endpoint for IG image generation.

- Static frontend bundle served by Vercel CDN
- One server-side API route: `/api/generate-ig-image`
- No app-managed database backend

This remains a lightweight fit for Vercel.

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

---

## 4. Commercial Use Restriction

The Vercel Hobby plan is restricted to non-commercial, personal use only. If this app is:

- Deployed for clients
- Used as part of a paid consulting engagement
- Monetized in any form

...then the Pro plan ($20/user/month) is required.

---

## 5. Deployment Setup

### Prerequisites
- Vercel account
- Git repository connected to Vercel
- Node.js installed locally

### Steps

1. **Connect repository to Vercel**
   - Import the project repo from Vercel dashboard.
2. **Build configuration**
   - Build command: `npm run build`
   - Output directory: `dist`
3. **Deploy**
   - Push to main for production deployment.
   - Pull requests get preview URLs.

---

## 6. Environment Variables

Required for IG generation API:

- `OPENAI_API_KEY` - used only on the server by `/api/generate-ig-image`

Set in:
**Vercel Dashboard -> Project -> Settings -> Environment Variables**

Local development note:

- Use `.env.local` with `OPENAI_API_KEY=...` when running Vercel server runtime locally.
- Do not expose this secret as `VITE_*`.

---

## 7. Upgrade Path

| Stage | Plan | Trigger |
|---|---|---|
| Development & personal demo | Hobby (free) | Default starting point |
| Client-facing or commercial use | Pro ($20/month) | Any commercial deployment |
| Team collaboration | Pro | Multiple developers on the project |

---

Update this document when deployment target or plan changes.
