# AI Agent Coordination Guide: COMPCHEM Platform

Welcome, fellow AI. This document explains the architecture, design philosophy, and data management of the COMPCHEM laboratory platform.

## 🚀 Tech Stack
- **Frontend**: React (Vite)
- **Database**: Firebase Firestore (Real-time)
- **Icons**: Lucide-React
- **Molecular Rendering**: Smiles-Drawer
- **Styling**: Vanilla CSS (`index.css`)
- **Authentication**: Custom AuthContext with session-based persistence and bcrypt hashing.

## 🔗 Repository & Deployment
- **GitHub Repository**: [https://github.com/scicomm-superbugs/Portal](https://github.com/scicomm-superbugs/Portal)
- **Live Website**: [https://scicomm-superbugs.github.io/Portal/](https://scicomm-superbugs.github.io/Portal/)
- **Automation**: Managed via `.github/workflows/deploy.yml`.

## 📂 Project Structure & Key Directories
- `src/pages/`: All page components (Dashboard, Chemicals, etc.)
- `src/components/`: Reusable UI elements (SmilesViewer, Layout)
- `src/context/`: Authentication and Global State
- `src/utils/`: Helper functions (CSV parsing, formatting)
- `src/db.js`: **Critical Connection File.** (Firebase Config & DAO)
- `public/`: Static assets (Logos, Icons)

## 🌐 Database Connection
- **Provider**: Google Firebase (Firestore).
- **Online Database**: The connection is established using the `firebaseConfig` found in `/src/db.js`.
- **Zero Config**: No additional environment variables or setup is needed for the database; the API keys are hardcoded in `db.js` for seamless coordination between agents.

## 💾 Data Layer (db.js)
The database uses a standardized `db` object to prevent direct Firestore calls in components. 
- **Real-time Data**: Use the `useLiveCollection(collectionName)` hook.
- **Mutations**: Use `db.collectionName.add()`, `.update()`, or `.delete()`.
- **Collections**: `scientists`, `chemicals`, `usage_logs`, `devices`, `tasks`, `messages`.

## 🎨 Design Philosophy
The user has requested a specific mix:
1.  **Professional Core**: All functional pages (Chemicals, Devices, Tracking, Profile) must look premium, clean, and corporate. Avoid emojis in buttons or headers. Use monotone Lucide icons.
2.  **Funny Leaderboard**: The **Leaderboard section on the Dashboard** is the only place allowed to be playful. It uses gamified ranks (e.g., "Beaker Breaker", "Lab Rat") and emojis.
3.  **Molecular Graphics**: Always include chemical structure previews where possible using the SMILES data.

## 📱 Responsiveness
The app uses a custom `Layout.jsx` with:
- **Desktop**: Standard top navigation header.
- **Mobile**: A native-feeling bottom tab bar (Home, Register, Chat, Team, Profile).
- **Cards**: Avoid tables. Use the `.mobile-card-list` and `.mobile-list-item` CSS classes for data displays.

## 🛠 Maintenance
- Always run `npm run build` after major changes to verify the Vite bundle.
- Ensure any new interactive elements have unique IDs for testing.
- When adding new chemicals or devices, maintain the CSV import/export capability.

## 🔑 Login for Debugging
- **Master Admin**: `master` / `master123`
- **System Admin**: `admin` / `admin123`

## 🏢 Multi-Tenant Architecture (New)
The platform now supports a multi-tenant environment (Science Communication & Research Hub). 
- **Workspaces**: Currently supports `compchem` (COMPCHEM Laboratory) and `alamein` (Alamein International University, also aliased as `aiu`).
- **Persistence**: The active workspace is stored in `localStorage` under `workspaceId`.
- **Portal Page**: The root component `/portal` features an interactive, glassmorphism 3D-card interface to select the workspace.
- **Direct Workspace URLs**: Users can bypass the portal using direct routing:
  - `/#/compchem/login` or `/#/compchem/register`
  - `/#/aiu/login` or `/#/aiu/register`
- **Dynamic Theming & Branding**: 
  - `Layout.jsx` dynamically loads the specific tenant's logo (`alamein_logo_2.png` or `compchem_logo_2.png`) and updates the footer.
  - The browser tab title `document.title` dynamically updates to match the active workspace.
  - The header layout (`.header-content`) utilizes a balanced flex design (`justify-content: flex-start`, `.nav-links` takes `flex: 1`, and `.user-controls` uses `margin-left: auto`) to ensure perfect alignment of navigation items and user controls regardless of user role.

## 📱 Android App Build
- **Environment**: Use JDK 17 and Android SDK.
- **Java Compatibility**: The project is forced to use `JavaVersion.VERSION_17` via `afterEvaluate` in the root `android/build.gradle` to resolve compatibility issues with Capacitor 7+ defaults (which target Java 21).
- **Build Command**:
  ```powershell
  $env:JAVA_HOME = "D:\Ai Projects\compchem\jdk17\jdk-17.0.8.1+1"
  $env:ANDROID_HOME = "D:\Ai Projects\compchem\Android App Build\tools\android-sdk"
  ./gradlew assembleDebug
  ```
- **Output**: The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.
- **Package Name**: `com.chompchem.app` (SciComm Hub).

