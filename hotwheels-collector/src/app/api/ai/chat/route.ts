import { NextRequest, NextResponse } from 'next/server';
import { chatWithBot } from '@/features/ai/chatbot.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'message is required and must be a string' },
        { status: 400 }
      );
    }

    const result = await chatWithBot(message, history || []);

    if (!result) {
      return NextResponse.json(
        { error: 'Chatbot unavailable' },
        { status: 503 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}




