import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import { RunSession, SessionCreateRequest, Participant } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: SessionCreateRequest = await request.json();
    
    // Create participants
    const participants: Participant[] = body.participantNames.map(name => ({
      id: uuidv4(),
      name,
      lapsCompleted: 0,
      finished: false,
    }));

    // Create session
    const session: RunSession = {
      id: uuidv4(),
      name: body.name,
      totalLaps: body.totalLaps,
      participants,
      status: 'setup',
      createdAt: new Date().toISOString(),
    };

    // Store in Vercel Blob
    await put(`sessions/${session.id}.json`, JSON.stringify(session), {
      access: 'public',
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
} 