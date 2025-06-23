import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { RunSession } from '@/types';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await fetchSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await fetchSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updates = await request.json();
    const updatedSession = { ...session, ...updates };

    // Store updated session in Vercel Blob
    await put(`sessions/${id}.json`, JSON.stringify(updatedSession), {
      access: 'public',
    });

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
} 