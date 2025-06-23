import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';
import { RunSession, Participant } from '@/types';

// Helper function to fetch session from Vercel Blob
async function fetchSession(sessionId: string): Promise<RunSession | null> {
  try {
    // Use Vercel Blob list API to find the session file
    const { blobs } = await list({
      prefix: `sessions/${sessionId}.json`,
      limit: 1,
    });
    
    if (blobs.length === 0) {
      return null;
    }
    
    // Fetch the session data from the blob URL
    const response = await fetch(blobs[0].url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching session:', error);
    return null;
  }
}

interface SyncRequest {
  sessionId: string;
  participants: Participant[];
  status: 'setup' | 'running' | 'finished';
  endTime?: string;
}

export async function PUT(request: NextRequest) {
  try {
    const body: SyncRequest = await request.json();
    const { sessionId, participants, status, endTime } = body;
    
    console.log('Session sync: sessionId:', sessionId, 'status:', status);
    console.log('Session sync: participants:', participants.map(p => ({ id: p.id, name: p.name, laps: p.lapsCompleted, finished: p.finished })));

    // Fetch current session to preserve other data
    const currentSession = await fetchSession(sessionId);
    if (!currentSession) {
      console.log('Session sync: Session not found');
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update session with new participant data and status
    const updatedSession: RunSession = {
      ...currentSession,
      participants,
      status,
      endTime: endTime || currentSession.endTime,
    };

    console.log('Session sync: Saving updated session with', participants.length, 'participants');

    // Store updated session in Vercel Blob
    await put(`sessions/${sessionId}.json`, JSON.stringify(updatedSession), {
      access: 'public',
      allowOverwrite: true,
    });

    console.log('Session sync: Successfully saved to blob storage');

    return NextResponse.json({ success: true, session: updatedSession });
  } catch (error) {
    console.error('Error syncing session:', error);
    return NextResponse.json({ 
      error: 'Failed to sync session',
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 