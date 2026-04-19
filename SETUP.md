# Good Neighbors – Setup Guide

Complete setup from zero to production on Vercel + Neon.

---

## 1. Create a Neon Database

1. Go to [neon.tech](https://neon.tech) and sign up / sign in.
2. Click **New Project**, name it `good-neighbors` (or anything), choose a region close to your users (e.g. `us-east-2`).
3. Once created, go to **Connection Details** → select **Pooled connection** and copy the connection string. It looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep this tab open — you'll need the string in steps below.

---

## 2. Apply the Database Schema

Open the **Neon SQL Editor** (left sidebar → SQL Editor) and paste the entire contents of `db/schema.sql`, then click **Run**.

This creates all 28 tables. You should see no errors.

---

## 3. Set Up Environment Variables Locally

Copy the example file:
```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxx   # see step 5
COOKIE_SECRET=some-long-random-string-change-this
APP_URL=http://localhost:3000
```

Generate a strong `COOKIE_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Install Dependencies

```bash
npm install
```

---

## 5. Create a Vercel Blob Store

1. Go to your [Vercel dashboard](https://vercel.com/dashboard).
2. Open your project (or create a new one linked to this repo).
3. Go to **Storage** → **Create Database** → choose **Blob**.
4. Name it anything (e.g. `good-neighbors-blob`), click **Create**.
5. Go to the Blob store → **Settings** → copy the `BLOB_READ_WRITE_TOKEN`.
6. Add it to your local `.env` file.

> **Local dev note:** If `BLOB_READ_WRITE_TOKEN` is missing, the server falls back to storing base64 data URLs in-memory (fine for dev, not for prod).

---

## 6. Seed the Super-Admin

Run this once after the schema is applied:

```bash
npm run seed
```

This creates:
- **Email:** costablancavillaspanama@gmail.com  
- **Username:** admin  
- **Password:** Paintball$1  
- **Role:** admin (super admin with all privileges)

The seed is idempotent — safe to re-run if you need to reset the admin password.

---

## 7. Run Locally

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

---

## 8. Deploy to Vercel

### First deploy
```bash
npm install -g vercel   # if not already installed
vercel
```
Follow the prompts to link or create a Vercel project.

### Set environment variables on Vercel

In your Vercel project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon pooled connection string |
| `BLOB_READ_WRITE_TOKEN` | From your Blob store |
| `COOKIE_SECRET` | Same long random string as local |
| `APP_URL` | `https://your-app.vercel.app` (your production URL) |

### Subsequent deploys
```bash
vercel --prod
```
Or push to your main branch if you've connected the GitHub repo in Vercel.

---

## 9. Email (Forgot Password + HOA Alerts)

The app uses Gmail via Nodemailer. Configure in the Admin panel under **Settings**, or set directly in the `app_settings` table:

```sql
INSERT INTO app_settings (key, value) VALUES
  ('gmail_user', 'your@gmail.com'),
  ('gmail_pass', 'your-app-password');
```

Use a [Gmail App Password](https://support.google.com/accounts/answer/185833) (not your regular Gmail password). Enable 2FA on the account first, then generate an App Password under **Security → 2-Step Verification → App passwords**.

---

## 10. Post-Deploy Checklist

- [ ] Schema applied in Neon SQL Editor
- [ ] `npm run seed` completed successfully
- [ ] All 4 environment variables set in Vercel
- [ ] Test login with admin credentials
- [ ] Test user registration
- [ ] Test forgot-password email flow
- [ ] Upload an avatar (tests Vercel Blob)
