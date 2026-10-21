# Commonroom Community

Commonroom is a live community site backed by Firebase Authentication and Realtime Database. Open `index.html` through `http://localhost` or the hosted site; Firebase sign-in does not work from a `file://` URL.

## Community features

- Email and password account creation, sign-in, sign-out, and password reset
- Guest browsing, posts, replies, likes, and saves for 90 days per anonymous Firebase account
- Guest-to-account conversion that keeps the same Firebase user ID and existing posts
- Case-insensitive unique display-name reservations, including the one-time creator admin name `Ⓖ THE Creator Ⓖ`
- Live posts and replies, with owner edits/deletes and admin moderation
- Search, topic spaces, following and saved feeds, member directory, and reporting

## Firebase project setup

The page is configured for Firebase project `guidelines-community`. The Realtime Database URL in `index.html` uses `europe-west1`, matching the prior site's database region. Confirm the new database uses that same region; the exact URL appears at the top of Realtime Database → Data. If Firebase shows a different URL, copy it into the `databaseURL` value in `index.html`.

In Firebase Console → Authentication → Sign-in method, enable **Email/Password** and **Anonymous**. Add `localhost` and the hosted site domain under Authentication → Settings → Authorized domains. Firebase setup references: [Email and password authentication](https://firebase.google.com/docs/auth/web/password-auth) and [Anonymous authentication](https://firebase.google.com/docs/auth/web/anonymous-auth).

The 90-day deadline is checked in the database rules against Firebase's server-issued anonymous sign-in time, so changing the computer clock does not extend a guest account. A browser that clears its Firebase data can receive a new anonymous ID and therefore a new trial; anonymous sign-in cannot reliably identify the same person across cleared browsers or devices. Linking an email/password account preserves that guest ID and removes the guest expiration.

## Deploy database rules

The committed rules protect posts, comments, display-name claims, profiles, reports, and the admin claim. To deploy them with the Firebase CLI, sign in to the CLI with an account that has access to `guidelines-community`, then run this from this folder:

```powershell
firebase deploy --only database
```

You can also copy `database.rules.json` into Firebase Console → Realtime Database → Rules and publish it there. The Firebase Console account currently open in the browser reports that it cannot access this project, so cloud deployment and confirmation of the database region still need an account with access.

To serve the site locally, run this in PowerShell from this folder:

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

Then open `http://localhost:8000/index.html` and leave the PowerShell window running.
