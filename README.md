# 🏃‍♀️ RunVibe

A simple and efficient web app for tracking running laps during races, training sessions, and group fitness activities.

## Features

- ✨ Create running sessions with custom lap counts
- 👥 Add multiple participants
- 🏁 Start/stop race functionality
- 📊 Real-time lap tracking with progress bars
- 🏆 Automatic sorting by lap count (ascending)
- 📱 Mobile-friendly responsive design
- 🔗 Shareable session links
- 💾 Persistent data storage with Vercel Blob
- 🎯 Final results display

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Storage**: Vercel Blob Storage
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd runvibe
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment on Vercel

### 1. Connect Vercel Blob Storage

1. Go to your Vercel dashboard
2. Create a new project from your RunVibe repository
3. Go to your project settings
4. Navigate to the "Storage" tab
5. Create a new Blob store
6. Copy the environment variables and add them to your project

### 2. Deploy

The app will automatically deploy when you push to your main branch. Vercel will:
- Build the Next.js application
- Set up the Blob storage
- Provide you with a production URL

### 3. Environment Variables

Make sure these are set in your Vercel project:
- `BLOB_READ_WRITE_TOKEN` - Provided by Vercel Blob

## Usage

### Creating a Session

1. Enter a session name (e.g., "Morning 5K Run")
2. Set the total number of laps
3. Add participant names
4. Click "Create Session"

### During the Race

1. Click "🏁 Start Race" when ready
2. Use "+1 Lap" buttons to track completed laps
3. Use "Finish" button when a participant is done
4. Share the session link with others for real-time viewing

### After the Race

- View final results automatically when all participants finish
- Results are sorted by lap completion (least to most)
- Data persists for future reference

## API Endpoints

- `POST /api/sessions` - Create a new session
- `GET /api/sessions/[id]` - Get session data
- `PUT /api/sessions/[id]` - Update session (start/finish)
- `PUT /api/participants` - Update participant lap count

## Project Structure

```
src/
├── app/
│   ├── api/                 # API routes
│   ├── session/[id]/        # Session tracking page
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
└── types/
    └── index.ts             # TypeScript types
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for your running events!

---

Made with ❤️ for runners everywhere 🏃‍♂️🏃‍♀️
