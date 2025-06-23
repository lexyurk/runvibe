import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { RunSession, UpdateParticipantRequest } from '@/types';

// Helper function to fetch session from Vercel Blob
async function fetchSession(sessionId: string): Promise<RunSession | null> {
  try {
    // Use blob URL directly for Vercel Blob storage
    const blobUrl = `https://blob.vercel-storage.com/sessions/${sessionId}.json`;
    const response = await fetch(blobUrl);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching session:', error);
    return null;
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body: UpdateParticipantRequest = await request.json();
    const { sessionId, participantId, action } = body;

    const session = await fetchSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Find and update participant
    const participantIndex = session.participants.findIndex(p => p.id === participantId);
    if (participantIndex === -1) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const participant = session.participants[participantIndex];

    if (action === 'addLap') {
      // Add a lap if not already finished and hasn't reached total laps
      if (!participant.finished && participant.lapsCompleted < session.totalLaps) {
        participant.lapsCompleted += 1;
        
        // Mark as finished if reached total laps
        if (participant.lapsCompleted >= session.totalLaps) {
          participant.finished = true;
        }
      }
    } else if (action === 'finish') {
      participant.finished = true;
    }

    // Check if all participants are finished
    const allFinished = session.participants.every(p => p.finished);
    if (allFinished && session.status === 'running') {
      session.status = 'finished';
      session.endTime = new Date().toISOString();
    }

    // Store updated session
    await put(`sessions/${sessionId}.json`, JSON.stringify(session), {
      access: 'public',
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error updating participant:', error);
    return NextResponse.json({ error: 'Failed to update participant' }, { status: 500 });
  }
} 