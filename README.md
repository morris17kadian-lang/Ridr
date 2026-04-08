# Ridr

Expo mobile app scaffolded in this folder and prepared to use Firebase as the backend.

## Stack

- Expo SDK 54
- React Native 0.81
- TypeScript
- Firebase Auth currently disabled for styling
- Cloud Firestore
- Firebase Storage

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Paste in your Firebase web app credentials from the Firebase console.
3. Start the app:

```bash
npm start
```

## Logo file

Use `assets/ridr-logo.png` for your main logo file. The current UI still points at the existing Expo icon until that file is added.

## Firebase backend files

- `firebase.json` wires local Firebase config files together.
- `firestore.rules` locks data to authenticated users under `/users/{uid}`.
- `storage.rules` locks storage paths to authenticated users under `/users/{uid}`.

## Recommended next work

- Enable Email/Password, Google, or phone auth in Firebase Authentication.
- Create your first Firestore collections under each user's document path.
- Add feature screens on top of the starter dashboard in `App.tsx`.