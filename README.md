# Commonroom Community

Commonroom is a live community site backed by Firebase Authentication and Realtime Database. Open `index.html` through `http://localhost` or the hosted site; Firebase sign-in does not work from a `file://` URL.

## Community features

- Email and password account creation, sign-in, sign-out, and password reset
- Guest browsing, posts, replies, likes, and saves without an account or time limit
- Guest-to-account conversion that keeps the same Firebase user ID and existing posts
- Case-insensitive unique display-name reservations, including the one-time creator admin name `Ⓖ THE Creator Ⓖ`
- Live posts and replies, with owner edits/deletes and admin moderation
- Search, topic spaces, following and saved feeds, member directory, and reporting

## Firebase project setup

The page is configured for Firebase project `guidelines-community`. Confirm the `databaseURL` value in `index.html` matches the URL shown at the top of Realtime Database → Data. It currently uses `europe-west1`, matching the prior site's region; replace it if the new database uses another region.

In Firebase Console → Authentication → Sign-in method, enable **Email/Password** and **Anonymous**. Add `localhost` and the hosted site domain under Authentication → Settings → Authorized domains. Firebase setup references: [Email and password authentication](https://firebase.google.com/docs/auth/web/password-auth) and [Anonymous authentication](https://firebase.google.com/docs/auth/web/anonymous-auth).

Anonymous visitors can keep using the community without a time limit. Linking an email/password account preserves the same Firebase user ID and posts, and makes the account available when signing in on another device.

## Become the admin

Create an email/password account with this exact display name: `Ⓖ THE Creator Ⓖ`. The first account to reserve that name becomes admin automatically. If you are already using a guest session, create the account from that session to keep its posts. The name and admin claim are one-time reservations; if someone else has already claimed the name, sign in to that account. The claim is stored at `/communityConfig/adminUid`.

## Deploy database rules

The committed rules protect posts, comments, display-name claims, profiles, reports, and the admin claim. To deploy them with the Firebase CLI, sign in to the CLI with an account that has access to `guidelines-community`, then run this from this folder:

```powershell
firebase deploy --only database
```

You can also copy `database.rules.json` into Firebase Console → Realtime Database → Rules and publish it there. Publishing requires a Google account with access to `guidelines-community`.

To serve the site locally, run this in PowerShell from this folder:

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

Then open `http://localhost:8000/index.html` and leave the PowerShell window running.
